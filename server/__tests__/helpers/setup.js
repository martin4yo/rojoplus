/**
 * Setup global para tests.
 * Mockea prisma y servicios externos ANTES de importar la app.
 * Exports generados automaticamente desde el codigo fuente.
 */
import { jest } from '@jest/globals'
import { createMockPrisma } from './mockPrisma.js'

const mockPrisma = createMockPrisma()
const noop = jest.fn()
const noopAsync = jest.fn().mockResolvedValue(null)

// ===== PRISMA =====
jest.unstable_mockModule('../../src/lib/prisma.js', () => ({
  default: mockPrisma,
}))

const tenantDbInstances = new Map()
const createTenantPrismaMock = jest.fn((tenantId) => {
  if (!tenantDbInstances.has(tenantId)) {
    tenantDbInstances.set(tenantId, createMockPrisma())
  }
  return tenantDbInstances.get(tenantId)
})
jest.unstable_mockModule('../../src/lib/tenantPrisma.js', () => ({
  createTenantPrisma: createTenantPrismaMock,
}))

// ===== JOBS =====
jest.unstable_mockModule('../../src/jobs/notificaciones.js', () => ({
  iniciarCronJobs: noop,
  detenerCronJobs: noop,
}))

// ===== SERVICES =====

jest.unstable_mockModule('../../src/services/email.js', () => ({
  getMailConfig: noop,
  enviarEmail: noopAsync,
  enviarEmailAprobacion: noopAsync,
  enviarEmailRechazo: noopAsync,
  enviarEmailLinkAcceso: noopAsync,
  enviarReciboPago: noopAsync,
  enviarMagicLinkSocio: noopAsync,
  enviarEmailQRSocio: noopAsync,
  enviarEmailContacto: noopAsync,
  enviarConfirmacionReserva: noopAsync,
  enviarCancelacionReserva: noopAsync,
  enviarRecordatorioReserva: noopAsync,
  verificarConexionSMTP: noopAsync,
}))

jest.unstable_mockModule('../../src/services/socketService.js', () => ({
  default: {},
  initSocket: jest.fn(() => ({})),
  getIO: jest.fn(() => ({ to: noop, emit: noop })),
  emitirNotificacion: noop,
  notificarNuevaComanda: noop,
  notificarItemListo: noop,
  notificarCuentaPedida: noop,
  notificarMesaCobrada: noop,
}))

jest.unstable_mockModule('../../src/services/webPush.js', () => ({
  default: {},
  enviarNotificacionPush: noopAsync,
  enviarNotificacionPushMasiva: noopAsync,
  notificarCuotaProximaVencer: noopAsync,
  notificarCuotaVencida: noopAsync,
  notificarPagoConfirmado: noopAsync,
  getVapidPublicKey: jest.fn(() => 'fake-vapid-key'),
}))

jest.unstable_mockModule('../../src/services/whatsappService.js', () => ({
  getWhatsAppConfig: noop,
  normalizarNumero: jest.fn(n => n),
  enviarWhatsAppImagen: noopAsync,
  enviarWhatsApp: noopAsync,
  enviarWhatsAppMasivo: noopAsync,
  verificarConexionWhatsApp: noopAsync,
  configurarWebhookEvolution: noopAsync,
  obtenerTelefonoSocio: noopAsync,
  notificarPago: noopAsync,
  notificarVencimiento: noopAsync,
  notificarMora: noopAsync,
  enviarLinkPortal: noopAsync,
}))

jest.unstable_mockModule('../../src/services/notificacionService.js', () => ({
  default: {},
  enviarEmailConTemplate: noopAsync,
  programarNotificacion: noopAsync,
  procesarNotificacionesPendientes: noopAsync,
  notificarCuotaProximaVencer: noopAsync,
  notificarCuotaVencida: noopAsync,
  notificarMorosidad: noopAsync,
  notificarInscripcionConfirmada: noopAsync,
  notificarBienvenida: noopAsync,
  verificarCuotasProximasVencer: noopAsync,
  verificarCuotasVencidasHoy: noopAsync,
  verificarMorosidad: noopAsync,
  notificarConvocatoriaPartido: noopAsync,
  notificarRecordatorioPartido: noopAsync,
  verificarPartidosProximos: noopAsync,
  notificarNuevoEntrenamiento: noopAsync,
  notificarCancelacionEntrenamiento: noopAsync,
  notificarPasajeCategoria: noopAsync,
  verificarBajaAsistencia: noopAsync,
  enviarSaludosCumpleanios: noopAsync,
  verificarRecordatorioAnticipado: noopAsync,
}))

