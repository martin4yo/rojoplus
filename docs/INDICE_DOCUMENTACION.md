# 📚 Índice de Documentación - RojoPlus

**Última Actualización:** 22 de Febrero 2026

Este índice organiza toda la documentación del proyecto RojoPlus para facilitar la navegación y búsqueda de información.

---

## 🚀 DOCUMENTOS PRINCIPALES

### 1. ⭐ INICIO RÁPIDO

| Archivo | Descripción | Cuándo Usar |
|---------|-------------|-------------|
| **ESTADO_ACTUAL_PROYECTO.md** | Resumen ejecutivo del estado actual | **SIEMPRE PRIMERO** - Al retomar trabajo |
| **ROADMAP.md** | Plan general de 35 fases del proyecto | Para entender el proyecto completo |
| **CLAUDE.md** | Instrucciones del proyecto en root | Para Claude Code (contexto automático) |

### 2. 📋 PLANIFICACIÓN Y PROGRESO

| Archivo | Tema | Estado |
|---------|------|--------|
| **PLAN_MULTITENANT.md** | Arquitectura multi-tenant | 📋 Plan |
| **PLAN_PERSONALIZACION_VISUAL.md** | Personalización por club | 📋 Plan |
| **PLAN_IMPLEMENTACION_ACTIVIDADES.md** | Actividades deportivas | 📋 Plan |
| **PLAN_REFACTOR_ADMIN.md** | Refactorización admin | 📋 Plan |

---

## 🎯 BUFFET POS - MEJORAS (22 FEB 2026)

### Documentos Buffet

| Archivo | Contenido | Importancia |
|---------|-----------|-------------|
| **SESION_22_FEB_2026_TABS_KIOSCO.md** | Sesión tabs + correcciones | ⭐⭐⭐ Para retomar |
| **MEJORAS_POS_COMPLETADO.md** | Resumen ejecutivo 15 mejoras POS | ⭐⭐⭐ Métricas y KPIs |
| **PROGRESO_MEJORAS_POS.md** | Estado detallado 17 tareas (100%) | ⭐⭐ Progreso técnico |
| **BACKEND_PAGOS_MULTIPLES_COMPLETADO.md** | Backend pagos múltiples | ⭐⭐ Documentación técnica |
| **TESTING_MEJORAS_POS.md** | 29 casos de testing | ⭐⭐⭐ Plan de testing |
| **MEJORAS_UI_POS_BUFFET.md** | Análisis UI/UX inicial | ⭐ Análisis previo |

### Componentes Creados

**Ubicación:** `client/src/components/`

```
TecladoNumerico.jsx                    ✅ Grid 4x3 táctil

buffet/
├── CalculadoraVuelto.jsx              ✅ Calculadora con teclado
├── SelectorMedioPago.jsx              ✅ Selector visual pagos
├── PropinaSelector.jsx                ✅ Propina 0/10/15/20%
├── SplitCuenta.jsx                    ✅ División de cuenta
└── PagoMultiple.jsx                   ✅ Pagos parciales
```

### Páginas Modificadas

**Ubicación:** `client/src/pages/admin/buffet/`

```
BuffetKiosco.jsx                       ✅ + Tabs + Mejoras UX
BuffetComanda.jsx                      ✅ + Modal mejorado
BuffetTakeAway.jsx                     ✅ Funcionalidades heredadas
```

---

## 🏗️ REFACTORIZACIÓN Y COMPLETADOS

### Refactorización Frontend

| Archivo | Tema | Fecha |
|---------|------|-------|
| **REFACTOR_FRONTEND_COMPLETADO.md** | Refactor completo frontend | Completado |
| **REFACTOR_FASE1_UTILITIES_COMPLETADO.md** | Utilities + formatters | Fase 1 ✅ |
| **REFACTOR_FASE2_COMPLETO.md** | Componentes reutilizables | Fase 2 ✅ |
| **REFACTOR_FASE2_COMPONENTES_COMPLETADO.md** | Detalles componentes | Fase 2 ✅ |
| **REFACTORIZACION_ADMIN_COMPLETADA.md** | Admin routes refactor | Completado |
| **REFACTOR_ADMIN_COMPLETADO.md** | Admin modularización | Completado |

---

## 🎮 CONTROL DE ACCESOS

### Documentación Accesos

| Archivo | Contenido | Estado |
|---------|-----------|--------|
| **GUIA_CONTROL_ACCESOS.md** | Guía completa del módulo | 📘 Guía |
| **CONTROL_ACCESOS_COMPLETADO.md** | Implementación completa | ✅ Completado |
| **TESTING_CONTROL_ACCESOS.md** | Testing del módulo | 🧪 Testing |

### Componentes Accesos

**Ubicación:** `client/src/pages/admin/accesos/`

```
ControlPWA.jsx                         ✅ Control móvil
Configuracion.jsx                      ✅ Config dispositivos
Reportes.jsx                           ✅ Reportes accesos
```

