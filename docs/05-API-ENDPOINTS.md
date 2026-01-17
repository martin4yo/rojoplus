# RojoPlus - API Endpoints

---

## 1. Informacion General

### Base URL
```
Desarrollo: http://localhost:3000/api
Produccion: https://rojoplus.club/api
```

### Formato de Respuestas
Todas las respuestas usan JSON con la siguiente estructura:

**Exito:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Descripcion del error"
  }
}
```

### Autenticacion
- **Comerciantes**: Token UUID en URL (`/comercio/{token}/...`)
- **Admin**: JWT en header `Authorization: Bearer {token}`

---

## 2. Endpoints Publicos (Sin Auth)

### 2.1 Registro de Comercio

**POST** `/comercios/registro`

Registra una nueva solicitud de comercio.

**Request:**
```json
{
  "nombre": "Panaderia Don Juan",
  "direccion": "Av. San Martin 1234",
  "rubroId": 1,
  "telefono": "0230-4551234",
  "email": "panaderia@email.com",
  "cuit": "20-12345678-9",
  "responsable": "Juan Perez"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 15,
    "mensaje": "Solicitud enviada correctamente",
    "flyerUrl": "/flyer/comercio-adherido.png"
  }
}
```

**Errores:**
- `400` - Datos invalidos
- `409` - Email ya registrado

---

### 2.2 Obtener Rubros

**GET** `/rubros`

Lista rubros disponibles para el selector.

**Response (200):**
```json
{
  "success": true,
  "data": [
    { "id": 1, "nombre": "Gastronomia" },
    { "id": 2, "nombre": "Indumentaria" },
    { "id": 3, "nombre": "Farmacia" }
  ]
}
```

---

## 3. Endpoints de Comerciante (Auth por Token)

Base: `/comercio/{token}`

El token se valida en middleware. Si es invalido o comercio inactivo, retorna 401.

### 3.1 Obtener Info del Comercio

**GET** `/comercio/{token}`

Retorna datos del comercio para mostrar en pantalla.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "nombre": "Panaderia Don Juan",
    "descuentoPct": 10,
    "acumulacionActiva": true,
    "acumComprasReq": 4,
    "acumPeriodoDias": 7,
    "acumDescuentoExtra": 15
  }
}
```

---

### 3.2 Buscar Socio

**GET** `/comercio/{token}/socios/buscar?q={query}`

Busca socio por numero de socio o documento.

**Parametros:**
- `q` (required): Numero de socio o DNI

**Response (200) - Encontrado:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "nroSocio": "12345",
    "apellidoNombre": "Juan Carlos Perez",
    "estado": "ACTIVO",
    "esActivo": true
  }
}
```

**Response (200) - No encontrado:**
```json
{
  "success": true,
  "data": null
}
```

---

### 3.3 Calcular Descuento (Preview)

**POST** `/comercio/{token}/ventas/calcular`

Calcula el descuento sin registrar la venta. Util para mostrar preview.

**Request:**
```json
{
  "socioId": 123,
  "importeOriginal": 10000
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "importeOriginal": 10000,
    "descuentoBasePct": 10,
    "descuentoBaseMonto": 1000,
    "aplicaAcumulacion": true,
    "comprasEnPeriodo": 4,
    "descuentoAcumPct": 15,
    "descuentoAcumMonto": 1500,
    "descuentoTotalMonto": 2500,
    "importeFinal": 7500
  }
}
```

---

### 3.4 Registrar Venta

**POST** `/comercio/{token}/ventas`

Registra una venta con descuento.

**Request:**
```json
{
  "socioId": 123,
  "importeOriginal": 10000
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 456,
    "fecha": "2026-01-17T14:30:00Z",
    "importeOriginal": 10000,
    "importeFinal": 7500,
    "descuentoPct": 10,
    "descuentoMonto": 1000,
    "aplicoAcumulacion": true,
    "descuentoAcumPct": 15,
    "mensaje": "Venta registrada correctamente"
  }
}
```

**Errores:**
- `400` - Datos invalidos
- `404` - Socio no encontrado
- `422` - Socio inactivo

---

## 4. Endpoints de Admin (Auth JWT)

Base: `/admin`

Requiere header `Authorization: Bearer {jwt_token}`

### 4.1 Login

**POST** `/admin/login`

**Request:**
```json
{
  "email": "admin@club.com",
  "password": "secreto123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "admin": {
      "id": 1,
      "email": "admin@club.com",
      "nombre": "Administrador"
    }
  }
}
```

---

### 4.2 Dashboard Stats

**GET** `/admin/dashboard`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "ventasHoy": 45,
    "ventasSemana": 312,
    "comerciosActivos": 12,
    "comerciosPendientes": 3,
    "sociosActivos": 1234,
    "montoTotalHoy": 450000,
    "montoTotalSemana": 3120000
  }
}
```

---

### 4.3 Listar Comercios

**GET** `/admin/comercios?estado={estado}&page={page}`

**Parametros:**
- `estado` (optional): PENDIENTE, ACTIVO, RECHAZADO, INACTIVO
- `page` (optional): Numero de pagina (default: 1)
- `limit` (optional): Items por pagina (default: 20)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "comercios": [
      {
        "id": 1,
        "nombre": "Panaderia Don Juan",
        "rubro": "Gastronomia",
        "email": "panaderia@email.com",
        "estado": "ACTIVO",
        "descuentoPct": 10,
        "createdAt": "2026-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

---

### 4.4 Detalle de Comercio

**GET** `/admin/comercios/{id}`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nombre": "Panaderia Don Juan",
    "direccion": "Av. San Martin 1234",
    "rubro": { "id": 1, "nombre": "Gastronomia" },
    "telefono": "0230-4551234",
    "email": "panaderia@email.com",
    "cuit": "20-12345678-9",
    "responsable": "Juan Perez",
    "estado": "PENDIENTE",
    "descuentoPct": 10,
    "acumulacionActiva": false,
    "createdAt": "2026-01-15T10:00:00Z",
    "approvedAt": null,
    "totalVentas": 0,
    "montoTotalVentas": 0
  }
}
```

---

### 4.5 Aprobar Comercio

**POST** `/admin/comercios/{id}/aprobar`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "estado": "ACTIVO",
    "token": "abc123-def456-...",
    "mensaje": "Comercio aprobado. Se envio email con link de acceso."
  }
}
```

