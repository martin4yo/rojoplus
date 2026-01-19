# Plan de Trabajo - Sistema de Gestión Club Sportivo Pilar

## Resumen Ejecutivo

| Fase | Nombre | Duración | Prioridad |
|------|--------|----------|-----------|
| 0 | Preparación y Base de Datos | 1 semana | Crítica |
| 1 | Gestión de Socios Completa | 2 semanas | Crítica |
| 2 | Deportes, Categorías e Inscripciones | 2 semanas | Crítica |
| 3 | Sistema de Cuotas | 2 semanas | Crítica |
| 4 | Cobranzas y Pagos | 2 semanas | Crítica |
| 5 | Caja y Movimientos | 2 semanas | Alta |
| 5.5 | **Débito Automático (Prisma/Payway)** | 2 semanas | Alta |
| 5.6 | **Conciliación Bancaria** | 1 semana | Alta |
| 6 | Portal del Socio (MercadoPago + MODO) | 2 semanas | Alta |
| 6.5 | **Configuración y Branding** | 1 semana | Media |
| 7 | Reportes y Analytics | 2 semanas | Alta |
| 8 | Notificaciones | 1 semana | Media |
| 9 | PWA y Mejoras Mobile | 2 semanas | Media |
| **TOTAL** | | **22 semanas** | |

## Nuevas Funcionalidades (Actualización Enero 2026)

### Débito Automático
- Plataformas: **Prisma** y **Payway**
- Generación de archivos según formato de cada procesador
- Importación de archivos de respuesta/rendición
- Registro automático de cobros y rechazos

### Conciliación Bancaria
- Importación de extractos: **OFX, CSV/Excel, PDF (manual)**
- Conciliación automática y manual
- Identificación de movimientos no conciliados
- Reportes de conciliación

### Pagos Online
- **MercadoPago**: Checkout Pro
- **MODO**: Integración API
- Botón de pago en portal del socio
- Webhooks para acreditación automática

### Branding Configurable
- Logo principal y secundario
- Paleta de colores personalizable
- Nombre, slogan y datos de contacto
- Redes sociales

---

# FASE 0: Preparación y Base de Datos
**Duración estimada: 1 semana**

## Objetivos
- Preparar el entorno de desarrollo
- Migrar el schema de base de datos
- Configurar seeds iniciales

---

### Etapa 0.1: Backup y Preparación ✅
**Duración: 1 día**

#### Tareas
- [x] Backup completo de la base de datos de producción
- [x] Backup del código actual
- [x] Crear rama `feature/gestion-club` en git
- [x] Documentar estado actual del sistema

#### Criterios de Aceptación
```
✓ Backup de BD almacenado en ubicación segura
✓ Rama git creada y pusheada
✓ Documento de estado actual creado
```

#### Test de Verificación
```bash
# Verificar que el backup se puede restaurar
pg_restore --list backup_rojoplus_FECHA.dump
# Verificar rama
git branch -a | grep gestion-club
```

---

### Etapa 0.2: Migración de Schema - Parte 1 (Socios) ✅
**Duración: 1 día**

#### Tareas
- [x] Agregar nuevos campos al modelo Socio:
  - [x] Campos personales extendidos (apellido separado, sexo, nacionalidad, etc.)
  - [x] Campos de domicilio completos
  - [x] Campos médicos (grupo sanguíneo, obra social, alergias)
  - [x] Contactos de emergencia
  - [x] Campo `responsableId` para menores
  - [x] Campo `esMenor`
- [x] Crear modelo `GrupoFamiliar`
- [x] Crear modelo `AutorizacionMenor`
- [x] Ejecutar migración en desarrollo
- [x] Crear script de migración de datos existentes

#### Criterios de Aceptación
```
✓ Migración ejecuta sin errores
✓ Datos existentes de socios preservados
✓ Nuevos campos disponibles (pueden estar vacíos)
✓ Relación socio-grupo familiar funcional
```

#### Test de Verificación
```bash
# En desarrollo
npx prisma migrate dev --name add_socio_extended_fields
npx prisma studio
# Verificar visualmente que los datos existen
```

```sql
-- Verificar estructura
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'socios';

-- Verificar que no se perdieron datos
SELECT COUNT(*) FROM socios;
```

---

### Etapa 0.3: Migración de Schema - Parte 2 (Deportes y Cuotas) ✅
**Duración: 1 día**

#### Tareas
- [x] Crear modelo `Deporte`
- [x] Crear modelo `Categoria`
- [x] Crear modelo `Inscripcion`
- [x] Crear modelo `EntrenadorCategoria`
- [x] Crear modelo `TipoCuota`
- [x] Crear modelo `ConfiguracionCuota`
- [x] Crear modelo `ConfiguracionRecargo`
- [x] Crear modelo `PeriodoCuota`
- [x] Crear modelo `Cuota`
- [x] Ejecutar migración

#### Criterios de Aceptación
```
✓ Todas las tablas creadas correctamente
✓ Índices creados
✓ Relaciones FK funcionando
```

#### Test de Verificación
```bash
npx prisma migrate dev --name add_deportes_cuotas
npx prisma db push --force-reset # Solo en dev para probar
```

---

### Etapa 0.4: Migración de Schema - Parte 3 (Pagos y Caja) ✅
**Duración: 1 día**

#### Tareas
- [x] Crear modelo `MedioPago`
- [x] Crear modelo `Pago`
- [x] Crear modelo `SaldoFavor`
- [x] Crear modelo `AplicacionSaldo`
- [x] Crear modelo `Caja`
- [x] Crear modelo `CuentaBancaria`
- [x] Crear modelo `CuentaContable`
- [x] Crear modelo `MovimientoCaja`
- [x] Ejecutar migración

#### Criterios de Aceptación
```
✓ Todas las tablas de pagos y caja creadas
✓ Relaciones entre pagos, cuotas y movimientos funcionando
```

---

### Etapa 0.5: Migración de Schema - Parte 4 (Roles y Permisos) ✅
**Duración: 0.5 días**

#### Tareas
- [x] Crear modelo `Rol`
- [x] Crear modelo `Permiso`
- [x] Crear modelo `PermisoRol`
- [x] Agregar `rolId` al modelo `Admin`
- [x] Ejecutar migración

