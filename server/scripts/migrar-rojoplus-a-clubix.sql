-- =============================================================
-- Migración de datos de rojoplus_db → clubix_db (tenant sportivopilar)
-- Ambas bases en el mismo cluster PostgreSQL puerto 5434
--
-- Ejecutar conectado a clubix_db:
--   psql -p 5434 -U postgres -d clubix_db -f migrar-rojoplus-a-clubix.sql
-- =============================================================

\echo '== Iniciando migración rojoplus_db → clubix_db (sportivopilar) =='

-- Tenant sportivopilar = id 1
\set TENANT_ID 1

-- ── 1. Habilitar dblink ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS dblink;

-- ── 2. Abrir conexión a rojoplus_db ───────────────────────────────────────
SELECT dblink_connect('rojo_conn', 'dbname=rojoplus_db');

-- ── 3. Deshabilitar triggers para FK durante la carga ─────────────────────
SET session_replication_role = replica;

-- ── 4. Borrar datos actuales de sportivopilar (hijos primero) ─────────────
\echo '-- Borrando datos actuales de sportivopilar...'
DELETE FROM opciones_item_comanda   WHERE tenant_id = :TENANT_ID;
DELETE FROM opciones_item_takeaway  WHERE tenant_id = :TENANT_ID;
DELETE FROM items_comanda           WHERE tenant_id = :TENANT_ID;
DELETE FROM items_pedido_takeaway   WHERE tenant_id = :TENANT_ID;
DELETE FROM comandas                WHERE tenant_id = :TENANT_ID;
DELETE FROM pedidos_takeaway        WHERE tenant_id = :TENANT_ID;
DELETE FROM notificaciones_buffet   WHERE tenant_id = :TENANT_ID;
DELETE FROM movimientos_caja        WHERE tenant_id = :TENANT_ID;
DELETE FROM productos_buffet        WHERE tenant_id = :TENANT_ID;
DELETE FROM productos               WHERE tenant_id = :TENANT_ID;
DELETE FROM mesas                   WHERE tenant_id = :TENANT_ID;

-- ── 5. Insertar desde rojoplus_db con tenant_id ────────────────────────────

\echo '-- Insertando mesas...'
INSERT INTO mesas (id, numero, nombre, capacidad, estado, zona, activo, created_at, updated_at, es_comunal, mozo_asignado_id, tenant_id)
SELECT             t.id, t.numero, t.nombre, t.capacidad, t.estado, t.zona, t.activo, t.created_at, t.updated_at, t.es_comunal, t.mozo_asignado_id, :TENANT_ID
FROM dblink('rojo_conn', 'SELECT id, numero, nombre, capacidad, estado, zona, activo, created_at, updated_at, es_comunal, mozo_asignado_id FROM mesas')
  AS t(id int, numero int, nombre text, capacidad int, estado text, zona text, activo bool, created_at timestamptz, updated_at timestamptz, es_comunal bool, mozo_asignado_id int);

\echo '-- Insertando productos...'
INSERT INTO productos (id, codigo, nombre, descripcion, categoria_id, precio_compra, precio_venta, margen, activo, created_at, updated_at, concepto_compra_id, concepto_venta_id, tenant_id)
SELECT                 t.id, t.codigo, t.nombre, t.descripcion, t.categoria_id, t.precio_compra, t.precio_venta, t.margen, t.activo, t.created_at, t.updated_at, t.concepto_compra_id, t.concepto_venta_id, :TENANT_ID
FROM dblink('rojo_conn', 'SELECT id, codigo, nombre, descripcion, categoria_id, precio_compra, precio_venta, margen, activo, created_at, updated_at, concepto_compra_id, concepto_venta_id FROM productos')
  AS t(id int, codigo text, nombre text, descripcion text, categoria_id int, precio_compra numeric, precio_venta numeric, margen numeric, activo bool, created_at timestamptz, updated_at timestamptz, concepto_compra_id int, concepto_venta_id int);

\echo '-- Insertando productos_buffet...'
INSERT INTO productos_buffet (id, producto_id, categoria_menu_id, nombre, descripcion, precio, imagen, disponible, destacado, orden, activo, created_at, updated_at, codigo_barras, tipos_venta, tenant_id)
SELECT                        t.id, t.producto_id, t.categoria_menu_id, t.nombre, t.descripcion, t.precio, t.imagen, t.disponible, t.destacado, t.orden, t.activo, t.created_at, t.updated_at, t.codigo_barras, t.tipos_venta, :TENANT_ID
FROM dblink('rojo_conn', 'SELECT id, producto_id, categoria_menu_id, nombre, descripcion, precio, imagen, disponible, destacado, orden, activo, created_at, updated_at, codigo_barras, tipos_venta FROM productos_buffet')
  AS t(id int, producto_id int, categoria_menu_id int, nombre text, descripcion text, precio numeric, imagen text, disponible bool, destacado bool, orden int, activo bool, created_at timestamptz, updated_at timestamptz, codigo_barras text, tipos_venta text[]);

