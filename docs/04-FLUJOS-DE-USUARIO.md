# RojoPlus - Flujos de Usuario

---

## 1. Flujo de Registro de Comercio

### 1.1 Diagrama

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REGISTRO DE COMERCIO                                 │
└─────────────────────────────────────────────────────────────────────────────┘

    COMERCIANTE                    SISTEMA                      ADMIN
         │                            │                           │
         │  1. Accede a /registro     │                           │
         │ ──────────────────────────▶│                           │
         │                            │                           │
         │  2. Ve formulario          │                           │
         │ ◀──────────────────────────│                           │
         │                            │                           │
         │  3. Completa datos         │                           │
         │     - Nombre comercio      │                           │
         │     - Direccion            │                           │
         │     - Rubro (selector)     │                           │
         │     - Telefono             │                           │
         │     - Email                │                           │
         │     - CUIT                 │                           │
         │     - Responsable          │                           │
         │ ──────────────────────────▶│                           │
         │                            │                           │
         │                            │  4. Valida datos          │
         │                            │  5. Guarda con estado     │
         │                            │     PENDIENTE             │
         │                            │                           │
         │  6. Confirmacion +         │                           │
         │     Link descarga flyer    │                           │
         │ ◀──────────────────────────│                           │
         │                            │                           │
         │  7. Descarga flyer         │  8. Envia email a admin   │
         │     "Comercio Adherido"    │ ─────────────────────────▶│
         │                            │                           │
         │                            │                           │  9. Revisa solicitud
         │                            │                           │
         │                            │                           │  10. APRUEBA
         │                            │ ◀─────────────────────────│
         │                            │                           │
         │                            │  11. Genera token         │
         │                            │  12. Cambia estado        │
         │                            │      a ACTIVO             │
         │                            │                           │
         │  13. Recibe email con      │                           │
         │      link de acceso        │                           │
         │ ◀──────────────────────────│                           │
         │                            │                           │
         ▼                            ▼                           ▼
    PUEDE OPERAR
```

### 1.2 Pantallas

**Pantalla de Registro:**
```
┌──────────────────────────────────────────────────┐
│           ROJOPLUS - REGISTRO DE COMERCIO         │
│          Club Sportivo Pilar                      │
├──────────────────────────────────────────────────┤
│                                                   │
│  Adherite al programa de beneficios para         │
│  socios del Club Sportivo Pilar                  │
│                                                   │
│  Nombre del comercio *                           │
│  [________________________________]              │
│                                                   │
│  Direccion *                                     │
│  [________________________________]              │
│                                                   │
│  Rubro *                                         │
│  [ Seleccionar rubro           ▼]                │
│                                                   │
│  Telefono *                                      │
│  [________________________________]              │
│                                                   │
│  Email *                                         │
│  [________________________________]              │
│                                                   │
│  CUIT *                                          │
│  [________________________________]              │
│                                                   │
│  Nombre del responsable *                        │
│  [________________________________]              │
│                                                   │
│  [        ENVIAR SOLICITUD        ]              │
│                                                   │
└──────────────────────────────────────────────────┘
```

**Pantalla de Confirmacion:**
```
┌──────────────────────────────────────────────────┐
│           ROJOPLUS - SOLICITUD ENVIADA           │
├──────────────────────────────────────────────────┤
│                                                   │
│              ✓ Solicitud recibida                │
│                                                   │
│  Tu solicitud sera revisada por el club.         │
│  Recibiras un email cuando sea aprobada.         │
│                                                   │
│  Mientras tanto, podes descargar el flyer        │
│  para mostrar en tu comercio:                    │
│                                                   │
│  [    DESCARGAR FLYER "COMERCIO ADHERIDO"   ]    │
│                                                   │
└──────────────────────────────────────────────────┘
```

---

## 2. Flujo de Operacion del Comerciante

### 2.1 Diagrama - Venta Normal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REGISTRO DE VENTA                                    │
└─────────────────────────────────────────────────────────────────────────────┘

    COMERCIANTE                    SISTEMA                      BASE DATOS
         │                            │                           │
         │  1. Accede via link        │                           │
         │     /c/{token}             │                           │
         │ ──────────────────────────▶│                           │
         │                            │  2. Valida token          │
         │                            │ ─────────────────────────▶│
         │                            │ ◀─────────────────────────│
         │                            │                           │
         │  3. Ve pantalla principal  │                           │
         │ ◀──────────────────────────│                           │
         │                            │                           │
         │  4. Ingresa nro socio      │                           │
         │     o DNI                  │                           │
         │ ──────────────────────────▶│                           │
         │                            │  5. Busca socio           │
         │                            │ ─────────────────────────▶│
         │                            │ ◀─────────────────────────│
         │                            │                           │
         │  6. Ve datos del socio     │                           │
         │     (nombre, estado)       │                           │
         │ ◀──────────────────────────│                           │
         │                            │                           │
         │  [Si estado = ACTIVO]      │                           │
         │                            │                           │
         │  7. Ingresa importe        │                           │
         │     de la venta            │                           │
         │ ──────────────────────────▶│                           │
         │                            │  8. Calcula descuento     │
         │                            │     (local)               │
         │                            │                           │
         │  9. Ve descuento y         │                           │
         │     total a cobrar         │                           │
         │ ◀──────────────────────────│                           │
         │                            │                           │
         │  10. Confirma venta        │                           │
         │ ──────────────────────────▶│                           │
         │                            │  11. Guarda venta         │
         │                            │ ─────────────────────────▶│
         │                            │ ◀─────────────────────────│
         │                            │                           │
         │  12. Ve confirmacion       │                           │
         │ ◀──────────────────────────│                           │
         │                            │                           │
         ▼                            ▼                           ▼
```