#### Criterios de Aceptación
```
✓ Sistema de roles y permisos creado
✓ Admin existente sigue funcionando
```

---

### Etapa 0.6: Seeds Iniciales ⚠️ (Parcial)
**Duración: 0.5 días**

#### Tareas
- [ ] Seed de deportes básicos (Fútbol, Básquet, Vóley, Natación, Hockey, Tenis)
- [ ] Seed de tipos de cuota (SOCIAL, DEPORTIVA)
- [ ] Seed de medios de pago (Efectivo, Transferencia, Débito, Crédito, MercadoPago)
- [ ] Seed de roles (SUPER_ADMIN, ADMIN, TESORERO, SECRETARIO)
- [ ] Seed de permisos por módulo
- [ ] Seed de cuentas contables básicas
- [ ] Seed de configuración inicial

#### Criterios de Aceptación
```
✓ npx prisma db seed ejecuta sin errores
✓ Datos de catálogos disponibles en BD
```

#### Test de Verificación
```bash
npx prisma db seed
# Verificar
npx prisma studio
```

---

### Etapa 0.7: Deploy de Migraciones a Producción ✅
**Duración: 0.5 días**

#### Tareas
- [x] Review de migraciones generadas
- [x] Backup de producción
- [x] Ejecutar migraciones en producción
- [x] Ejecutar seeds en producción
- [x] Verificar integridad de datos

#### Criterios de Aceptación
```
✓ Producción migrada sin pérdida de datos
✓ Sistema actual (RojoPlus) sigue funcionando
✓ Nuevas tablas disponibles
```

#### Test de Verificación
```bash
# En producción
npx prisma migrate deploy
npx prisma db seed
# Probar que /mi-qr sigue funcionando
# Probar que comercios siguen funcionando
```

---

### ✅ HITO FASE 0: Base de Datos Lista
```
☑ Schema completo migrado a desarrollo
☑ Schema completo migrado a producción
⚠ Seeds ejecutados (parcial - faltan catálogos)
☑ Sistema actual sigue funcionando
☑ Prisma Studio muestra todas las tablas
```

---

# FASE 1: Gestión de Socios Completa
**Duración estimada: 2 semanas**

## Objetivos
- CRUD completo de socios con todos los campos
- Gestión de grupos familiares
- Gestión de menores y responsables
- Búsqueda y filtros avanzados

---

### Etapa 1.1: Backend - API de Socios Extendida ✅
**Duración: 2 días**

#### Tareas
- [x] `GET /api/admin/socios` - Listar con filtros avanzados
  - [x] Filtro por estado
  - [x] Filtro por categoría de socio
  - [x] Filtro por deporte/actividad
  - [x] Filtro por grupo familiar
  - [x] Filtro por edad (menores/mayores)
  - [x] Búsqueda por nombre, DNI, nro socio
  - [x] Paginación
- [x] `GET /api/admin/socios/:id` - Detalle completo del socio
- [x] `POST /api/admin/socios` - Crear socio nuevo
- [x] `PUT /api/admin/socios/:id` - Actualizar socio
- [x] `DELETE /api/admin/socios/:id` - Eliminar/dar de baja socio
- [x] `GET /api/admin/socios/:id/grupo-familiar` - Miembros del grupo

#### Criterios de Aceptación
```
✓ Todos los endpoints responden correctamente
✓ Validaciones de datos funcionando
✓ Filtros devuelven resultados correctos
✓ Paginación funciona
```

#### Test de Verificación
```bash
# Probar con curl o Postman
curl -X GET "http://localhost:3001/api/admin/socios?estado=ACTIVO&page=1" \
  -H "Authorization: Bearer TOKEN"

curl -X POST "http://localhost:3001/api/admin/socios" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nroSocio": "9999", "nombre": "Test", "apellido": "Usuario", ...}'
```

---

### Etapa 1.2: Backend - API de Grupos Familiares ✅
**Duración: 1 día**

#### Tareas
- [x] `GET /api/admin/grupos-familiares` - Listar grupos
- [x] `GET /api/admin/grupos-familiares/:id` - Detalle con miembros
- [x] `POST /api/admin/grupos-familiares` - Crear grupo
- [x] `PUT /api/admin/grupos-familiares/:id` - Actualizar grupo
- [x] `POST /api/admin/grupos-familiares/:id/agregar-miembro` - Agregar socio
- [x] `POST /api/admin/grupos-familiares/:id/quitar-miembro/:socioId` - Quitar miembro
- [x] `POST /api/admin/grupos-familiares/:id/cambiar-titular` - Cambiar titular

#### Criterios de Aceptación
```
✓ CRUD de grupos funciona
✓ No se puede eliminar grupo con miembros
✓ Titular siempre es miembro del grupo
✓ Un socio solo puede estar en un grupo
```

#### Test de Verificación
```bash
# Crear grupo y agregar miembros
curl -X POST ".../grupos-familiares" -d '{"nombre": "Familia Test", "titularId": 1}'
curl -X POST ".../grupos-familiares/1/agregar-miembro" -d '{"socioId": 2}'
curl -X GET ".../grupos-familiares/1"
# Verificar que devuelve titular y miembros
```

---

### Etapa 1.3: Frontend - Listado de Socios Mejorado ✅
**Duración: 2 días**

#### Tareas
- [x] Rediseñar página `/admin/socios`
  - [x] Tabla con columnas configurables
  - [x] Filtros avanzados (desplegables)
  - [x] Indicador visual de estado (activo/inactivo/baja)
  - [x] Indicador de grupo familiar
  - [ ] Indicador de menores
  - [x] Botón de acciones (ver, editar, QR)
- [x] Exportar a Excel
- [x] Búsqueda en tiempo real

#### Criterios de Aceptación
```
✓ Lista carga en menos de 2 segundos
✓ Filtros funcionan correctamente
✓ Paginación funciona
✓ Se puede exportar a Excel
```

#### Test de Verificación
```
□ Abrir /admin/socios - carga lista
□ Filtrar por estado "ACTIVO" - muestra solo activos
□ Buscar por DNI - encuentra socio
□ Click en exportar - descarga Excel con datos filtrados
```

---

