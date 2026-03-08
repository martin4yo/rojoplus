import cron from 'node-cron'
import prisma from '../lib/prisma.js'
import {
  procesarNotificacionesPendientes,
  verificarCuotasProximasVencer,
  verificarCuotasVencidasHoy,
  verificarMorosidad,
  verificarPartidosProximos,
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
 * Verificar partidos de mañana (recordatorios 24h antes)
 * Se ejecuta todos los días a las 18:00
 */
const verificarPartidosCron = cron.schedule('0 18 * * *', async () => {
  try {
    console.log('\n⚽ [CRON] Verificando partidos de mañana...')
    const cantidad = await verificarPartidosProximos()
    console.log(`✅ [CRON] Programadas ${cantidad} notificaciones de recordatorio de partido\n`)
  } catch (error) {
    console.error('❌ [CRON] Error verificando partidos próximos:', error.message)
  }
}, {
  scheduled: false,
  timezone: 'America/Argentina/Buenos_Aires',
})

/**
 * Sugerir pasajes de categoría al inicio de temporada
 * Se ejecuta el 1 de diciembre a las 8:00 AM
 * Solo genera un log/reporte - la ejecución real es manual desde la UI
 */
const sugerirPasajesCron = cron.schedule('0 8 1 12 *', async () => {
  try {
    console.log('\n🔄 [CRON] Revisando socios que necesitan pasaje de categoría...')

    // Fecha de referencia: 1 de enero del próximo año
    const fechaRef = new Date(new Date().getFullYear() + 1, 0, 1)

    // Obtener inscripciones activas no exceptuadas
    const inscripciones = await prisma.inscripcion.findMany({
      where: {
        estado: 'ACTIVA',
        fechaFin: null,
        exceptuadoPasaje: false,
      },
      include: {
        socio: { select: { id: true, fechaNacimiento: true, apellidoNombre: true } },
        categoriaActividad: {
          include: {
            actividad: { select: { id: true, nombre: true } }
          }
        }
      }
    })

    let fueraDeRango = 0

    for (const insc of inscripciones) {
      if (!insc.socio?.fechaNacimiento) continue

      const nacimiento = new Date(insc.socio.fechaNacimiento)
      let edad = fechaRef.getFullYear() - nacimiento.getFullYear()
      if (fechaRef.getMonth() < nacimiento.getMonth() ||
          (fechaRef.getMonth() === nacimiento.getMonth() && fechaRef.getDate() < nacimiento.getDate())) {
        edad--
      }

      const cat = insc.categoriaActividad
      const edadMin = cat.edadMinima || 0
      const edadMax = cat.edadMaxima || 99

      if (edad < edadMin || edad > edadMax) {
        fueraDeRango++
      }
    }

    console.log(`✅ [CRON] Encontrados ${fueraDeRango} socios fuera de rango de edad para pasaje`)
    console.log(`   Revisar en: /admin/deportes/pasaje-categoria\n`)

  } catch (error) {
    console.error('❌ [CRON] Error revisando pasajes de categoría:', error.message)
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
  console.log('  ⚽ Recordatorio partidos: Todos los días a las 18:00')
  console.log('  🔄 Sugerir pasajes: 1 de diciembre a las 8:00 AM')
  console.log('  🌍 Timezone: America/Argentina/Buenos_Aires\n')

  procesarCola.start()
  verificarProximasVencer.start()
  verificarVencidasHoy.start()
  verificarMorosidadCron.start()
  verificarPartidosCron.start()
  sugerirPasajesCron.start()

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
  verificarPartidosCron.stop()
  sugerirPasajesCron.stop()

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
    case 'partidos':
      return await verificarPartidosProximos()
    default:
      throw new Error(`Tipo desconocido: ${tipo}`)
  }
}

export default {
  iniciarCronJobs,
  detenerCronJobs,
  ejecutarManual,
}
