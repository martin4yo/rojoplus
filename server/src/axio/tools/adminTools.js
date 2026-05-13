/**
 * Tools admin para AXIO Hub (Capa 2.6).
 *
 * Reglas:
 *  - El `name` matchea EXACTAMENTE el valor de ACCIONES en aiAssistant.js
 *    para que el dispatcher pueda mapear tool_call → {accion, entidades}
 *    directo a ActionExecutor sin transformación.
 *  - `inputSchema` matchea el formato `entidades` del prompt legacy.
 *  - Queries libres tipo "cuántos socios morosos" NO necesitan tool: las
 *    resuelve Capa 2.5 (SQL via Claude). Solo declaramos tools para acciones
 *    que ejecutan algo en la DB o disparan un side-effect.
 */

export const ADMIN_TOOLS = [
  {
    name: 'estadisticas_socios',
    description:
      'Obtener estadísticas agregadas de socios del club. Usar cuando el admin pide un conteo o resumen (no un listado de filas individuales).',
    inputSchema: {
      type: 'object',
      properties: {
        filtro: {
          type: 'string',
          enum: ['morosos', 'activos', 'todos'],
          description: 'Qué subconjunto de socios contar.',
        },
        periodo: {
          type: 'string',
          enum: ['mes', 'año'],
          description: 'Ventana temporal opcional.',
        },
      },
    },
  },
  {
    name: 'ventas_buffet',
    description:
      'Obtener resumen de ventas del buffet por período y tipo (mesas, takeaway, kiosco).',
    inputSchema: {
      type: 'object',
      properties: {
        periodo: {
          type: 'string',
          enum: ['hoy', 'semana', 'mes'],
          description: 'Período de análisis.',
        },
        tipo: {
          type: 'string',
          enum: ['mesas', 'takeaway', 'kiosco', 'todos'],
          description: "Default 'todos' si no se aclara.",
        },
      },
      required: ['periodo'],
    },
  },
  {
    name: 'crear_cuota',
    description:
      'Generar cuotas sociales. Usar cuando el admin pide crear/generar cuotas masivas para un período.',
    inputSchema: {
      type: 'object',
      properties: {
        periodoId: {
          type: 'number',
          description: 'ID del período al que pertenecen las cuotas a generar.',
        },
        descripcion: {
          type: 'string',
          description: 'Descripción opcional de la generación.',
        },
      },
    },
  },
]
