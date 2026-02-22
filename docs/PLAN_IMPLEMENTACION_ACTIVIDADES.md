# Plan de Implementación - Sistema de Actividades Deportivas

## 📋 Resumen

**Proyecto:** Sistema de Actividades Deportivas
**Fecha Inicio:** 12 de Febrero 2026
**Estimación Total:** 3-4 semanas (Fase 1)
**Equipo:** 1-2 desarrolladores

---

## 🎯 Fases del Proyecto

### **FASE 1 - MVP (Prioridad Alta)** ⭐
**Objetivo:** Sistema funcional y usable para padres y jugadores
**Duración:** 3-4 semanas

**Entregables:**
1. Cronograma general con filtros simples
2. Detalle de actividad con tabs
3. Próximos partidos
4. Convocatorias con confirmación
5. Staff técnico
6. Reglamento de convivencia
7. Noticias deportivas

### **FASE 2 - Mejoras (Prioridad Media)**
**Objetivo:** Funcionalidades adicionales y optimizaciones
**Duración:** 2-3 semanas

**Entregables:**
1. Resultados históricos
2. Contacto con entrenador
3. Estadísticas básicas
4. Notificaciones push
5. Exportar calendario

### **FASE 3 - Avanzado (Prioridad Baja)**
**Objetivo:** Funcionalidades premium
**Duración:** 3-4 semanas

**Entregables:**
1. Tabla de posiciones
2. Galería multimedia
3. Chat en tiempo real
4. Asistencias con tracking
5. Integración con Google Calendar

---

## 📦 FASE 1 - Desglose Detallado

---

## **SPRINT 1: Base de Datos y Backend Core** (Semana 1)

### 1.1 Migraciones de Base de Datos

**Archivo:** `server/prisma/schema.prisma`

**Tareas:**
- [ ] Agregar modelo `StaffTecnico`
- [ ] Agregar modelo `NoticiaDeportiva`
- [ ] Agregar modelo `ArticuloReglamento`
- [ ] Agregar modelo `AceptacionReglamento`
- [ ] Agregar modelo `MensajeEntrenador`
- [ ] Agregar campos faltantes en `Partido` (resultado, golesAFavor, golesEnContra)
- [ ] Agregar relaciones en modelos existentes
- [ ] Crear índices para performance

**Comandos:**
```bash
cd server
npx prisma db push
npx prisma generate
```

**Validación:**
- ✅ Todos los modelos creados sin errores
- ✅ Relaciones funcionando correctamente
- ✅ Índices creados

---

### 1.2 Seeds de Datos de Prueba

**Archivo:** `server/prisma/seed.js` (crear o modificar)

**Tareas:**
- [ ] Crear actividades de ejemplo (Fútbol, Básquet, Hockey)
- [ ] Crear categorías por actividad (Sub 8, Sub 10, Sub 12, etc.)
- [ ] Crear horarios recurrentes de ejemplo
- [ ] Crear partidos de ejemplo (próximos y pasados)
- [ ] Crear staff técnico de ejemplo
- [ ] Crear noticias deportivas de ejemplo
- [ ] Crear artículos de reglamento de ejemplo

**Comando:**
```bash
npx prisma db seed
```

**Validación:**
- ✅ Datos visibles en BD
- ✅ Relaciones correctas

---

### 1.3 Backend - Endpoints Públicos

**Archivo:** `server/src/routes/public.js`

**Endpoints a implementar:**

#### 1.3.1 Cronograma General
```javascript
GET /api/public/cronograma
```

**Tareas:**
- [ ] Implementar lógica de filtrado por actividades
- [ ] Implementar lógica de filtrado por categorías
- [ ] Implementar filtrado por rango de fechas
- [ ] Función helper: `generarInstanciasEntrenamientos()`
- [ ] Función helper: `calcularRangoFecha()` (presets)
- [ ] Combinar entrenamientos + partidos + eventos
- [ ] Tests unitarios

