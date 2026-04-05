-- =============================================================================
-- Script de reconstrucción de pedidos BARRA huérfanos
-- Crea registros en pedidos_takeaway para movimientos_caja sin pedido vinculado
-- =============================================================================

BEGIN;

-- Paso 1: tabla temporal con los grupos de movimientos huérfanos
CREATE TEMP TABLE orphan_groups AS
SELECT
  c.tenant_id,
  substring(mc.concepto from 'TA[0-9]{8}-[0-9]+') AS numero,
  MIN(mc.fecha) AS hora_recibido,
  SUM(mc.monto) AS total
FROM movimientos_caja mc
JOIN cajas c ON c.id = mc.caja_id
WHERE mc.pedido_takeaway_id IS NULL
  AND mc.concepto LIKE 'Take Away%'
  AND mc.anulado = false
  AND mc.tipo = 'INGRESO'
GROUP BY c.tenant_id, substring(mc.concepto from 'TA[0-9]{8}-[0-9]+');

-- Paso 2: insertar los pedidos que NO existen aún (upsert seguro)
INSERT INTO pedidos_takeaway (
  numero,
  nombre_cliente,
  estado,
  tipo,
  hora_recibido,
  hora_pagado,
  hora_entregado,
  subtotal,
  total,
  observaciones,
  es_venta_interna,
  created_at,
  updated_at,
  tenant_id
)
SELECT
  og.numero,
  'Venta Barra (Reconstruido)' AS nombre_cliente,
  'ENTREGADO' AS estado,
  'BARRA' AS tipo,
  og.hora_recibido,
  og.hora_recibido AS hora_pagado,
  og.hora_recibido AS hora_entregado,
  og.total AS subtotal,
  og.total AS total,
  'Pedido reconstruido a partir de movimientos de caja (historial perdido)' AS observaciones,
  true AS es_venta_interna,
  now() AS created_at,
  now() AS updated_at,
  og.tenant_id
FROM orphan_groups og
WHERE NOT EXISTS (
  SELECT 1 FROM pedidos_takeaway pt
  WHERE pt.tenant_id = og.tenant_id AND pt.numero = og.numero
);

-- Paso 3: vincular los movimientos huérfanos a sus pedidos (existentes o recién creados)
UPDATE movimientos_caja mc
SET pedido_takeaway_id = pt.id
FROM cajas c, pedidos_takeaway pt
WHERE mc.caja_id = c.id
  AND mc.pedido_takeaway_id IS NULL
  AND mc.concepto LIKE 'Take Away%'
  AND mc.anulado = false
  AND mc.tipo = 'INGRESO'
  AND pt.tenant_id = c.tenant_id
  AND pt.numero = substring(mc.concepto from 'TA[0-9]{8}-[0-9]+');

-- Paso 4: actualizar pedidos existentes que recibieron movimientos pero tienen estado incorrecto
-- (pedidos BARRA en RECIBIDO que ya tienen cobros vinculados)
UPDATE pedidos_takeaway pt
SET
  estado = 'ENTREGADO',
  total = sub.suma,
  subtotal = sub.suma,
  hora_pagado = sub.primera_fecha,
  hora_entregado = sub.primera_fecha,
  updated_at = now()
FROM (
  SELECT
    mc.pedido_takeaway_id,
    SUM(mc.monto) as suma,
    MIN(mc.fecha) as primera_fecha
  FROM movimientos_caja mc
  WHERE mc.anulado = false AND mc.tipo = 'INGRESO'
  GROUP BY mc.pedido_takeaway_id
) sub
WHERE pt.id = sub.pedido_takeaway_id
  AND pt.estado NOT IN ('PAGADO', 'ENTREGADO', 'CANCELADO');

-- Verificación final
SELECT
  'Pedidos creados' AS descripcion,
  COUNT(*) AS cantidad,
  SUM(total) AS monto_total
FROM pedidos_takeaway
WHERE observaciones LIKE 'Pedido reconstruido%'
UNION ALL
SELECT
  'Movimientos vinculados' AS descripcion,
  COUNT(*) AS cantidad,
  SUM(monto) AS monto_total
FROM movimientos_caja mc
JOIN pedidos_takeaway pt ON pt.id = mc.pedido_takeaway_id
WHERE pt.observaciones LIKE 'Pedido reconstruido%'
  AND mc.anulado = false AND mc.tipo = 'INGRESO'
UNION ALL
SELECT
  'Movimientos aún huérfanos' AS descripcion,
  COUNT(*) AS cantidad,
  SUM(monto) AS monto_total
FROM movimientos_caja
WHERE pedido_takeaway_id IS NULL
  AND concepto LIKE 'Take Away%'
  AND anulado = false AND tipo = 'INGRESO';

COMMIT;
