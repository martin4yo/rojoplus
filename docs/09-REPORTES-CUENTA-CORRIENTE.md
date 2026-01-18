# Cuenta Corriente y Reportes Financieros

## 1. Cuenta Corriente del Socio

Vista consolidada de todos los movimientos de un socio o grupo familiar.

### Estructura de Datos (Vista)

```sql
-- Vista de cuenta corriente
CREATE VIEW cuenta_corriente_socio AS
SELECT
  s.id as socio_id,
  s.nro_socio,
  s.apellido_nombre,
  gf.id as grupo_familiar_id,
  gf.nombre as grupo_familiar,

  -- Movimiento
  'CUOTA' as tipo_movimiento,
  c.id as referencia_id,
  CONCAT(pc.nombre, ' - ', tc.nombre) as concepto,
  c.fecha_vencimiento as fecha,
  c.monto_total as debe,
  0 as haber,
  c.estado,
  c.created_at as fecha_registro

FROM socios s
LEFT JOIN grupos_familiares gf ON s.grupo_familiar_id = gf.id
JOIN cuotas c ON (c.socio_id = s.id OR c.grupo_familiar_id = gf.id)
JOIN periodos_cuota pc ON c.periodo_id = pc.id
JOIN tipos_cuota tc ON c.tipo_cuota_id = tc.id

UNION ALL

SELECT
  s.id as socio_id,
  s.nro_socio,
  s.apellido_nombre,
  gf.id as grupo_familiar_id,
  gf.nombre as grupo_familiar,

  'PAGO' as tipo_movimiento,
  p.id as referencia_id,
  CONCAT('Pago #', p.numero, ' - ', mp.nombre) as concepto,
  p.fecha as fecha,
  0 as debe,
  p.monto_total as haber,
  p.estado,
  p.created_at as fecha_registro

FROM socios s
LEFT JOIN grupos_familiares gf ON s.grupo_familiar_id = gf.id
JOIN pagos p ON (p.socio_id = s.id OR p.grupo_familiar_id = gf.id)
JOIN medios_pago mp ON p.medio_pago_id = mp.id

ORDER BY fecha_registro;
```

### Pantalla de Cuenta Corriente

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CUENTA CORRIENTE                                                       │
│  Socio: #1234 - Juan Pérez (Familia Pérez)                              │
├─────────────────────────────────────────────────────────────────────────┤
│  Saldo actual: $45.000 (DEUDOR)          Saldo a favor: $0              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Filtros: [Desde: ___] [Hasta: ___] [Tipo: Todos ▼] [Buscar]           │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ FECHA      │ CONCEPTO                    │ DEBE    │ HABER │SALDO│   │
│  ├────────────┼─────────────────────────────┼─────────┼───────┼─────│   │
│  │ 01/01/2026 │ Enero 2026 - Cuota Social   │ $15.000 │       │15000│   │
│  │ 01/01/2026 │ Enero 2026 - Futbol Sub-12  │ $10.000 │       │25000│   │
│  │ 01/01/2026 │ Enero 2026 - Basquet Sub-12 │ $10.000 │       │35000│   │
│  │ 15/01/2026 │ Pago #P-2026-001 - Efectivo │         │$35.000│    0│   │
│  │ 01/02/2026 │ Febrero 2026 - Cuota Social │ $15.000 │       │15000│   │
│  │ 01/02/2026 │ Febrero 2026 - Futbol Sub-12│ $10.000 │       │25000│   │
│  │ 01/02/2026 │ Febrero 2026 - Basquet Sub-12│$10.000 │       │35000│   │
│  │ 05/02/2026 │ Recargo 10% Cuota Social    │ $1.500  │       │36500│   │
│  │ 01/03/2026 │ Marzo 2026 - Cuota Social   │ $15.000 │       │51500│   │
│  │ ...        │                              │         │       │     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  [Exportar PDF] [Exportar Excel] [Imprimir]                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Información Mostrada

1. **Cabecera**
   - Datos del socio/grupo familiar
   - Saldo actual (deuda total)
   - Saldo a favor (si tiene)
   - Estado general (AL DÍA, EN MORA, DEUDOR)