**Código base:**
```javascript
router.get('/cronograma', asyncHandler(async (req, res) => {
  const { actividadIds, categoriaIds, desde, hasta, tipos } = req.query

  // Parsear parámetros
  const actividades = actividadIds ? actividadIds.split(',').map(Number) : []
  const categorias = categoriaIds ? categoriaIds.split(',').map(Number) : []
  const tiposArray = tipos ? tipos.split(',') : ['entrenamientos', 'partidos']

  const fechaDesde = desde ? new Date(desde) : new Date()
  const fechaHasta = hasta ? new Date(hasta) : addMonths(new Date(), 1)

  // TODO: Implementar lógica

  res.json({ success: true, data: { entrenamientos: [], partidos: [] } })
}))
```

#### 1.3.2 Staff Técnico
```javascript
GET /api/public/actividades/:id/staff
```

**Tareas:**
- [ ] Obtener staff de una actividad
- [ ] Agrupar por categoría
- [ ] Ordenar por rol (DT primero)
- [ ] Tests unitarios

#### 1.3.3 Noticias Deportivas
```javascript
GET /api/public/noticias-deportivas
GET /api/public/actividades/:id/noticias
```

**Tareas:**
- [ ] Listar noticias con paginación
- [ ] Filtrar por actividad
- [ ] Filtrar por categoría
- [ ] Ordenar por fecha descendente
- [ ] Tests unitarios

#### 1.3.4 Próximos Partidos
```javascript
GET /api/public/partidos/proximos
GET /api/public/actividades/:id/partidos
```

**Tareas:**
- [ ] Filtrar partidos futuros
- [ ] Incluir información de categoría y actividad
- [ ] Ordenar por fecha ascendente
- [ ] Tests unitarios

#### 1.3.5 Reglamento
```javascript
GET /api/public/reglamento
```

**Tareas:**
- [ ] Obtener artículos activos
- [ ] Agrupar por sección
- [ ] Ordenar por orden
- [ ] Tests unitarios

**Validación Sprint 1:**
- ✅ Todos los endpoints responden correctamente
- ✅ Tests pasando
- ✅ Documentación básica (comentarios)
- ✅ Probado con Postman/Thunder Client

---

## **SPRINT 2: Backend Portal Socio y Admin** (Semana 1-2)

### 2.1 Backend - Endpoints Portal Socio

**Archivo:** `server/src/routes/socio.js` (existente o crear)

#### 2.1.1 Mis Actividades
```javascript
GET /api/socio/:token/mis-actividades
```

**Tareas:**
- [ ] Obtener inscripciones activas del socio
- [ ] Incluir inscripciones del grupo familiar
- [ ] Incluir información completa de actividad y categoría
- [ ] Tests unitarios

#### 2.1.2 Mi Cronograma
```javascript
GET /api/socio/:token/cronograma
```

**Tareas:**
- [ ] Reutilizar lógica de cronograma público
- [ ] Pre-filtrar por inscripciones del socio
- [ ] Tests unitarios

#### 2.1.3 Mis Convocatorias
```javascript
GET /api/socio/:token/convocatorias
PUT /api/socio/:token/convocatorias/:id/confirmar
```

**Tareas:**
- [ ] Listar convocatorias pendientes
- [ ] Endpoint para confirmar/rechazar
- [ ] Validar que el socio pertenece a la convocatoria
- [ ] Enviar notificación al admin/DT
- [ ] Tests unitarios

---

### 2.2 Backend - Endpoints Admin

**Archivo:** `server/src/routes/deportes.js` (NUEVO)

#### 2.2.1 Staff Técnico (CRUD)
```javascript
GET    /api/admin/actividades/:id/staff
POST   /api/admin/staff
PUT    /api/admin/staff/:id
DELETE /api/admin/staff/:id
```

**Tareas:**
- [ ] Implementar CRUD completo
- [ ] Validaciones de permisos
- [ ] Validaciones de datos (email, teléfono)
- [ ] Subida de foto (multer)
- [ ] Tests unitarios

#### 2.2.2 Partidos (CRUD)
```javascript
GET    /api/admin/partidos
POST   /api/admin/partidos
PUT    /api/admin/partidos/:id
DELETE /api/admin/partidos/:id
```