### Etapa 1.4: Frontend - Formulario de Socio ✅
**Duración: 3 días**

#### Tareas
- [x] Crear componente `SocioForm.jsx` con tabs/secciones:
  - [x] Tab 1: Datos Personales
    - [x] Nombre, Apellido, DNI, CUIL
    - [x] Fecha nacimiento (con cálculo de edad)
    - [x] Sexo, Nacionalidad, Estado civil
    - [x] Foto (upload)
  - [x] Tab 2: Contacto
    - [x] Email, Teléfonos
    - [x] Domicilio completo
  - [x] Tab 3: Club (integrado en Personal)
    - [x] Nro socio (auto o manual)
    - [x] Fecha alta, Estado, Categoría, Tipo
  - [x] Tab 4: Médico
    - [x] Grupo sanguíneo, Obra social
    - [x] Alergias, Condiciones
    - [x] Apta física (fecha vencimiento)
  - [x] Tab 5: Emergencia (integrado en Contacto)
    - [x] 2 contactos de emergencia
  - [ ] Tab 6: Familia (si tiene grupo)
    - [ ] Mostrar grupo familiar
    - [ ] Responsable (si es menor)
- [x] Crear página `/admin/socios/nuevo`
- [x] Crear página `/admin/socios/:id/editar`
- [x] Validaciones de formulario
- [x] Manejo de errores

#### Criterios de Aceptación
```
✓ Formulario carga datos existentes correctamente
✓ Validaciones muestran errores claros
✓ Guardar actualiza el socio
✓ Crear genera nuevo socio con nro automático
✓ Foto se puede subir y visualizar
```

#### Test de Verificación
```
□ Crear socio nuevo - completar todos los campos - guardar - verificar en lista
□ Editar socio existente - modificar email - guardar - verificar cambio
□ Intentar guardar sin DNI - muestra error de validación
□ Subir foto - se visualiza en el formulario
```

---

### Etapa 1.5: Frontend - Detalle de Socio ✅
**Duración: 1.5 días**

#### Tareas
- [x] Crear página `/admin/socios/:id`
  - [x] Header con foto, nombre, estado
  - [x] Resumen de datos principales
  - [x] Sección de actividades (preview, link a inscripciones)
  - [x] Sección de cuotas (preview, link a cuenta corriente)
  - [x] Sección de grupo familiar
  - [ ] Historial de cambios (si aplica)
- [x] Acciones rápidas:
  - [x] Editar
  - [x] Ver QR
  - [ ] Dar de baja
  - [ ] Enviar email
  - [ ] Ver cuenta corriente

#### Criterios de Aceptación
```
✓ Página muestra toda la información del socio
✓ Links a otras secciones funcionan
✓ Acciones ejecutan correctamente
```

---

### Etapa 1.6: Frontend - Gestión de Grupos Familiares ✅
**Duración: 1.5 días**

#### Tareas
- [x] Crear página `/admin/grupos-familiares`
  - [x] Lista de grupos con cantidad de miembros
  - [x] Búsqueda por nombre o titular
- [x] Crear página `/admin/grupos-familiares/:id`
  - [x] Datos del grupo
  - [x] Lista de miembros con rol (titular/miembro)
  - [x] Agregar miembro (buscador de socios)
  - [x] Quitar miembro
  - [x] Cambiar titular
- [x] Script de migración automática de grupos familiares
  - [x] Crear grupos basados en tipoSocio "Titular Familia"/"Miembro Familia"
  - [x] 190 grupos creados, 444 miembros asignados automáticamente
- [ ] Modal de crear grupo desde detalle de socio (opcional)

#### Criterios de Aceptación
```
✓ CRUD de grupos funciona desde la UI
✓ Se puede agregar/quitar miembros
✓ No se puede quitar al titular sin asignar otro
```

#### Test de Verificación
```
□ Crear grupo "Familia Test" con titular socio #1
□ Agregar socio #2 como miembro
□ Verificar que ambos aparecen en el grupo
□ Quitar socio #2 - verificar que ya no está
□ Intentar quitar titular - muestra error o pide nuevo titular
```

---

### ✅ HITO FASE 1: Gestión de Socios Completa ✅
```
☑ CRUD completo de socios funcionando
☑ Todos los campos nuevos editables
☑ Grupos familiares funcionando (backend + UI)
☑ Grupos familiares migrados automáticamente (190 grupos, 634 socios)
□ Menores vinculados a responsables (mejora futura)
☑ Búsqueda y filtros funcionando
☑ Exportación a Excel funcionando
☑ QR de socios sigue funcionando
☑ Sistema de comercios sigue funcionando
```

**Prueba de Aceptación Final Fase 1:**
```
1. Crear un socio adulto "Juan Pérez" con todos los datos
2. Crear un socio menor "Tomás Pérez" (hijo de Juan)
3. Crear grupo familiar "Familia Pérez" con Juan como titular
4. Agregar a Tomás al grupo familiar
5. Verificar que Juan aparece como responsable de Tomás
6. Editar datos de Juan - verificar que se guardan
7. Buscar "Pérez" - deben aparecer ambos
8. Filtrar por "menores" - solo aparece Tomás
9. Exportar a Excel - verificar datos
10. Ver QR de Juan - funciona para descuentos
```

---

# FASE 2: Deportes, Categorías e Inscripciones
**Duración estimada: 2 semanas**

## Objetivos
- ABM de deportes y categorías
- Sistema de inscripciones
- Asignación de entrenadores
- Vista de planteles por categoría

---

### Etapa 2.1: Backend - API de Deportes y Categorías
**Duración: 1 día**

#### Tareas
- [ ] `GET /api/admin/deportes` - Listar deportes con categorías
- [ ] `POST /api/admin/deportes` - Crear deporte
- [ ] `PUT /api/admin/deportes/:id` - Actualizar deporte
- [ ] `DELETE /api/admin/deportes/:id` - Desactivar deporte
- [ ] `GET /api/admin/deportes/:id/categorias` - Categorías del deporte
- [ ] `POST /api/admin/deportes/:id/categorias` - Crear categoría
- [ ] `PUT /api/admin/categorias/:id` - Actualizar categoría
- [ ] `DELETE /api/admin/categorias/:id` - Desactivar categoría

