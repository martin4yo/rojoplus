# RojoPlus - Sistema de Fidelizacion
## Club Sportivo Pilar - "El Rojo de la Avenida"

---

## 1. Descripcion General

**RojoPlus** es una aplicacion web de fidelizacion que permite a los socios del Club Sportivo Pilar obtener descuentos en comercios adheridos presentando su numero de socio, carnet o documento de identidad.

### 1.1 Objetivos
- Brindar beneficios tangibles a los socios del club
- Generar alianzas con comercios de la zona
- Registrar y analizar el uso del programa de beneficios
- Facilitar la operacion para comerciantes con una interfaz simple

### 1.2 Caracteristicas Clave
- **Simplicidad**: Una sola pantalla principal para el comerciante
- **Acceso rapido**: Link con token para evitar login constante
- **Sin app nativa**: Web responsive, funciona en cualquier celular
- **Mantenimiento minimo**: Socios se cargan desde Excel

---

## 2. Usuarios del Sistema

### 2.1 Comerciantes Adheridos
- Se registran en el sistema con sus datos comerciales
- Requieren **aprobacion del club** antes de operar
- Acceden via link con token (sin necesidad de login cada vez)
- Registran ventas a socios y el sistema calcula descuentos

### 2.2 Administradores del Club
- Cargan/actualizan socios desde archivo Excel
- Aprueban o rechazan solicitudes de comercios
- Configuran el porcentaje de descuento sugerido
- Acceden a reportes de uso del programa

### 2.3 Socios (usuarios pasivos)
- No interactuan directamente con el sistema
- Solo presentan su identificacion al comerciante
- Cualquier persona puede usar el beneficio presentando datos de un socio activo

---

## 3. Funcionalidades por Modulo

### 3.1 Modulo de Registro de Comercios

**Datos requeridos:**
| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| Nombre del comercio | Texto | Si |
| Direccion | Texto | Si |
| Rubro | Selector (tabla predefinida) | Si |
| Telefono | Texto | Si |
| Email | Email | Si |
| CUIT | Texto | Si |
| Nombre del responsable | Texto | Si |

**Flujo:**
1. Comerciante accede a pagina de registro
2. Completa formulario con sus datos
3. Sistema guarda solicitud en estado "PENDIENTE"
4. Comerciante puede descargar flyer de "Comercio Adherido"
5. Administrador recibe notificacion de nueva solicitud
6. Administrador aprueba/rechaza la solicitud
7. Si aprueba: se envia email con link de acceso (con token)
8. Comerciante accede al sistema via el link

### 3.2 Modulo de Operacion del Comerciante (Pantalla Principal)

**Pantalla unica con flujo simple:**

```
+------------------------------------------+
|          ROJOPLUS - [Nombre Comercio]    |
+------------------------------------------+
|                                          |
|  Buscar Socio:                          |
|  [____________________________] [Buscar] |
|  (Nro. Socio o DNI)                     |
|                                          |
+------------------------------------------+
|  (Resultado de busqueda)                 |
|                                          |
|  Socio: Juan Perez                      |
|  Estado: ACTIVO                         |
|  Nro. Socio: 12345                      |
|                                          |
+------------------------------------------+
|                                          |
|  Importe de la venta: $[__________]     |
|                                          |
|  Descuento (10%):     $1.000            |
|  TOTAL A COBRAR:      $9.000            |
|                                          |
|  [        REGISTRAR VENTA        ]      |
|                                          |
+------------------------------------------+
```

**Flujo:**
1. Comerciante ingresa numero de socio o DNI
2. Sistema busca y valida que el socio este ACTIVO
3. Si esta activo: muestra datos del socio
4. Comerciante ingresa importe de la venta
5. Sistema calcula descuento y muestra total a cobrar
6. Comerciante presiona "Registrar Venta"
7. Sistema guarda la transaccion y muestra confirmacion

**Validaciones:**
- Si socio no existe: "Socio no encontrado"
- Si socio inactivo: "Socio INACTIVO - No aplica descuento"
- El descuento se calcula automaticamente segun configuracion del comercio

### 3.3 Modulo de Descuentos por Acumulacion (Opcional por comercio)

**Configuracion:**
- El comerciante puede activar/desactivar esta opcion
- Parametros: cantidad de compras requeridas, periodo (dias), % descuento extra

