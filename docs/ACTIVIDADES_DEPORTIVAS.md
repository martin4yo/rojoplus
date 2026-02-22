# Sistema de Actividades Deportivas - Especificación Técnica

## 📋 Resumen Ejecutivo

Sistema completo para gestión y visualización de actividades deportivas del club, orientado a padres, jugadores y entrenadores. Prioriza simplicidad de uso para usuarios no técnicos.

**Fecha:** 12 de Febrero 2026
**Estado:** En Planificación
**Prioridad:** Alta

---

## 🎯 Objetivos

### Usuarios Objetivo
- **Padres/Tutores:** Consultar horarios, partidos, convocatorias de sus hijos
- **Jugadores:** Ver entrenamientos, partidos, plantel, noticias
- **Entrenadores:** Comunicar información, convocar, compartir documentos
- **Público General:** Conocer actividades disponibles para inscribirse

### Necesidades a Resolver
1. ✅ Consultar horarios de entrenamiento de forma simple
2. ✅ Ver próximos partidos y resultados
3. ✅ Conocer convocatorias y confirmar asistencia
4. ✅ Contactar con entrenadores
5. ✅ Acceder a reglamento de convivencia
6. ✅ Ver noticias y comunicados del deporte
7. ✅ Consultar plantel/integrantes por categoría

---

## 🏗️ Arquitectura del Sistema

### Módulos Principales

```
┌─────────────────────────────────────────────────────────────┐
│                    SISTEMA ACTIVIDADES                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. CRONOGRAMA                                              │
│     - Vista general de entrenamientos y partidos           │
│     - Filtrado simple (buscador + botones)                 │
│     - Múltiples actividades y categorías                   │
│     - Presets de fecha (hoy, semana, mes)                  │
│                                                             │
│  2. DETALLE DE ACTIVIDAD                                    │
│     - Página dinámica por deporte (/actividades/:id)       │
│     - Tabs: Info, Cronograma, Partidos, Plantel, Noticias │
│     - Staff técnico y contacto                             │
│                                                             │
│  3. PARTIDOS Y RESULTADOS                                   │
│     - Próximos partidos por categoría                      │
│     - Resultados históricos                                │
│     - Convocatorias con confirmación                       │
│                                                             │
│  4. REGLAMENTO DE CONVIVENCIA                              │
│     - Sistema administrable por secciones                  │
│     - Versionado y tracking de aceptaciones                │
│     - Descarga PDF                                         │
│                                                             │
│  5. NOTICIAS Y COMUNICADOS                                 │
│     - Noticias específicas por deporte                     │
│     - Comunicados importantes                              │
│     - Destacados del mes                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Modelo de Datos

### Modelos Existentes (ya en BD)

```prisma
// Ya existen en schema.prisma:

model Actividad {
  id          Int      @id @default(autoincrement())
  codigo      String   @unique
  nombre      String
  descripcion String?
  imagen      String?
  activo      Boolean  @default(true)
  categorias  CategoriaActividad[]
}

model CategoriaActividad {
  id                   Int      @id @default(autoincrement())
  actividadId          Int
  codigo               String   @unique
  nombre               String   // "Sub 10", "Sub 12", etc.
  edadMinima           Int?
  edadMaxima           Int?
  sexo                 String?
  cupoMaximo           Int?
  activo               Boolean  @default(true)

  actividad            Actividad @relation(fields: [actividadId], references: [id])
  horarios             HorarioRecurrente[]
  inscripciones        Inscripcion[]
  partidos             Partido[]
}

model HorarioRecurrente {
  id                   Int      @id @default(autoincrement())
  categoriaActividadId Int
  espacioId            Int?
  diaSemana            Int      // 1=Lunes, 2=Martes, ..., 7=Domingo
  horaInicio           String   // "17:00"
  horaFin              String   // "18:30"
  activo               Boolean  @default(true)

  categoriaActividad   CategoriaActividad @relation(fields: [categoriaActividadId], references: [id])
  espacio              EspacioDeportivo? @relation(fields: [espacioId], references: [id])
}