jest.unstable_mockModule('../../src/services/pdfGenerator.js', () => ({
  generatePDF: noopAsync,
  generarPDFCierreCaja: noopAsync,
  generateTestPDF: noopAsync,
  generarReciboPagoPDF: noopAsync,
}))

jest.unstable_mockModule('../../src/services/thermalPrinter.js', () => ({
  commands: {},
  generateAfipQRData: noop,
  generarTicketFiscal: noop,
  generarTicketCuenta: noop,
}))

jest.unstable_mockModule('../../src/services/ticketService.js', () => ({
  renderTicketFiscal: noopAsync,
  renderTicketNoFiscal: noopAsync,
  renderTicketComanda: noopAsync,
  renderTicketPreCuenta: noopAsync,
  toByteArray: noop,
  toBase64: noop,
}))

jest.unstable_mockModule('../../src/services/asientosContables.js', () => ({
  resolverCuentaCashId: noopAsync,
  generarAsientoPagoCuota: noopAsync,
  generarAsientoMovimientoCaja: noopAsync,
  crearAsientoTransferencia: noopAsync,
  generarAsientoPagoSueldo: noopAsync,
  generarAsientoFacturaVenta: noopAsync,
  generarAsientoReciboCobro: noopAsync,
  generarAsientoFacturaCompra: noopAsync,
  generarAsientoOrdenPago: noopAsync,
}))

jest.unstable_mockModule('../../src/services/afipWSAAService.js', () => ({
  getTicketAcceso: noopAsync,
  invalidateTicket: noop,
  getConfiguracionFiscal: noopAsync,
}))

jest.unstable_mockModule('../../src/services/afipWSFEService.js', () => ({
  getLastAuthorizedNumber: noopAsync,
  requestCAE: noopAsync,
  getServerStatus: noopAsync,
  TIPOS_COMPROBANTE: {},
  TIPOS_DOCUMENTO: {},
  CONDICIONES_IVA: {},
}))

jest.unstable_mockModule('../../src/services/afipQRService.js', () => ({
  generateQRData: noop,
  canGenerateQR: noop,
  generateQRContent: noop,
}))

jest.unstable_mockModule('../../src/services/mercadopago.js', () => ({
  default: {},
  crearPreferenciaPago: noopAsync,
  obtenerPago: noopAsync,
  crearReembolso: noopAsync,
}))

jest.unstable_mockModule('../../src/services/paywayService.js', () => ({
  tokenizarTarjeta: noopAsync,
  cobrarConToken: noopAsync,
  consultarPago: noopAsync,
  verificarWebhook: noop,
}))

jest.unstable_mockModule('../../src/services/aiConstants.js', () => ({
  ROLES: {},
  ACCIONES: {},
}))

jest.unstable_mockModule('../../src/services/axioMLService.js', () => ({
  getScopeHint: noop,
  isAxioMLAvailable: jest.fn(() => false),
  consultarML: noopAsync,
  enviarFeedbackML: noopAsync,
}))

jest.unstable_mockModule('../../src/services/actionExecutor.js', () => ({
  default: class { async execute() { return {} } },
}))

jest.unstable_mockModule('../../src/services/reportEngine.js', () => ({
  warmBrowser: noopAsync,
  renderHtml: noopAsync,
  htmlToPdf: noopAsync,
  getDefaultTemplate: noop,
}))

jest.unstable_mockModule('../../src/services/reportQueries.js', () => ({
  listQueryDefinitions: jest.fn(() => []),
  getQueryDefinition: noop,
  runQuery: noopAsync,
}))

jest.unstable_mockModule('../../src/services/gestionCobranzaService.js', () => ({
  actualizarGestionesCobranza: noopAsync,
  enviarRecordatoriosAcciones: noopAsync,
}))

jest.unstable_mockModule('../../src/services/buffetStockService.js', () => ({
  descontarStockVentaBuffet: noopAsync,
}))

jest.unstable_mockModule('../../src/services/exportCentrosCosto.js', () => ({
  exportarComparativoExcel: noopAsync,
  exportarEvolucionExcel: noopAsync,
  exportarRentabilidadExcel: noopAsync,
  exportarPresupuestoExcel: noopAsync,
  generarPDFComparativo: noopAsync,
}))

jest.unstable_mockModule('../../src/services/emailTemplateService.js', () => ({
  sendTemplateEmail: noopAsync,
  sendTestEmail: noopAsync,
  verificarConexionSMTP: noopAsync,
}))

// ===== IMPORT APP =====
const { app } = await import('../../src/index.js')
const { createTenantPrisma } = await import('../../src/lib/tenantPrisma.js')

export { app, mockPrisma, createTenantPrisma, tenantDbInstances }

export function resetMocks() {
  jest.clearAllMocks()
  tenantDbInstances.clear()
}
