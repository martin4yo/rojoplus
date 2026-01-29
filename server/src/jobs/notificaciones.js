import cron from 'node-cron'
import {
  procesarNotificacionesPendientes,
  verificarCuotasProximasVencer,
  verificarCuotasVencidasHoy,
  verificarMorosidad,
} from '../services/notificacionService.js'

/**
 * Sistema de Notificaciones Automáticas
 *
 * Cron jobs para enviar notificaciones programadas a socios:
 * - Cuotas próximas a vencer (5 días antes)
 * - Cuotas vencidas (día del vencimiento)
 * - Recordatorios de morosidad (cada 15 días)
 */

/**
 * Procesar cola de notificaciones pendientes
 * Se ejecuta cada 10 minutos
 */
const procesarCola = cron.schedule('*/10 * * * *', async () => {
  try {
    console.log('\n📬 [CRON] Procesando cola de notificaciones pendientes...')
    const resultado = await procesarNotificacionesPendientes()
    console.log(`✅ [CRON] Procesadas: ${resultado.exitosos} exitosas, ${resultado.fallidos} fallidas\n`)
  } catch (error) {
    console.error('❌ [CRON] Error procesando cola de notificaciones:', error.message)
  }
}, {
  scheduled: false,
})

/**
 * Verificar cuotas próximas a vencer
 * Se ejecuta todos los días a las 9:00 AM
 */
const verificarProximasVencer = cron.schedule('0 9 * * *', async () => {
  try {
    console.log('\n🔔 [CRON] Verificando cuotas próximas a vencer (5 días)...')
    const cantidad = await verificarCuotasProximasVencer()
    console.log(`✅ [CRON] Programadas ${cantidad} notificaciones de cuotas próximas a vencer\n`)
  } catch (error) {
    console.error('❌ [CRON] Error verificando cuotas próximas a vencer:', error.message)
  }
}, {
  scheduled: false,
  timezone: 'America/Argentina/Buenos_Aires',
})

/**
 * Verificar cuotas vencidas hoy
 * Se ejecuta todos los días a las 10:00 AM
 */
const verificarVencidasHoy = cron.schedule('0 10 * * *', async () => {
  try {
    console.log('\n⏰ [CRON] Verificando cuotas que vencen hoy...')
    const cantidad = await verificarCuotasVencidasHoy()
    console.log(`✅ [CRON] Programadas ${cantidad} notificaciones de cuotas vencidas\n`)
  } catch (error) {
    console.error('❌ [CRON] Error verificando cuotas vencidas:', error.message)
  }
}, {
  scheduled: false,
  timezone: 'America/Argentina/Buenos_Aires',
})

/**
 * Verificar morosidad
 * Se ejecuta todos los lunes y viernes a las 11:00 AM
 */
const verificarMorosidadCron = cron.schedule('0 11 * * 1,5', async () => {
  try {
    console.log('\n💰 [CRON] Verificando socios con morosidad...')
    const cantidad = await verificarMorosidad()
    console.log(`✅ [CRON] Programadas ${cantidad} notificaciones de morosidad\n`)
  } catch (error) {
    console.error('❌ [CRON] Error verificando morosidad:', error.message)
  }
}, {
  scheduled: false,
  timezone: 'America/Argentina/Buenos_Aires',
})

/**
 * Iniciar todos los cron jobs
 */
export function iniciarCronJobs() {
  console.log('\n🚀 Iniciando sistema de notificaciones automáticas...\n')

  console.log('📅 Cron jobs configurados:')
  console.log('  ⏱️  Procesar cola: Cada 10 minutos')
  console.log('  🔔 Cuotas próximas a vencer: Todos los días a las 9:00 AM')
  console.log('  ⏰ Cuotas vencidas: Todos los días a las 10:00 AM')
  console.log('  💰 Morosidad: Lunes y viernes a las 11:00 AM')
  console.log('  🌍 Timezone: America/Argentina/Buenos_Aires\n')

  procesarCola.start()
  verificarProximasVencer.start()
  verificarVencidasHoy.start()
  verificarMorosidadCron.start()

  console.log('✅ Todos los cron jobs iniciados correctamente\n')
}

/**
 * Detener todos los cron jobs
 */
export function detenerCronJobs() {
  console.log('\n🛑 Deteniendo sistema de notificaciones automáticas...\n')

  procesarCola.stop()
  verificarProximasVencer.stop()
  verificarVencidasHoy.stop()
  verificarMorosidadCron.stop()

  console.log('✅ Todos los cron jobs detenidos\n')
}

/**
 * Ejecutar manualmente una verificación (útil para testing)
 */
export async function ejecutarManual(tipo) {
  console.log(`\n🔧 Ejecutando manualmente: ${tipo}\n`)

  switch (tipo) {
    case 'cola':
      return await procesarNotificacionesPendientes()
    case 'proximas-vencer':
      return await verificarCuotasProximasVencer()
    case 'vencidas':
      return await verificarCuotasVencidasHoy()
    case 'morosidad':
      return await verificarMorosidad()
    default:
      throw new Error(`Tipo desconocido: ${tipo}`)
  }
}

export default {
  iniciarCronJobs,
  detenerCronJobs,
  ejecutarManual,
}
