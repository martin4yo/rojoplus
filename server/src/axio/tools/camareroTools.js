/**
 * Tools camarero (buffet) para AXIO Hub (Capa 2.6).
 *
 * Los `name` y las claves de `inputSchema.properties` matchean EXACTO los
 * campos `entidades` que espera ActionExecutor — el dispatcher mapea
 * tool_call → {accion: name, entidades: args} sin transformaciones.
 */

export const CAMARERO_TOOLS = [
  {
    name: 'ver_mesas',
    description: 'Ver estado de las mesas del buffet.',
    inputSchema: {
      type: 'object',
      properties: {
        filtro: {
          type: 'string',
          enum: ['ocupadas', 'libres', 'todas'],
          description: "Default 'todas' si no se aclara.",
        },
        zona: {
          type: 'string',
          description: 'Nombre de zona del buffet (opcional).',
        },
      },
    },
  },
  {
    name: 'abrir_mesa',
    description: 'Abrir/activar una mesa para empezar a tomar comanda.',
    inputSchema: {
      type: 'object',
      properties: {
        mesaNumero: {
          type: 'number',
          description: 'Número físico de la mesa.',
        },
        nombreCliente: {
          type: 'string',
          description: 'Nombre del cliente, opcional.',
        },
      },
      required: ['mesaNumero'],
    },
  },
  {
    name: 'agregar_items_mesa',
    description: 'Sumar productos al pedido de una mesa abierta.',
    inputSchema: {
      type: 'object',
      properties: {
        mesaNumero: { type: 'number', description: 'Número de mesa.' },
        items: {
          type: 'array',
          description: 'Lista de productos a sumar.',
          items: {
            type: 'object',
            properties: {
              producto: { type: 'string', description: 'Nombre del producto.' },
              cantidad: { type: 'number', description: 'Unidades.' },
              observaciones: {
                type: 'string',
                description: 'Pedidos especiales (sin sal, sin gluten, etc.).',
              },
            },
            required: ['producto', 'cantidad'],
          },
        },
      },
      required: ['mesaNumero', 'items'],
    },
  },
  {
    name: 'ver_comanda_mesa',
    description: 'Ver el pedido / cuenta actual de una mesa.',
    inputSchema: {
      type: 'object',
      properties: {
        mesaNumero: { type: 'number', description: 'Número de mesa.' },
      },
      required: ['mesaNumero'],
    },
  },
  {
    name: 'cerrar_mesa',
    description: 'Cerrar la mesa, cobrar y opcionalmente emitir factura.',
    inputSchema: {
      type: 'object',
      properties: {
        mesaNumero: { type: 'number', description: 'Número de mesa.' },
        metodoPago: {
          type: 'string',
          enum: ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'MERCADOPAGO'],
          description: 'Forma de pago.',
        },
        emitirFactura: {
          type: 'boolean',
          description: 'Si se solicita factura/comprobante AFIP.',
        },
      },
      required: ['mesaNumero', 'metodoPago'],
    },
  },
  {
    name: 'cancelar_item',
    description: 'Cancelar un item específico de una comanda abierta.',
    inputSchema: {
      type: 'object',
      properties: {
        mesaNumero: { type: 'number', description: 'Número de mesa.' },
        itemId: { type: 'number', description: 'ID del item a cancelar.' },
        motivo: { type: 'string', description: 'Motivo opcional.' },
      },
      required: ['mesaNumero', 'itemId'],
    },
  },
  {
    name: 'ver_comandas_pendientes',
    description: 'Listar comandas que están pendientes en cocina o barra.',
    inputSchema: {
      type: 'object',
      properties: {
        sector: {
          type: 'string',
          enum: ['cocina', 'barra', 'todos'],
          description: "Default 'todos' si no se aclara.",
        },
      },
    },
  },
  {
    name: 'marcar_comanda_lista',
    description:
      'Marcar una comanda como lista para entregar (típicamente desde cocina/barra).',
    inputSchema: {
      type: 'object',
      properties: {
        comandaId: { type: 'number', description: 'ID de la comanda.' },
      },
      required: ['comandaId'],
    },
  },
]
