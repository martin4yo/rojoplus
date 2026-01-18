# Conciliación Bancaria

## Descripción

El módulo de conciliación bancaria permite comparar los movimientos registrados en el sistema con los extractos bancarios importados, identificando:
- Movimientos coincidentes
- Movimientos no registrados en el sistema
- Movimientos no reflejados en el banco

---

## Formatos de Importación Soportados

### OFX (Open Financial Exchange)
- Formato estándar bancario
- Estructura XML
- Contiene saldos y movimientos
- Parser automático

### Excel/CSV
- Formato tabular
- Requiere mapeo de columnas
- Configurable por banco

### PDF
- Procesamiento manual o semi-automático
- Extracción de texto con OCR (futuro)
- Actualmente: ingreso manual asistido

---

## Flujo de Conciliación

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  1. Importar    │────▶│  2. Conciliar   │────▶│  3. Revisar     │
│  extracto       │     │  automático     │     │  diferencias    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                        ┌─────────────────┐            │
                        │  4. Cerrar      │◀───────────┘
                        │  conciliación   │
                        └─────────────────┘
```

### 1. Importar Extracto
- Seleccionar cuenta bancaria (Caja)
- Cargar archivo (OFX, CSV, Excel)
- Sistema parsea y crea registros
- Muestra preview de movimientos

### 2. Conciliación Automática
El sistema intenta conciliar automáticamente por:
- **Importe exacto + fecha cercana** (±3 días)
- **Número de operación** si está registrado
- **Referencia/concepto** parcial

### 3. Revisión Manual
- Ver movimientos no conciliados del extracto
- Ver movimientos no conciliados del sistema
- Conciliar manualmente
- Marcar como "ignorar" si corresponde

### 4. Cierre
- Verificar saldo conciliado vs saldo extracto
- Registrar diferencias si existen
- Cerrar período

---

## Modelo de Datos

### ExtractoBancario
Cabecera del extracto importado.

| Campo | Descripción |
|-------|-------------|
| numero | ID único (EXT-2026-01-001) |
| cajaId | Cuenta bancaria asociada |
| periodoDesde/Hasta | Rango de fechas |
| saldoInicial | Saldo al inicio del período |
| saldoFinal | Saldo al cierre |
| estado | IMPORTADO, EN_CONCILIACION, CONCILIADO |

### MovimientoExtracto
Cada línea del extracto.

| Campo | Descripción |
|-------|-------------|
| fecha | Fecha del movimiento |
| fechaValor | Fecha valor (puede diferir) |
| concepto | Descripción del banco |
| referencia | Nro. operación del banco |
| tipo | CREDITO o DEBITO |
| importe | Monto del movimiento |
| saldo | Saldo después del movimiento |
| conciliado | Boolean |

### Conciliacion
Registro de conciliación realizada.

| Campo | Descripción |
|-------|-------------|
| extractoId | Extracto conciliado |
| tipo | AUTOMATICA o MANUAL |
| movimientosConciliados | Cantidad |
| montoConciliado | Total conciliado |

---

## Estructura de Archivo OFX

```xml
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <DTSTART>20260101</DTSTART>
          <DTEND>20260131</DTEND>
          <STMTTRN>
            <TRNTYPE>CREDIT</TRNTYPE>
            <DTPOSTED>20260115</DTPOSTED>
            <TRNAMT>50000.00</TRNAMT>
            <FITID>202601150001</FITID>
            <NAME>TRANSFERENCIA</NAME>
            <MEMO>DE: GARCIA JUAN</MEMO>
          </STMTTRN>
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>150000.00</BALAMT>
          <DTASOF>20260131</DTASOF>
        </LEDGERBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
```

---

## Configuración CSV/Excel

Para importar CSV/Excel, se configura el mapeo:

```json
{
  "separador": ";",
  "filaInicio": 2,
  "columnas": {
    "fecha": "A",
    "concepto": "B",
    "referencia": "C",
    "debito": "D",
    "credito": "E",
    "saldo": "F"
  },
  "formatoFecha": "DD/MM/YYYY"
}
```

---

## Interfaz de Usuario

### Pantalla de Importación
1. Seleccionar cuenta bancaria
2. Subir archivo
3. Preview de movimientos importados
4. Confirmar importación

### Pantalla de Conciliación
Vista en dos columnas:

| Extracto Bancario | Sistema (Movimientos Caja) |
|-------------------|---------------------------|
| Movimiento 1 ✓    | Movimiento A ✓           |
| Movimiento 2      | Movimiento B             |
| Movimiento 3 ✓    | Movimiento C ✓           |

- Checkbox para marcar conciliados
- Botón para conciliación automática
- Filtros: Solo pendientes, por fecha, por importe

### Reportes
- Estado de conciliación por cuenta
- Movimientos no conciliados
- Histórico de conciliaciones
- Diferencias detectadas

---

## Reglas de Conciliación Automática

1. **Match exacto**: mismo importe, misma fecha
2. **Match por fecha cercana**: importe exacto, fecha ±3 días
3. **Match por referencia**: número de operación coincide
4. **Match por concepto**: importe exacto + concepto contiene palabras clave

Orden de prioridad: 1 > 2 > 3 > 4

---

## Estados de Movimiento

### MovimientoExtracto
- `conciliado: false` - Pendiente
- `conciliado: true` - Conciliado con movimiento del sistema

### MovimientoCaja
- `conciliado: false` - No verificado contra banco
- `conciliado: true` - Confirmado en extracto bancario