\echo '-- Insertando comandas...'
INSERT INTO comandas (id, numero, mesa_id, socio_id, centro_costo_id, estado, hora_apertura, hora_cierre, subtotal, descuento, propina, total, observaciones, atendido_por, cerrado_por, es_venta_interna, created_at, updated_at, tenant_id)
SELECT                t.id, t.numero, t.mesa_id, t.socio_id, t.centro_costo_id, t.estado, t.hora_apertura, t.hora_cierre, t.subtotal, t.descuento, t.propina, t.total, t.observaciones, t.atendido_por, t.cerrado_por, t.es_venta_interna, t.created_at, t.updated_at, :TENANT_ID
FROM dblink('rojo_conn', 'SELECT id, numero, mesa_id, socio_id, centro_costo_id, estado, hora_apertura, hora_cierre, subtotal, descuento, propina, total, observaciones, atendido_por, cerrado_por, es_venta_interna, created_at, updated_at FROM comandas')
  AS t(id int, numero text, mesa_id int, socio_id int, centro_costo_id int, estado text, hora_apertura timestamptz, hora_cierre timestamptz, subtotal numeric, descuento numeric, propina numeric, total numeric, observaciones text, atendido_por int, cerrado_por int, es_venta_interna bool, created_at timestamptz, updated_at timestamptz);

\echo '-- Insertando items_comanda...'
INSERT INTO items_comanda (id, comanda_id, producto_buffet_id, cantidad, "precioUnitario", subtotal, estado, observaciones, enviado_cocina_at, listo_at, entregado_at, created_at, updated_at, opciones_removidas, tenant_id)
SELECT                     t.id, t.comanda_id, t.producto_buffet_id, t.cantidad, t.precio_unitario, t.subtotal, t.estado, t.observaciones, t.enviado_cocina_at, t.listo_at, t.entregado_at, t.created_at, t.updated_at, t.opciones_removidas, :TENANT_ID
FROM dblink('rojo_conn', 'SELECT id, comanda_id, producto_buffet_id, cantidad, "precioUnitario", subtotal, estado, observaciones, enviado_cocina_at, listo_at, entregado_at, created_at, updated_at, opciones_removidas FROM items_comanda')
  AS t(id int, comanda_id int, producto_buffet_id int, cantidad int, precio_unitario numeric, subtotal numeric, estado text, observaciones text, enviado_cocina_at timestamptz, listo_at timestamptz, entregado_at timestamptz, created_at timestamptz, updated_at timestamptz, opciones_removidas jsonb);

\echo '-- Insertando opciones_item_comanda...'
INSERT INTO opciones_item_comanda (id, item_comanda_id, opcion_id, cantidad, precio_adicional, created_at, tenant_id)
SELECT                             t.id, t.item_comanda_id, t.opcion_id, t.cantidad, t.precio_adicional, t.created_at, :TENANT_ID
FROM dblink('rojo_conn', 'SELECT id, item_comanda_id, opcion_id, cantidad, precio_adicional, created_at FROM opciones_item_comanda')
  AS t(id int, item_comanda_id int, opcion_id int, cantidad int, precio_adicional numeric, created_at timestamptz);

