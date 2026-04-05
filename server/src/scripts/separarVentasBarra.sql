-- =============================================================================
-- Script: separar ventas de barra colapsadas en un solo pedido
-- Cada grupo de movimientos separados >30s = cobro distinto → pedido propio
-- =============================================================================

BEGIN;

-- Paso 1: construir los grupos de cobro con identidad estable
CREATE TEMP TABLE grupos_cobro AS
WITH base AS (
  SELECT
    mc.id AS mov_id,
    mc.pedido_takeaway_id,
    mc.monto,
    mc.fecha,
    EXTRACT(EPOCH FROM (
      mc.fecha - LAG(mc.fecha) OVER (PARTITION BY mc.pedido_takeaway_id ORDER BY mc.fecha)
    )) AS seg_desde_anterior
  FROM movimientos_caja mc
  WHERE mc.anulado = false AND mc.tipo = 'INGRESO'
    AND mc.pedido_takeaway_id IS NOT NULL
),
con_grupo AS (
  SELECT *,
    SUM(CASE WHEN seg_desde_anterior IS NULL OR seg_desde_anterior > 30 THEN 1 ELSE 0 END)
      OVER (PARTITION BY pedido_takeaway_id ORDER BY fecha) AS grupo_num
  FROM base
),
resumen_grupo AS (
  SELECT
    pedido_takeaway_id,
    grupo_num,
    MIN(fecha)  AS hora_grupo,
    SUM(monto)  AS total_grupo
  FROM con_grupo
  GROUP BY pedido_takeaway_id, grupo_num
),
-- Identificar qué grupo es el "original" (más cercano a hora_pagado del pedido)
con_rn AS (
  SELECT rg.*,
    ROW_NUMBER() OVER (
      PARTITION BY rg.pedido_takeaway_id
      ORDER BY ABS(EXTRACT(EPOCH FROM (rg.hora_grupo - pt.hora_pagado)))
    ) AS rn
  FROM resumen_grupo rg
  JOIN pedidos_takeaway pt ON pt.id = rg.pedido_takeaway_id
),
-- Solo pedidos con más de 1 grupo
multi AS (
  SELECT pedido_takeaway_id FROM con_rn GROUP BY pedido_takeaway_id HAVING COUNT(*) > 1
)
SELECT cg.mov_id, cg.pedido_takeaway_id, cg.grupo_num, cg.monto, cg.fecha,
       rn.hora_grupo, rn.total_grupo, rn.rn
FROM con_grupo cg
JOIN con_rn rn ON rn.pedido_takeaway_id = cg.pedido_takeaway_id AND rn.grupo_num = cg.grupo_num
WHERE cg.pedido_takeaway_id IN (SELECT pedido_takeaway_id FROM multi);

-- Paso 2: tabla con los grupos no-originales, lista para insertar pedidos
CREATE TEMP TABLE grupos_nuevos AS
SELECT DISTINCT
  gc.pedido_takeaway_id AS pedido_origen_id,
  gc.grupo_num,
  gc.hora_grupo,
  gc.total_grupo,
  pt.tenant_id,
  pt.numero AS numero_origen
FROM grupos_cobro gc
JOIN pedidos_takeaway pt ON pt.id = gc.pedido_takeaway_id
WHERE gc.rn > 1;  -- Solo los no-originales

-- Agregar columna para el nuevo pedido_id
ALTER TABLE grupos_nuevos ADD COLUMN nuevo_pedido_id INT;

-- Paso 3: insertar los nuevos pedidos y capturar sus IDs
-- Procesamos uno por uno con un numero temporal único
DO $$
DECLARE
  rec RECORD;
  nuevo_id INT;
  seq_diario INT;
  fecha_str TEXT;
  nuevo_numero TEXT;
BEGIN
  FOR rec IN SELECT * FROM grupos_nuevos ORDER BY hora_grupo LOOP
    fecha_str := TO_CHAR(rec.hora_grupo AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYYMMDD');

    -- Generar número único que no colisione: prefijo BR (Barra Reconstruido)
    SELECT COALESCE(MAX(
      CASE WHEN numero ~ ('^BR' || fecha_str || '-[0-9]+$')
           THEN (regexp_match(numero, '[0-9]+$'))[1]::INT
           ELSE 0 END
    ), 0) + 1
    INTO seq_diario
    FROM pedidos_takeaway
    WHERE numero LIKE 'BR' || fecha_str || '-%' AND tenant_id = rec.tenant_id;

    nuevo_numero := 'BR' || fecha_str || '-' || LPAD(seq_diario::TEXT, 4, '0');

    INSERT INTO pedidos_takeaway (
      numero, nombre_cliente, estado, tipo,
      hora_recibido, hora_pagado, hora_entregado,
      subtotal, total, observaciones, es_venta_interna,
      created_at, updated_at, tenant_id
    ) VALUES (
      nuevo_numero,
      'Venta Barra (Reconstruido)',
      'ENTREGADO',
      'BARRA',
      rec.hora_grupo,
      rec.hora_grupo,
      rec.hora_grupo,
      rec.total_grupo,
      rec.total_grupo,
      'Venta reconstruida desde mov. de caja - pedido origen: ' || rec.numero_origen,
      true,
      now(), now(),
      rec.tenant_id
    ) RETURNING id INTO nuevo_id;

    UPDATE grupos_nuevos
    SET nuevo_pedido_id = nuevo_id
    WHERE pedido_origen_id = rec.pedido_origen_id AND grupo_num = rec.grupo_num;
  END LOOP;
END $$;

-- Paso 4: reasignar los movimientos a sus nuevos pedidos
UPDATE movimientos_caja mc
SET pedido_takeaway_id = gn.nuevo_pedido_id
FROM grupos_nuevos gn
JOIN grupos_cobro gc ON gc.pedido_takeaway_id = gn.pedido_origen_id
                     AND gc.grupo_num          = gn.grupo_num
WHERE mc.id = gc.mov_id;

-- Paso 5: corregir total y hora_pagado del pedido original (solo queda su grupo)
UPDATE pedidos_takeaway pt
SET
  total         = sub.total_grupo,
  subtotal      = sub.total_grupo,
  hora_pagado   = sub.hora_grupo,
  hora_entregado = sub.hora_grupo,
  updated_at    = now()
FROM (
  SELECT DISTINCT pedido_takeaway_id, total_grupo, hora_grupo
  FROM grupos_cobro WHERE rn = 1
) sub
WHERE pt.id = sub.pedido_takeaway_id;

-- Verificación final
SELECT 'Nuevos pedidos creados'   AS descripcion, COUNT(*) AS cantidad, SUM(total) AS monto
FROM pedidos_takeaway WHERE observaciones LIKE 'Venta reconstruida%'
UNION ALL
SELECT 'Total ventas 5/4 pedidos', COUNT(*), SUM(pt.total)
FROM pedidos_takeaway pt
WHERE pt.tenant_id = 1
  AND pt.estado IN ('PAGADO','ENTREGADO')
  AND pt.hora_pagado >= '2026-04-05 00:00:00'
  AND pt.hora_pagado < '2026-04-06 00:00:00'
UNION ALL
SELECT 'Movimientos Caja Buffet 5/4', COUNT(*), SUM(mc.monto)
FROM movimientos_caja mc JOIN cajas c ON c.id = mc.caja_id
WHERE c.tenant_id = 1 AND c.para_buffet = true
  AND mc.anulado = false AND mc.tipo = 'INGRESO'
  AND mc.fecha >= '2026-04-05 00:00:00'
  AND mc.fecha < '2026-04-06 00:00:00';

COMMIT;
