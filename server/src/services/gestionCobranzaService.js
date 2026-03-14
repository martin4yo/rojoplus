import prisma from '../lib/prisma.js'

/**
 * Calcula los días de atraso de un cargo
 */
function calcularDiasAtraso(fechaVencimiento) {
  const hoy = new Date()
  const vencimiento = new Date(fechaVencimiento)
  const dias = Math.floor((hoy - vencimiento) / (1000 * 60 * 60 * 24))
  return Math.max(0, dias)
}

/**
 * Determina la prioridad según días de atraso
 */
function determinarPrioridad(diasAtraso) {
  if (diasAtraso > 90) return 'CRITICA'
  if (diasAtraso > 60) return 'ALTA'
  if (diasAtraso > 30) return 'MEDIA'
  return 'BAJA'
}

/**
 * Actualiza o crea gestiones de cobranza para socios con deuda vencida
 */
export async function actualizarGestionesCobranza() {
  console.log('[GestionCobranza] Iniciando actualización de gestiones...')

  try {
    // Buscar socios con cuotas vencidas pendientes
    const sociosConDeuda = await prisma.socio.findMany({
      where: {
        estado: { in: ['ACTIVO', 'VIGENTE'] },
        cargos: {
          some: {
            estado: 'PENDIENTE',
            fechaVencimiento: { lt: new Date() }
          }
        }
      },
      include: {
        cargos: {
          where: {
            estado: 'PENDIENTE',
            fechaVencimiento: { lt: new Date() }
          },
          orderBy: {
            fechaVencimiento: 'asc'
          }
        }
      }
    })

    console.log(`[GestionCobranza] Encontrados ${sociosConDeuda.length} socios con deuda`)

    let creadas = 0
    let actualizadas = 0

    for (const socio of sociosConDeuda) {
      // Calcular deuda total
      const deudaTotal = socio.cargos.reduce((sum, cargo) => sum + Number(cargo.montoTotal), 0)
      const cuotasAdeudadas = socio.cargos.length

      // Calcular días de atraso (del cargo más antiguo)
      const cargoMasAntiguo = socio.cargos[0]
      const diasAtraso = calcularDiasAtraso(cargoMasAntiguo.fechaVencimiento)

      // Determinar prioridad
      const prioridad = determinarPrioridad(diasAtraso)

      // Buscar si ya existe una gestión para este socio
      const gestionExistente = await prisma.gestionCobranza.findFirst({
        where: {
          socioId: socio.id,
          estado: { not: 'RESUELTO' }
        }
      })

      if (gestionExistente) {
        // Actualizar gestión existente
        await prisma.gestionCobranza.update({
          where: { id: gestionExistente.id },
          data: {
            montoDeuda: deudaTotal,
            cuotasAdeudadas,
            diasAtraso,
            prioridad
          }
        })
        actualizadas++
      } else {
        // Crear nueva gestión
        await prisma.gestionCobranza.create({
          data: {
            socioId: socio.id,
            estado: 'PENDIENTE',
            prioridad,
            montoDeuda: deudaTotal,
            cuotasAdeudadas,
            diasAtraso
          }
        })
        creadas++
      }
    }

    // Resolver gestiones de socios que ya no tienen deuda
    const gestionesActivas = await prisma.gestionCobranza.findMany({
      where: {
        estado: { not: 'RESUELTO' }
      },
      include: {
        socio: {
          include: {
            cargos: {
              where: {
                estado: 'PENDIENTE',
                fechaVencimiento: { lt: new Date() }
              }
            }
          }
        }
      }
    })

    let resueltas = 0
    for (const gestion of gestionesActivas) {
      if (gestion.socio.cargos.length === 0) {
        await prisma.gestionCobranza.update({
          where: { id: gestion.id },
          data: { estado: 'RESUELTO' }
        })
        resueltas++
      }
    }

    console.log(`[GestionCobranza] Actualización completada:`)
    console.log(`  - Creadas: ${creadas}`)
    console.log(`  - Actualizadas: ${actualizadas}`)
    console.log(`  - Resueltas: ${resueltas}`)

    return {
      creadas,
      actualizadas,
      resueltas,
      total: sociosConDeuda.length
    }

  } catch (error) {
    console.error('[GestionCobranza] Error:', error)
    throw error
  }
}

/**
 * Envía recordatorios de acciones pendientes a los responsables
 */
export async function enviarRecordatoriosAcciones() {
  console.log('[GestionCobranza] Enviando recordatorios de acciones pendientes...')

  try {
    const hoy = new Date()
    const inicioDia = new Date(hoy.setHours(0, 0, 0, 0))
    const finDia = new Date(hoy.setHours(23, 59, 59, 999))

    const gestionesPendientes = await prisma.gestionCobranza.findMany({
      where: {
        fechaProximaAccion: {
          gte: inicioDia,
          lte: finDia
        },
        recordatorioEnviado: false,
        responsableId: { not: null }
      },
      include: {
        socio: {
          select: {
            nroSocio: true,
            apellidoNombre: true
          }
        },
        responsable: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true
          }
        }
      }
    })

    console.log(`[GestionCobranza] Encontradas ${gestionesPendientes.length} acciones pendientes para hoy`)

    for (const gestion of gestionesPendientes) {
      // TODO: Aquí se puede enviar email o notificación push al responsable
      // Por ahora solo marcamos como enviado
      console.log(`  - Recordatorio para ${gestion.responsable.nombre}: ${gestion.socio.apellidoNombre} - ${gestion.proximaAccion}`)

      await prisma.gestionCobranza.update({
        where: { id: gestion.id },
        data: { recordatorioEnviado: true }
      })
    }

    return gestionesPendientes.length

  } catch (error) {
    console.error('[GestionCobranza] Error enviando recordatorios:', error)
    throw error
  }
}