**Tareas:**
- [ ] Implementar CRUD completo
- [ ] Validaciones (fecha futura, horario válido)
- [ ] Incluir relación con categoría
- [ ] Tests unitarios

#### 2.2.3 Convocatorias
```javascript
GET    /api/admin/partidos/:id/convocatorias
POST   /api/admin/partidos/:id/convocatorias
DELETE /api/admin/convocatorias/:id
```

**Tareas:**
- [ ] Obtener convocatorias de un partido
- [ ] Crear convocatorias masivas (array de socioIds)
- [ ] Validar que socios estén inscriptos en la categoría
- [ ] Enviar notificaciones (push/email)
- [ ] Eliminar convocatoria
- [ ] Tests unitarios

#### 2.2.4 Noticias Deportivas (CRUD)
```javascript
GET    /api/admin/noticias-deportivas
POST   /api/admin/noticias-deportivas
PUT    /api/admin/noticias-deportivas/:id
DELETE /api/admin/noticias-deportivas/:id
```

**Tareas:**
- [ ] Implementar CRUD completo
- [ ] Subida de imagen destacada
- [ ] Validaciones de permisos
- [ ] Tests unitarios

#### 2.2.5 Reglamento (CRUD)
```javascript
GET    /api/admin/reglamento
POST   /api/admin/reglamento/articulo
PUT    /api/admin/reglamento/articulo/:id
DELETE /api/admin/reglamento/articulo/:id (soft delete)
GET    /api/admin/reglamento/estadisticas-aceptacion
```

**Tareas:**
- [ ] Implementar CRUD completo
- [ ] Versionado automático al editar
- [ ] Estadísticas de aceptación
- [ ] Tests unitarios

**Validación Sprint 2:**
- ✅ Endpoints admin funcionando
- ✅ Endpoints socio funcionando
- ✅ Permisos configurados
- ✅ Tests pasando

---

## **SPRINT 3: Frontend Público - Cronograma** (Semana 2)

### 3.1 Componentes Base

**Directorio:** `client/src/components/cronograma/`

#### 3.1.1 EventoCard
**Archivo:** `EventoCard.jsx`

**Tareas:**
- [ ] Crear componente reutilizable
- [ ] Variantes: entrenamiento, partido, evento
- [ ] Iconos y colores por deporte
- [ ] Responsive
- [ ] PropTypes

**Props:**
```javascript
{
  tipo: 'entrenamiento|partido|evento',
  icono: '⚽',
  titulo: 'Fútbol Sub 10',
  fecha: Date,
  horaInicio: '17:00',
  horaFin: '18:30',
  lugar: 'Cancha 1',
  onClick: Function
}
```

#### 3.1.2 BuscadorSimple
**Archivo:** `BuscadorSimple.jsx`

**Tareas:**
- [ ] Input con icono de búsqueda
- [ ] Placeholder dinámico
- [ ] Debounce (300ms)
- [ ] Clear button
- [ ] Responsive

#### 3.1.3 FiltroDeporte
**Archivo:** `FiltroDeporte.jsx`

**Tareas:**
- [ ] Botón con icono + nombre
- [ ] Estado activo/inactivo
- [ ] Colores por deporte
- [ ] Animación al toggle

#### 3.1.4 PresetsDefecha
**Archivo:** `PresetsFecha.jsx`

**Tareas:**
- [ ] Botones: Hoy, Esta semana, Próxima semana, Este mes
- [ ] Estado activo
- [ ] Responsive (scroll horizontal en mobile)

---

### 3.2 Página Cronograma

**Archivo:** `client/src/pages/public/Cronograma.jsx`

**Tareas:**
- [ ] Layout básico
- [ ] Integrar BuscadorSimple
- [ ] Integrar PresetsFecha
- [ ] Integrar FiltroDeporte (lista de deportes)
- [ ] Llamada a API `/api/public/cronograma`
- [ ] Manejo de loading state
- [ ] Manejo de error state
- [ ] Empty state amigable
- [ ] Agrupar eventos por día
- [ ] Renderizar EventoCard por cada evento
- [ ] Sincronizar filtros con URL (useSearchParams)
- [ ] Pre-filtrado desde URL (si viene de actividad)
- [ ] Responsive completo