model Partido {
  id                   Int      @id @default(autoincrement())
  categoriaActividadId Int
  fecha                DateTime @db.Date
  hora                 String
  tipo                 String   @default("LIGA") // LIGA, AMISTOSO, TORNEO, COPA
  condicion            String   // LOCAL, VISITANTE
  rival                String
  ubicacion            String?  // Dirección si es visitante
  espacioId            Int?     // Si es local
  resultado            String?  // "3-1", "85-72", etc.
  golesAFavor          Int?
  golesEnContra        Int?
  observaciones        String?

  categoriaActividad   CategoriaActividad @relation(fields: [categoriaActividadId], references: [id])
  convocatorias        Convocatoria[]
}

model Convocatoria {
  id                   Int      @id @default(autoincrement())
  partidoId            Int
  socioId              Int
  confirmado           Boolean? // null=pendiente, true=confirmado, false=rechazado
  motivoRechazo        String?
  notificadoPush       Boolean?
  fechaNotifPush       DateTime?

  partido              Partido @relation(fields: [partidoId], references: [id])
  socio                Socio @relation(fields: [socioId], references: [id])
}

model Inscripcion {
  id                   Int      @id @default(autoincrement())
  socioId              Int
  categoriaActividadId Int
  fechaInscripcion     DateTime @default(now())
  fechaInicio          DateTime
  fechaFin             DateTime?
  activo               Boolean  @default(true)

  socio                Socio @relation(fields: [socioId], references: [id])
  categoriaActividad   CategoriaActividad @relation(fields: [categoriaActividadId], references: [id])
}
```

### Nuevos Modelos a Crear

```prisma
// 1. STAFF TÉCNICO
model StaffTecnico {
  id                   Int      @id @default(autoincrement())
  categoriaActividadId Int      @map("categoria_actividad_id")
  nombre               String
  apellido             String
  rol                  String   // ENTRENADOR, AYUDANTE, PREPARADOR_FISICO, COORDINADOR
  foto                 String?
  email                String?
  telefono             String?
  biografia            String?  @db.Text
  activo               Boolean  @default(true)
  orden                Int      @default(0)
  createdAt            DateTime @default(now()) @map("created_at")
  updatedAt            DateTime @updatedAt @map("updated_at")

  categoriaActividad   CategoriaActividad @relation(fields: [categoriaActividadId], references: [id], onDelete: Cascade)

  @@index([categoriaActividadId])
  @@map("staff_tecnico")
}

// 2. NOTICIAS DEPORTIVAS
model NoticiaDeportiva {
  id                Int      @id @default(autoincrement())
  actividadId       Int?     @map("actividad_id") // null = general del club
  categoriaId       Int?     @map("categoria_id") // null = toda la actividad
  titulo            String
  copete            String?  @db.Text // Resumen corto
  contenido         String   @db.Text
  imagen            String?
  autor             String?
  destacada         Boolean  @default(false)
  tipo              String   @default("NOTICIA") // NOTICIA, COMUNICADO, RESULTADO
  fechaPublicacion  DateTime @default(now()) @map("fecha_publicacion")
  activo            Boolean  @default(true)
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  actividad         Actividad? @relation(fields: [actividadId], references: [id], onDelete: Cascade)
  categoria         CategoriaActividad? @relation(fields: [categoriaId], references: [id], onDelete: Cascade)

  @@index([actividadId])
  @@index([categoriaId])
  @@index([fechaPublicacion])
  @@map("noticias_deportivas")
}

// 3. REGLAMENTO DE CONVIVENCIA
model ArticuloReglamento {
  id                 Int      @id @default(autoincrement())
  seccion            String   // GENERAL, PADRES, JUGADORES, ENTRENADORES, SANCIONES, CONFLICTOS
  titulo             String
  contenido          String   @db.Text
  orden              Int      @default(0)
  activo             Boolean  @default(true)
  version            Int      @default(1)
  fechaVigencia      DateTime @default(now()) @map("fecha_vigencia")
  requiereAceptacion Boolean  @default(false) @map("requiere_aceptacion")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  aceptaciones       AceptacionReglamento[]

  @@index([seccion])
  @@index([activo])
  @@map("articulos_reglamento")
}