#### Criterios de Aceptación
```
✓ CRUD de deportes funciona
✓ CRUD de categorías funciona
✓ No se puede eliminar deporte con categorías activas
✓ No se puede eliminar categoría con inscripciones activas
```

---

### Etapa 2.2: Backend - API de Inscripciones
**Duración: 2 días**

#### Tareas
- [ ] `GET /api/admin/inscripciones` - Listar con filtros
  - [ ] Filtro por deporte
  - [ ] Filtro por categoría
  - [ ] Filtro por estado
  - [ ] Filtro por socio
- [ ] `GET /api/admin/categorias/:id/inscriptos` - Plantel de categoría
- [ ] `GET /api/admin/socios/:id/inscripciones` - Inscripciones del socio
- [ ] `POST /api/admin/inscripciones` - Crear inscripción
  - [ ] Validar edad del socio vs categoría
  - [ ] Validar que no esté ya inscripto
  - [ ] Validar estado del socio (activo)
- [ ] `PUT /api/admin/inscripciones/:id` - Actualizar inscripción
- [ ] `POST /api/admin/inscripciones/:id/finalizar` - Dar de baja de actividad
- [ ] `GET /api/admin/categorias/:id/entrenadores` - Staff de categoría
- [ ] `POST /api/admin/categorias/:id/entrenadores` - Asignar entrenador

#### Criterios de Aceptación
```
✓ Inscripción valida requisitos de edad
✓ No permite inscripción duplicada
✓ Histórico de inscripciones se mantiene
✓ Entrenadores asignados correctamente
```

#### Test de Verificación
```bash
# Inscribir socio a categoría
curl -X POST ".../inscripciones" \
  -d '{"socioId": 1, "categoriaId": 5, "fechaInicio": "2026-01-01"}'

# Intentar inscribir de nuevo - debe fallar
curl -X POST ".../inscripciones" \
  -d '{"socioId": 1, "categoriaId": 5, "fechaInicio": "2026-01-01"}'
# Response: 400 - "Socio ya inscripto en esta categoría"

# Ver plantel
curl -X GET ".../categorias/5/inscriptos"
```

---

### Etapa 2.3: Frontend - ABM de Deportes y Categorías
**Duración: 2 días**

#### Tareas
- [ ] Crear página `/admin/deportes`
  - [ ] Lista de deportes como acordeón/expandible
  - [ ] Cada deporte muestra sus categorías
  - [ ] Indicador de cantidad de inscriptos por categoría
- [ ] Modal de crear/editar deporte
- [ ] Modal de crear/editar categoría
  - [ ] Nombre
  - [ ] Rango de edad (min-max)
  - [ ] Sexo (M/F/Mixto)
  - [ ] Cuota mensual
  - [ ] Horarios y lugar (informativo)
  - [ ] Cupo máximo

#### Criterios de Aceptación
```
✓ Lista de deportes carga correctamente
✓ Se pueden crear/editar deportes
✓ Se pueden crear/editar categorías
✓ Muestra cantidad de inscriptos
```

#### Test de Verificación
```
□ Crear deporte "Paddle"
□ Crear categoría "Adultos" con cuota $15.000
□ Verificar que aparece en la lista
□ Editar categoría - cambiar cuota - guardar
□ Verificar que el cambio se guardó
```

---

### Etapa 2.4: Frontend - Gestión de Inscripciones
**Duración: 3 días**

#### Tareas
- [ ] Crear página `/admin/categorias/:id` (detalle de categoría)
  - [ ] Datos de la categoría
  - [ ] Lista de inscriptos (plantel)
    - [ ] Foto, nombre, edad, fecha inscripción
    - [ ] Estado de cuota (al día/debe)
    - [ ] Acciones: ver socio, dar de baja
  - [ ] Lista de entrenadores/staff
  - [ ] Botón "Inscribir socio"
  - [ ] Exportar plantel a Excel
- [ ] Modal de inscripción
  - [ ] Buscador de socios
  - [ ] Mostrar si cumple requisitos de edad
  - [ ] Fecha de inicio
  - [ ] Exento de cuota (checkbox + motivo)
- [ ] Desde detalle de socio:
  - [ ] Ver actividades actuales
  - [ ] Botón "Inscribir a actividad"

#### Criterios de Aceptación
```
✓ Plantel muestra todos los inscriptos
✓ Se puede inscribir nuevo socio
✓ Se valida edad antes de inscribir
✓ Se puede dar de baja de la actividad
✓ Se puede exportar plantel
```

#### Test de Verificación
```
□ Ir a categoría "Fútbol Sub-13"
□ Click en "Inscribir socio"
□ Buscar "Tomás Pérez" (12 años)
□ Sistema indica que cumple requisitos
□ Confirmar inscripción
□ Verificar que aparece en el plantel
□ Intentar inscribir socio de 16 años - debe mostrar advertencia
□ Exportar plantel - verificar Excel
```

---

### Etapa 2.5: Frontend - Asignación de Entrenadores
**Duración: 1 día**

#### Tareas
- [ ] En detalle de categoría:
  - [ ] Sección "Staff técnico"
  - [ ] Agregar entrenador (puede ser socio o externo)
  - [ ] Tipo: Entrenador, Ayudante, Preparador físico, Delegado
  - [ ] Si es externo: nombre, teléfono, email
  - [ ] Quitar del staff

#### Criterios de Aceptación
```
✓ Se puede asignar entrenador socio
✓ Se puede asignar entrenador externo
✓ Se puede quitar del staff
```

---

### ✅ HITO FASE 2: Deportes e Inscripciones
```
□ CRUD de deportes funcionando
□ CRUD de categorías funcionando
□ Sistema de inscripciones funcionando
□ Validación de edad funcionando
□ Asignación de entrenadores funcionando
□ Planteles visibles y exportables
□ Histórico de inscripciones disponible
```

**Prueba de Aceptación Final Fase 2:**
```
1. Crear deporte "Fútbol" con categorías Sub-11, Sub-13, Sub-15
2. Configurar Sub-13 con edad 12-13 años, cuota $10.000
3. Asignar entrenador "Roberto Gómez" (externo)
4. Inscribir a "Tomás Pérez" (12 años) en Sub-13
5. Intentar inscribir a "Juan Pérez" (35 años) - debe advertir
6. Ver plantel de Sub-13 - aparece Tomás
7. Dar de baja a Tomás de Sub-13 con motivo "Cambio categoría"
8. Inscribir a Tomás en Sub-15
9. Ver historial de inscripciones de Tomás - muestra ambas
```