---

### 4.6 Rechazar Comercio

**POST** `/admin/comercios/{id}/rechazar`

**Request:**
```json
{
  "motivo": "Documentacion incompleta"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "estado": "RECHAZADO",
    "mensaje": "Comercio rechazado. Se envio email de notificacion."
  }
}
```

---

### 4.7 Actualizar Comercio

**PATCH** `/admin/comercios/{id}`

**Request:**
```json
{
  "descuentoPct": 15,
  "acumulacionActiva": true,
  "acumComprasReq": 4,
  "acumPeriodoDias": 7,
  "acumDescuentoExtra": 15
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "mensaje": "Comercio actualizado"
  }
}
```

---

### 4.8 Desactivar Comercio

**POST** `/admin/comercios/{id}/desactivar`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "estado": "INACTIVO",
    "mensaje": "Comercio desactivado"
  }
}
```

---

### 4.9 Reenviar Link de Acceso

**POST** `/admin/comercios/{id}/reenviar-link`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "mensaje": "Link de acceso reenviado a panaderia@email.com"
  }
}
```

---

### 4.10 Listar Socios

**GET** `/admin/socios?q={query}&page={page}`

**Parametros:**
- `q` (optional): Busqueda por nombre, nro socio o documento
- `estado` (optional): Filtro por estado
- `page` (optional): Numero de pagina

**Response (200):**
```json
{
  "success": true,
  "data": {
    "socios": [
      {
        "id": 1,
        "nroSocio": "12345",
        "documento": "30123456",
        "apellidoNombre": "Juan Carlos Perez",
        "estado": "ACTIVO",
        "email": "juan@email.com",
        "categoria": "Activo"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1234,
      "pages": 62
    }
  }
}
```

---

### 4.11 Cargar Excel de Socios

**POST** `/admin/socios/upload`

**Request:** `multipart/form-data`
- `file`: Archivo Excel (.xlsx)

**Response (200) - Preview:**
```json
{
  "success": true,
  "data": {
    "preview": true,
    "nuevos": 50,
    "actualizar": 1180,
    "errores": 4,
    "detalleErrores": [
      { "fila": 15, "error": "DNI duplicado" },
      { "fila": 23, "error": "Numero de socio vacio" }
    ],
    "uploadId": "temp-123456"
  }
}
```

---

### 4.12 Confirmar Carga de Socios

**POST** `/admin/socios/upload/{uploadId}/confirmar`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "procesados": 1230,
    "nuevos": 50,
    "actualizados": 1180,
    "mensaje": "Socios actualizados correctamente"
  }
}
```

---

### 4.13 Reporte de Ventas

**GET** `/admin/reportes/ventas?desde={fecha}&hasta={fecha}&comercioId={id}`

**Parametros:**
- `desde` (optional): Fecha inicio (YYYY-MM-DD)
- `hasta` (optional): Fecha fin (YYYY-MM-DD)
- `comercioId` (optional): Filtrar por comercio
- `socioId` (optional): Filtrar por socio
- `agrupar` (optional): dia, semana, mes

**Response (200):**
```json
{
  "success": true,
  "data": {
    "resumen": {
      "totalVentas": 312,
      "montoOriginal": 3500000,
      "montoConDescuento": 3150000,
      "totalDescuentos": 350000
    },
    "porComercio": [
      {
        "comercioId": 1,
        "nombre": "Panaderia Don Juan",
        "ventas": 45,
        "monto": 450000
      }
    ],
    "porPeriodo": [
      {
        "periodo": "2026-01-15",
        "ventas": 45,
        "monto": 450000
      }
    ]
  }
}
```

---

### 4.14 Exportar Reporte

**GET** `/admin/reportes/ventas/export?formato={formato}&...`

**Parametros:**
- `formato`: csv, xlsx
- (mismos filtros que reporte de ventas)

**Response:** Archivo descargable

---

### 4.15 Configuracion

**GET** `/admin/configuracion`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "descuento_default": "10",
    "nombre_club": "Club Sportivo Pilar",
    "email_notificaciones": "admin@club.com"
  }
}
```

**PATCH** `/admin/configuracion`

**Request:**
```json
{
  "descuento_default": "12"
}
```

---

## 5. Codigos de Error

| Codigo | Nombre | Descripcion |
|--------|--------|-------------|
| AUTH_REQUIRED | Autenticacion requerida | Falta token o JWT |
| AUTH_INVALID | Token invalido | Token expirado o incorrecto |
| COMERCIO_INACTIVO | Comercio inactivo | El comercio fue desactivado |
| SOCIO_NOT_FOUND | Socio no encontrado | No existe socio con esos datos |
| SOCIO_INACTIVO | Socio inactivo | El socio no esta activo |
| VALIDATION_ERROR | Error de validacion | Datos del request invalidos |
| EMAIL_EXISTS | Email duplicado | Ya existe comercio con ese email |
| FILE_INVALID | Archivo invalido | El Excel no tiene formato correcto |

---

*Documento creado: Enero 2026*
*Version: 1.0*
