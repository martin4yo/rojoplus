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
    name: 'consultar_ultimos_movimientos',
    description:
      'Consultar los últimos pagos / movimientos de cuenta del socio. Usar cuando pregunta por pagos recientes o historial de movimientos.',
    inputSchema: {
      type: 'object',
      properties: {
        limite: {
          type: 'number',
          description: 'Cantidad de movimientos a traer (default 5, máximo 20).',
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
      'Listar TODAS las actividades deportivas/recreativas que ofrece el club (catálogo). NO usar para ver en cuáles está inscripto el socio — para eso usar mis_actividades.',
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
    name: 'mis_actividades',
    description:
      'Ver las actividades en las que el SOCIO YA ESTÁ INSCRIPTO (sus inscripciones activas, con horarios). Usar cuando pregunta "¿qué actividades tengo?", "en qué estoy anotado", "mis clases".',
    inputSchema: {
      type: 'object',
      properties: {},
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
  {
    name: 'enviar_link_portal',
    description:
      'Generar y devolver el link de acceso al portal personal del socio (donde ve cuotas, pagos, datos personales). NO confundir con QR de comercios — esto es el portal de gestión.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'enviar_qr_comercios',
    description:
      'Devolver al socio su link/QR para presentar en comercios adheridos y acceder a descuentos/beneficios. Distinto al portal personal.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'enviar_link_web',
    description:
      'Devolver el link al sitio web público del club. Usar cuando el socio pide la web o información pública.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'info_club',
    description:
      'Información general del club: horarios de atención, dirección, teléfono y email de contacto. Usar para preguntas sobre cómo contactar al club, dónde queda o cuándo atienden.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'derivar_humano',
    description:
      'Escalar la conversación a un humano cuando el pedido no se puede resolver con las otras tools o cuando el socio pide explícitamente hablar con una persona.',
    inputSchema: {
      type: 'object',
      properties: {
        motivo: {
          type: 'string',
          description: 'Breve descripción del motivo de la derivación.',
        },
      },
      required: ['motivo'],
    },
  },
]