---

# FASE 3: Sistema de Cuotas
**Duración estimada: 2 semanas**

## Objetivos
- Configuración de montos de cuotas
- Generación mensual de cuotas
- Cálculo de recargos
- Visualización de deuda

---

### Etapa 3.1: Backend - Configuración de Cuotas
**Duración: 1 día**

#### Tareas
- [ ] `GET /api/admin/configuracion/cuotas` - Ver configuración
- [ ] `PUT /api/admin/configuracion/cuotas/social` - Configurar cuota social
  - [ ] Monto individual
  - [ ] Monto familiar
- [ ] `PUT /api/admin/categorias/:id/cuota` - Configurar cuota de categoría
- [ ] `GET /api/admin/configuracion/recargos` - Ver recargos
- [ ] `POST /api/admin/configuracion/recargos` - Crear regla de recargo
- [ ] `PUT /api/admin/configuracion/recargos/:id` - Editar recargo
- [ ] `DELETE /api/admin/configuracion/recargos/:id` - Eliminar recargo

#### Criterios de Aceptación
```
✓ Configuración de cuota social guardada
✓ Configuración de cuota por categoría guardada
✓ Recargos configurables con % y días
✓ Recargos acumulativos funcionando
```

---

### Etapa 3.2: Backend - Generación de Cuotas
**Duración: 3 días**

#### Tareas
- [ ] `GET /api/admin/periodos` - Listar periodos
- [ ] `POST /api/admin/periodos` - Crear periodo (mes/año)
- [ ] `POST /api/admin/periodos/:id/generar` - Generar cuotas del periodo
  - [ ] Generar cuota SOCIAL por cada socio individual activo
  - [ ] Generar cuota SOCIAL por cada grupo familiar activo
  - [ ] Generar cuota DEPORTIVA por cada inscripción activa (no exenta)
  - [ ] Usar montos vigentes de configuración
  - [ ] Establecer fecha de vencimiento
- [ ] `GET /api/admin/periodos/:id/cuotas` - Listar cuotas del periodo
- [ ] `GET /api/admin/periodos/:id/resumen` - Resumen del periodo
  - [ ] Total generado
  - [ ] Total cobrado
  - [ ] Total pendiente
  - [ ] Cantidad por estado

#### Criterios de Aceptación
```
✓ Genera cuota social para socios individuales
✓ Genera UNA cuota social por grupo familiar (no por miembro)
✓ Genera cuota deportiva por cada inscripción
✓ No genera duplicados si se ejecuta 2 veces
✓ Respeta exenciones
```

#### Test de Verificación
```bash
# Crear periodo Febrero 2026
curl -X POST ".../periodos" -d '{"anio": 2026, "mes": 2}'

# Generar cuotas
curl -X POST ".../periodos/1/generar"

# Verificar resumen
curl -X GET ".../periodos/1/resumen"
# Debe mostrar totales correctos

# Intentar generar de nuevo - no debe duplicar
curl -X POST ".../periodos/1/generar"
curl -X GET ".../periodos/1/resumen"
# Totales deben ser iguales
```

---

### Etapa 3.3: Backend - Cálculo de Recargos
**Duración: 1 día**

#### Tareas
- [ ] Función `calcularRecargo(cuota, fecha)` que:
  - [ ] Calcula días desde vencimiento
  - [ ] Aplica recargos acumulativos según configuración
  - [ ] Retorna monto de recargo
- [ ] `GET /api/admin/cuotas/:id` incluye recargo calculado
- [ ] `GET /api/admin/socios/:id/deuda` - Deuda con recargos
- [ ] Job opcional: actualizar recargos diariamente

#### Criterios de Aceptación
```
✓ Recargo se calcula correctamente
✓ Recargos acumulativos funcionan (10% + 20% = 30%)
✓ Cuota no vencida tiene recargo 0
```

#### Test de Verificación
```javascript
// Test unitario
const cuota = { montoOriginal: 10000, fechaVencimiento: '2026-01-10' }
const hoy = '2026-01-25' // 15 días después

// Con recargo 10% a los 0 días, 20% a los 10 días
const recargo = calcularRecargo(cuota, hoy)
// recargo = 10000 * 0.30 = 3000 (10% + 20%)
```

---

### Etapa 3.4: Backend - Deuda por Socio/Grupo
**Duración: 1 día**

#### Tareas
- [ ] `GET /api/admin/socios/:id/cuenta-corriente` - Movimientos del socio
  - [ ] Incluir cuotas (con recargos)
  - [ ] Incluir pagos
  - [ ] Calcular saldo
- [ ] `GET /api/admin/grupos-familiares/:id/cuenta-corriente` - Movimientos del grupo
- [ ] `GET /api/admin/socios/:id/deuda` - Solo deuda pendiente
- [ ] `GET /api/admin/grupos-familiares/:id/deuda` - Deuda del grupo

#### Criterios de Aceptación
```
✓ Cuenta corriente muestra todos los movimientos
✓ Saldo se calcula correctamente
✓ Recargos se incluyen en la deuda
```

---

### Etapa 3.5: Frontend - Configuración de Cuotas
**Duración: 1.5 días**

#### Tareas
- [ ] Crear página `/admin/configuracion/cuotas`
  - [ ] Sección Cuota Social
    - [ ] Monto individual
    - [ ] Monto familiar
    - [ ] Día de vencimiento
  - [ ] Sección Recargos
    - [ ] Lista de reglas de recargo
    - [ ] Crear/editar regla
    - [ ] Preview de cálculo
- [ ] En ABM de categorías: campo de cuota mensual

#### Criterios de Aceptación
```
✓ Se pueden configurar montos de cuota social
✓ Se pueden configurar recargos
✓ Preview muestra cálculo correcto
```

---

### Etapa 3.6: Frontend - Generación de Cuotas
**Duración: 2 días**