2. **Detalle de Movimientos**
   - Fecha
   - Concepto (cuota, pago, recargo, ajuste, bonificación)
   - Debe (cargos)
   - Haber (pagos/créditos)
   - Saldo acumulado
   - Estado (PENDIENTE, PAGADO, ANULADO)

3. **Filtros**
   - Rango de fechas
   - Tipo de movimiento
   - Estado

4. **Acciones**
   - Exportar a PDF/Excel
   - Imprimir
   - Registrar pago (acceso directo)

---

## 2. Reportes Financieros

### 2.1 Reporte de Morosidad General

```
┌─────────────────────────────────────────────────────────────────────────┐
│  REPORTE DE MOROSIDAD                                   Fecha: 18/01/26│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  RESUMEN GENERAL                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Total Socios Activos:          1.250                             │  │
│  │ Socios al día:                   890 (71.2%)                     │  │
│  │ Socios con 1 cuota pendiente:    180 (14.4%)                     │  │
│  │ Socios con 2 cuotas pendientes:   95 (7.6%)                      │  │
│  │ Socios con 3+ cuotas pendientes:  85 (6.8%)                      │  │
│  │                                                                   │  │
│  │ Deuda total:                 $4.500.000                          │  │
│  │ Deuda vencida:               $2.800.000                          │  │
│  │ Recargos acumulados:           $420.000                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  [Ver detalle] [Exportar] [Enviar recordatorios]                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Morosidad por Tipo de Cuota

```
┌─────────────────────────────────────────────────────────────────────────┐
│  MOROSIDAD POR TIPO DE CUOTA                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CUOTA SOCIAL                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Cuotas emitidas:     1.250        Monto: $18.750.000             │  │
│  │ Cuotas cobradas:       890        Monto: $13.350.000             │  │
│  │ Cuotas pendientes:     360        Monto:  $5.400.000             │  │
│  │ % Morosidad:         28.8%                                        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  CUOTAS DEPORTIVAS (Total)                                              │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Cuotas emitidas:     2.340        Monto: $23.400.000             │  │
│  │ Cuotas cobradas:     1.950        Monto: $19.500.000             │  │
│  │ Cuotas pendientes:     390        Monto:  $3.900.000             │  │
│  │ % Morosidad:         16.7%                                        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Morosidad por Deporte

