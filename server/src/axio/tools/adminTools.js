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

  // Lecturas auxiliares: listas de opciones para elegir por nombre (el admin no
  // conoce IDs). Las usan las write ops cuando falta un dato de catálogo.
  {
    name: 'listar_centros_costo',
    description:
      'Listar los centros de costo activos del club. Usar cuando el admin pregunta ' +
      'qué centros de costo hay, o cuando necesita elegir uno para generar un cargo ' +
      'o inscribir en una actividad y no sabe el nombre.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'listar_estados_socio',
    description:
      'Listar los estados de socio posibles (Activo, Suspendido, Baja, etc.). Usar ' +
      'cuando el admin va a cambiar el estado de un socio y no sabe el nombre exacto.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'listar_tipos_socio',
    description:
      'Listar los tipos de socio del club. Usar cuando el admin va a cambiar el tipo ' +
      'de un socio y no sabe el nombre exacto.',
    inputSchema: { type: 'object', properties: {} },
  },

  // ── Write operations: el hub pide confirmación y delega la ejecución acá ────
  // `write: true` → el hub valida los datos requeridos (slot-filling), pide
  // confirmación y, al confirmar, devuelve el tool_call para que ActionExecutor
  // lo ejecute contra la base de Clubix. Cero SQL de negocio en el hub.
  {
    name: 'crear_socio',
    write: true,
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
    write: true,
    description:
      'Actualizar el tipo y/o categoría de un socio existente. Usar cuando el admin dice: ' +
      '"cambiá el tipo de socio", "actualizá la categoría", "pasá al socio X a tipo Y". ' +
      'Se identifica al socio por su número.',
    inputSchema: {
      type: 'object',
      properties: {
        nroSocio: {
          type: 'string',
          description: 'Número del socio a actualizar.',
        },
        tipoSocio: {
          type: 'string',
          description: 'Nombre del nuevo tipo de socio. Si el admin no lo sabe, usá listar_tipos_socio.',
        },
        categoria: {
          type: 'string',
          description: 'Nombre de la nueva categoría de socio (opcional; se puede cambiar solo el tipo).',
        },
      },
      required: ['nroSocio'],
    },
  },
  {
    name: 'cambiar_estado_socio',
    write: true,
    description:
      'Cambiar el estado de un socio (activo, inactivo, suspendido, baja, etc.). ' +
      'Usar cuando el admin dice: "suspendé al socio", "activá al socio", ' +
      '"cambiá el estado", "darlo de baja", "dar de alta". ' +
      'Se identifica al socio por su número.',
    inputSchema: {
      type: 'object',
      properties: {
        nroSocio: {
          type: 'string',
          description: 'Número del socio.',
        },
        estado: {
          type: 'string',
          description: 'Nombre del nuevo estado (ej: "Activo", "Suspendido", "Baja"). Si el admin no lo sabe, usá listar_estados_socio.',
        },
        motivo: {
          type: 'string',
          description: 'Motivo del cambio (opcional; se registra como motivo de baja si el estado da de baja al socio).',
        },
      },
      required: ['nroSocio', 'estado'],
    },
  },
  {
    name: 'generar_cargo',
    write: true,
    description:
      'Generar un cargo/deuda manual para un socio. Usar cuando el admin dice: ' +
      '"generá un cargo", "cobrá a", "aplicá un cobro", "cargar deuda", ' +
      '"generá una cobranza". NO usar para cuotas masivas — eso es crear_cuota.',
    inputSchema: {
      type: 'object',
      properties: {
        nroSocio: {
          type: 'string',
          description: 'Número del socio al que se le genera el cargo.',
        },
        montoOriginal: {
          type: 'number',
          description: 'Monto del cargo en pesos.',
        },
        centroCosto: {
          type: 'string',
          description: 'Nombre del centro de costo al que imputar el cargo. Si el admin no lo sabe, usá primero listar_centros_costo para mostrarle las opciones.',
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
          description: 'Categoría del cargo: CUOTA_SOCIAL, CUOTA_ACTIVIDAD, PRODUCTO, SERVICIO. Default: CUOTA_ACTIVIDAD.',
        },
      },
      required: ['nroSocio', 'montoOriginal', 'centroCosto'],
    },
  },
  {
    name: 'inscribir_actividad',
    write: true,
    description:
      'Inscribir a un socio en una actividad o disciplina. Usar cuando el admin dice: ' +
      '"inscribí al socio en", "anotá a X en", "registrar inscripción", ' +
      '"dar de alta en actividad". Se identifica al socio por su número y la ' +
      'actividad por su nombre. Genera automáticamente la cuota de la actividad.',
    inputSchema: {
      type: 'object',
      properties: {
        nroSocio: {
          type: 'string',
          description: 'Número del socio a inscribir.',
        },
        actividad: {
          type: 'string',
          description: 'Nombre de la actividad o disciplina (ej: "Tenis", "Natación"). Si el admin no lo sabe, usá listar_actividades.',
        },
        categoria: {
          type: 'string',
          description: 'Nombre de la categoría/turno de la actividad (ej: "Mañana", "Infantil"). Opcional; ayuda a desambiguar cuando la actividad tiene varias.',
        },
        centroCosto: {
          type: 'string',
          description: 'Nombre del centro de costo al que imputar la cuota de la actividad (obligatorio). Si el admin no lo sabe, usá primero listar_centros_costo.',
        },
        fechaInicio: {
          type: 'string',
          description: 'Fecha de inicio de la inscripción ISO 8601 (ej: "2025-01-15"). Opcional; default hoy.',
        },
      },
      required: ['nroSocio', 'actividad', 'centroCosto'],
    },
  },
]
