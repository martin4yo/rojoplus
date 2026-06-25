/**
 * Tools admin para AXIO Hub (Capa 2.6).
 *
 * Reglas:
 *  - El `name` matchea EXACTAMENTE el valor de ACCIONES en aiConstants.js
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
      'Devuelve estadísticas agregadas de socios del club: cantidad total, ' +
      'cantidad de morosos, cantidad de activos, y porcentaje de morosidad. ' +
      'Usar cuando el admin pide: "porcentaje de morosidad", "tasa de mora", ' +
      '"% morosos", "cuántos socios morosos hay", "cuántos socios activos", ' +
      '"cuántos socios tenemos", "ranking de morosidad", "estadísticas de ' +
      'socios", "resumen de socios". NO usar para listar los socios uno por ' +
      'uno — para eso necesita Capa 2.5 SQL.',
    inputSchema: {
      type: 'object',
      properties: {
        filtro: {
          type: 'string',
          enum: ['morosos', 'activos', 'todos', 'porcentaje_morosidad'],
          description:
            "Qué métrica devolver. 'porcentaje_morosidad' devuelve todo " +
            'el resumen con el % calculado. Default: porcentaje_morosidad.',
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

  // ── Fase 5: write operations con confirmación ──────────────────────────────
  {
    name: 'crear_socio',
    description:
      'Crear un nuevo socio en el club. Usar cuando el admin dice: "creá el socio", ' +
      '"dar de alta a", "registrá a", "nuevo socio", "agregá socio". ' +
      'Requiere nombre completo y número de socio.',
    inputSchema: {
      type: 'object',
      properties: {
        nroSocio: {
          type: 'string',
          description: 'Número de socio asignado (ej: "1234", "A-005").',
        },
        apellidoNombre: {
          type: 'string',
          description: 'Apellido y nombre completo del socio.',
        },
        documento: {
          type: 'string',
          description: 'DNI o número de documento (opcional).',
        },
        email: {
          type: 'string',
          description: 'Email del socio (opcional).',
        },
        celular: {
          type: 'string',
          description: 'Teléfono celular (opcional).',
        },
        categoriaSocioId: {
          type: 'number',
          description: 'ID de la categoría del socio (opcional).',
        },
        tipoSocioRelId: {
          type: 'number',
          description: 'ID del tipo de socio (opcional).',
        },
        estadoSocioId: {
          type: 'number',
          description: 'ID del estado inicial del socio (opcional).',
        },
      },
      required: ['nroSocio', 'apellidoNombre'],
    },
  },
  {
    name: 'actualizar_tipo_socio',
    description:
      'Actualizar el tipo y/o categoría de un socio existente. Usar cuando el admin dice: ' +
      '"cambiá el tipo de socio", "actualizá la categoría", "pasá al socio X a tipo Y". ' +
      'Se identifica al socio por su número.',
    inputSchema: {
      type: 'object',
      properties: {
        nroSocio: {
          type: 'string',
          description: 'Número de socio a actualizar.',
        },
        tipoSocioRelId: {
          type: 'number',
          description: 'ID del nuevo tipo de socio (opcional si se cambia solo categoría).',
        },
        tipoSocioNombre: {
          type: 'string',
          description: 'Nombre del tipo para mostrar en la confirmación (opcional).',
        },
        categoriaSocioId: {
          type: 'number',
          description: 'ID de la nueva categoría (opcional si se cambia solo tipo).',
        },
        categoriaNombre: {
          type: 'string',
          description: 'Nombre de la categoría para la confirmación (opcional).',
        },
      },
      required: ['nroSocio'],
    },
  },
  {
    name: 'cambiar_estado_socio',
    description:
      'Cambiar el estado de un socio (activo, inactivo, suspendido, etc.). ' +
      'Usar cuando el admin dice: "suspendé al socio", "activá al socio", ' +
      '"cambiá el estado", "darlo de baja", "dar de alta". ' +
      'Se identifica al socio por su número.',
    inputSchema: {
      type: 'object',
      properties: {
        nroSocio: {
          type: 'string',
          description: 'Número de socio.',
        },
        estadoSocioId: {
          type: 'number',
          description: 'ID del nuevo estado del socio.',
        },
        estadoNombre: {
          type: 'string',
          description: 'Nombre del estado para mostrar en la confirmación (ej: "Activo", "Suspendido").',
        },
      },
      required: ['nroSocio', 'estadoSocioId'],
    },
  },
  {
    name: 'generar_cargo',
    description:
      'Generar un cargo/deuda manual para un socio. Usar cuando el admin dice: ' +
      '"generá un cargo", "cobrá a", "aplicá un cobro", "cargar deuda", ' +
      '"generá una cobranza". NO usar para cuotas masivas — eso es crear_cuota.',
    inputSchema: {
      type: 'object',
      properties: {
        socioId: {
          type: 'number',
          description: 'ID interno del socio (no el nroSocio).',
        },
        montoOriginal: {
          type: 'number',
          description: 'Monto base del cargo en pesos.',
        },
        montoTotal: {
          type: 'number',
          description: 'Monto total a cobrar (igual a montoOriginal si no hay recargos).',
        },
        descripcion: {
          type: 'string',
          description: 'Descripción del cargo (ej: "Cuota enero", "Ropa deportiva").',
        },
        fechaVencimiento: {
          type: 'string',
          description: 'Fecha de vencimiento ISO 8601 (ej: "2025-01-31"). Opcional.',
        },
        categoria: {
          type: 'string',
          description: 'Categoría del cargo: CUOTA_SOCIAL, ACTIVIDAD, PRODUCTO, SERVICIO. Default: CUOTA_SOCIAL.',
        },
      },
      required: ['socioId', 'montoOriginal'],
    },
  },
  {
    name: 'inscribir_actividad',
    description:
      'Inscribir a un socio en una actividad o disciplina. Usar cuando el admin dice: ' +
      '"inscribí al socio en", "anotá a X en", "registrar inscripción", ' +
      '"dar de alta en actividad". Requiere ID del socio e ID de la categoría de actividad.',
    inputSchema: {
      type: 'object',
      properties: {
        socioId: {
          type: 'number',
          description: 'ID interno del socio.',
        },
        categoriaActividadId: {
          type: 'number',
          description: 'ID de la categoría de actividad (disciplina/turno específico).',
        },
        categoriaActividadNombre: {
          type: 'string',
          description: 'Nombre de la actividad para la confirmación (ej: "Tenis - Mañana").',
        },
        fechaInicio: {
          type: 'string',
          description: 'Fecha de inicio de la inscripción ISO 8601 (ej: "2025-01-15").',
        },
        fechaFin: {
          type: 'string',
          description: 'Fecha de fin (opcional, si es temporal).',
        },
      },
      required: ['socioId', 'categoriaActividadId', 'fechaInicio'],
    },
  },
]