**Estructura:**
```jsx
export default function Cronograma() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [busqueda, setBusqueda] = useState('')
  const [deportesSeleccionados, setDeportesSeleccionados] = useState([])
  const [periodo, setPeriodo] = useState('esta-semana')
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)

  // Cargar datos
  useEffect(() => {
    cargarCronograma()
  }, [deportesSeleccionados, periodo])

  // Filtrado local por búsqueda
  const eventosFiltrados = useMemo(() => {
    if (!busqueda) return eventos
    return eventos.filter(e => /* lógica de búsqueda */)
  }, [eventos, busqueda])

  // Agrupar por día
  const eventosPorDia = useMemo(() => {
    return agruparPorDia(eventosFiltrados)
  }, [eventosFiltrados])

  return (
    <div>
      {/* Header + Filtros */}
      {/* Lista de eventos */}
    </div>
  )
}
```

**Validación:**
- ✅ Carga datos correctamente
- ✅ Filtros funcionan
- ✅ Búsqueda funciona
- ✅ Responsive en mobile
- ✅ Empty state visible
- ✅ Loading state visible

---

### 3.3 Helpers y Utils

**Archivo:** `client/src/utils/cronograma.js`

**Funciones a crear:**
- [ ] `agruparPorDia(eventos)` - Agrupa eventos por fecha
- [ ] `formatearDia(fecha)` - "Lunes 10 de Febrero"
- [ ] `calcularRangoFecha(preset)` - Devuelve { desde, hasta }
- [ ] `filtrarEventosPorTexto(eventos, texto)` - Búsqueda flexible
- [ ] `getColorDeporte(nombreDeporte)` - Devuelve clases Tailwind

---

## **SPRINT 4: Frontend Público - Detalle Actividad** (Semana 2-3)

### 4.1 Componentes de Detalle

**Directorio:** `client/src/components/actividades/`

#### 4.1.1 TabsActividad
**Archivo:** `TabsActividad.jsx`