\echo '-- Insertando pedidos_takeaway...'
INSERT INTO pedidos_takeaway (id, numero, nombre_cliente, telefono, socio_id, centro_costo_id, estado, tipo, hora_recibido, hora_estimada, hora_listo, hora_pagado, hora_entregado, subtotal, descuento, propina, total, observaciones, atendido_por, es_venta_interna, created_at, updated_at, tenant_id)
SELECT                        t.id, t.numero, t.nombre_cliente, t.telefono, t.socio_id, t.centro_costo_id, t.estado, t.tipo, t.hora_recibido, t.hora_estimada, t.hora_listo, t.hora_pagado, t.hora_entregado, t.subtotal, t.descuento, t.propina, t.total, t.observaciones, t.atendido_por, t.es_venta_interna, t.created_at, t.updated_at, :TENANT_ID
FROM dblink('rojo_conn', 'SELECT id, numero, nombre_cliente, telefono, socio_id, centro_costo_id, estado, tipo, hora_recibido, hora_estimada, hora_listo, hora_pagado, hora_entregado, subtotal, descuento, propina, total, observaciones, atendido_por, es_venta_interna, created_at, updated_at FROM pedidos_takeaway')
  AS t(id int, numero text, nombre_cliente text, telefono text, socio_id int, centro_costo_id int, estado text, tipo text, hora_recibido timestamptz, hora_estimada timestamptz, hora_listo timestamptz, hora_pagado timestamptz, hora_entregado timestamptz, subtotal numeric, descuento numeric, propina numeric, total numeric, observaciones text, atendido_por int, es_venta_interna bool, created_at timestamptz, updated_at timestamptz);

\echo '-- Insertando items_pedido_takeaway...'
INSERT INTO items_pedido_takeaway (id, pedido_id, producto_buffet_id, cantidad, "precioUnitario", subtotal, estado, observaciones, created_at, updated_at, opciones_removidas, tenant_id)
SELECT                             t.id, t.pedido_id, t.producto_buffet_id, t.cantidad, t.precio_unitario, t.subtotal, t.estado, t.observaciones, t.created_at, t.updated_at, t.opciones_removidas, :TENANT_ID
FROM dblink('rojo_conn', 'SELECT id, pedido_id, producto_buffet_id, cantidad, "precioUnitario", subtotal, estado, observaciones, created_at, updated_at, opciones_removidas FROM items_pedido_takeaway')
  AS t(id int, pedido_id int, producto_buffet_id int, cantidad int, precio_unitario numeric, subtotal numeric, estado text, observaciones text, created_at timestamptz, updated_at timestamptz, opciones_removidas jsonb);

\echo '-- Insertando opciones_item_takeaway...'
INSERT INTO opciones_item_takeaway (id, item_takeaway_id, opcion_id, cantidad, precio_adicional, created_at, tenant_id)
SELECT                              t.id, t.item_takeaway_id, t.opcion_id, t.cantidad, t.precio_adicional, t.created_at, :TENANT_ID
FROM dblink('rojo_conn', 'SELECT id, item_takeaway_id, opcion_id, cantidad, precio_adicional, created_at FROM opciones_item_takeaway')
  AS t(id int, item_takeaway_id int, opcion_id int, cantidad int, precio_adicional numeric, created_at timestamptz);

\echo '-- Insertando movimientos_caja...'
INSERT INTO movimientos_caja (id, numero, caja_id, fecha, fecha_operacion, tipo, cuenta_contable_id, monto, pago_id, caja_destino_id, movimiento_relacionado_id, descripcion, comprobante_nro, comprobante_tipo, estado, fecha_anulacion, motivo_anulacion, anulado_por, conciliado, conciliacion_id, registrado_por, created_at, updated_at, concepto, anulado, movimiento_contable_id, centro_costo_id, fecha_conciliacion, observacion_conciliacion, comanda_id, pedido_takeaway_id, tenant_id)
SELECT                        t.id, t.numero, t.caja_id, t.fecha, t.fecha_operacion, t.tipo, t.cuenta_contable_id, t.monto, t.pago_id, t.caja_destino_id, t.movimiento_relacionado_id, t.descripcion, t.comprobante_nro, t.comprobante_tipo, t.estado, t.fecha_anulacion, t.motivo_anulacion, t.anulado_por, t.conciliado, t.conciliacion_id, t.registrado_por, t.created_at, t.updated_at, t.concepto, t.anulado, t.movimiento_contable_id, t.centro_costo_id, t.fecha_conciliacion, t.observacion_conciliacion, t.comanda_id, t.pedido_takeaway_id, :TENANT_ID
FROM dblink('rojo_conn', 'SELECT id, numero, caja_id, fecha, fecha_operacion, tipo, cuenta_contable_id, monto, pago_id, caja_destino_id, movimiento_relacionado_id, descripcion, comprobante_nro, comprobante_tipo, estado, fecha_anulacion, motivo_anulacion, anulado_por, conciliado, conciliacion_id, registrado_por, created_at, updated_at, concepto, anulado, movimiento_contable_id, centro_costo_id, fecha_conciliacion, observacion_conciliacion, comanda_id, pedido_takeaway_id FROM movimientos_caja')
  AS t(id int, numero text, caja_id int, fecha timestamptz, fecha_operacion timestamptz, tipo text, cuenta_contable_id int, monto numeric, pago_id int, caja_destino_id int, movimiento_relacionado_id int, descripcion text, comprobante_nro text, comprobante_tipo text, estado text, fecha_anulacion timestamptz, motivo_anulacion text, anulado_por int, conciliado bool, conciliacion_id int, registrado_por int, created_at timestamptz, updated_at timestamptz, concepto text, anulado bool, movimiento_contable_id int, centro_costo_id int, fecha_conciliacion timestamptz, observacion_conciliacion text, comanda_id int, pedido_takeaway_id int);

