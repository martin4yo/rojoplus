/**
 * Tools socio para AXIO Hub (Capa 2.6).
 *
 * Los `name` y las claves de `inputSchema.properties` matchean EXACTO los
 * campos `entidades` que espera ActionExecutor — el dispatcher mapea
 * tool_call → {accion: name, entidades: args} sin transformaciones.
 *
 * El contexto del socio (id, tokenPortal, miembrosFamilia) se inyecta del
 * lado del handler local, no viaja al hub.
 */

export const SOCIO_TOOLS = [
  {
    name: 'consultar_deuda',
    description:
      'Consultar saldo / deuda del socio (cuotas pendientes). Usar cuando pregunta por su estado de cuenta, deuda o cuotas pendientes.',
    inputSchema: {
      type: 'object',
      properties: {
        incluirFamilia: {
          type: 'boolean',
          description: 'True para incluir la deuda del grupo familiar del socio.',
        },
      },
    },
  },
  {
    name: 'generar_link_pago',
    description:
      'Generar un link de pago (Mercado Pago) para que el socio abone cuotas pendientes.',
    inputSchema: {
      type: 'object',
      properties: {
        cuotasIds: {
          oneOf: [
            { type: 'array', items: { type: 'number' } },
            { type: 'string', enum: ['todas'] },
          ],
          description:
            "IDs específicos de cuotas a incluir, o 'todas' para pagar todo lo pendiente.",
        },
        metodoPago: {
          type: 'string',
          enum: ['MERCADOPAGO'],
          description: "Default 'MERCADOPAGO'.",
        },
      },
    },
  },
  {
    name: 'listar_actividades',
    description:
      'Listar las actividades deportivas/recreativas disponibles en el club.',
    inputSchema: {
      type: 'object',
      properties: {
        categoria: {
          type: 'string',
          description: 'Filtrar por categoría/edad (opcional).',
        },
      },
    },
  },
  {
    name: 'inscribir_actividad',
    description:
      'Inscribir al socio (o a un familiar) en una actividad deportiva.',
    inputSchema: {
      type: 'object',
      properties: {
        actividad: {
          type: 'string',
          description: 'Nombre de la actividad (ej "Tenis", "Natación").',
        },
        categoria: {
          type: 'string',
          description: 'Categoría específica si aplica (ej "Adultos", "Sub-15").',
        },
        familiarId: {
          type: 'number',
          description:
            'ID del familiar a inscribir. Si null/ausente, se inscribe al socio.',
        },
      },
      required: ['actividad'],
    },
  },
  {
    name: 'baja_actividad',
    description: 'Dar de baja al socio (o familiar) de una actividad.',
    inputSchema: {
      type: 'object',
      properties: {
        actividad: { type: 'string', description: 'Nombre de la actividad.' },
        familiarId: {
          type: 'number',
          description: 'ID del familiar. Si null/ausente, se da de baja al socio.',
        },
      },
      required: ['actividad'],
    },
  },
  {
    name: 'ver_grupo_familiar',
    description: 'Ver miembros del grupo familiar del socio.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'agregar_familiar',
    description: 'Agregar un nuevo miembro al grupo familiar del socio.',
    inputSchema: {
      type: 'object',
      properties: {
        apellidoNombre: {
          type: 'string',
          description: 'Apellido y nombre del familiar.',
        },
        dni: { type: 'string', description: 'DNI sin puntos ni guiones.' },
        fechaNacimiento: {
          type: 'string',
          description: 'YYYY-MM-DD.',
        },
        parentesco: {
          type: 'string',
          description: 'Ej "hijo", "cónyuge", "padre".',
        },
      },
      required: ['apellidoNombre'],
    },
  },
  {
    name: 'ver_convocatorias',
    description: 'Ver convocatorias a partidos/eventos del socio.',
    inputSchema: {
      type: 'object',
      properties: {
        soloPendientes: {
          type: 'boolean',
          description: 'Si true, solo las que están sin confirmar todavía.',
        },
      },
    },
  },
  {
    name: 'confirmar_convocatoria',
    description: 'Confirmar o rechazar la asistencia a un partido convocado.',
    inputSchema: {
      type: 'object',
      properties: {
        partidoId: { type: 'number', description: 'ID del partido convocado.' },
        confirmado: {
          type: 'boolean',
          description: 'true = confirma asistencia, false = rechaza.',
        },
        motivoRechazo: {
          type: 'string',
          description: 'Opcional si rechaza.',
        },
      },
      required: ['partidoId', 'confirmado'],
    },
  },
  {
    name: 'ver_menu_buffet',
    description: 'Ver el menú actual del buffet (productos y precios).',
    inputSchema: {
      type: 'object',
      properties: {
        categoria: {
          type: 'string',
          description: 'Filtrar por categoría (opcional).',
        },
      },
    },
  },
  {
    name: 'pedir_takeaway',
    description:
      'Hacer un pedido de buffet para llevar (takeaway) a nombre del socio.',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Productos del pedido.',
          items: {
            type: 'object',
            properties: {
              producto: { type: 'string', description: 'Nombre del producto.' },
              cantidad: { type: 'number', description: 'Unidades.' },
              observaciones: {
                type: 'string',
                description: 'Pedidos especiales (sin sal, sin TACC, etc.).',
              },
            },
            required: ['producto', 'cantidad'],
          },
        },
      },
      required: ['items'],
    },
  },
]