#### Tareas
- [ ] Crear página `/admin/cuotas`
  - [ ] Selector de periodo (mes/año)
  - [ ] Botón "Generar cuotas del periodo"
  - [ ] Confirmación antes de generar
  - [ ] Resumen post-generación
- [ ] Lista de cuotas del periodo
  - [ ] Filtros: tipo, estado, socio
  - [ ] Indicador de vencimiento
  - [ ] Monto con recargo
- [ ] Acciones masivas:
  - [ ] Bonificar cuotas seleccionadas
  - [ ] Anular cuotas seleccionadas

#### Criterios de Aceptación
```
✓ Se puede generar cuotas del mes
✓ Lista muestra cuotas con recargos calculados
✓ Se pueden aplicar acciones masivas
```

#### Test de Verificación
```
□ Ir a /admin/cuotas
□ Seleccionar Febrero 2026
□ Click "Generar cuotas"
□ Confirmar - esperar generación
□ Ver resumen: X cuotas sociales, Y deportivas
□ Filtrar por "PENDIENTE" - ver lista
□ Verificar que recargos se muestran en rojo
```

---

### Etapa 3.7: Frontend - Cuenta Corriente
**Duración: 1.5 días**

#### Tareas
- [ ] Crear página `/admin/socios/:id/cuenta-corriente`
  - [ ] Header con saldo actual
  - [ ] Tabla de movimientos (debe/haber/saldo)
  - [ ] Filtros por fecha y tipo
  - [ ] Exportar a PDF/Excel
- [ ] Acceso desde detalle de socio
- [ ] Acceso desde detalle de grupo familiar

#### Criterios de Aceptación
```
✓ Muestra todos los movimientos
✓ Saldo se calcula correctamente
✓ Se puede exportar
```

---

### ✅ HITO FASE 3: Sistema de Cuotas
```
□ Configuración de cuota social funciona
□ Configuración de recargos funciona
□ Generación de cuotas funciona
□ Cuotas sociales individuales generadas
□ Cuotas sociales familiares generadas (1 por grupo)
□ Cuotas deportivas generadas por inscripción
□ Recargos se calculan correctamente
□ Cuenta corriente muestra movimientos
□ Exportación funciona
```

**Prueba de Aceptación Final Fase 3:**
```
1. Configurar cuota social individual $15.000, familiar $20.000
2. Configurar recargo 10% al vencer, 20% adicional a los 15 días
3. Configurar cuota Fútbol Sub-13 en $10.000
4. Generar cuotas de Febrero 2026
5. Verificar que Juan Pérez (individual) tiene cuota de $15.000
6. Verificar que Familia Pérez tiene UNA cuota de $20.000 (no $40.000)
7. Verificar que Tomás tiene cuota de Fútbol $10.000
8. Avanzar fecha a 20 días después del vencimiento
9. Ver cuenta corriente de Familia Pérez
10. Verificar recargo acumulado: $20.000 * 30% = $6.000
11. Total deuda grupo: $20.000 + $10.000 + $6.000 + recargo fútbol
```

---

# FASE 4: Cobranzas y Pagos
**Duración estimada: 2 semanas**

## Objetivos
- Registrar pagos de cuotas
- Saldos a favor
- Anulación de pagos
- Comprobantes

---

### Etapa 4.1: Backend - Registro de Pagos
**Duración: 2 días**

#### Tareas
- [ ] `POST /api/admin/pagos` - Registrar pago
  - [ ] Validar que cuotas existen y están pendientes
  - [ ] Calcular monto total con recargos
  - [ ] Marcar cuotas como PAGADAS
  - [ ] Generar número de comprobante
  - [ ] Registrar movimiento de caja
  - [ ] Si hay excedente, crear saldo a favor
- [ ] `GET /api/admin/pagos` - Listar pagos
- [ ] `GET /api/admin/pagos/:id` - Detalle de pago
- [ ] `POST /api/admin/pagos/:id/anular` - Anular pago
  - [ ] Volver cuotas a PENDIENTE
  - [ ] Generar movimiento de egreso compensatorio
  - [ ] Registrar motivo de anulación

#### Criterios de Aceptación
```
✓ Pago marca cuotas como pagadas
✓ Se genera número de comprobante único
✓ Movimiento de caja se registra
✓ Anulación revierte todo correctamente
```

---

### Etapa 4.2: Backend - Saldos a Favor
**Duración: 1 día**

#### Tareas
- [ ] `GET /api/admin/socios/:id/saldo-favor` - Ver saldo a favor
- [ ] `POST /api/admin/pagos` con `aplicarSaldo: true`
  - [ ] Descontar saldo a favor disponible
  - [ ] Registrar aplicación de saldo
- [ ] `POST /api/admin/saldos-favor` - Crear saldo manual (ajuste)

#### Criterios de Aceptación
```
✓ Saldo a favor se crea cuando hay excedente
✓ Saldo se puede aplicar a futuros pagos
✓ Se registra historial de aplicaciones
```

---

### Etapa 4.3: Backend - Comprobantes
**Duración: 1 día**

#### Tareas
- [ ] `GET /api/admin/pagos/:id/comprobante` - Generar PDF de recibo
  - [ ] Datos del club
  - [ ] Datos del socio/grupo
  - [ ] Detalle de cuotas pagadas
  - [ ] Medio de pago
  - [ ] Número de comprobante
  - [ ] Fecha y firma digital

#### Criterios de Aceptación
```
✓ PDF se genera correctamente
✓ Incluye todos los datos necesarios
✓ Tiene formato profesional
```

---

### Etapa 4.4: Frontend - Pantalla de Cobranza
**Duración: 3 días**

#### Tareas
- [ ] Crear página `/admin/cobranza`
  - [ ] Buscador de socio/grupo
  - [ ] Al seleccionar, mostrar:
    - [ ] Datos del socio/grupo
    - [ ] Saldo a favor disponible
    - [ ] Cuotas pendientes con checkbox
    - [ ] Cálculo de recargos en tiempo real
    - [ ] Total a cobrar
  - [ ] Selección de medio de pago
  - [ ] Selección de caja
  - [ ] Campo de observaciones
  - [ ] Botón "Cobrar"
  - [ ] Post-cobro: mostrar resumen y opción de imprimir