**Tareas:**
- [ ] Componente de tabs reutilizable
- [ ] Tabs: Información, Cronograma, Partidos, Plantel, Noticias, Reglamento
- [ ] Lazy loading de contenido de tabs
- [ ] Sincronizar tab activo con URL hash (#cronograma)
- [ ] Responsive (scroll horizontal en mobile)

#### 4.1.2 StaffCard
**Archivo:** `StaffCard.jsx`

**Tareas:**
- [ ] Card con foto, nombre, rol
- [ ] Biografía expandible
- [ ] Contacto (email, teléfono) - opcional mostrar
- [ ] Placeholder si no hay foto

#### 4.1.3 PartidoCard
**Archivo:** `PartidoCard.jsx`

**Tareas:**
- [ ] Card de partido (próximo o resultado)
- [ ] Mostrar fecha, hora, rival, cancha
- [ ] Badge de condición (LOCAL/VISITANTE)
- [ ] Resultado (si ya se jugó)
- [ ] Link a detalle (futuro)

#### 4.1.4 NoticiaCard
**Archivo:** `NoticiaCard.jsx`

**Tareas:**
- [ ] Card de noticia
- [ ] Imagen, título, copete
- [ ] Fecha de publicación
- [ ] Badge de tipo (noticia, comunicado, resultado)
- [ ] Link a detalle (futuro)

---

### 4.2 Modificar ActividadDetalle

**Archivo:** `client/src/pages/public/ActividadDetalle.jsx`

**Tareas:**
- [ ] Integrar TabsActividad
- [ ] **Tab Información:** Contenido actual (descripción, categorías, horarios)
- [ ] **Tab Cronograma:** Vista de cronograma filtrada por esta actividad
- [ ] **Tab Partidos:** Llamada a `/api/public/actividades/:id/partidos`
- [ ] **Tab Plantel:** Lista de categorías → selector → inscriptos
- [ ] **Tab Noticias:** Llamada a `/api/public/actividades/:id/noticias`
- [ ] **Tab Reglamento:** Link o iframe al reglamento
- [ ] Integrar StaffCard en tab Información
- [ ] Responsive
- [ ] Loading states por tab

**Estructura modificada:**
```jsx
export default function ActividadDetalle() {
  const { id } = useParams()
  const [tabActivo, setTabActivo] = useState('informacion')

  return (
    <div>
      {/* Hero existente */}

      <TabsActividad
        tabs={['informacion', 'cronograma', 'partidos', 'plantel', 'noticias']}
        activo={tabActivo}
        onChange={setTabActivo}
      />

      {/* Contenido según tab */}
      {tabActivo === 'informacion' && <TabInformacion />}
      {tabActivo === 'cronograma' && <TabCronograma actividadId={id} />}
      {tabActivo === 'partidos' && <TabPartidos actividadId={id} />}
      {tabActivo === 'plantel' && <TabPlantel actividadId={id} />}
      {tabActivo === 'noticias' && <TabNoticias actividadId={id} />}
    </div>
  )
}
```

---

### 4.3 Tabs como Componentes

**Archivos:**
- `client/src/components/actividades/tabs/TabInformacion.jsx`
- `client/src/components/actividades/tabs/TabCronograma.jsx`
- `client/src/components/actividades/tabs/TabPartidos.jsx`
- `client/src/components/actividades/tabs/TabPlantel.jsx`
- `client/src/components/actividades/tabs/TabNoticias.jsx`

**Tareas por Tab:**

#### TabInformacion
- [ ] Descripción de la actividad
- [ ] Categorías disponibles (existente, mejorar)
- [ ] Staff técnico (usar StaffCard)
- [ ] CTA de inscripción

#### TabCronograma
- [ ] Reutilizar componentes de cronograma
- [ ] Pre-filtrado por esta actividad
- [ ] Opción de agregar más actividades

#### TabPartidos
- [ ] Selector de categoría
- [ ] Lista de próximos partidos (PartidoCard)
- [ ] Toggle: Próximos / Resultados
- [ ] Paginación si hay muchos

#### TabPlantel
- [ ] Selector de categoría
- [ ] Lista de inscriptos (nombre, posición si aplica)
- [ ] Respeto a privacidad (solo nombres públicos)
- [ ] Entrenador asignado

#### TabNoticias
- [ ] Lista de noticias (NoticiaCard)
- [ ] Paginación
- [ ] Filtro por tipo (noticia, comunicado, resultado)

**Validación Sprint 4:**
- ✅ Tabs funcionan correctamente
- ✅ Lazy loading funciona
- ✅ Datos se cargan correctamente
- ✅ Responsive
- ✅ URL sincronizada

---

## **SPRINT 5: Frontend Portal Socio** (Semana 3)

### 5.1 Mis Actividades

**Archivo:** `client/src/pages/socio/MisActividades.jsx`

**Tareas:**
- [ ] Obtener token del socio (desde URL)
- [ ] Llamada a `/api/socio/:token/mis-actividades`
- [ ] Mostrar inscripciones del socio
- [ ] Mostrar inscripciones del grupo familiar (agrupadas)
- [ ] Card por cada inscripción (actividad, categoría, horarios)
- [ ] Link a detalle de actividad
- [ ] Link a cronograma personal
- [ ] Responsive

---

### 5.2 Mi Cronograma

**Archivo:** `client/src/pages/socio/MiCronograma.jsx`

**Tareas:**
- [ ] Reutilizar componentes de cronograma público
- [ ] Pre-cargar con inscripciones del socio
- [ ] Mensaje personalizado: "Tus actividades esta semana"
- [ ] Opción: "Ver más actividades del club" (link a cronograma público)
- [ ] Botón: Agregar a Google Calendar (futuro)
- [ ] Responsive

---

### 5.3 Mis Convocatorias

**Archivo:** `client/src/pages/socio/MisConvocatorias.jsx`

**Tareas:**
- [ ] Llamada a `/api/socio/:token/convocatorias`
- [ ] Listar convocatorias pendientes
- [ ] Card por convocatoria (partido, fecha, hora, rival)
- [ ] Botones: "Confirmo" / "No puedo"
- [ ] Modal de confirmación al rechazar (motivo opcional)
- [ ] Actualizar lista después de confirmar
- [ ] Empty state: "No tenés convocatorias pendientes"
- [ ] Badge con cantidad de pendientes (para mostrar en menú)
- [ ] Responsive

**Componente:**
```jsx
export default function MisConvocatorias() {
  const { token } = useParams()
  const [convocatorias, setConvocatorias] = useState([])

  async function confirmarAsistencia(convocatoriaId, confirmado) {
    await api.put(`/socio/${token}/convocatorias/${convocatoriaId}/confirmar`, {
      confirmado
    })
    // Recargar
    cargarConvocatorias()
  }

  return (
    <div>
      {convocatorias.map(c => (
        <ConvocatoriaCard
          key={c.id}
          convocatoria={c}
          onConfirmar={() => confirmarAsistencia(c.id, true)}
          onRechazar={() => confirmarAsistencia(c.id, false)}
        />
      ))}
    </div>
  )
}
```

**Validación Sprint 5:**
- ✅ Portal socio funcional
- ✅ Convocatorias se confirman correctamente
- ✅ Datos personalizados se muestran
- ✅ Responsive

---

## **SPRINT 6: Frontend Admin** (Semana 3-4)

### 6.1 Staff Técnico

**Archivo:** `client/src/pages/admin/deportes/StaffTecnico.jsx`

**Tareas:**
- [ ] Tabla de staff técnico
- [ ] Filtros por actividad/categoría
- [ ] Botón: Agregar Staff
- [ ] Modal/Página: Formulario de staff
- [ ] Upload de foto
- [ ] Validaciones (email, teléfono)
- [ ] Editar staff (modal)
- [ ] Eliminar staff (confirmación)
- [ ] Permisos: STAFF_TECNICO_*

---

### 6.2 Partidos

**Archivo:** `client/src/pages/admin/deportes/Partidos.jsx`

**Tareas:**
- [ ] Tabla de partidos
- [ ] Filtros: actividad, categoría, fecha desde/hasta
- [ ] Botón: Agregar Partido
- [ ] Formulario de partido (modal o página)
- [ ] Validaciones (fecha futura, horario)
- [ ] Selector de categoría
- [ ] Tipo: Liga, Amistoso, Torneo, Copa
- [ ] Condición: Local, Visitante
- [ ] Cancha (si es local) o dirección (si es visitante)
- [ ] Editar partido
- [ ] Eliminar partido (confirmación)
- [ ] Link a "Convocar jugadores"
- [ ] Permisos: PARTIDOS_*

---

### 6.3 Convocatorias

**Archivo:** `client/src/pages/admin/deportes/Convocatorias.jsx`

**Tareas:**
- [ ] Vista: Detalle de partido
- [ ] Lista de convocados (con estado: pendiente/confirmado/rechazado)
- [ ] Botón: "Agregar convocados"
- [ ] Modal: Selector múltiple de jugadores (solo inscriptos en la categoría)
- [ ] Enviar notificación al convocar
- [ ] Quitar de convocatoria
- [ ] Estadísticas: X confirmados, Y pendientes, Z rechazados
- [ ] Permisos: CONVOCATORIAS_*

---

### 6.4 Noticias Deportivas

**Archivo:** `client/src/pages/admin/deportes/NoticiasDeportivas.jsx`

**Tareas:**
- [ ] Tabla de noticias
- [ ] Filtros: actividad, categoría, tipo, fecha
- [ ] Botón: Nueva Noticia
- [ ] Formulario: título, copete, contenido (editor rico), imagen
- [ ] Selector: actividad, categoría (opcional)
- [ ] Tipo: Noticia, Comunicado, Resultado
- [ ] Checkbox: Destacada
- [ ] Preview antes de publicar
- [ ] Editar noticia
- [ ] Eliminar noticia
- [ ] Permisos: NOTICIAS_DEPORTIVAS_*

---

### 6.5 Reglamento Admin

**Archivo:** `client/src/pages/admin/deportes/ReglamentoAdmin.jsx`

**Tareas:**
- [ ] Lista de artículos agrupados por sección
- [ ] Botón: Agregar Artículo
- [ ] Formulario: sección, título, contenido (editor rico)
- [ ] Orden (drag & drop opcional)
- [ ] Checkbox: Requiere aceptación
- [ ] Editar artículo (incrementa versión automáticamente)
- [ ] Desactivar artículo (soft delete)
- [ ] Vista: Estadísticas de aceptación
- [ ] Permisos: REGLAMENTO_*

**Validación Sprint 6:**
- ✅ CRUD completo funcional
- ✅ Permisos configurados
- ✅ Validaciones funcionando
- ✅ Upload de archivos funciona
- ✅ Responsive

---

## **SPRINT 7: Reglamento Público y Pulido Final** (Semana 4)

### 7.1 Página Reglamento de Convivencia

**Archivo:** `client/src/pages/public/ReglamentoConvivencia.jsx`

**Tareas:**
- [ ] Layout con navegación lateral (secciones)
- [ ] Contenido expandible por artículo
- [ ] Llamada a `/api/public/reglamento`
- [ ] Anclas por sección (#padres, #jugadores, etc.)
- [ ] Botón: Descargar PDF (futuro)
- [ ] Responsive (navegación como tabs en mobile)
- [ ] Smooth scroll

**Componente:**
```jsx
export default function ReglamentoConvivencia() {
  const [articulos, setArticulos] = useState({})
  const [seccionActiva, setSeccionActiva] = useState('GENERAL')

  const secciones = [
    { id: 'GENERAL', nombre: 'Normas Generales' },
    { id: 'PADRES', nombre: 'Código para Padres' },
    { id: 'JUGADORES', nombre: 'Código para Jugadores' },
    { id: 'ENTRENADORES', nombre: 'Código para Entrenadores' },
    { id: 'SANCIONES', nombre: 'Sanciones' },
    { id: 'CONFLICTOS', nombre: 'Resolución de Conflictos' }
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Sidebar */}
      <aside>
        {secciones.map(s => (
          <button
            key={s.id}
            onClick={() => setSeccionActiva(s.id)}
            className={seccionActiva === s.id ? 'active' : ''}
          >
            {s.nombre}
          </button>
        ))}
      </aside>

      {/* Contenido */}
      <main className="lg:col-span-3">
        {articulos[seccionActiva]?.map(art => (
          <SeccionReglamento key={art.id} articulo={art} />
        ))}
      </main>
    </div>
  )
}
```

---

### 7.2 Modal de Aceptación (Portal Socio)

**Archivo:** `client/src/components/reglamento/ModalAceptacion.jsx`

**Tareas:**
- [ ] Modal que se muestra en primera visita del socio
- [ ] Contenido del reglamento (resumen o completo)
- [ ] Checkbox: "Leí y acepto el reglamento"
- [ ] Botón: Aceptar (deshabilitado hasta marcar)
- [ ] Guardar aceptación en BD
- [ ] No permitir cerrar sin aceptar (obligatorio)
- [ ] Mostrar nuevamente si hay nueva versión

---

### 7.3 Pulido y Testing

**Tareas generales:**
- [ ] Revisar responsive en todos los componentes
- [ ] Optimizar imágenes
- [ ] Lazy loading de imágenes
- [ ] Accesibilidad (aria-labels, alt text)
- [ ] Loading skeletons donde aplique
- [ ] Mensajes de error amigables
- [ ] Confirmaciones antes de acciones destructivas
- [ ] Tests E2E con Cypress (flujos críticos)
- [ ] Performance audit (Lighthouse)
- [ ] Revisar console.logs (eliminar)
- [ ] Revisar warnings de React

---

### 7.4 Documentación

**Archivos a crear/actualizar:**
- [ ] README.md (actualizar con nuevas funcionalidades)
- [ ] ACTIVIDADES_DEPORTIVAS.md (este documento)
- [ ] PLAN_IMPLEMENTACION_ACTIVIDADES.md (este documento)
- [ ] JSDoc en funciones complejas
- [ ] Comentarios en código no obvio

---

### 7.5 Deploy y Configuración

**Tareas:**
- [ ] Variables de entorno (.env.example actualizado)
- [ ] Migraciones en producción (plan de rollout)
- [ ] Backup de BD antes de migrar
- [ ] Seeds de datos iniciales (si aplica)
- [ ] Permisos iniciales para roles
- [ ] Configuración de CORS si aplica
- [ ] Logs configurados

---

## **Checklist Final de FASE 1**

### Backend
- [ ] Todos los modelos en BD
- [ ] Todos los endpoints públicos funcionando
- [ ] Todos los endpoints portal socio funcionando
- [ ] Todos los endpoints admin funcionando
- [ ] Permisos configurados
- [ ] Tests unitarios básicos pasando
- [ ] Validaciones implementadas
- [ ] Manejo de errores consistente

### Frontend Público
- [ ] Cronograma funcional y usable
- [ ] Detalle de actividad con tabs
- [ ] Reglamento de convivencia visible
- [ ] Responsive en mobile
- [ ] Loading states
- [ ] Error states
- [ ] Empty states

### Frontend Portal Socio
- [ ] Mis actividades funcional
- [ ] Mi cronograma funcional
- [ ] Mis convocatorias funcional
- [ ] Confirmación de asistencia funcional

### Frontend Admin
- [ ] CRUD Staff Técnico
- [ ] CRUD Partidos
- [ ] Gestión de Convocatorias
- [ ] CRUD Noticias Deportivas
- [ ] CRUD Reglamento

### UX/UI
- [ ] Diseño consistente con el resto del sistema
- [ ] Colores del club aplicados
- [ ] Tipografía consistente
- [ ] Iconos consistentes
- [ ] Feedback visual claro

### Performance
- [ ] Carga inicial < 3 segundos
- [ ] Lighthouse score > 80
- [ ] Imágenes optimizadas
- [ ] Lazy loading implementado

### Documentación
- [ ] README actualizado
- [ ] Documentación técnica completa
- [ ] Comentarios en código complejo
- [ ] Guía de usuario básica

---

## 📅 Cronograma Resumido

| Sprint | Semana | Foco | Entregables |
|--------|--------|------|-------------|
| 1 | 1 | BD + Backend Core | Migraciones, Seeds, Endpoints públicos |
| 2 | 1-2 | Backend Socio/Admin | Endpoints portal socio y admin |
| 3 | 2 | Frontend Cronograma | Página cronograma pública |
| 4 | 2-3 | Frontend Detalle | Tabs en detalle de actividad |
| 5 | 3 | Frontend Socio | Portal socio completo |
| 6 | 3-4 | Frontend Admin | CRUDs admin |
| 7 | 4 | Reglamento + Pulido | Reglamento público, testing, deploy |

---

## 🎯 Criterios de Éxito

### Métricas Cuantitativas
- ✅ 100% de endpoints implementados
- ✅ 80% de cobertura de tests (mínimo)
- ✅ < 3s tiempo de carga inicial
- ✅ 0 errores de consola en producción
- ✅ Lighthouse score > 80

### Métricas Cualitativas
- ✅ Usuario puede encontrar horarios en < 30 segundos
- ✅ Usuario puede confirmar convocatoria en < 1 minuto
- ✅ Admin puede crear partido en < 2 minutos
- ✅ Sistema usable sin capacitación para usuarios finales
- ✅ Feedback positivo en testing con usuarios reales

---

## 🚀 Siguientes Pasos (Post Fase 1)

1. **Recopilar Feedback** de usuarios reales (padres, admins)
2. **Ajustes y Bugfixes** basados en feedback
3. **Planificar Fase 2:**
   - Resultados históricos
   - Estadísticas
   - Contacto con entrenador
   - Notificaciones push
   - Exportar a Google Calendar

---

## 📞 Contacto y Soporte

**Desarrollador Principal:** [Tu nombre]
**Fecha de creación:** 12 de Febrero 2026
**Última actualización:** 12 de Febrero 2026

---

**¡Manos a la obra! 🚀**
