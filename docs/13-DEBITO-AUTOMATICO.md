# Sistema de Débito Automático

## Plataformas Soportadas

### Prisma (Prisma Medios de Pago)
- **Tipo**: Procesador de pagos
- **Tarjetas**: Visa, Mastercard, AMEX, Cabal
- **Archivo de salida**: TXT con formato específico
- **Respuesta**: Archivo de rendición

### Payway
- **Tipo**: Procesador de pagos
- **Integración**: API REST y archivos
- **Tarjetas**: Todas las principales
- **Respuesta**: Webhook + archivo

### Débito Directo Bancario
- **Bancos**: Galicia, Macro, Santander, Provincia
- **Formato**: Según especificación de cada banco
- **Proceso**: Envío de archivo → Procesamiento → Respuesta

---

## Flujo de Débito Automático

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  1. Generación  │────▶│  2. Envío       │────▶│  3. Proceso     │
│  de archivo     │     │  al procesador  │     │  bancario       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
┌─────────────────┐     ┌─────────────────┐            │
│  5. Registro    │◀────│  4. Importación │◀───────────┘
│  de pagos       │     │  de respuesta   │
└─────────────────┘     └─────────────────┘
```

### 1. Generación de Archivo
- Seleccionar período (mes/año)
- Seleccionar socios con débito activo
- Generar archivo según formato del procesador
- Registrar cuotas incluidas

### 2. Envío al Procesador
- Subir archivo al portal del procesador
- O enviar vía API (si está disponible)
- Marcar archivo como "ENVIADO"

### 3. Proceso Bancario
- El procesador intenta el débito
- Genera archivo de respuesta con:
  - Débitos exitosos
  - Rechazos con código de error

### 4. Importación de Respuesta
- Cargar archivo de rendición
- Parsear según formato del procesador
- Identificar débitos exitosos y rechazados

### 5. Registro de Pagos
- Crear pagos automáticos para débitos exitosos
- Marcar cuotas como pagadas
- Registrar motivo de rechazo en fallidos

---

## Modelo de Datos

### ConfiguracionDebito
Almacena la configuración de cada procesador/banco.

| Campo | Descripción |
|-------|-------------|
| codigo | Identificador único (PRISMA, PAYWAY) |
| tipo | PROCESADOR, BANCO, TARJETA |
| plataforma | Nombre de la plataforma |
| formatoArchivo | TXT, CSV, XLSX |
| configuracionCampos | JSON con mapeo de columnas |
| templateCabecera | Template para header del archivo |
| codigoEmpresa | Código asignado por el procesador |
| apiUrl/apiKey/apiSecret | Credenciales para API |

### ArchivoDebito
Registro de cada archivo generado.

| Campo | Descripción |
|-------|-------------|
| numero | Identificador único (DEB-2026-01-001) |
| periodoAnio/periodoMes | Período de las cuotas |
| cantidadRegistros | Total de débitos incluidos |
| montoTotal | Suma de importes |
| estado | GENERADO, ENVIADO, PROCESADO |

### DetalleDebito
Cada línea del archivo de débito.

| Campo | Descripción |
|-------|-------------|
| socioId | Socio a debitar |
| cbuEnviado | CBU/Tarjeta enviado |
| importeEnviado | Monto a debitar |
| estado | PENDIENTE, COBRADO, RECHAZADO |
| codigoRechazo | Código de error si rechazado |

---

## Datos del Socio para Débito

En el modelo `Socio`:
- `bancoDebito`: Banco de la cuenta
- `cbuDebito`: CBU para débito
- `tarjetaDebito`: Últimos 4 dígitos (referencia)
- `titularCuenta`: Titular de la cuenta/tarjeta
- `enviaDebito`: Boolean - si está activo para débito

---

## Formato de Archivos

### Prisma (ejemplo)
```
H|20260115|CLUBSPORT|001|
D|27123456789|100000|CUOTA ENERO 2026|
D|27987654321|100000|CUOTA ENERO 2026|
T|2|200000|
```

### Archivo de Respuesta (ejemplo)
```
R|27123456789|100000|00|APROBADO|
R|27987654321|100000|51|FONDOS INSUFICIENTES|
```

---

## Códigos de Rechazo Comunes

| Código | Descripción |
|--------|-------------|
| 00 | Aprobado |
| 51 | Fondos insuficientes |
| 54 | Tarjeta vencida |
| 57 | Tarjeta no habilitada |
| 61 | Excede límite |
| 91 | Banco no disponible |

---

## Interfaz de Usuario

### Pantalla de Generación
1. Seleccionar procesador (Prisma, Payway, etc.)
2. Seleccionar período
3. Filtrar socios (por zona, categoría, etc.)
4. Vista previa de registros
5. Generar y descargar archivo

### Pantalla de Importación
1. Seleccionar archivo de débito original
2. Cargar archivo de respuesta
3. Vista previa de resultados
4. Confirmar procesamiento
5. Ver resumen (cobrados, rechazados, errores)

### Reportes
- Débitos por período
- Tasa de rechazo por motivo
- Socios con rechazos recurrentes
- Comparativo mensual