### 2.2 Diagrama - Venta con Acumulacion

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VENTA CON DESCUENTO POR ACUMULACION                       │
└─────────────────────────────────────────────────────────────────────────────┘

         │  (pasos 1-6 igual que arriba)
         │                            │                           │
         │  7. Ingresa importe        │                           │
         │ ──────────────────────────▶│                           │
         │                            │  8. Cuenta compras del    │
         │                            │     socio en ultimos N    │
         │                            │     dias en este comercio │
         │                            │ ─────────────────────────▶│
         │                            │ ◀── 4 compras ────────────│
         │                            │                           │
         │                            │  9. Compras >= umbral?    │
         │                            │     SI: Aplica dcto extra │
         │                            │                           │
         │  10. Ve:                   │                           │
         │      - Descuento base 10%  │                           │
         │      - Descuento extra 15% │                           │
         │      - Total descuento 25% │                           │
         │      - Total a cobrar      │                           │
         │ ◀──────────────────────────│                           │
         │                            │                           │
         │  (resto igual)             │                           │
         ▼                            ▼                           ▼
```

### 2.3 Pantalla Principal del Comerciante

**Estado inicial:**
```
┌──────────────────────────────────────────────────┐
│  ROJOPLUS              Panaderia Don Juan        │
├──────────────────────────────────────────────────┤
│                                                   │
│  Buscar socio                                    │
│  ┌────────────────────────────────┐              │
│  │                                │  [BUSCAR]    │
│  └────────────────────────────────┘              │
│  Ingresa nro. de socio o DNI                     │
│                                                   │
└──────────────────────────────────────────────────┘
```

**Socio encontrado (ACTIVO):**
```
┌──────────────────────────────────────────────────┐
│  ROJOPLUS              Panaderia Don Juan        │
├──────────────────────────────────────────────────┤
│                                                   │
│  Buscar socio                                    │
│  ┌────────────────────────────────┐              │
│  │ 12345                          │  [BUSCAR]    │
│  └────────────────────────────────┘              │
│                                                   │
│  ┌──────────────────────────────────────────┐    │
│  │  ✓ SOCIO ACTIVO                         │    │
│  │                                          │    │
│  │  Juan Carlos Perez                       │    │
│  │  Socio #12345                           │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  Importe de la venta                             │
│  ┌────────────────────────────────┐              │
│  │ $ 10000                        │              │
│  └────────────────────────────────┘              │
│                                                   │
│  ┌──────────────────────────────────────────┐    │
│  │  Descuento (10%):      $  1.000         │    │
│  │  ─────────────────────────────────       │    │
│  │  TOTAL A COBRAR:       $  9.000         │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  [          REGISTRAR VENTA          ]           │
│                                                   │
└──────────────────────────────────────────────────┘
```

**Socio encontrado (INACTIVO):**
```
┌──────────────────────────────────────────────────┐
│  ROJOPLUS              Panaderia Don Juan        │
├──────────────────────────────────────────────────┤
│                                                   │
│  Buscar socio                                    │
│  ┌────────────────────────────────┐              │
│  │ 12345                          │  [BUSCAR]    │
│  └────────────────────────────────┘              │
│                                                   │
│  ┌──────────────────────────────────────────┐    │
│  │  ✗ SOCIO INACTIVO                       │    │
│  │                                          │    │
│  │  Juan Carlos Perez                       │    │
│  │  Socio #12345                           │    │
│  │                                          │    │
│  │  No aplica descuento                     │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  [           NUEVA BUSQUEDA           ]          │
│                                                   │
└──────────────────────────────────────────────────┘
```

**Con descuento por acumulacion:**
```
┌──────────────────────────────────────────────────┐
│  ...                                              │
│  ┌──────────────────────────────────────────┐    │
│  │  ★ DESCUENTO ESPECIAL                   │    │
│  │  5ta compra en 7 dias                   │    │
│  │                                          │    │
│  │  Descuento base (10%):     $  1.000     │    │
│  │  Descuento extra (15%):    $  1.500     │    │
│  │  ─────────────────────────────────       │    │
│  │  TOTAL DESCUENTO:          $  2.500     │    │
│  │  TOTAL A COBRAR:           $  7.500     │    │
│  └──────────────────────────────────────────┘    │
│  ...                                              │
└──────────────────────────────────────────────────┘
```

---

## 3. Flujo de Administracion

### 3.1 Aprobacion de Comercios

```
    ADMIN                         SISTEMA                      COMERCIANTE
      │                              │                              │
      │  1. Accede a /admin          │                              │
      │ ────────────────────────────▶│                              │
      │                              │                              │
      │  2. Ve dashboard con         │                              │
      │     notificacion de          │                              │
      │     solicitudes pendientes   │                              │
      │ ◀────────────────────────────│                              │
      │                              │                              │
      │  3. Click en "Comercios      │                              │
      │     Pendientes"              │                              │
      │ ────────────────────────────▶│                              │
      │                              │                              │
      │  4. Ve lista de solicitudes  │                              │
      │ ◀────────────────────────────│                              │
      │                              │                              │
      │  5. Click en solicitud       │                              │
      │ ────────────────────────────▶│                              │
      │                              │                              │
      │  6. Ve detalle completo      │                              │
      │ ◀────────────────────────────│                              │
      │                              │                              │
      │  7. Click "APROBAR"          │                              │
      │ ────────────────────────────▶│                              │
      │                              │  8. Genera token             │
      │                              │  9. Actualiza estado         │
      │                              │  10. Envia email             │
      │                              │ ────────────────────────────▶│
      │                              │                              │
      │  11. Confirmacion            │  12. Recibe email con link   │
      │ ◀────────────────────────────│                              │
      │                              │                              │
      ▼                              ▼                              ▼