model AceptacionReglamento {
  id              Int      @id @default(autoincrement())
  socioId         Int      @map("socio_id")
  articuloId      Int      @map("articulo_id")
  version         Int      // Versión que aceptó
  fechaAceptacion DateTime @default(now()) @map("fecha_aceptacion")
  ipAddress       String?  @map("ip_address")

  socio           Socio    @relation(fields: [socioId], references: [id], onDelete: Cascade)
  articulo        ArticuloReglamento @relation(fields: [articuloId], references: [id], onDelete: Cascade)

  @@unique([socioId, articuloId, version])
  @@index([socioId])
  @@map("aceptaciones_reglamento")
}

// 4. MENSAJES A ENTRENADORES (Sistema simple)
model MensajeEntrenador {
  id              Int      @id @default(autoincrement())
  staffId         Int      @map("staff_id")
  nombre          String   // Nombre de quien envía
  email           String
  telefono        String?
  socioId         Int?     @map("socio_id") // Si está logueado
  asunto          String
  mensaje         String   @db.Text
  leido           Boolean  @default(false)
  respondido      Boolean  @default(false)
  createdAt       DateTime @default(now()) @map("created_at")

  staff           StaffTecnico @relation(fields: [staffId], references: [id], onDelete: Cascade)
  socio           Socio? @relation(fields: [socioId], references: [id], onDelete: SetNull)

  @@index([staffId])
  @@index([leido])
  @@map("mensajes_entrenador")
}
```

---

## 🎨 Diseño UX/UI

### Principios de Diseño

1. **SIMPLICIDAD PRIMERO**
   - Usuario promedio: padre/madre consultando horarios de su hijo
   - Menos clicks = mejor experiencia
   - Lenguaje cotidiano, no técnico

2. **MOBILE FIRST**
   - 70%+ accederá desde celular
   - Botones grandes, fáciles de tocar
   - Mínimo scroll horizontal

3. **FEEDBACK VISUAL CLARO**
   - Iconos + colores por deporte
   - Estados visibles (filtrado, cargando, vacío)
   - Confirmaciones sin modal cuando sea posible

4. **ACCESIBILIDAD**
   - Contraste adecuado
   - Tamaños de fuente legibles
   - Alt text en imágenes

### Paleta de Colores por Deporte

```javascript
const COLORES_DEPORTES = {
  FUTBOL: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-500',
    icon: '⚽'
  },
  BASQUET: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-500',
    icon: '🏀'
  },
  HOCKEY: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-500',
    icon: '🏑'
  },
  NATACION: {
    bg: 'bg-cyan-100',
    text: 'text-cyan-800',
    border: 'border-cyan-500',
    icon: '🏊'
  },
  VOLEY: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-500',
    icon: '🏐'
  },
  TENIS: {
    bg: 'bg-lime-100',
    text: 'text-lime-800',
    border: 'border-lime-500',
    icon: '🎾'
  }
}
```

---

## 🛣️ Rutas y Navegación

### Páginas Públicas

```
/actividades                          → Listado de todas las actividades
/actividades/:id                      → Detalle de actividad con tabs
/cronograma                           → Cronograma general (todos los deportes)
/cronograma?actividades=1,3           → Pre-filtrado por actividades
/reglamento-convivencia               → Reglamento completo
/actividades/:id/noticias             → Noticias de una actividad específica
```

### Portal Socio

```
/s/:token/mis-actividades             → Actividades del socio y familia
/s/:token/cronograma                  → Cronograma pre-filtrado por inscripciones
/s/:token/convocatorias               → Convocatorias pendientes de confirmar
/s/:token/actividades/:id             → Detalle con info personalizada
```

### Admin

```
/admin/actividades                    → CRUD actividades
/admin/actividades/:id/categorias     → CRUD categorías
/admin/actividades/:id/staff          → CRUD staff técnico
/admin/partidos                       → CRUD partidos
/admin/partidos/:id/convocatorias     → Gestión de convocatorias
/admin/noticias-deportivas            → CRUD noticias
/admin/reglamento                     → CRUD reglamento
```

---

## 🔌 API Endpoints

### Endpoints Públicos

```javascript
// CRONOGRAMA
GET /api/public/cronograma
  Query params:
    - actividadIds: "1,2,3" (opcional)
    - categoriaIds: "5,8" (opcional)
    - desde: "2026-02-10" (opcional, default: hoy)
    - hasta: "2026-02-17" (opcional, default: +1 mes)
    - tipos: "entrenamientos,partidos,eventos" (opcional, default: todos)
  Response: {
    success: true,
    filtros: {...},
    data: {
      entrenamientos: [...],
      partidos: [...],
      eventos: [...]
    }
  }