\echo '-- Insertando notificaciones_buffet...'
INSERT INTO notificaciones_buffet (id, tipo, titulo, mensaje, datos, sonido, para_usuario_id, para_destino, created_at, tenant_id)
SELECT                             t.id, t.tipo, t.titulo, t.mensaje, t.datos, t.sonido, t.para_usuario_id, t.para_destino, t.created_at, :TENANT_ID
FROM dblink('rojo_conn', 'SELECT id, tipo, titulo, mensaje, datos, sonido, para_usuario_id, para_destino, created_at FROM notificaciones_buffet')
  AS t(id int, tipo text, titulo text, mensaje text, datos jsonb, sonido text, para_usuario_id int, para_destino text, created_at timestamptz);

-- ── 6. Reactivar triggers ─────────────────────────────────────────────────
SET session_replication_role = DEFAULT;

-- ── 7. Cerrar conexión dblink ─────────────────────────────────────────────
SELECT dblink_disconnect('rojo_conn');

-- ── 8. Resetear secuencias ────────────────────────────────────────────────
\echo '-- Reseteando secuencias...'
SELECT setval('mesas_id_seq',                 COALESCE((SELECT MAX(id) FROM mesas), 1));
SELECT setval('productos_id_seq',             COALESCE((SELECT MAX(id) FROM productos), 1));
SELECT setval('productos_buffet_id_seq',      COALESCE((SELECT MAX(id) FROM productos_buffet), 1));
SELECT setval('comandas_id_seq',              COALESCE((SELECT MAX(id) FROM comandas), 1));
SELECT setval('items_comanda_id_seq',         COALESCE((SELECT MAX(id) FROM items_comanda), 1));
SELECT setval('opciones_item_comanda_id_seq', COALESCE((SELECT MAX(id) FROM opciones_item_comanda), 1));
SELECT setval('pedidos_takeaway_id_seq',      COALESCE((SELECT MAX(id) FROM pedidos_takeaway), 1));
SELECT setval('items_pedido_takeaway_id_seq', COALESCE((SELECT MAX(id) FROM items_pedido_takeaway), 1));
SELECT setval('opciones_item_takeaway_id_seq',COALESCE((SELECT MAX(id) FROM opciones_item_takeaway), 1));
SELECT setval('movimientos_caja_id_seq',      COALESCE((SELECT MAX(id) FROM movimientos_caja), 1));
SELECT setval('notificaciones_buffet_id_seq', COALESCE((SELECT MAX(id) FROM notificaciones_buffet), 1));

-- ── 9. Verificación final ─────────────────────────────────────────────────
\echo '== Resultado final =='
SELECT 'mesas'                   as tabla, count(*) FROM mesas                  WHERE tenant_id = :TENANT_ID
UNION ALL SELECT 'productos',             count(*) FROM productos               WHERE tenant_id = :TENANT_ID
UNION ALL SELECT 'productos_buffet',      count(*) FROM productos_buffet        WHERE tenant_id = :TENANT_ID
UNION ALL SELECT 'comandas',              count(*) FROM comandas                WHERE tenant_id = :TENANT_ID
UNION ALL SELECT 'items_comanda',         count(*) FROM items_comanda           WHERE tenant_id = :TENANT_ID
UNION ALL SELECT 'pedidos_takeaway',      count(*) FROM pedidos_takeaway        WHERE tenant_id = :TENANT_ID
UNION ALL SELECT 'items_pedido_takeaway', count(*) FROM items_pedido_takeaway   WHERE tenant_id = :TENANT_ID
UNION ALL SELECT 'movimientos_caja',      count(*) FROM movimientos_caja        WHERE tenant_id = :TENANT_ID
UNION ALL SELECT 'notificaciones_buffet', count(*) FROM notificaciones_buffet   WHERE tenant_id = :TENANT_ID
ORDER BY tabla;

\echo '== Migración completada =='