---

## 🏃 ACTIVIDADES DEPORTIVAS

### Documentación Actividades

| Archivo | Descripción |
|---------|-------------|
| **ACTIVIDADES_DEPORTIVAS.md** | Modelo y funcionalidad completa |

### Características

- Gestión de actividades y disciplinas
- Convocatorias y asistencias
- Staff técnico (entrenadores, DT)
- Noticias deportivas
- Reglamentos por disciplina
- Cronogramas de entrenamientos

---

## 💰 FINANCIERO Y CONTABILIDAD

### Documentación Financiera

| Archivo | Tema |
|---------|------|
| **CENTRO_COSTOS_IMPLEMENTACION.md** | Centros de costo |

### Módulos Completados

- ✅ Cuenta corriente socios
- ✅ Cuotas y pagos
- ✅ Cobranzas con adjuntos
- ✅ Débito automático
- ✅ Conciliación bancaria
- ✅ Asientos contables
- ✅ Plan de cuentas

---

## ⚙️ INSTALACIÓN Y PRODUCCIÓN

### Guías de Deployment

| Archivo | Contenido |
|---------|-----------|
| **INSTALACION_PRODUCCION.md** | Guía completa de instalación en producción |

### Pasos Principales

1. Configuración servidor
2. Instalación dependencias
3. Configuración base de datos
4. Variables de entorno
5. Build y deploy
6. Nginx/Apache setup
7. SSL/HTTPS
8. Monitoreo

---

## 📁 ARCHIVOS TEMPORALES Y BACKUPS

### Archivos Temporales (NO VERSIONADOS)

```
temp_*.txt                             Archivos temporales de desarrollo
server/src/routes/admin.js.backup     Backup rutas admin
server/prisma/cleanDuplicados.js      Scripts de limpieza
server/prisma/deleteActividades.js    Scripts de limpieza
server/prisma/seedActividades.js      Seed de actividades
```

---

## 🗂️ ESTRUCTURA POR MÓDULO

### 1. SOCIOS Y GRUPOS FAMILIARES

**Archivos:**
- Schema: `server/prisma/schema.prisma` (modelo Socio, GrupoFamiliar)
- Routes: `server/src/routes/admin/socios.js`
- Frontend: `client/src/pages/admin/Socios.jsx`, `SocioDetalle.jsx`

**Documentación:**
- Ver ROADMAP.md - Fase 1-5

---

### 2. CUOTAS Y COBRANZAS

**Archivos:**
- Schema: Cuota, Pago, Cobranza
- Routes: `server/src/routes/admin/cuotas.js`, `cobranzas.js`
- Frontend: `client/src/pages/admin/Cuotas.jsx`

**Documentación:**
- Ver ROADMAP.md - Fase 6-10

---

### 3. BUFFET MVP

**Archivos:**
- Routes: `server/src/routes/buffet.js` (~2700 líneas)
- Frontend: `client/src/pages/admin/buffet/*`
- Components: `client/src/components/buffet/*`

**Documentación:**
- ⭐ **SESION_22_FEB_2026_TABS_KIOSCO.md**
- ⭐ **MEJORAS_POS_COMPLETADO.md**
- **PROGRESO_MEJORAS_POS.md**
- **BACKEND_PAGOS_MULTIPLES_COMPLETADO.md**
- **TESTING_MEJORAS_POS.md**

---

### 4. PORTAL SOCIO (PWA)

**Archivos:**
- Routes: `server/src/routes/socio.js`
- Frontend: `client/src/pages/socio/*`
- PWA: `client/public/manifest.json`, `service-worker.js`

**Documentación:**
- Ver ROADMAP.md - Fase 24-26

---

### 5. SITIO INSTITUCIONAL

**Archivos:**
- Routes: `server/src/routes/public.js`
- Frontend: `client/src/pages/public/*`

**Documentación:**
- Ver ROADMAP.md - Fase 27-28

---

### 6. CONTROL DE ACCESOS

**Archivos:**
- Routes: `server/src/routes/accesos.js`
- Frontend: `client/src/pages/admin/accesos/*`
- Service: `molinete-service/*`

**Documentación:**
- ⭐ **GUIA_CONTROL_ACCESOS.md**
- **CONTROL_ACCESOS_COMPLETADO.md**
- **TESTING_CONTROL_ACCESOS.md**

---

### 7. ACTIVIDADES DEPORTIVAS

**Archivos:**
- Routes: `server/src/routes/admin/actividades.js`
- Frontend: `client/src/pages/admin/actividades/*`

**Documentación:**
- **ACTIVIDADES_DEPORTIVAS.md**
- **PLAN_IMPLEMENTACION_ACTIVIDADES.md**

---

### 8. FINANCIERO/CONTABILIDAD

