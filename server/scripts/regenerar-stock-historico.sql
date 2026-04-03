-- Regenerar movimientos de stock historicos desde comandas + takeaway
-- Ejecutar en clubix_db como tenant_id=1

-- Movimientos desde comandas cerradas
WITH items_con_variante AS (
  SELECT
    ic.cantidad,
    pv.id AS variante_id,
    c.hora_cierre AS fecha,
    'Venta Buffet - Comanda ' || c.numero AS concepto
  FROM items_comanda ic
  JOIN comandas c ON c.id = ic.comanda_id
  JOIN productos_buffet pb ON pb.id = ic.producto_buffet_id
  JOIN producto_variantes pv ON pv.producto_id = pb.producto_id AND pv.talle = 'UNICA'
  WHERE ic.tenant_id = 1
    AND ic.estado != 'ANULADO'
    AND c.estado = 'CERRADA'
),
acumulado AS (
  SELECT
    variante_id,
    fecha,
    concepto,
    cantidad,
    SUM(cantidad) OVER (PARTITION BY variante_id ORDER BY fecha ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS total_egresado
  FROM items_con_variante
)
INSERT INTO movimientos_stock (producto_variante_id, fecha, tipo, cantidad, stock_anterior, stock_posterior, concepto, registrado_por, tenant_id)
SELECT
  variante_id,
  fecha,
  'EGRESO',
  cantidad,
  -(total_egresado - cantidad),
  -total_egresado,
  concepto,
  1,
  1
FROM acumulado;

-- Movimientos desde takeaway pagados/entregados
WITH items_ta AS (
  SELECT
    ipt.cantidad,
    pv.id AS variante_id,
    pt.hora_pagado AS fecha,
    'TakeAway - Pedido ' || pt.numero AS concepto
  FROM items_pedido_takeaway ipt
  JOIN pedidos_takeaway pt ON pt.id = ipt.pedido_id
  JOIN productos_buffet pb ON pb.id = ipt.producto_buffet_id
  JOIN producto_variantes pv ON pv.producto_id = pb.producto_id AND pv.talle = 'UNICA'
  WHERE ipt.tenant_id = 1
    AND pt.estado IN ('PAGADO', 'ENTREGADO')
    AND pt.hora_pagado IS NOT NULL
),
acumulado_ta AS (
  SELECT
    variante_id,
    fecha,
    concepto,
    cantidad,
    SUM(cantidad) OVER (PARTITION BY variante_id ORDER BY fecha ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS total_egresado
  FROM items_ta
)
INSERT INTO movimientos_stock (producto_variante_id, fecha, tipo, cantidad, stock_anterior, stock_posterior, concepto, registrado_por, tenant_id)
SELECT
  variante_id,
  fecha,
  'EGRESO',
  cantidad,
  -(total_egresado - cantidad),
  -total_egresado,
  concepto,
  1,
  1
FROM acumulado_ta;

-- Actualizar stock_actual de cada variante como 0 - total_egresado
UPDATE producto_variantes pv
SET stock_actual = COALESCE((
  SELECT -SUM(ms.cantidad)
  FROM movimientos_stock ms
  WHERE ms.producto_variante_id = pv.id AND ms.tipo = 'EGRESO'
), 0)
WHERE pv.tenant_id = 1;

-- Resumen
SELECT 'movimientos generados' AS resumen, count(*) FROM movimientos_stock WHERE tenant_id=1
UNION ALL
SELECT 'variantes con stock negativo', count(*) FROM producto_variantes WHERE tenant_id=1 AND stock_actual < 0;