```
┌─────────────────────────────────────────────────────────────────────────┐
│  MOROSIDAD POR DEPORTE                              Período: Enero 2026│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────┬──────────┬──────────┬──────────┬─────────┬──────────┐  │
│  │ DEPORTE    │INSCRIPTOS│ EMITIDO  │ COBRADO  │PENDIENTE│% MOROSID │  │
│  ├────────────┼──────────┼──────────┼──────────┼─────────┼──────────┤  │
│  │ FÚTBOL     │    450   │$4.500.000│$3.800.000│ $700.000│   15.6%  │  │
│  │ BÁSQUET    │    280   │$2.800.000│$2.300.000│ $500.000│   17.9%  │  │
│  │ VÓLEY      │    180   │$1.800.000│$1.600.000│ $200.000│   11.1%  │  │
│  │ NATACIÓN   │    320   │$4.800.000│$4.200.000│ $600.000│   12.5%  │  │
│  │ HOCKEY     │    150   │$1.500.000│$1.200.000│ $300.000│   20.0%  │  │
│  │ TENIS      │     80   │$1.200.000│$1.100.000│ $100.000│    8.3%  │  │
│  ├────────────┼──────────┼──────────┼──────────┼─────────┼──────────┤  │
│  │ TOTAL      │  1.460   │$16.600.000│$14.200.00│$2.400.00│   14.5%  │  │
│  └────────────┴──────────┴──────────┴──────────┴─────────┴──────────┘  │
│                                                                         │
│  [Gráfico de torta] [Gráfico de barras] [Exportar]                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Morosidad por Categoría

```
┌─────────────────────────────────────────────────────────────────────────┐
│  MOROSIDAD POR CATEGORÍA - FÚTBOL                   Período: Enero 2026│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────┬──────────┬──────────┬──────────┬─────────┬──────────┐  │
│  │ CATEGORÍA  │INSCRIPTOS│ EMITIDO  │ COBRADO  │PENDIENTE│% MOROSID │  │
│  ├────────────┼──────────┼──────────┼──────────┼─────────┼──────────┤  │
│  │ Sub-11     │     45   │  $450.000│  $420.000│  $30.000│    6.7%  │  │
│  │ Sub-12     │     52   │  $520.000│  $480.000│  $40.000│    7.7%  │  │
│  │ Sub-13     │     48   │  $480.000│  $400.000│  $80.000│   16.7%  │  │
│  │ Sub-15     │     55   │  $550.000│  $450.000│ $100.000│   18.2%  │  │
│  │ Sub-17     │     42   │  $420.000│  $350.000│  $70.000│   16.7%  │  │
│  │ Sub-21     │     38   │  $380.000│  $300.000│  $80.000│   21.1%  │  │
│  │ Primera    │     35   │  $350.000│  $320.000│  $30.000│    8.6%  │  │
│  │ Reserva    │     28   │  $280.000│  $250.000│  $30.000│   10.7%  │  │
│  │ Veteranos  │     45   │  $450.000│  $380.000│  $70.000│   15.6%  │  │
│  │ Femenino   │     62   │  $620.000│  $450.000│ $170.000│   27.4%  │  │
│  ├────────────┼──────────┼──────────┼──────────┼─────────┼──────────┤  │
│  │ TOTAL FUT  │    450   │$4.500.000│$3.800.000│ $700.000│   15.6%  │  │
│  └────────────┴──────────┴──────────┴──────────┴─────────┴──────────┘  │
│                                                                         │
│  [Ver detalle Sub-21] [Ver listado morosos]                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.5 Listado de Morosos (Drill-down)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LISTADO DE MOROSOS - Fútbol Sub-21                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────┬────────────────────┬───────┬─────────┬─────────┬────────┐  │
│  │ NRO    │ NOMBRE             │CUOTAS │ DEUDA   │ RECARGO │ TOTAL  │  │
│  ├────────┼────────────────────┼───────┼─────────┼─────────┼────────┤  │
│  │ #1234  │ García, Martín     │   2   │ $20.000 │  $3.000 │$23.000 │  │
│  │ #1456  │ López, Juan        │   3   │ $30.000 │  $6.000 │$36.000 │  │
│  │ #1789  │ Rodríguez, Pedro   │   1   │ $10.000 │  $1.000 │$11.000 │  │
│  │ #2012  │ Fernández, Carlos  │   2   │ $20.000 │  $2.500 │$22.500 │  │
│  └────────┴────────────────────┴───────┴─────────┴─────────┴────────┘  │
│                                                                         │
│  [Enviar WhatsApp] [Enviar Email] [Exportar] [Imprimir cartas]         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Reportes Financieros de Caja

### 3.1 Balance de Caja

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BALANCE DE CAJAS                                   Fecha: 18/01/2026  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────────────┬────────────┬────────────┬────────────────────┐ │
│  │ CAJA               │ INGRESOS   │ EGRESOS    │ SALDO ACTUAL       │ │
│  ├────────────────────┼────────────┼────────────┼────────────────────┤ │
│  │ Caja Principal     │ $2.500.000 │ $1.800.000 │ $700.000           │ │
│  │ Banco Galicia CC   │ $5.200.000 │ $4.100.000 │ $1.100.000         │ │
│  │ Banco Nación CA    │   $800.000 │   $300.000 │ $500.000           │ │
│  │ Mercado Pago       │ $1.200.000 │   $950.000 │ $250.000           │ │
│  ├────────────────────┼────────────┼────────────┼────────────────────┤ │
│  │ TOTAL              │ $9.700.000 │ $7.150.000 │ $2.550.000         │ │
│  └────────────────────┴────────────┴────────────┴────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Ingresos/Egresos por Cuenta Contable