**Archivos:**
- Routes: `server/src/routes/contabilidad.js`
- Frontend: `client/src/pages/admin/contabilidad/*`

**Documentación:**
- **CENTRO_COSTOS_IMPLEMENTACION.md**
- Ver ROADMAP.md - Fases 11-17

---

## 🔍 BÚSQUEDA RÁPIDA

### ¿Cómo hacer...?

| Pregunta | Ver Documento |
|----------|---------------|
| ¿Cómo instalar en producción? | **INSTALACION_PRODUCCION.md** |
| ¿Cómo funcionan los tabs de BuffetKiosco? | **SESION_22_FEB_2026_TABS_KIOSCO.md** |
| ¿Cómo testear mejoras POS? | **TESTING_MEJORAS_POS.md** |
| ¿Cómo funciona control de accesos? | **GUIA_CONTROL_ACCESOS.md** |
| ¿Cuál es el estado actual? | **ESTADO_ACTUAL_PROYECTO.md** |
| ¿Qué falta implementar? | **ROADMAP.md** |
| ¿Cómo usar actividades deportivas? | **ACTIVIDADES_DEPORTIVAS.md** |
| ¿Cómo funciona el backend de pagos múltiples? | **BACKEND_PAGOS_MULTIPLES_COMPLETADO.md** |

### ¿Qué archivo modificar para...?

| Necesidad | Archivo | Ubicación |
|-----------|---------|-----------|
| Agregar nueva ruta admin | `admin/*.js` | `server/src/routes/admin/` |
| Nuevo componente buffet | `*.jsx` | `client/src/components/buffet/` |
| Modificar schema DB | `schema.prisma` | `server/prisma/` |
| Agregar permiso | `permisos.js` | `client/src/services/` |
| Nueva página admin | `*.jsx` | `client/src/pages/admin/` |

---

## 📊 MÉTRICAS Y KPIs

### Documentos con Métricas

- **MEJORAS_POS_COMPLETADO.md** - KPIs mejoras buffet
- **ESTADO_ACTUAL_PROYECTO.md** - Estado general
- **TESTING_MEJORAS_POS.md** - Cobertura testing

### KPIs Principales

| Métrica | Valor Actual |
|---------|--------------|
| Proyecto completado | 99% |
| Módulos principales | 11/11 ✅ |
| Tareas buffet POS | 17/17 ✅ |
| Testing buffet | 4/29 (⏳ pendiente) |
| Tiempo por venta (buffet) | < 30 seg (-33%) |

---

## 🎯 PRÓXIMOS PASOS

Ver **ESTADO_ACTUAL_PROYECTO.md** sección "Próximos Pasos Recomendados"

### Prioridades

1. ⏳ Testing manual BuffetKiosco tabs
2. ⏳ Testing backend pagos múltiples (25 casos)
3. ⏳ Control de Accesos (Tarea #31)
4. ⏳ Testing integral sistema (Tarea #18)

---

## 📞 AYUDA Y SOPORTE

### Comandos Útiles

```bash
# Ver documentación
ls *.md                              # Listar todos los .md
grep -r "palabra" *.md               # Buscar en documentación

# Desarrollo
cd server && npm run dev             # Backend :3000
cd client && npm run dev             # Frontend :5173

# Base de datos
npx prisma studio                    # GUI para DB
npx prisma db push                   # Aplicar cambios schema

# Git
git status                           # Ver estado
git log --oneline -10                # Últimos commits
```

### Credenciales

- **Admin:** admin@rojoplus.com / admin123
- **DB:** postgres:Q27G4B98@localhost/rojoplus

---

## ✅ CHECKLIST AL INICIAR SESIÓN

- [ ] Leer **ESTADO_ACTUAL_PROYECTO.md**
- [ ] Revisar **SESION_22_FEB_2026_TABS_KIOSCO.md** (última sesión)
- [ ] Verificar **ROADMAP.md** para contexto general
- [ ] Revisar documentos específicos del módulo a trabajar
- [ ] Confirmar servidor y cliente funcionando

---

## 📝 RESUMEN DE ARCHIVOS

### Total de Documentos: ~25 archivos .md

**Por Categoría:**
- 🚀 Inicio y Estado: 3 archivos
- 📋 Planificación: 4 archivos
- 🎯 Buffet POS: 6 archivos
- 🏗️ Refactorización: 6 archivos
- 🎮 Control Accesos: 3 archivos
- 🏃 Actividades: 2 archivos
- 💰 Financiero: 1 archivo
- ⚙️ Instalación: 1 archivo
- 📚 Índice: 1 archivo (este)

---

**Proyecto:** RojoPlus - Club Sportivo Pilar
**Última Actualización:** 22 de Febrero 2026
**Desarrollado por:** Claude Sonnet 4.5

---

✅ **Índice completo - Use este archivo como punto de partida para navegar la documentación**

_Actualizar este índice cuando se agreguen nuevos documentos importantes_