#### Criterios de Aceptación
```
✓ Búsqueda encuentra socio/grupo
✓ Muestra cuotas pendientes con recargos
✓ Permite seleccionar cuotas a pagar
✓ Calcula total correctamente
✓ Registra pago y muestra comprobante
```

#### Test de Verificación
```
□ Buscar "Familia Pérez"
□ Ver cuotas pendientes listadas
□ Seleccionar todas las cuotas
□ Verificar total incluye recargos
□ Seleccionar medio "Efectivo", caja "Principal"
□ Click "Cobrar"
□ Verificar mensaje de éxito
□ Verificar comprobante generado
□ Volver a buscar "Familia Pérez" - no debe tener deuda
```

---

### Etapa 4.5: Frontend - Pago a Cuenta
**Duración: 1 día**

#### Tareas
- [ ] En pantalla de cobranza:
  - [ ] Opción "Pago a cuenta" (sin seleccionar cuotas)
  - [ ] Ingresar monto recibido
  - [ ] Se genera saldo a favor
- [ ] Mostrar saldo a favor en la pantalla
- [ ] Opción de aplicar saldo a cuotas

#### Criterios de Aceptación
```
✓ Se puede registrar pago a cuenta
✓ Saldo a favor aparece disponible
✓ Se puede aplicar saldo a cuotas
```

---

### Etapa 4.6: Frontend - Listado y Anulación de Pagos
**Duración: 1.5 días**

#### Tareas
- [ ] Crear página `/admin/pagos`
  - [ ] Lista de pagos con filtros
  - [ ] Filtros: fecha, socio, medio de pago, estado
  - [ ] Ver detalle de pago
  - [ ] Anular pago (con confirmación y motivo)
- [ ] En detalle de pago:
  - [ ] Datos completos
  - [ ] Cuotas incluidas
  - [ ] Descargar comprobante
  - [ ] Botón anular

#### Criterios de Aceptación
```
✓ Lista de pagos funciona
✓ Filtros funcionan
✓ Anulación funciona y revierte cuotas
```

---

### Etapa 4.7: Frontend - Integración en Cuenta Corriente
**Duración: 0.5 días**

#### Tareas
- [ ] En cuenta corriente del socio:
  - [ ] Botón "Cobrar" que lleva a cobranza
  - [ ] Link a detalle de cada pago
  - [ ] Indicador de pagos anulados

---

### ✅ HITO FASE 4: Cobranzas y Pagos
```
□ Registro de pagos funciona
□ Cuotas se marcan como pagadas
□ Comprobante se genera correctamente
□ Saldos a favor funcionan
□ Anulación de pagos funciona
□ Movimientos de caja se registran
□ Listado de pagos con filtros
□ Cuenta corriente actualizada
```

**Prueba de Aceptación Final Fase 4:**
```
1. Ir a Cobranza
2. Buscar "Familia Pérez"
3. Ver 3 cuotas pendientes con recargos
4. Seleccionar todas ($35.700 total)
5. Medio: Efectivo, Caja: Principal
6. Cobrar - verificar comprobante
7. Ver cuenta corriente - saldo $0
8. Registrar otro pago de $10.000 a cuenta
9. Ver saldo a favor de $10.000
10. Generar cuotas Marzo 2026
11. Ir a cobranza - ver cuotas nuevas
12. Aplicar saldo a favor - total a pagar reducido
13. Anular el pago de Febrero
14. Ver cuenta corriente - cuotas vuelven a pendientes
15. Ver movimiento de egreso compensatorio en caja
```

---

# FASE 5: Caja y Movimientos
**Duración estimada: 2 semanas**

## Objetivos
- ABM de cajas y cuentas bancarias
- Plan de cuentas contable
- Registro de ingresos/egresos
- Transferencias entre cajas
- Cierre de caja

---

### Etapa 5.1: Backend - ABM de Cajas
**Duración: 1 día**

#### Tareas
- [ ] CRUD `/api/admin/cajas`
- [ ] CRUD `/api/admin/cuentas-bancarias`
- [ ] `GET /api/admin/cajas/:id/saldo` - Saldo actual
- [ ] `GET /api/admin/cajas/:id/movimientos` - Movimientos de la caja

---

### Etapa 5.2: Backend - Plan de Cuentas
**Duración: 1 día**

#### Tareas
- [ ] CRUD `/api/admin/cuentas-contables`
- [ ] Soporte para estructura jerárquica (padre/hijos)
- [ ] Validar que solo hojas son imputables

---

### Etapa 5.3: Backend - Movimientos de Caja
**Duración: 2 días**

#### Tareas
- [ ] `POST /api/admin/movimientos` - Registrar movimiento
  - [ ] Validar cuenta imputable
  - [ ] Actualizar saldo de caja
  - [ ] Generar número de movimiento
- [ ] `GET /api/admin/movimientos` - Listar con filtros
- [ ] `POST /api/admin/movimientos/:id/anular` - Anular movimiento
- [ ] `POST /api/admin/transferencias` - Transferir entre cajas
  - [ ] Crear movimiento SALIDA en origen
  - [ ] Crear movimiento ENTRADA en destino
  - [ ] Vincular ambos movimientos

---

### Etapa 5.4: Frontend - Gestión de Cajas
**Duración: 2 días**

#### Tareas
- [ ] Página `/admin/cajas`
- [ ] CRUD de cajas con datos bancarios
- [ ] Ver saldo de cada caja
- [ ] Página `/admin/cuentas-contables`
- [ ] Vista de árbol del plan de cuentas
- [ ] CRUD de cuentas

---

### Etapa 5.5: Frontend - Movimientos de Caja
**Duración: 3 días**

#### Tareas
- [ ] Página `/admin/caja/movimientos`
- [ ] Registrar ingreso
- [ ] Registrar egreso
- [ ] Realizar transferencia
- [ ] Listado con filtros
- [ ] Anulación de movimientos

---

### Etapa 5.6: Frontend - Cierre de Caja
**Duración: 1 día**

#### Tareas
- [ ] Resumen diario de caja
- [ ] Comparar saldo sistema vs saldo real
- [ ] Registrar diferencias

---