```
┌─────────────────────────────────────────────────────────────────────────┐
│  INGRESOS POR CONCEPTO                        Período: Enero 2026      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────┬───────────┬────────┐ │
│  │ CONCEPTO                                     │ MONTO     │   %    │ │
│  ├──────────────────────────────────────────────┼───────────┼────────┤ │
│  │ 020 - INGRESOS POR CUOTAS                    │           │        │ │
│  │   021 - Cuotas Sociales                      │$4.200.000 │  43.3% │ │
│  │   022 - Cuotas Deportivas                    │$3.800.000 │  39.2% │ │
│  │   023 - Recargos por mora                    │  $280.000 │   2.9% │ │
│  │ 030 - OTROS INGRESOS                         │           │        │ │
│  │   031 - Alquiler de canchas                  │  $450.000 │   4.6% │ │
│  │   032 - Cantina/Buffet                       │  $620.000 │   6.4% │ │
│  │   033 - Eventos y fiestas                    │  $350.000 │   3.6% │ │
│  ├──────────────────────────────────────────────┼───────────┼────────┤ │
│  │ TOTAL INGRESOS                               │$9.700.000 │ 100.0% │ │
│  └──────────────────────────────────────────────┴───────────┴────────┘ │
│                                                                         │
│  ┌──────────────────────────────────────────────┬───────────┬────────┐ │
│  │ EGRESOS                                      │ MONTO     │   %    │ │
│  ├──────────────────────────────────────────────┼───────────┼────────┤ │
│  │ 010 - SUELDOS                                │           │        │ │
│  │   011 - Sueldos Administración               │  $800.000 │  11.2% │ │
│  │   012 - Sueldos Básquet                      │  $450.000 │   6.3% │ │
│  │   013 - Sueldos Fútbol                       │  $650.000 │   9.1% │ │
│  │   014 - Sueldos Vóley                        │  $280.000 │   3.9% │ │
│  │ 040 - SERVICIOS                              │           │        │ │
│  │   041 - Luz                                  │  $320.000 │   4.5% │ │
│  │   042 - Gas                                  │  $180.000 │   2.5% │ │
│  │   043 - Agua                                 │   $95.000 │   1.3% │ │
│  │   044 - Internet/Teléfono                    │   $45.000 │   0.6% │ │
│  │ 050 - MANTENIMIENTO                          │           │        │ │
│  │   051 - Mantenimiento canchas                │  $420.000 │   5.9% │ │
│  │   052 - Mantenimiento edilicio               │  $280.000 │   3.9% │ │
│  │ 060 - COMPRAS                                │           │        │ │
│  │   061 - Equipamiento deportivo               │  $850.000 │  11.9% │ │
│  │   062 - Insumos cantina                      │  $380.000 │   5.3% │ │
│  │ 070 - OTROS GASTOS                           │           │        │ │
│  │   071 - Seguros                              │  $450.000 │   6.3% │ │
│  │   072 - Impuestos y tasas                    │  $520.000 │   7.3% │ │
│  │   073 - Gastos bancarios                     │   $85.000 │   1.2% │ │
│  │   074 - Varios                               │  $345.000 │   4.8% │ │
│  ├──────────────────────────────────────────────┼───────────┼────────┤ │
│  │ TOTAL EGRESOS                                │$7.150.000 │ 100.0% │ │
│  └──────────────────────────────────────────────┴───────────┴────────┘ │
│                                                                         │
│  RESULTADO DEL PERÍODO: $2.550.000 (SUPERÁVIT)                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Queries de Reportes (SQL)

### 4.1 Morosidad General

```sql
-- Morosidad general
SELECT
  COUNT(DISTINCT COALESCE(c.socio_id, c.grupo_familiar_id)) as total_deudores,
  COUNT(c.id) as cuotas_pendientes,
  SUM(c.monto_original) as deuda_original,
  SUM(c.monto_recargo) as recargos,
  SUM(c.monto_total) as deuda_total
FROM cuotas c
WHERE c.estado = 'PENDIENTE';

-- % morosidad por cantidad de cuotas
SELECT
  CASE
    WHEN cuotas_pendientes = 0 THEN 'Al día'
    WHEN cuotas_pendientes = 1 THEN '1 cuota'
    WHEN cuotas_pendientes = 2 THEN '2 cuotas'
    ELSE '3+ cuotas'
  END as categoria,
  COUNT(*) as cantidad,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as porcentaje