```

### 3.2 Carga de Socios desde Excel

```
    ADMIN                         SISTEMA
      │                              │
      │  1. Accede a Socios >        │
      │     Cargar Excel             │
      │ ────────────────────────────▶│
      │                              │
      │  2. Selecciona archivo       │
      │ ────────────────────────────▶│
      │                              │
      │                              │  3. Lee archivo
      │                              │  4. Valida formato
      │                              │  5. Muestra preview
      │                              │
      │  6. Ve preview:              │
      │     - X socios nuevos        │
      │     - Y socios a actualizar  │
      │     - Z errores              │
      │ ◀────────────────────────────│
      │                              │
      │  7. Confirma carga           │
      │ ────────────────────────────▶│
      │                              │
      │                              │  8. Procesa:
      │                              │     - Inserta nuevos
      │                              │     - Actualiza existentes
      │                              │
      │  9. Resumen final            │
      │ ◀────────────────────────────│
      │                              │
      ▼                              ▼
```

### 3.3 Pantallas de Admin

**Dashboard:**
```
┌──────────────────────────────────────────────────────────────────────────┐
│  ROJOPLUS ADMIN                                          [Cerrar Sesion] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐  ┌─────────────────────────────────────────────────┐   │
│  │             │  │                                                  │   │
│  │  MENU       │  │   DASHBOARD                                     │   │
│  │             │  │                                                  │   │
│  │  Dashboard  │  │   ┌─────────┐ ┌─────────┐ ┌─────────┐          │   │
│  │             │  │   │ Ventas  │ │Comercios│ │ Socios  │          │   │
│  │  Socios     │  │   │  Hoy    │ │ Activos │ │ Activos │          │   │
│  │  > Listado  │  │   │   45    │ │   12    │ │  1.234  │          │   │
│  │  > Cargar   │  │   └─────────┘ └─────────┘ └─────────┘          │   │
│  │                │  │                                                  │   │
│  │  Comercios  │  │   ┌─────────────────────────────────────────┐   │   │
│  │  > Listado  │  │   │  ⚠ 3 solicitudes pendientes            │   │   │
│  │  > Pendient.│  │   │     [Ver solicitudes]                   │   │   │
│  │             │  │   └─────────────────────────────────────────┘   │   │
│  │  Reportes   │  │                                                  │   │
│  │  > Ventas   │  │   Ultimas ventas                                │   │
│  │  > Export   │  │   ┌────────────────────────────────────────┐    │   │
│  │             │  │   │ Comercio     │ Socio    │ Importe │Hora│    │   │
│  │  Config     │  │   │──────────────│──────────│─────────│────│    │   │
│  │             │  │   │ Panaderia    │ #12345   │ $9.000  │10:30   │   │
│  │             │  │   │ Farmacia X   │ #54321   │ $4.500  │10:15   │   │
│  └─────────────┘  │   │ ...          │          │         │    │    │   │
│                   │   └────────────────────────────────────────┘    │   │
│                   └─────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Casos de Error

### 4.1 Socio no encontrado
```
┌──────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────┐    │
│  │  ✗ SOCIO NO ENCONTRADO                  │    │
│  │                                          │    │
│  │  No se encontro socio con ese           │    │
│  │  numero o documento.                     │    │
│  │                                          │    │
│  │  Verifica los datos e intenta de nuevo. │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

### 4.2 Token invalido
```
┌──────────────────────────────────────────────────┐
│                                                   │
│          ACCESO NO AUTORIZADO                    │
│                                                   │
│  El link que estas usando no es valido          │
│  o el comercio fue desactivado.                 │
│                                                   │
│  Contacta al Club Sportivo Pilar para           │
│  obtener un nuevo link de acceso.               │
│                                                   │
└──────────────────────────────────────────────────┘
```

### 4.3 Error de conexion
```
┌──────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────┐    │
│  │  ⚠ ERROR DE CONEXION                    │    │
│  │                                          │    │
│  │  No se pudo conectar con el servidor.   │    │
│  │  Verifica tu conexion a internet.       │    │
│  │                                          │    │
│  │  [     REINTENTAR     ]                 │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

---

*Documento creado: Enero 2026*
*Version: 1.0*