// ACTIVIDADES
GET /api/public/actividades
  Response: Lista de actividades activas con categorías

GET /api/public/actividades/:id
  Response: Detalle completo de actividad (ya existe, mejorar)

GET /api/public/actividades/:id/staff
  Response: Staff técnico de la actividad

GET /api/public/actividades/:id/noticias?limit=10
  Response: Noticias de la actividad

GET /api/public/actividades/:id/partidos?desde=2026-02-10&hasta=2026-03-10
  Response: Partidos de la actividad en rango

GET /api/public/actividades/:id/plantel?categoriaId=5
  Response: Lista de inscriptos (solo nombres, respetando privacidad)

// REGLAMENTO
GET /api/public/reglamento
  Response: Todos los artículos activos agrupados por sección

GET /api/public/reglamento/pdf
  Response: PDF descargable del reglamento

// NOTICIAS
GET /api/public/noticias-deportivas?actividadId=1&limit=10
  Response: Noticias deportivas filtradas

// PARTIDOS
GET /api/public/partidos/proximos?actividadId=1&categoriaId=5
  Response: Próximos partidos filtrados

// CONTACTO ENTRENADOR
POST /api/public/contacto-entrenador
  Body: { staffId, nombre, email, telefono, asunto, mensaje }
  Response: { success: true, message: "Mensaje enviado" }
```

### Endpoints Portal Socio

```javascript
// MIS ACTIVIDADES
GET /api/socio/:token/mis-actividades
  Response: Inscripciones activas del socio y grupo familiar

GET /api/socio/:token/cronograma
  Response: Cronograma pre-filtrado por inscripciones

GET /api/socio/:token/convocatorias
  Response: Convocatorias pendientes de confirmar

PUT /api/socio/:token/convocatorias/:id/confirmar
  Body: { confirmado: true/false, motivoRechazo?: string }
  Response: { success: true }
```

### Endpoints Admin

```javascript
// STAFF TÉCNICO
GET /api/admin/actividades/:id/staff
POST /api/admin/staff
PUT /api/admin/staff/:id
DELETE /api/admin/staff/:id

// PARTIDOS
GET /api/admin/partidos?categoriaId=5&desde=2026-02-01
POST /api/admin/partidos
PUT /api/admin/partidos/:id
DELETE /api/admin/partidos/:id

// CONVOCATORIAS
GET /api/admin/partidos/:id/convocatorias
POST /api/admin/partidos/:id/convocatorias
  Body: { socioIds: [1,2,3] }
DELETE /api/admin/convocatorias/:id

// NOTICIAS
GET /api/admin/noticias-deportivas
POST /api/admin/noticias-deportivas
PUT /api/admin/noticias-deportivas/:id
DELETE /api/admin/noticias-deportivas/:id

// REGLAMENTO
GET /api/admin/reglamento
POST /api/admin/reglamento/articulo
PUT /api/admin/reglamento/articulo/:id
DELETE /api/admin/reglamento/articulo/:id
GET /api/admin/reglamento/estadisticas-aceptacion