**Ejemplo de configuracion:**
- Compras requeridas: 4
- Periodo: 7 dias
- Descuento extra: 15%

**Logica:**
- Sistema cuenta compras del socio en ese comercio en los ultimos N dias
- Si alcanza el umbral, aplica descuento extra en la siguiente compra
- Despues de aplicar el descuento extra, el contador se reinicia

### 3.4 Modulo de Administracion del Club

**Funcionalidades:**

#### 3.4.1 Gestion de Socios
- Subir archivo Excel para actualizar base de socios
- Ver listado de socios
- Buscar socio por nombre, DNI o numero

#### 3.4.2 Gestion de Comercios
- Ver solicitudes pendientes de aprobacion
- Aprobar/Rechazar solicitudes
- Ver listado de comercios activos
- Desactivar comercios
- Reenviar link de acceso

#### 3.4.3 Configuracion de Beneficios
- Establecer % de descuento sugerido (default para nuevos comercios)
- Ver/editar descuento de cada comercio

#### 3.4.4 Reportes
- **Ventas por comercio**: Total vendido, cantidad de transacciones, periodo
- **Ventas por socio**: Que socios usan mas el beneficio
- **Ventas por periodo**: Diario, semanal, mensual
- **Resumen general**: Metricas globales del programa

---

## 4. Reglas de Negocio

### 4.1 Validacion de Socios
- Un socio es valido si el campo "Estado" en el Excel indica que esta activo
- La busqueda se puede hacer por Nro.Socio o por Documento (DNI)
- Cualquier persona puede presentar los datos de un socio (no se valida identidad)

### 4.2 Calculo de Descuentos
```
Descuento Base = Importe Venta * (% Descuento Comercio / 100)
Total a Cobrar = Importe Venta - Descuento Base

Si aplica descuento por acumulacion:
  Descuento Extra = Importe Venta * (% Descuento Extra / 100)
  Total a Cobrar = Importe Venta - Descuento Base - Descuento Extra
```

### 4.3 Registro de Transacciones
Cada venta registra:
- Fecha y hora
- ID del comercio
- ID del socio
- Importe original
- Importe con descuento
- Porcentaje aplicado
- Si aplico descuento por acumulacion

### 4.4 Acceso de Comerciantes
- El link con token tiene validez indefinida (o configurable)
- Si el comercio es desactivado, el token deja de funcionar
- El comerciante puede solicitar un nuevo link desde el panel

---

## 5. Estados

### 5.1 Estados de Comercio
| Estado | Descripcion |
|--------|-------------|
| PENDIENTE | Solicitud enviada, esperando aprobacion |
| ACTIVO | Aprobado y operativo |
| RECHAZADO | Solicitud rechazada por el club |
| INACTIVO | Desactivado por el club |

### 5.2 Estados de Socio
- Se determina por el campo "Estado" del archivo Excel
- Valores posibles: segun datos del club (tipicamente ACTIVO/INACTIVO)

---

## 6. Notificaciones por Email

| Evento | Destinatario | Contenido |
|--------|--------------|-----------|
| Nueva solicitud de comercio | Admin del club | Aviso de nueva solicitud |
| Solicitud aprobada | Comerciante | Link de acceso con token |
| Solicitud rechazada | Comerciante | Notificacion de rechazo |

---

## 7. Rubros de Comercios (Tabla Predefinida)

Lista sugerida (modificable por el club):
- Gastronomia
- Indumentaria
- Farmacia
- Libreria
- Supermercado/Almacen
- Ferreteria
- Electronica
- Servicios Profesionales
- Belleza y Estetica
- Deportes
- Automotor
- Hogar y Decoracion
- Otros

---

## 8. Consideraciones de Usabilidad

### 8.1 Para Comerciantes
- Interfaz minimalista, una sola pantalla
- Botones grandes, faciles de tocar en celular
- Confirmacion visual clara de cada operacion
- Link guardable en pantalla de inicio del celular

### 8.2 Para Administradores
- Panel web tradicional con menu lateral
- Exportacion de reportes a Excel/CSV
- Carga de Excel con preview antes de confirmar

---

*Documento creado: Enero 2026*
*Version: 1.0*