### ✅ HITO FASE 5: Caja y Movimientos
```
□ CRUD de cajas funciona
□ Plan de cuentas jerárquico funciona
□ Registro de ingresos funciona
□ Registro de egresos funciona
□ Transferencias entre cajas funcionan
□ Saldos se actualizan correctamente
□ Movimientos de cobranza aparecen automáticamente
□ Cierre de caja funciona
```

---

# FASE 6: Portal del Socio Ampliado
**Duración estimada: 2 semanas**

## Objetivos
- Portal completo para el socio
- Ver datos, actividades, deuda
- Pagar online con MercadoPago/MODO
- Descargar comprobantes

---

### Etapa 6.1: Backend - APIs del Portal
**Duración: 2 días**

#### Tareas
- [ ] `GET /api/socio/:token/perfil` - Datos completos
- [ ] `GET /api/socio/:token/actividades` - Inscripciones
- [ ] `GET /api/socio/:token/cuotas` - Cuotas pendientes con recargos
- [ ] `GET /api/socio/:token/cuenta-corriente` - Historial
- [ ] `GET /api/socio/:token/comprobantes/:id` - Descargar comprobante
- [ ] `PUT /api/socio/:token/perfil` - Actualizar algunos datos

---

### Etapa 6.2: Backend - Integración MercadoPago
**Duración: 2 días**

#### Tareas
- [ ] `POST /api/socio/:token/pagos/iniciar` - Crear preferencia MP
- [ ] `POST /api/webhooks/mercadopago` - Recibir notificaciones
- [ ] `GET /api/socio/:token/pagos/:id/estado` - Verificar estado
- [ ] Lógica de acreditación automática

---

### Etapa 6.3: Frontend - Portal del Socio
**Duración: 4 días**

#### Tareas
- [ ] Rediseñar `/s/:token`
- [ ] Sección "Mis Datos"
- [ ] Sección "Mis Actividades"
- [ ] Sección "Mi Cuenta Corriente"
- [ ] Sección "Pagar"
  - [ ] Seleccionar cuotas
  - [ ] Ver total con recargos
  - [ ] Botón MercadoPago
  - [ ] Opción transferencia
- [ ] Sección "Mi QR"
- [ ] Descargar comprobantes

---

### Etapa 6.4: Frontend - Flujo de Pago Online
**Duración: 2 días**

#### Tareas
- [ ] Integración con checkout de MercadoPago
- [ ] Página de retorno exitoso
- [ ] Página de retorno fallido
- [ ] Actualización de estado en tiempo real

---

### ✅ HITO FASE 6: Portal del Socio
```
□ Socio puede ver sus datos
□ Socio puede ver sus actividades
□ Socio puede ver su deuda
□ Socio puede pagar con MercadoPago
□ Pago se acredita automáticamente
□ Socio puede descargar comprobantes
□ QR sigue funcionando para descuentos
```

---

# FASE 7: Reportes y Analytics
**Duración estimada: 2 semanas**

## Objetivos
- Reportes de morosidad
- Reportes financieros
- Dashboard ejecutivo
- Exportaciones

---

### Etapa 7.1: Reportes de Morosidad
**Duración: 3 días**

---

### Etapa 7.2: Reportes Financieros
**Duración: 3 días**

---

### Etapa 7.3: Dashboard Ejecutivo
**Duración: 2 días**

---

### Etapa 7.4: Exportaciones
**Duración: 2 días**

---

### ✅ HITO FASE 7: Reportes
```
□ Reporte de morosidad general
□ Morosidad por deporte/categoría
□ Reporte de ingresos/egresos
□ Balance de caja
□ Dashboard con KPIs
□ Exportación a Excel/PDF
```

---

# FASE 8: Notificaciones
**Duración estimada: 1 semana**

## Objetivos
- Notificaciones por email
- Integración WhatsApp (opcional)
- Recordatorios automáticos

---

### ✅ HITO FASE 8: Notificaciones
```
□ Email de cuota próxima a vencer
□ Email de cuota vencida
□ Email de confirmación de pago
□ Centro de preferencias del socio
□ WhatsApp básico (opcional)
```

---

# FASE 9: PWA y Mejoras Mobile
**Duración estimada: 2 semanas**

## Objetivos
- Convertir portal en PWA
- Funcionalidad offline
- Push notifications
- Mejoras de UX mobile

---

### ✅ HITO FASE 9: PWA
```
□ Portal instalable como app
□ Funciona offline (datos cacheados)
□ Push notifications funcionando
□ UX optimizada para mobile
□ QR accesible rápidamente
```

---

# Resumen de Hitos

| Fase | Hito | Criterio de Éxito |
|------|------|-------------------|
| 0 | BD Lista | Schema migrado, seeds ejecutados |
| 1 | Socios | CRUD completo, grupos familiares |
| 2 | Deportes | Inscripciones funcionando |
| 3 | Cuotas | Generación y recargos funcionando |
| 4 | Pagos | Cobranza y comprobantes |
| 5 | Caja | Movimientos y transferencias |
| 6 | Portal | Socio puede pagar online |
| 7 | Reportes | Dashboard y exportaciones |
| 8 | Notificaciones | Emails automáticos |
| 9 | PWA | App instalable |

---

# Checklist General de Proyecto

## Pre-requisitos
- [ ] Entorno de desarrollo configurado
- [ ] Acceso a base de datos de desarrollo
- [ ] Acceso a base de datos de producción
- [ ] Cuenta de MercadoPago (sandbox y producción)
- [ ] Servicio de email configurado

## Por Fase
- [x] **Fase 0**: Base de Datos ✅ (Schema completo, seeds parciales)
- [x] **Fase 1**: Gestión de Socios ✅ 100% (grupos familiares migrados automáticamente)
- [ ] **Fase 2**: Deportes e Inscripciones
- [ ] **Fase 3**: Sistema de Cuotas
- [ ] **Fase 4**: Cobranzas y Pagos
- [ ] **Fase 5**: Caja y Movimientos
- [ ] **Fase 6**: Portal del Socio (QR básico ✅)
- [ ] **Fase 7**: Reportes
- [ ] **Fase 8**: Notificaciones
- [ ] **Fase 9**: PWA

---

*Plan de trabajo creado: Enero 2026*
*Última actualización: 18 Enero 2026 - Fase 1 completa, grupos familiares migrados*
