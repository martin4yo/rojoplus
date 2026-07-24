/**
 * Constantes compartidas del subsistema de asistente AI.
 *
 * Antes vivían en aiAssistant.js junto al servicio legacy. Se extrajeron
 * acá para que el servicio legacy se pueda borrar sin romper imports.
 */

// Acciones que el AI Assistant identifica y que ActionExecutor sabe ejecutar.
// El name de cada SOCIO_TOOL / CAMARERO_TOOL / ADMIN_TOOL matchea uno de
// estos valores (sin transformaciones).
export const ACCIONES = {
  // Socios
  CONSULTAR_DEUDA: 'consultar_deuda',
  CONSULTAR_ULTIMOS_MOVIMIENTOS: 'consultar_ultimos_movimientos',
  GENERAR_LINK_PAGO: 'generar_link_pago',
  LISTAR_ACTIVIDADES: 'listar_actividades',
  MIS_ACTIVIDADES: 'mis_actividades',
  INSCRIBIR_ACTIVIDAD: 'inscribir_actividad',
  BAJA_ACTIVIDAD: 'baja_actividad',
  VER_GRUPO_FAMILIAR: 'ver_grupo_familiar',
  AGREGAR_FAMILIAR: 'agregar_familiar',
  VER_CONVOCATORIAS: 'ver_convocatorias',
  CONFIRMAR_CONVOCATORIA: 'confirmar_convocatoria',
  VER_MENU_BUFFET: 'ver_menu_buffet',
  PEDIR_TAKEAWAY: 'pedir_takeaway',
  ENVIAR_LINK_PORTAL: 'enviar_link_portal',
  ENVIAR_QR_COMERCIOS: 'enviar_qr_comercios',
  ENVIAR_LINK_WEB: 'enviar_link_web',
  INFO_CLUB: 'info_club',
  DERIVAR_HUMANO: 'derivar_humano',

  // Camareros (Buffet)
  VER_MESAS: 'ver_mesas',
  ABRIR_MESA: 'abrir_mesa',
  AGREGAR_ITEMS_MESA: 'agregar_items_mesa',
  VER_COMANDA_MESA: 'ver_comanda_mesa',
  CERRAR_MESA: 'cerrar_mesa',
  CANCELAR_ITEM: 'cancelar_item',
  VER_COMANDAS_PENDIENTES: 'ver_comandas_pendientes',
  MARCAR_COMANDA_LISTA: 'marcar_comanda_lista',

  // Admins
  ESTADISTICAS_SOCIOS: 'estadisticas_socios',
  VENTAS_BUFFET: 'ventas_buffet',
  CREAR_CUOTA: 'crear_cuota',
  LISTAR_CENTROS_COSTO: 'listar_centros_costo',
  LISTAR_ESTADOS_SOCIO: 'listar_estados_socio',
  LISTAR_TIPOS_SOCIO: 'listar_tipos_socio',

  // Admins — write operations (el hub pide confirmación y delega la ejecución acá)
  CREAR_SOCIO: 'crear_socio',
  ACTUALIZAR_TIPO_SOCIO: 'actualizar_tipo_socio',
  CAMBIAR_ESTADO_SOCIO: 'cambiar_estado_socio',
  GENERAR_CARGO: 'generar_cargo',

  // General
  UNKNOWN: 'unknown',
}

export const ROLES = {
  SOCIO: 'socio',
  ADMIN: 'admin',
  CAMARERO: 'camarero',
}
