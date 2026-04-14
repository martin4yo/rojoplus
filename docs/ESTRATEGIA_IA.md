# Clubix — Estrategia de IA

> Última actualización: 2026-04-11

---

## Análisis de mercado: dónde estamos

### Cobertura funcional actual (~85% de gestión de club completa)

| Módulo | Estado | Profundidad |
|---|---|---|
| Gestión de socios (alta, baja, familia, categorías) | ✅ | Muy completo |
| Cuotas y facturación (períodos, cargos, recargos) | ✅ | Muy completo |
| Cobranzas y recupero (campañas, gestión, encuesta baja) | ✅ | Avanzado |
| Deportes (actividades, categorías, equipos, torneos) | ✅ | Muy completo |
| Entrenamiento (asistencia, planillas, convocatorias) | ✅ | Completo |
| Buffet/POS (mesas, cocina, kiosco, takeaway, fiscal) | ✅ | Muy avanzado |
| Contabilidad (plan de cuentas, asientos, centros de costo) | ✅ | Completo |
| Débito automático (Prisma/PRIMA, archivos banco) | ✅ | Funcional |
| Conciliación bancaria | ✅ | Implementado |
| Control de accesos (RFID, molinetes) | ✅ | Implementado |
| Portal del socio (PWA, cuenta corriente, inscripciones) | ✅ | Completo |
| Sitio web institucional (noticias, calendario, menú) | ✅ | Completo |
| Eventos y entradas | ✅ | Completo |
| Comunicaciones (email, WhatsApp, push, campañas) | ✅ | Avanzado |
| Facturación electrónica AFIP (QR, CAE) | ✅ | Completo |
| Multi-tenant SaaS | ✅ | Completo |
| Permisos y roles granulares | ✅ | Completo |
| Gobernanza (actas, votaciones, documentos) | ✅ | Implementado |
| Reservas de espacios | ✅ | Implementado |
| Chat entrenadores-socios (Socket.io) | ✅ | Implementado |
| Agente IA (WhatsApp + chat interno) | ✅ Parcial | Claude directo |

### Competencia directa (gestión de clubes deportivos en Argentina)

| Feature | Clubix | Competidores típicos |
|---|---|---|
| SaaS multi-tenant | ✅ Subdominios | Limitado/custom |
| AFIP con CAE+QR | ✅ Automático | Manual o limitado |
| Buffet/POS integrado | ✅ Cocina, mesas, kiosco, takeaway | ❌ No existe |
| Gestión deportiva profunda | ✅ Actividades, equipos, torneos, stats | Básico |
| Portal socio PWA | ✅ Mobile + offline | Web básico |
| Débito automático bancario | ✅ PRIMA/Prisma | Manual |
| WhatsApp + IA | ✅ EvolutionAPI + Claude | Solo email |
| Control de accesos RFID | ✅ Tiempo real | Manual |
| Contabilidad completa | ✅ Doble entrada | GL básico |
| Display cocina tiempo real | ✅ Socket.io | Tickets de papel |

**Posición:** Clubix es significativamente más completo que cualquier competidor
de gestión de clubes en Argentina. El buffet/POS integrado y el control de accesos
son diferenciadores únicos.

---

## Qué IA ya está implementada

| Componente | Estado | Ubicación |
|---|---|---|
| Agente IA para chat/WhatsApp | ✅ | `aiAssistant.js` → Claude directo |
| Panel de métricas IA | ✅ | `IAMetricas.jsx` (super-admin) |
| Análisis: resumen mensual | ✅ | `ai-analisis.js` → AXIO ML Hub |
| Análisis: socios en riesgo | ✅ | `ai-analisis.js` → AXIO ML Hub |
| Análisis: actividades | ✅ | `ai-analisis.js` → AXIO ML Hub |
| Toggle local/cloud por tenant | ✅ | `TenantDetail.jsx` (super-admin) |
| Widget de feedback (👍/👎) | ❌ | Pendiente |

---

## Features de IA por prioridad comercial

### Tier 1 — Impacto inmediato en el club

**1. Resumen ejecutivo mensual (ya implementado, mejorar)**
- Al abrir el dashboard, el dirigente ve:
  "Renovaciones bajaron 15%. Los socios que no renovaron solo iban al gimnasio.
   Sugerencia: oferta cruzada gimnasio + actividad grupal."
- **Estado:** endpoint existe, falta mejorar con RAG y datos más ricos
- **Impacto:** el dirigente entiende la salud del club sin pedir informes

**2. Predicción de bajas (churn prediction)**
- "34 socios no asistieron en 2 meses. 12 tienen cuota vencida.
   Contactar con oferta de reactivación antes de que se den de baja."
- **Implementación:** combinar datos de asistencia + pagos + inscripciones
- **Impacto:** retener socios = retener ingresos. Un socio que se va cuesta
  5x más que retener al que está

**3. Análisis de actividades con recomendaciones**
- "Yoga tiene 92% de asistencia y está al límite de capacidad → abrir otro turno.
   Pilates tiene 40% de ausentes los viernes → evaluar cambio de horario."
- **Estado:** endpoint existe, mejorar profundidad de análisis
- **Impacto:** optimizar la oferta de actividades = más inscripciones = más ingresos

**4. Análisis de buffet/ventas POS**
- "El ticket promedio bajó $500. Los sándwiches se venden 3x más los sábados.
   Sugerencia: reforzar stock sábados y evaluar promoción entre semana."
- **Implementación:** nuevo endpoint que consulta datos de comandas/ventas
- **Impacto:** optimizar operación del buffet = más margen

### Tier 2 — Valor operativo (retención)