// MENSAJES
GET /api/admin/mensajes-entrenador?staffId=5&leido=false
PUT /api/admin/mensajes-entrenador/:id/marcar-leido
```

---

## 📱 Componentes Frontend

### Componentes Principales

```
client/src/
├── pages/
│   ├── public/
│   │   ├── Cronograma.jsx                    [NUEVO]
│   │   ├── ActividadDetalle.jsx              [MODIFICAR - agregar tabs]
│   │   ├── ReglamentoConvivencia.jsx         [NUEVO]
│   │   └── NoticiasDeportivas.jsx            [NUEVO]
│   │
│   ├── socio/
│   │   ├── MisActividades.jsx                [NUEVO]
│   │   ├── MiCronograma.jsx                  [NUEVO]
│   │   └── MisConvocatorias.jsx              [NUEVO]
│   │
│   └── admin/
│       ├── deportes/
│       │   ├── StaffTecnico.jsx              [NUEVO]
│       │   ├── Partidos.jsx                  [NUEVO]
│       │   ├── PartidoForm.jsx               [NUEVO]
│       │   ├── Convocatorias.jsx             [NUEVO]
│       │   ├── NoticiasDeportivas.jsx        [NUEVO]
│       │   └── ReglamentoAdmin.jsx           [NUEVO]
│
├── components/
│   ├── cronograma/
│   │   ├── CronogramaGrid.jsx                [NUEVO] - Grilla semanal
│   │   ├── CronogramaLista.jsx               [NUEVO] - Vista lista
│   │   ├── FiltrosCronograma.jsx             [NUEVO] - Buscador + filtros
│   │   └── EventoCard.jsx                    [NUEVO] - Card de evento
│   │
│   ├── actividades/
│   │   ├── TabsActividad.jsx                 [NUEVO] - Tabs de detalle
│   │   ├── StaffCard.jsx                     [NUEVO] - Card de entrenador
│   │   ├── PartidoCard.jsx                   [NUEVO] - Card de partido
│   │   ├── PlantelLista.jsx                  [NUEVO] - Lista de jugadores
│   │   └── FormContactoEntrenador.jsx        [NUEVO] - Formulario contacto
│   │
│   └── reglamento/
│       ├── SeccionReglamento.jsx             [NUEVO] - Sección expandible
│       └── ModalAceptacion.jsx               [NUEVO] - Modal de aceptación
```

### Componentes Reutilizables

```jsx
// EventoCard.jsx - Card genérico para entrenamientos/partidos
<EventoCard
  tipo="entrenamiento|partido|evento"
  icono="⚽"
  titulo="Fútbol Sub 10"
  fecha={new Date()}
  horaInicio="17:00"
  horaFin="18:30"
  lugar="Cancha 1"
  onClick={() => {}}
/>

// FiltroDeporte.jsx - Botón de filtro visual
<FiltroDeporte
  deporte={{ id: 1, nombre: "Fútbol", icono: "⚽" }}
  activo={true}
  onClick={() => {}}
/>

// BuscadorSimple.jsx - Buscador estilo Google
<BuscadorSimple
  placeholder="Ej: Fútbol Sub 10, Básquet..."
  value={busqueda}
  onChange={setBusqueda}
/>
```

---

## 🔐 Permisos y Seguridad

### Permisos Admin

```javascript
// server/src/constants/permisos.js
export const PERMISOS = {
  // ... existentes

  // Nuevos permisos
  STAFF_TECNICO_VER: 'STAFF_TECNICO_VER',
  STAFF_TECNICO_CREAR: 'STAFF_TECNICO_CREAR',
  STAFF_TECNICO_EDITAR: 'STAFF_TECNICO_EDITAR',
  STAFF_TECNICO_ELIMINAR: 'STAFF_TECNICO_ELIMINAR',

  PARTIDOS_VER: 'PARTIDOS_VER',
  PARTIDOS_CREAR: 'PARTIDOS_CREAR',
  PARTIDOS_EDITAR: 'PARTIDOS_EDITAR',
  PARTIDOS_ELIMINAR: 'PARTIDOS_ELIMINAR',

  CONVOCATORIAS_VER: 'CONVOCATORIAS_VER',
  CONVOCATORIAS_GESTIONAR: 'CONVOCATORIAS_GESTIONAR',

  NOTICIAS_DEPORTIVAS_VER: 'NOTICIAS_DEPORTIVAS_VER',
  NOTICIAS_DEPORTIVAS_CREAR: 'NOTICIAS_DEPORTIVAS_CREAR',
  NOTICIAS_DEPORTIVAS_EDITAR: 'NOTICIAS_DEPORTIVAS_EDITAR',
  NOTICIAS_DEPORTIVAS_ELIMINAR: 'NOTICIAS_DEPORTIVAS_ELIMINAR',

  REGLAMENTO_VER: 'REGLAMENTO_VER',
  REGLAMENTO_EDITAR: 'REGLAMENTO_EDITAR',

  MENSAJES_ENTRENADOR_VER: 'MENSAJES_ENTRENADOR_VER'
}
```

### Validaciones

```javascript
// Validaciones de datos
- Email: formato válido
- Teléfono: solo números y caracteres permitidos (+, -, espacio)
- Fechas: no permitir fechas pasadas para partidos futuros
- Horarios: horaFin > horaInicio
- Convocatorias: solo jugadores inscriptos en la categoría
- Reglamento: no eliminar artículos con aceptaciones, solo desactivar
```

---

## 🧪 Testing

### Tests Unitarios

```javascript
// Funciones helpers
- generarInstanciasEntrenamientos() → verificar recurrencia correcta
- filtrarPorBusqueda() → verificar búsqueda flexible
- agruparPorDia() → verificar agrupación correcta
- calcularRangoFecha() → verificar presets de fecha