FROM (
  SELECT
    COALESCE(s.id, gf.titular_id) as socio_id,
    COUNT(c.id) as cuotas_pendientes
  FROM socios s
  LEFT JOIN grupos_familiares gf ON s.id = gf.titular_id
  LEFT JOIN cuotas c ON (c.socio_id = s.id OR c.grupo_familiar_id = gf.id)
    AND c.estado = 'PENDIENTE'
  WHERE s.estado = 'ACTIVO'
  GROUP BY COALESCE(s.id, gf.titular_id)
) sub
GROUP BY categoria;
```

### 4.2 Morosidad por Deporte

```sql
SELECT
  d.nombre as deporte,
  COUNT(DISTINCT i.socio_id) as inscriptos,
  COUNT(c.id) as cuotas_emitidas,
  SUM(CASE WHEN c.estado = 'PAGADA' THEN 1 ELSE 0 END) as cuotas_pagadas,
  SUM(CASE WHEN c.estado = 'PENDIENTE' THEN 1 ELSE 0 END) as cuotas_pendientes,
  SUM(CASE WHEN c.estado = 'PAGADA' THEN c.monto_total ELSE 0 END) as monto_cobrado,
  SUM(CASE WHEN c.estado = 'PENDIENTE' THEN c.monto_total ELSE 0 END) as monto_pendiente,
  ROUND(
    SUM(CASE WHEN c.estado = 'PENDIENTE' THEN 1 ELSE 0 END) * 100.0 /
    NULLIF(COUNT(c.id), 0), 2
  ) as pct_morosidad
FROM deportes d
JOIN categorias cat ON cat.deporte_id = d.id
JOIN inscripciones i ON i.categoria_id = cat.id AND i.estado = 'ACTIVA'
LEFT JOIN cuotas c ON c.categoria_id = cat.id
WHERE d.activo = true
GROUP BY d.id, d.nombre
ORDER BY pct_morosidad DESC;
```

### 4.3 Morosidad por Categoría

```sql
SELECT
  d.nombre as deporte,
  cat.nombre as categoria,
  COUNT(DISTINCT i.socio_id) as inscriptos,
  SUM(CASE WHEN c.estado = 'PENDIENTE' THEN c.monto_total ELSE 0 END) as deuda,
  ROUND(
    SUM(CASE WHEN c.estado = 'PENDIENTE' THEN 1 ELSE 0 END) * 100.0 /
    NULLIF(COUNT(c.id), 0), 2
  ) as pct_morosidad
FROM deportes d
JOIN categorias cat ON cat.deporte_id = d.id
JOIN inscripciones i ON i.categoria_id = cat.id AND i.estado = 'ACTIVA'
LEFT JOIN cuotas c ON c.categoria_id = cat.id
WHERE d.activo = true
GROUP BY d.id, d.nombre, cat.id, cat.nombre
ORDER BY d.nombre, cat.orden;
```

---

## 5. Estructura de Endpoints API

```
GET  /api/admin/socios/:id/cuenta-corriente
     ?desde=2026-01-01&hasta=2026-12-31&tipo=CUOTA|PAGO

GET  /api/admin/reportes/morosidad
     ?periodo=2026-01&tipo=SOCIAL|DEPORTIVA

GET  /api/admin/reportes/morosidad/deportes
     ?periodo=2026-01

GET  /api/admin/reportes/morosidad/categorias
     ?deporteId=1&periodo=2026-01

GET  /api/admin/reportes/morosidad/detalle
     ?categoriaId=5&periodo=2026-01

GET  /api/admin/reportes/caja/balance
     ?desde=2026-01-01&hasta=2026-01-31

GET  /api/admin/reportes/caja/movimientos
     ?cajaId=1&desde=2026-01-01&hasta=2026-01-31&cuentaId=21

GET  /api/admin/reportes/caja/ingresos-egresos
     ?periodo=2026-01
```

---

*Documento creado: Enero 2026*