**5. Sugerencias personalizadas por socio**
- "A este socio de 35 años que solo va al gimnasio le podría interesar
   Natación (horario mañana compatible) o Spinning."
- **Implementación:** perfil del socio + historial → consulta al hub
- **Impacto:** cross-sell de actividades, más inscripciones

**6. Predicción de ingresos**
- "Ingresos estimados próximo mes: $2.3M. 45 cuotas en riesgo de mora
   basado en historial de pago."
- **Implementación:** datos de períodos + pagos + morosos históricos
- **Impacto:** planificación financiera para el tesorero

**7. Asistente inteligente para socios (chat mejorado)**
- El socio pregunta por WhatsApp: "¿Puedo inscribirme en natación?"
- La IA responde: "Sí, hay lugar en el turno de martes y jueves 19hs.
   ¿Querés que te inscriba?"
- **Estado:** `aiAssistant.js` ya hace esto con Claude directo
- **Mejora:** migrar al hub cuando el modelo propio esté listo

**8. Detección de anomalías en caja**
- "Hoy se registraron 3 anulaciones seguidas en la caja del buffet"
- "El cobrador X tiene un ratio de cobranza 60% menor que el promedio"
- **Impacto:** control interno, prevención de irregularidades

### Tier 3 — Diferenciación a largo plazo

**9. Análisis de rendimiento deportivo**
- Estadísticas de equipos y jugadores procesadas por IA
- "El equipo sub-16 mejoró su posesión pero baja en efectividad de gol"
- **Impacto:** diferenciador para clubes con divisiones inferiores

**10. Optimización de espacios y horarios**
- "La cancha 2 tiene 30% de uso los martes. Sugerencia: ofrecer descuento
   para reservas en ese horario."
- **Impacto:** maximizar uso de infraestructura

**11. Gobernanza asistida**
- Resumen IA de actas de reuniones
- Análisis de votaciones y tendencias de la comisión directiva
- **Impacto:** nicho, pero diferenciador único

---

## Integración técnica con AXIO ML Hub

### Ya implementado

```
Clubix (backend)
       ↓
  axioMLService.js → AXIO ML Hub (Ollama/Claude)
       ↓
  Endpoints:
    /api/admin/ai/disponible
    /api/admin/ai/resumen-mensual
    /api/admin/ai/socios-en-riesgo
    /api/admin/ai/actividades
    /api/admin/ai/consulta
    /api/admin/ai/metricas
```

### Pendiente de migrar al hub

```
aiAssistant.js (chat/WhatsApp)
  Hoy: Claude directo vía @anthropic-ai/sdk
  Futuro: AXIO ML Hub cuando modelo propio esté listo
  Nota: usa function calling (acciones) que requiere modelos avanzados
```

### Datos disponibles para análisis IA

Clubix tiene una riqueza de datos enorme para IA:

| Dato | Modelo Prisma | Uso para IA |
|---|---|---|
| Socios (perfil, estado, familia) | Socio, GrupoFamiliar | Segmentación, churn prediction |
| Asistencia a actividades | Asistencia, Entrenamiento | Predicción de bajas |
| Historial de pagos | Pago, Cargo, Periodo | Predicción de cobranza, mora |
| Inscripciones | Inscripcion | Cross-sell, recomendaciones |
| Ventas buffet | Comanda, ItemComanda | Análisis de consumo, stock |
| Accesos físicos | RegistroAcceso | Frecuencia de uso real |
| Comunicaciones | CampanaComunicacion | Efectividad de campañas |
| Encuestas de baja | EncuestaBaja | Por qué se van los socios |

---

## Estrategia comercial con IA

### Pitch para dirigentes de club

> "Clubix no solo gestiona tu club — lo entiende. La IA analiza
> los datos de tus socios, actividades y finanzas para decirte
> qué está pasando, qué va a pasar, y qué podés hacer al respecto."

### Diferenciador competitivo

Ningún sistema de gestión de clubes en Argentina (ni en la región) ofrece
análisis con IA. Es un "ocean blue" — no hay competencia en esta funcionalidad.

### Modelo de pricing con IA

| Plan | IA incluida | Target |
|---|---|---|
| Clubix Básico | Sin IA | Clubes chicos (<200 socios) |
| Clubix Pro | Resumen ejecutivo + alertas | Clubes medianos (200-1000) |
| Clubix Premium | Todo + asistente WhatsApp IA + predicciones | Clubes grandes (1000+) |

---

## Prioridades de implementación

| # | Feature | Esfuerzo | Impacto |
|---|---|---|---|
| 1 | Mejorar resumen mensual con RAG | Bajo (ya existe) | Alto |
| 2 | Widget de feedback 👍/👎 en análisis | Bajo | Alto (dataset) |
| 3 | Análisis de buffet/ventas POS | Medio (endpoint nuevo) | Alto |
| 4 | Predicción de bajas con datos de asistencia | Medio | Muy alto |
| 5 | Sugerencias personalizadas por socio | Medio | Alto |
| 6 | Predicción de ingresos/cobranza | Medio | Alto |
| 7 | Detección de anomalías en caja | Medio | Medio-Alto |
| 8 | Migrar aiAssistant.js al hub | Alto (function calling) | Medio |

---

## Documentación relacionada

- `cuthulu/docs/ML/23_ESTRATEGIA_MODELO_PROPIO.md` — estrategia del modelo propio
- `cuthulu/docs/ML/27_ESTADO_IMPLEMENTACION.md` — estado de implementación del hub
- `cuthulu/docs/ML/26_CLASIFICACION_DATOS_Y_LEGAL.md` — framework legal