// Componentes
- EventoCard → render correcto según tipo
- FiltrosCronograma → aplicar filtros correctamente
- FormContactoEntrenador → validaciones
```

### Tests de Integración

```javascript
// Flujos críticos
1. Usuario busca "futbol sub 10" → ver resultados correctos
2. Usuario filtra por múltiples deportes → ver combinación correcta
3. Socio confirma convocatoria → actualizar estado
4. Admin crea partido → enviar notificaciones
5. Usuario acepta reglamento → guardar en BD
```

### Tests E2E

```javascript
// Cypress/Playwright
1. Flujo completo: entrar a cronograma → filtrar → ver detalle
2. Portal socio: ver convocatorias → confirmar asistencia
3. Admin: crear partido → convocar jugadores → verificar notificación
```

---

## 📈 Métricas y Analytics

### Métricas de Uso

```javascript
// Tracking de eventos (Google Analytics / Mixpanel)
- cronograma_filtro_aplicado
- actividad_detalle_vista
- convocatoria_confirmada
- contacto_entrenador_enviado
- reglamento_aceptado
- noticia_vista
```

### KPIs

```
- % de convocatorias confirmadas
- Tiempo promedio en cronograma
- Actividades más consultadas
- % de aceptación de reglamento
- Mensajes a entrenadores por mes
```

---

## 🚀 Performance

### Optimizaciones

```javascript
// Frontend
- Lazy loading de tabs en detalle de actividad
- Virtualización de listas largas (react-window)
- Caché de imágenes de deportes
- Debounce en buscador (300ms)
- Paginación en noticias

// Backend
- Índices en BD (actividadId, categoriaId, fechas)
- Caché de cronograma (5 min) - Redis opcional
- Eager loading con Prisma include
- Limitar resultados (max 100 eventos en cronograma)

// Assets
- Imágenes optimizadas (WebP)
- Iconos como sprites o inline SVG
- Lazy loading de imágenes
```

---

## 📱 Progressive Web App (PWA)

### Funcionalidades PWA

```javascript
// Service Worker
- Caché de cronograma offline
- Notificaciones push para convocatorias
- Agregar a calendario del dispositivo
- Compartir cronograma (Web Share API)

// Manifest
- Nombre: "Actividades - [Club Name]"
- Ícono: logo del club
- Theme color: rojo del club
- Display: standalone
```

---

## 🔔 Notificaciones

### Canales de Notificación

```javascript
// 1. Push Notifications (Web/Mobile)
- Nueva convocatoria a partido
- Cambio en horario de entrenamiento
- Suspensión de actividad
- Nueva noticia de la actividad

// 2. Email
- Resumen semanal de actividades
- Recordatorio de convocatoria (24hs antes)
- Nuevo mensaje del entrenador
- Actualización de reglamento

// 3. WhatsApp (futuro)
- Convocatorias urgentes
- Suspensiones de último momento
```

---

## 🌐 Internacionalización (i18n)

### Idiomas

```javascript
// Fase 1: Solo Español
// Futuro: Inglés (comunidad internacional)

// Textos a traducir
- Días de la semana
- Meses
- Etiquetas de UI
- Mensajes de error/éxito
- Secciones del reglamento
```

---

## 📝 Logs y Auditoría

### Eventos a Loguear

```javascript
// Acciones críticas
- Creación/modificación/eliminación de partidos
- Envío de convocatorias
- Confirmación/rechazo de convocatorias
- Aceptación de reglamento (con IP y timestamp)
- Cambios en horarios (notificar a inscriptos)
- Mensajes a entrenadores (anti-spam)
```

---

## 🔄 Integraciones Futuras

### Posibles Integraciones

```javascript
// Google Calendar
- Exportar cronograma personal
- Sincronización automática

// iCal
- Descarga de calendario .ics

// WhatsApp Business API
- Notificaciones automatizadas
- Bot para consultas

// Sistema de Pagos
- Multas por inasistencia a convocatorias
- Pago de cuota desde detalle de actividad
```

---

## 🐛 Manejo de Errores

### Estrategia de Error Handling

```javascript
// Frontend
- Toast notifications para errores no críticos
- Modales para errores que requieren acción
- Fallback UI si falla carga de datos
- Retry automático en errores de red

// Backend
- Logs estructurados (Winston)
- Rollbar/Sentry para tracking de errores
- Respuestas HTTP estándar
- Mensajes de error claros y accionables
```

---

## 📚 Documentación

### Documentación de Usuario

```
- Guía rápida para padres (PDF)
- Video tutorial del cronograma (2 min)
- FAQ: "¿Cómo confirmo asistencia a un partido?"
- Tooltips en UI para funciones avanzadas
```

### Documentación Técnica

```
- README.md actualizado
- JSDoc en funciones complejas
- Swagger/OpenAPI para endpoints
- Diagramas de flujo (Mermaid)
- Este documento (ACTIVIDADES_DEPORTIVAS.md)
```

---

## 🔐 Backup y Recuperación

### Estrategia de Backup

```javascript
// Base de Datos
- Backup automático diario (PostgreSQL)
- Retención: 30 días
- Backup antes de migraciones

// Archivos
- Imágenes de noticias → S3 o similar
- PDFs de reglamento → versionados
- Fotos de staff → backup semanal
```

---

## 🎓 Capacitación

### Roles a Capacitar

```javascript
// Administradores
- CRUD de partidos y convocatorias
- Gestión de noticias deportivas
- Edición de reglamento
- Respuesta a mensajes de padres

// Coordinadores Deportivos
- Uso del sistema de convocatorias
- Actualización de horarios
- Publicación de noticias
- Gestión de staff técnico

// Entrenadores (opcional)
- Ver mensajes recibidos
- Actualizar información personal
- Publicar comunicados
```

---

## ✅ Criterios de Aceptación

### Fase 1 - MVP

```
✅ Cronograma funcional con filtros simples
✅ Detalle de actividad con tabs básicos
✅ Próximos partidos visibles
✅ Convocatorias con confirmación desde portal socio
✅ Staff técnico visible
✅ Reglamento de convivencia administrable
✅ Noticias por actividad (CRUD admin)
✅ Responsive en mobile
✅ Performance < 3s carga inicial
✅ Tests unitarios básicos
```

### Fase 2

```
□ Resultados históricos con estadísticas
□ Formulario de contacto a entrenador
□ Notificaciones push
□ Exportar cronograma a calendario
□ Galería de fotos por actividad
□ Videos/highlights
□ Tabla de posiciones
```

---

## 🎯 Definición de "Terminado" (DoD)

Para considerar una funcionalidad completada:

1. ✅ Código implementado y revisado
2. ✅ Tests unitarios pasando
3. ✅ Responsive (mobile + desktop)
4. ✅ Manejo de errores implementado
5. ✅ Permisos configurados
6. ✅ Documentación actualizada
7. ✅ Probado en entorno de staging
8. ✅ Aprobado por usuario final (si aplica)

---

**Última actualización:** 12 de Febrero 2026
**Próxima revisión:** Al completar Fase 1
