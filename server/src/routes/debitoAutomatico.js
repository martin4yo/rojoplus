import { Router } from 'express'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma.js'
import { authAdmin } from '../middleware/auth.js'
import { enviarReciboPago } from '../services/email.js'
import { notificarPago, obtenerTelefonoSocio } from '../services/whatsappService.js'

const router = Router()

// Helper para manejar errores async
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

// ============================================
// HELPER: Notificaciones de recibo (email + WA)
// ============================================

/**
 * Envía email + WhatsApp para una lista de pagos cobrados.
 * Retorna { emailOk, emailFail, waOk, waFail } para mostrar en UI.
 * No lanza excepciones — todos los errores son capturados.
 */
export async function enviarNotificacionesRecibo(pagosIds, db) {
  const stats = { emailOk: 0, emailFail: 0, waOk: 0, waFail: 0 }
  if (!pagosIds?.length) return stats

  for (const pagoId of pagosIds) {
    try {
      const pago = await db.pago.findUnique({
        where: { id: pagoId },
        include: {
          socio: {
            select: {
              id: true,
              nroSocio: true,
              apellidoNombre: true,
              documento: true,
              email: true,
              celular: true,
              celularSecundario: true,
              telefonoFijo: true
            }
          },
          medioPago: { select: { id: true, nombre: true } },
          cargos: {
            include: {
              periodo: { select: { nombre: true } },
              categoriaActividad: {
                select: {
                  nombre: true,
                  actividad: { select: { nombre: true } }
                }
              }
            }
          }
        }
      })

      if (!pago) continue

      // Email
      if (pago.socio?.email) {
        try {
          await enviarReciboPago(pago, db)
          stats.emailOk++
        } catch (err) {
          console.error(`[Débito] Error email recibo pago ${pagoId}:`, err.message)
          stats.emailFail++
        }
      }

      // WhatsApp
      const telefono = obtenerTelefonoSocio(pago.socio)
      if (telefono) {
        try {
          await notificarPago({
            db,
            socio: pago.socio,
            pago: { importe: pago.montoTotal, numero: pago.numero }
          })
          stats.waOk++
        } catch (err) {
          console.error(`[Débito] Error WA recibo pago ${pagoId}:`, err.message)
          stats.waFail++
        }
      }
    } catch (err) {
      console.error(`[Débito] Error obteniendo pago ${pagoId} para notificar:`, err.message)
    }
  }

  return stats
}

// ============================================
// CONFIGURACIONES DE DÉBITO
// ============================================

// GET /api/admin/debito/configuraciones - Listar configuraciones
router.get('/configuraciones', authAdmin, asyncHandler(async (req, res) => {
  const configuraciones = await req.db.configuracionDebito.findMany({
    orderBy: { nombre: 'asc' },
    include: {
      _count: {
        select: { archivos: true }
      }
    }
  })

  res.json({ success: true, data: configuraciones })
}))

// POST /api/admin/debito/configuraciones - Crear configuración
router.post('/configuraciones', authAdmin, asyncHandler(async (req, res) => {
  const {
    codigo,
    nombre,
    tipo,
    plataforma,
    formatoArchivo,
    separador,
    encoding,
    configuracionCampos,
    templateCabecera,
    templatePie,
    codigoEmpresa,
    codigoComercio,
    nombreEmpresa,
    cuitEmpresa,
    apiUrl,
    apiKey,
    apiSecret,
    ambiente
  } = req.body

  // Validar campos requeridos
  if (!codigo || !nombre) {
    return res.status(400).json({
      success: false,
      error: 'Código y nombre son requeridos'
    })
  }

  // Verificar que no exista un procesador con el mismo código
  const existente = await req.db.configuracionDebito.findUnique({
    where: { codigo }
  })

  if (existente) {
    return res.status(400).json({
      success: false,
      error: 'Ya existe un procesador con ese código'
    })
  }

  const configuracion = await req.db.configuracionDebito.create({
    data: {
      codigo,
      nombre,
      tipo,
      plataforma,
      formatoArchivo,
      separador,
      encoding,
      configuracionCampos,
      templateCabecera,
      templatePie,
      codigoEmpresa,
      codigoComercio,
      nombreEmpresa,
      cuitEmpresa,
      apiUrl,
      apiKey,
      apiSecret,
      ambiente
    }
  })

  res.status(201).json({ success: true, data: configuracion })
}))

// PUT /api/admin/debito/configuraciones/:id - Actualizar configuración
router.put('/configuraciones/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const data = req.body

  const configuracion = await req.db.configuracionDebito.update({
    where: { id: parseInt(id) },
    data
  })

  res.json({ success: true, data: configuracion })
}))

// DELETE /api/admin/debito/configuraciones/:id - Eliminar configuración
router.delete('/configuraciones/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  // Verificar que no tenga archivos asociados
  const archivos = await prisma.archivoDebito.count({
    where: { configuracionId: parseInt(id) }
  })

  if (archivos > 0) {
    return res.status(400).json({
      error: 'No se puede eliminar una configuración que tiene archivos generados'
    })
  }

  await req.db.configuracionDebito.delete({
    where: { id: parseInt(id) }
  })

  res.json({ message: 'Configuración eliminada' })
}))

// ============================================
// SOCIOS DISPONIBLES PARA DÉBITO
// ============================================

// GET /api/admin/debito/socios-disponibles - Listar socios con débito activo
router.get('/socios-disponibles', authAdmin, asyncHandler(async (req, res) => {
  const { periodoAnio, periodoMes, configuracionId } = req.query

  if (!periodoAnio || !periodoMes) {
    return res.status(400).json({ error: 'Se requiere período (año y mes)' })
  }

  // Buscar socios con débito activo que tengan cuotas pendientes en el período
  const socios = await req.db.socio.findMany({
    where: {
      enviaDebito: true,
      estadoSocioRel: { esSocioActivo: true },
      NOT: { tarjetaNumero: null }, // Requiere número de tarjeta
      cargos: {
        some: {
          periodoAnio: parseInt(periodoAnio),
          periodoMes: parseInt(periodoMes),
          saldo: { gt: 0 },
          incluidoEnDebitoId: null // No incluido en otro archivo
        }
      }
    },
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      dni: true,
      email: true,
      bancoDebito: true,
      cbuDebito: true,
      aliasDebito: true,
      debitoTipo: true,
      tarjetaNumero: true,
      tarjetaUltimos4: true,
      tarjetaMarca: true,
      tarjetaVencimiento: true,
      cargos: {
        where: {
          periodoAnio: parseInt(periodoAnio),
          periodoMes: parseInt(periodoMes),
          saldo: { gt: 0 },
          incluidoEnDebitoId: null
        },
        select: {
          id: true,
          descripcion: true,
          monto: true,
          saldo: true,
          recargo: true,
          categoria: true
        }
      }
    },
    orderBy: { nroSocio: 'asc' }
  })

  // Calcular total por socio
  const sociosConTotal = socios.map(socio => ({
    ...socio,
    totalDebitar: socio.cargos.reduce((sum, c) => sum + parseFloat(c.saldo) + parseFloat(c.recargo || 0), 0),
    cantidadCargos: socio.cargos.length,
    tipoTarjeta: obtenerTipoTarjeta(socio.tarjetaNumero, socio.tarjetaMarca)
  }))

  // Agrupar por tipo de tarjeta
  const porVisa = sociosConTotal.filter(s => s.tipoTarjeta === 'VISA_CREDITO' || s.tipoTarjeta === 'VISA_DEBITO')
  const porMastercard = sociosConTotal.filter(s => s.tipoTarjeta === 'MASTERCARD')

  res.json({
    socios: sociosConTotal,
    resumen: {
      total: sociosConTotal.length,
      montoTotal: sociosConTotal.reduce((sum, s) => sum + s.totalDebitar, 0),
      porVisa: porVisa.length,
      porMastercard: porMastercard.length,
      montoVisa: porVisa.reduce((sum, s) => sum + s.totalDebitar, 0),
      montoMastercard: porMastercard.reduce((sum, s) => sum + s.totalDebitar, 0)
    }
  })
}))

// Función para determinar tipo de tarjeta
function obtenerTipoTarjeta(numero, marca) {
  if (!numero) return 'DESCONOCIDO'

  // Por marca si está disponible
  if (marca) {
    const marcaUpper = marca.toUpperCase()
    if (marcaUpper.includes('VISA')) {
      // Visa débito empieza con 4517 o similar
      if (numero.startsWith('4517') || numero.startsWith('4509')) {
        return 'VISA_DEBITO'
      }
      return 'VISA_CREDITO'
    }
    if (marcaUpper.includes('MASTER')) return 'MASTERCARD'
  }

  // Por BIN (primeros dígitos)
  if (numero.startsWith('4')) {
    // Visa débito Argentina típicamente 4517, 4509
    if (numero.startsWith('4517') || numero.startsWith('4509')) {
      return 'VISA_DEBITO'
    }
    return 'VISA_CREDITO'
  }
  if (numero.startsWith('5') || numero.startsWith('2')) return 'MASTERCARD'

  return 'DESCONOCIDO'
}

// ============================================
// ARCHIVOS DE DÉBITO
// ============================================

// GET /api/admin/debito/archivos - Listar archivos generados
router.get('/archivos', authAdmin, asyncHandler(async (req, res) => {
  const { periodoAnio, periodoMes, estado, page = 1, limit = 20 } = req.query

  const where = {}
  if (periodoAnio) where.periodoAnio = parseInt(periodoAnio)
  if (periodoMes) where.periodoMes = parseInt(periodoMes)
  if (estado) where.estado = estado

  const [archivos, total] = await Promise.all([
    prisma.archivoDebito.findMany({
      where,
      include: {
        configuracion: {
          select: { nombre: true, codigo: true }
        },
        _count: {
          select: {
            detalles: true,
            cobranzas: true
          }
        }
      },
      orderBy: { fechaGeneracion: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    }),
    prisma.archivoDebito.count({ where })
  ])

  // Obtener estadísticas de cada archivo
  const archivosConStats = await Promise.all(archivos.map(async (archivo) => {
    const stats = await prisma.detalleDebito.groupBy({
      by: ['estado'],
      where: { archivoId: archivo.id },
      _count: true,
      _sum: { importeEnviado: true }
    })

    return {
      ...archivo,
      estadisticas: {
        pendientes: stats.find(s => s.estado === 'PENDIENTE')?._count || 0,
        cobrados: stats.find(s => s.estado === 'COBRADO')?._count || 0,
        rechazados: stats.find(s => s.estado === 'RECHAZADO')?._count || 0,
        montoCobrado: parseFloat(stats.find(s => s.estado === 'COBRADO')?._sum?.importeEnviado || 0)
      }
    }
  }))

  res.json({
    archivos: archivosConStats,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  })
}))

// POST /api/admin/debito/archivos/generar - Generar archivo de débito
router.post('/archivos/generar', authAdmin, asyncHandler(async (req, res) => {
  const {
    configuracionId,
    periodoAnio,
    periodoMes,
    socioIds, // Array de IDs de socios a incluir
    tipoArchivo, // VISA_CREDITO, VISA_DEBITO, MASTERCARD
    observaciones
  } = req.body

  if (!configuracionId || !periodoAnio || !periodoMes || !socioIds?.length || !tipoArchivo) {
    return res.status(400).json({
      error: 'Se requiere configuración, período, tipo de archivo y al menos un socio'
    })
  }

  // Obtener configuración
  const configuracion = await req.db.configuracionDebito.findUnique({
    where: { id: parseInt(configuracionId) }
  })

  if (!configuracion) {
    return res.status(404).json({ error: 'Configuración no encontrada' })
  }

  // Obtener socios con sus cargos pendientes
  const socios = await req.db.socio.findMany({
    where: {
      id: { in: socioIds.map(id => parseInt(id)) },
      enviaDebito: true,
      estado: 'ACTIVO',
      NOT: { tarjetaNumero: null }
    },
    include: {
      cargos: {
        where: {
          periodoAnio: parseInt(periodoAnio),
          periodoMes: parseInt(periodoMes),
          saldo: { gt: 0 },
          incluidoEnDebitoId: null
        }
      }
    }
  })

  if (socios.length === 0) {
    return res.status(400).json({ error: 'No hay socios válidos para generar débito' })
  }

  // Filtrar por tipo de tarjeta
  const sociosFiltrados = socios.filter(s => {
    const tipo = obtenerTipoTarjeta(s.tarjetaNumero, s.tarjetaMarca)
    if (tipoArchivo === 'VISA_CREDITO') return tipo === 'VISA_CREDITO'
    if (tipoArchivo === 'VISA_DEBITO') return tipo === 'VISA_DEBITO'
    if (tipoArchivo === 'MASTERCARD') return tipo === 'MASTERCARD'
    return false
  })

  if (sociosFiltrados.length === 0) {
    return res.status(400).json({ error: `No hay socios con tarjeta ${tipoArchivo} para generar débito` })
  }

  // Determinar nombre del archivo según tipo
  let nombreBase
  if (tipoArchivo === 'VISA_CREDITO') nombreBase = 'DEBLIQC'
  else if (tipoArchivo === 'VISA_DEBITO') nombreBase = 'DEBLIQD'
  else if (tipoArchivo === 'MASTERCARD') nombreBase = 'DEBLIMC'
  else nombreBase = 'DEBITO'

  // Generar número de archivo
  const ultimoArchivo = await prisma.archivoDebito.findFirst({
    where: {
      periodoAnio: parseInt(periodoAnio),
      periodoMes: parseInt(periodoMes)
    },
    orderBy: { numero: 'desc' }
  })

  const secuencia = ultimoArchivo
    ? parseInt(ultimoArchivo.numero.split('-').pop()) + 1
    : 1

  const numeroArchivo = `DEB-${periodoAnio}-${String(periodoMes).padStart(2, '0')}-${String(secuencia).padStart(3, '0')}`

  // Calcular totales
  let montoTotal = 0
  const detalles = []
  let secuenciaDetalle = 1

  for (const socio of sociosFiltrados) {
    const importeSocio = socio.cargos.reduce(
      (sum, c) => sum + parseFloat(c.saldo) + parseFloat(c.recargo || 0),
      0
    )

    if (importeSocio > 0) {
      detalles.push({
        socioId: socio.id,
        cbuEnviado: socio.tarjetaNumero, // Guardamos la tarjeta aquí
        importeEnviado: importeSocio,
        conceptoEnviado: `CUOTA ${String(periodoMes).padStart(2, '0')}/${periodoAnio}`,
        estado: 'PENDIENTE',
        // Datos adicionales para generar el archivo
        _tarjeta: socio.tarjetaNumero,
        _secuencia: secuenciaDetalle++,
        _nroSocio: socio.nroSocio,
        _esPrimerDebito: true // TODO: verificar si ya hubo débitos anteriores
      })

      montoTotal += importeSocio
    }
  }

  // Obtener número de establecimiento de la configuración
  const nroEstablecimiento = configuracion.codigoEmpresa || '0000000000'

  // Generar contenido del archivo según formato PRISMA
  const contenidoArchivo = generarArchivoPrisma(tipoArchivo, detalles, {
    periodoAnio,
    periodoMes,
    nroEstablecimiento,
    nombreBase
  })

  const nombreArchivoFinal = `${nombreBase}.txt`

  // Crear archivo en transacción
  const archivo = await req.db.$transaction(async (tx) => {
    // Crear archivo
    const nuevoArchivo = await tx.archivoDebito.create({
      data: {
        configuracionId: parseInt(configuracionId),
        numero: numeroArchivo,
        periodoAnio: parseInt(periodoAnio),
        periodoMes: parseInt(periodoMes),
        cantidadRegistros: detalles.length,
        montoTotal,
        nombreArchivo: nombreArchivoFinal,
        estado: 'GENERADO',
        generadoPor: req.admin.id,
        observaciones: `${tipoArchivo} - ${observaciones || ''}`
      }
    })

    // Crear detalles (sin los campos internos _*)
    await tx.detalleDebito.createMany({
      data: detalles.map(d => ({
        archivoId: nuevoArchivo.id,
        socioId: d.socioId,
        cbuEnviado: d.cbuEnviado,
        importeEnviado: d.importeEnviado,
        conceptoEnviado: d.conceptoEnviado,
        estado: d.estado
      }))
    })

    // Marcar cargos como incluidos en débito
    const cargoIds = sociosFiltrados.flatMap(s => s.cargos.map(c => c.id))
    await tx.cargo.updateMany({
      where: { id: { in: cargoIds } },
      data: { incluidoEnDebitoId: nuevoArchivo.id }
    })

    return nuevoArchivo
  })

  res.status(201).json({
    archivo,
    contenido: contenidoArchivo,
    nombreArchivo: nombreArchivoFinal,
    mensaje: `Archivo ${nombreBase} generado con ${detalles.length} registros por $${montoTotal.toLocaleString('es-AR')}`
  })
}))

// GET /api/admin/debito/archivos/:id - Ver detalle de archivo
router.get('/archivos/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const archivo = await prisma.archivoDebito.findUnique({
    where: { id: parseInt(id) },
    include: {
      configuracion: true,
      detalles: {
        include: {
          socio: {
            select: {
              id: true,
              nroSocio: true,
              apellidoNombre: true,
              dni: true,
              email: true,
              tarjetaUltimos4: true,
              tarjetaMarca: true
            }
          }
        },
        orderBy: { socio: { nroSocio: 'asc' } }
      },
      cobranzas: {
        orderBy: { fechaImportacion: 'desc' }
      },
      cargosIncluidos: {
        select: {
          id: true,
          descripcion: true,
          monto: true,
          saldo: true,
          socioId: true
        }
      }
    }
  })

  if (!archivo) {
    return res.status(404).json({ error: 'Archivo no encontrado' })
  }

  // Estadísticas
  const stats = await prisma.detalleDebito.groupBy({
    by: ['estado'],
    where: { archivoId: parseInt(id) },
    _count: true,
    _sum: { importeEnviado: true }
  })

  res.json({
    ...archivo,
    estadisticas: {
      pendientes: stats.find(s => s.estado === 'PENDIENTE')?._count || 0,
      cobrados: stats.find(s => s.estado === 'COBRADO')?._count || 0,
      rechazados: stats.find(s => s.estado === 'RECHAZADO')?._count || 0,
      montoPendiente: parseFloat(stats.find(s => s.estado === 'PENDIENTE')?._sum?.importeEnviado || 0),
      montoCobrado: parseFloat(stats.find(s => s.estado === 'COBRADO')?._sum?.importeEnviado || 0),
      montoRechazado: parseFloat(stats.find(s => s.estado === 'RECHAZADO')?._sum?.importeEnviado || 0)
    }
  })
}))

// GET /api/admin/debito/archivos/:id/descargar - Descargar archivo
router.get('/archivos/:id/descargar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const archivo = await prisma.archivoDebito.findUnique({
    where: { id: parseInt(id) },
    include: {
      configuracion: true,
      detalles: {
        include: {
          socio: {
            select: {
              nroSocio: true,
              tarjetaNumero: true,
              tarjetaMarca: true
            }
          }
        },
        orderBy: { id: 'asc' }
      }
    }
  })

  if (!archivo) {
    return res.status(404).json({ error: 'Archivo no encontrado' })
  }

  // Determinar tipo de archivo por el nombre
  let tipoArchivo = 'VISA_CREDITO'
  if (archivo.nombreArchivo.includes('DEBLIQD')) tipoArchivo = 'VISA_DEBITO'
  else if (archivo.nombreArchivo.includes('DEBLIMC')) tipoArchivo = 'MASTERCARD'

  // Preparar detalles con datos para regenerar
  const detallesConDatos = archivo.detalles.map((d, idx) => ({
    ...d,
    _tarjeta: d.cbuEnviado, // La tarjeta está guardada aquí
    _secuencia: idx + 1,
    _nroSocio: d.socio?.nroSocio || '',
    _esPrimerDebito: true
  }))

  // Regenerar contenido
  const contenido = generarArchivoPrisma(tipoArchivo, detallesConDatos, {
    periodoAnio: archivo.periodoAnio,
    periodoMes: archivo.periodoMes,
    nroEstablecimiento: archivo.configuracion?.codigoEmpresa || '0000000000',
    nombreBase: archivo.nombreArchivo.replace('.txt', '')
  })

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${archivo.nombreArchivo}"`)
  res.send(contenido)
}))

// PUT /api/admin/debito/archivos/:id/enviar - Marcar como enviado
router.put('/archivos/:id/enviar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const archivo = await prisma.archivoDebito.update({
    where: { id: parseInt(id) },
    data: {
      estado: 'ENVIADO',
      fechaEnvio: new Date()
    }
  })

  res.json(archivo)
}))

// ============================================
// IMPORTACIÓN DE RESPUESTAS
// ============================================

// POST /api/admin/debito/archivos/:id/importar-respuesta - Importar respuesta
router.post('/archivos/:id/importar-respuesta', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { contenido, nombreArchivo, tipoRespuesta } = req.body

  if (!contenido) {
    return res.status(400).json({ error: 'Se requiere el contenido del archivo' })
  }

  const archivo = await prisma.archivoDebito.findUnique({
    where: { id: parseInt(id) },
    include: {
      configuracion: true,
      detalles: {
        include: {
          socio: {
            select: {
              id: true,
              nroSocio: true,
              tarjetaNumero: true
            }
          }
        }
      }
    }
  })

  if (!archivo) {
    return res.status(404).json({ error: 'Archivo no encontrado' })
  }

  // Determinar tipo de archivo de respuesta
  let tipoResp = tipoRespuesta
  if (!tipoResp) {
    // Detectar por nombre del archivo original
    if (archivo.nombreArchivo.includes('DEBLIQD')) tipoResp = 'RDEBLIQD' // Visa Débito
    else if (archivo.nombreArchivo.includes('DEBLIQC')) tipoResp = 'RDEBLIQC' // Visa Crédito
    else if (archivo.nombreArchivo.includes('DEBLIMC')) tipoResp = 'RDEBLIMC' // Mastercard
    else tipoResp = 'RDEBLIQC' // Default
  }

  // Parsear respuesta según formato PRISMA
  const resultados = parsearRespuestaPrisma(tipoResp, contenido, archivo.detalles)

  // Generar número de importación
  const ultimaImportacion = await prisma.importacionCobranza.findFirst({
    orderBy: { numero: 'desc' }
  })

  const secuencia = ultimaImportacion
    ? parseInt(ultimaImportacion.numero.split('-').pop()) + 1
    : 1

  const numeroImportacion = `IMP-${new Date().getFullYear()}-${String(secuencia).padStart(4, '0')}`

  // Procesar en transacción
  const resultado = await req.db.$transaction(async (tx) => {
    // Crear registro de importación
    const importacion = await tx.importacionCobranza.create({
      data: {
        archivoDebitoId: parseInt(id),
        numero: numeroImportacion,
        tipo: 'DEBITO_AUTOMATICO',
        nombreArchivo: nombreArchivo || `${tipoResp}.txt`,
        registrosTotales: resultados.length,
        registrosCobrados: resultados.filter(r => r.estado === 'COBRADO').length,
        registrosRechazados: resultados.filter(r => r.estado === 'RECHAZADO').length,
        montoCobrado: resultados
          .filter(r => r.estado === 'COBRADO')
          .reduce((sum, r) => sum + r.importe, 0),
        importadoPor: req.admin.id
      }
    })

    // Actualizar detalles del archivo
    for (const resultado of resultados) {
      await tx.detalleDebito.update({
        where: { id: resultado.detalleId },
        data: {
          estado: resultado.estado,
          codigoRechazo: resultado.codigoRechazo,
          motivoRechazo: resultado.motivoRechazo,
          fechaProceso: new Date()
        }
      })

      // Si fue cobrado, crear el pago
      if (resultado.estado === 'COBRADO') {
        // Obtener cargos del socio incluidos en este archivo
        const cargos = await tx.cargo.findMany({
          where: {
            socioId: resultado.socioId,
            incluidoEnDebitoId: parseInt(id),
            saldo: { gt: 0 }
          },
          include: { conceptoTesoreria: true }
        })

        if (cargos.length > 0) {
          // Obtener o crear medio de pago y caja para débitos
          const medioPagoId = await obtenerMedioPagoDebito(tx)
          const caja = await obtenerCajaDebito(tx)

          // Generar número de pago único (defensivo contra numeros no parseables previos)
          const ultimosPagos = await tx.pago.findMany({
            orderBy: { id: 'desc' },
            select: { numero: true },
            take: 100,
          })
          const ultimoNumeroValido = ultimosPagos
            .map(p => parseInt(p.numero, 10))
            .filter(n => Number.isFinite(n) && n > 0)
            .reduce((max, n) => Math.max(max, n), 0)
          const nuevoNumero = String(ultimoNumeroValido + 1).padStart(8, '0')

          // Crear pago con todos los campos requeridos
          const pago = await tx.pago.create({
            data: {
              numero: nuevoNumero,
              socioId: resultado.socioId,
              fecha: new Date(),
              montoTotal: resultado.importe,
              montoRecibido: resultado.importe,
              montoACuenta: 0,
              medioPagoId,
              cajaId: caja.id,
              origen: 'DEBITO_AUTOMATICO',
              observaciones: `Débito automático - ${archivo.numero}`,
              registradoPor: req.admin.id
            }
          })

          // Crear MovimientoCaja para registro en tesorería
          const anioMov = new Date().getFullYear()
          const prefijoMov = `MV-${anioMov}-`
          const ultimoMov = await tx.movimientoCaja.findFirst({
            where: { numero: { startsWith: prefijoMov } },
            orderBy: { numero: 'desc' }
          })
          let siguienteMov = 1
          if (ultimoMov) {
            const partesMov = ultimoMov.numero.split('-')
            siguienteMov = (parseInt(partesMov[partesMov.length - 1]) || 0) + 1
          }
          const numeroMov = `${prefijoMov}${String(siguienteMov).padStart(5, '0')}`

          const movDA = await tx.movimientoCaja.create({
            data: {
              numero: numeroMov,
              cajaId: caja.id,
              cuentaContableId: caja.cuentaContableId,
              fecha: new Date(),
              tipo: 'INGRESO',
              concepto: 'Débito Automático',
              conceptoTesoreriaId: cargos[0]?.conceptoTesoreriaId || null,
              monto: resultado.importe,
              descripcion: `Débito automático - Socio #${resultado.socioId} - ${archivo.numero}`,
              pagoId: pago.id,
              registradoPor: req.admin.id,
              centroCostoId: caja.centroCostoId ?? null,
              conciliado: !caja.requiereConciliacion
            }
          })

          // ItemMovimientoCaja — un ítem por concepto de cargo
          const gruposDA = {}
          for (const c of cargos) {
            const key = c.conceptoTesoreriaId ?? 'sin'
            if (!gruposDA[key]) {
              gruposDA[key] = {
                conceptoTesoreriaId: c.conceptoTesoreriaId,
                cuentaContableId: c.conceptoTesoreria?.cuentaContableId ?? caja.cuentaContableId,
                centroCostoId: c.centroCostoId ?? caja.centroCostoId ?? null,
                monto: 0,
              }
            }
            gruposDA[key].monto += Number(c.saldo)
          }
          const gruposDAArr = Object.values(gruposDA)
          const totalDA = gruposDAArr.reduce((s, g) => s + g.monto, 0)
          let montoAsigDA = 0
          for (let i = 0; i < gruposDAArr.length; i++) {
            const g = gruposDAArr[i]
            const esUltimo = i === gruposDAArr.length - 1
            const montoItem = esUltimo
              ? Math.round((resultado.importe - montoAsigDA) * 100) / 100
              : Math.round(resultado.importe * (totalDA > 0 ? g.monto / totalDA : 1 / gruposDAArr.length) * 100) / 100
            if (montoItem <= 0) continue
            montoAsigDA += montoItem
            await tx.itemMovimientoCaja.create({
              data: {
                movimientoCajaId: movDA.id,
                conceptoTesoreriaId: g.conceptoTesoreriaId,
                cuentaContableId: g.cuentaContableId,
                centroCostoId: g.centroCostoId,
                monto: montoItem,
                descripcion: `Débito automático - Socio #${resultado.socioId} - ${archivo.numero}`,
                orden: i,
              }
            })
          }

          // Actualizar saldo de caja
          await tx.caja.update({
            where: { id: caja.id },
            data: { saldoActual: { increment: resultado.importe } }
          })

          // Guardar el pagoId en el resultado para enviar recibo después
          resultado.pagoId = pago.id

          // Aplicar pago a cargos
          let montoRestante = resultado.importe
          for (const cargo of cargos) {
            if (montoRestante <= 0) break

            const saldoCargo = parseFloat(cargo.saldo) + parseFloat(cargo.recargo || 0)
            const aplicar = Math.min(montoRestante, saldoCargo)

            // Actualizar cargo y vincularlo al pago
            await tx.cargo.update({
              where: { id: cargo.id },
              data: {
                pagoId: pago.id,
                estado: aplicar >= saldoCargo ? 'PAGADO' : 'PARCIAL',
                saldo: parseFloat(cargo.saldo) - Math.min(montoRestante, parseFloat(cargo.saldo)),
                recargo: 0,
                fechaPago: aplicar >= saldoCargo ? new Date() : null
              }
            })

            montoRestante -= aplicar
          }
        }
      }
    }

    // Actualizar estado del archivo
    const todosResueltos = resultados.every(r => r.estado !== 'PENDIENTE')
    if (todosResueltos) {
      await tx.archivoDebito.update({
        where: { id: parseInt(id) },
        data: {
          estado: 'PROCESADO',
          fechaProceso: new Date()
        }
      })
    }

    return importacion
  })

  // Enviar recibos (email + WhatsApp) a los cobrados
  const pagosIds = resultados.filter(r => r.estado === 'COBRADO' && r.pagoId).map(r => r.pagoId)
  const notifStats = await enviarNotificacionesRecibo(pagosIds, req.db)

  res.json({
    importacion: resultado,
    resumen: {
      total: resultados.length,
      cobrados: resultados.filter(r => r.estado === 'COBRADO').length,
      rechazados: resultados.filter(r => r.estado === 'RECHAZADO').length,
      montoCobrado: resultados
        .filter(r => r.estado === 'COBRADO')
        .reduce((sum, r) => sum + r.importe, 0),
      notificaciones: notifStats,
      detalles: resultados.map(r => ({
        tarjeta: r.tarjeta?.slice(-4) || '****',
        importe: r.importe,
        estado: r.estado,
        codigoRechazo: r.codigoRechazo,
        motivoRechazo: r.motivoRechazo
      }))
    }
  })
}))

// ============================================
// REENVÍO DE RECIBOS
// ============================================

// POST /api/admin/debito/archivos/:id/reenviar-recibos
// Re-envía email + WhatsApp a todos los cobrados de un archivo ya procesado
router.post('/archivos/:id/reenviar-recibos', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  // Obtener detalles cobrados del archivo
  const detalles = await req.db.detalleDebito.findMany({
    where: {
      archivoId: parseInt(id),
      tenantId: req.tenantId,
      estado: 'COBRADO'
    }
  })

  if (detalles.length === 0) {
    return res.status(400).json({ error: 'No hay registros cobrados en este archivo' })
  }

  // Obtener los pagoIds buscando pagos vinculados a los socios + archivo
  const pagos = await req.db.pago.findMany({
    where: {
      tenantId: req.tenantId,
      origen: { in: ['DEBITO_AUTOMATICO'] },
      socioId: { in: detalles.map(d => d.socioId) },
      cargos: {
        some: { incluidoEnDebitoId: parseInt(id) }
      }
    },
    select: { id: true }
  })

  if (pagos.length === 0) {
    return res.status(400).json({ error: 'No se encontraron pagos asociados a este archivo' })
  }

  const notifStats = await enviarNotificacionesRecibo(pagos.map(p => p.id), req.db)

  res.json({
    mensaje: 'Recibos reenviados',
    pagos: pagos.length,
    notificaciones: notifStats
  })
}))

// ============================================
// REINTENTO DE RECHAZADOS
// ============================================

// POST /api/admin/debito/archivos/:id/reintentar-rechazados
router.post('/archivos/:id/reintentar-rechazados', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { detalleIds } = req.body // Opcional: IDs específicos a reintentar

  const archivo = await prisma.archivoDebito.findUnique({
    where: { id: parseInt(id) },
    include: {
      configuracion: true,
      detalles: {
        where: {
          estado: 'RECHAZADO',
          ...(detalleIds?.length ? { id: { in: detalleIds.map(Number) } } : {})
        },
        include: {
          socio: {
            include: {
              cargos: {
                where: {
                  incluidoEnDebitoId: parseInt(id),
                  saldo: { gt: 0 }
                }
              }
            }
          }
        }
      }
    }
  })

  if (!archivo) {
    return res.status(404).json({ error: 'Archivo no encontrado' })
  }

  if (archivo.detalles.length === 0) {
    return res.status(400).json({ error: 'No hay rechazos para reintentar' })
  }

  // Verificar que los socios sigan activos y con débito
  const sociosValidos = archivo.detalles.filter(d =>
    d.socio.activo &&
    d.socio.enviaDebito &&
    d.socio.tarjetaNumero
  )

  if (sociosValidos.length === 0) {
    return res.status(400).json({ error: 'No hay socios válidos para reintentar' })
  }

  // Generar nuevo archivo de reintento
  const nuevoNumero = `${archivo.numero}-R${archivo.cobranzas?.length + 1 || 1}`

  let montoTotal = 0
  const detalles = sociosValidos.map(d => {
    const importe = d.socio.cargos.reduce(
      (sum, c) => sum + parseFloat(c.saldo) + parseFloat(c.recargo || 0),
      0
    )
    montoTotal += importe

    return {
      socioId: d.socio.id,
      cbuEnviado: d.socio.tarjetaNumero,
      importeEnviado: importe,
      conceptoEnviado: d.conceptoEnviado,
      estado: 'PENDIENTE'
    }
  })

  // Crear nuevo archivo de reintento
  const nuevoArchivo = await req.db.$transaction(async (tx) => {
    // Marcar detalles originales como reintentados
    await tx.detalleDebito.updateMany({
      where: {
        id: { in: sociosValidos.map(d => d.id) }
      },
      data: {
        motivoRechazo: `REINTENTADO EN ${nuevoNumero}`
      }
    })

    // Crear nuevo archivo
    const archivoNuevo = await tx.archivoDebito.create({
      data: {
        configuracionId: archivo.configuracionId,
        numero: nuevoNumero,
        periodoAnio: archivo.periodoAnio,
        periodoMes: archivo.periodoMes,
        cantidadRegistros: detalles.length,
        montoTotal,
        nombreArchivo: archivo.nombreArchivo, // Mismo tipo
        estado: 'GENERADO',
        generadoPor: req.admin.id,
        observaciones: `Reintento de ${archivo.numero}`
      }
    })

    // Crear detalles
    await tx.detalleDebito.createMany({
      data: detalles.map(d => ({
        ...d,
        archivoId: archivoNuevo.id
      }))
    })

    return archivoNuevo
  })

  res.json({
    archivo: nuevoArchivo,
    mensaje: `Archivo de reintento generado con ${detalles.length} registros`
  })
}))

// ============================================
// ESTADÍSTICAS
// ============================================

// GET /api/admin/debito/estadisticas - Estadísticas generales
router.get('/estadisticas', authAdmin, asyncHandler(async (req, res) => {
  const { anio } = req.query
  const anioActual = anio ? parseInt(anio) : new Date().getFullYear()

  // Socios con débito activo
  const sociosConDebito = await req.db.socio.count({
    where: {
      enviaDebito: true,
      estadoSocioRel: { esSocioActivo: true },
      NOT: { tarjetaNumero: null }
    }
  })

  // Archivos por estado
  const archivosPorEstado = await prisma.archivoDebito.groupBy({
    by: ['estado'],
    where: { periodoAnio: anioActual },
    _count: true,
    _sum: { montoTotal: true }
  })

  // Detalles por estado (del año)
  const detallesPorEstado = await prisma.detalleDebito.groupBy({
    by: ['estado'],
    where: {
      archivo: { periodoAnio: anioActual }
    },
    _count: true,
    _sum: { importeEnviado: true }
  })

  // Rechazos por código (top 10)
  const rechazosPorCodigo = await prisma.detalleDebito.groupBy({
    by: ['codigoRechazo', 'motivoRechazo'],
    where: {
      estado: 'RECHAZADO',
      NOT: { codigoRechazo: null },
      archivo: { periodoAnio: anioActual }
    },
    _count: true,
    orderBy: { _count: { codigoRechazo: 'desc' } },
    take: 10
  })

  // Tasa de éxito general
  const totalCobrados = detallesPorEstado.find(d => d.estado === 'COBRADO')?._count || 0
  const totalRechazados = detallesPorEstado.find(d => d.estado === 'RECHAZADO')?._count || 0
  const totalProcesados = totalCobrados + totalRechazados
  const tasaExito = totalProcesados > 0 ? (totalCobrados / totalProcesados * 100).toFixed(1) : 0

  res.json({
    sociosConDebito,
    anio: anioActual,
    archivos: {
      generados: archivosPorEstado.find(a => a.estado === 'GENERADO')?._count || 0,
      enviados: archivosPorEstado.find(a => a.estado === 'ENVIADO')?._count || 0,
      procesados: archivosPorEstado.find(a => a.estado === 'PROCESADO')?._count || 0,
      montoTotal: archivosPorEstado.reduce((sum, a) => sum + parseFloat(a._sum.montoTotal || 0), 0)
    },
    detalles: {
      pendientes: detallesPorEstado.find(d => d.estado === 'PENDIENTE')?._count || 0,
      cobrados: totalCobrados,
      rechazados: totalRechazados,
      montoCobrado: parseFloat(detallesPorEstado.find(d => d.estado === 'COBRADO')?._sum?.importeEnviado || 0),
      montoRechazado: parseFloat(detallesPorEstado.find(d => d.estado === 'RECHAZADO')?._sum?.importeEnviado || 0)
    },
    tasaExito: parseFloat(tasaExito),
    rechazosPorCodigo
  })
}))

// ============================================
// FUNCIONES DE GENERACIÓN DE ARCHIVOS PRISMA
// ============================================

/**
 * Genera archivo en formato PRISMA según especificación oficial
 *
 * Archivos de presentación:
 * - DEBLIQC.txt: VISA Crédito (100 caracteres por línea)
 * - DEBLIQD.txt: VISA Débito (100 caracteres por línea)
 * - DEBLIMC.txt: Mastercard Crédito/Débito (100 caracteres por línea)
 */
function generarArchivoPrisma(tipoArchivo, detalles, options) {
  const { periodoAnio, periodoMes, nroEstablecimiento, nombreBase } = options
  const now = new Date()
  const fecha = `${periodoAnio}${String(periodoMes).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const hora = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`

  const lineas = []

  // Determinar constante según tipo
  let constante = 'DEBLIQC '
  if (tipoArchivo === 'VISA_DEBITO') constante = 'DEBLIQD '
  else if (tipoArchivo === 'MASTERCARD') constante = 'DEBLIMC '

  // ==========================================
  // REGISTRO HEADER (Tipo "0") - 100 caracteres
  // ==========================================
  // Pos 1 (1): Tipo registro = "0"
  // Pos 2-9 (8): Constante "DEBLIQC " / "DEBLIQD " / "DEBLIMC "
  // Pos 10-19 (10): Número de establecimiento
  // Pos 20-29 (10): Constante "900000    "
  // Pos 30-37 (8): Fecha generación AAAAMMDD
  // Pos 38-41 (4): Hora generación HHMM
  // Pos 42 (1): Tipo archivo = "0" (Altas)
  // Pos 43-44 (2): Espacios
  // Pos 45-99 (55): Espacios
  // Pos 100 (1): "*"

  const header = [
    '0',                                          // Pos 1: Tipo registro
    constante,                                    // Pos 2-9: Constante (8 char)
    nroEstablecimiento.padEnd(10, ' ').slice(0, 10), // Pos 10-19: Nro establecimiento
    '900000    ',                                 // Pos 20-29: Constante
    fecha,                                        // Pos 30-37: Fecha AAAAMMDD
    hora,                                         // Pos 38-41: Hora HHMM
    '0',                                          // Pos 42: Tipo archivo (0=Altas)
    '  ',                                         // Pos 43-44: Espacios
    ' '.repeat(55),                               // Pos 45-99: Espacios
    '*'                                           // Pos 100: Fin de registro
  ].join('')

  lineas.push(header)

  // ==========================================
  // REGISTROS DETALLE (Tipo "1") - 100 caracteres
  // ==========================================
  // Pos 1 (1): Tipo registro = "1"
  // Pos 2-17 (16): Número de tarjeta
  // Pos 18-20 (3): Espacios
  // Pos 21-28 (8): Referencia/número secuencial
  // Pos 29-36 (8): Fecha vencimiento AAAAMMDD
  // Pos 37-40 (4): Código transacción (0005=Consumos)
  // Pos 41-55 (15): Importe (13 enteros + 2 decimales, sin punto)
  // Pos 56-70 (15): Identificador del débito
  // Pos 71 (1): Código alta ("E" si primer débito, sino espacio)
  // Pos 72-73 (2): Espacios
  // Pos 74-99 (26): Espacios
  // Pos 100 (1): "*"

  let montoTotal = 0

  for (const detalle of detalles) {
    const tarjeta = String(detalle._tarjeta || detalle.cbuEnviado || '').padEnd(16, ' ').slice(0, 16)
    const secuencia = String(detalle._secuencia || 1).padStart(8, '0')
    const fechaVto = `${periodoAnio}${String(periodoMes).padStart(2, '0')}10` // Día 10 del mes
    const importe = Math.round(detalle.importeEnviado * 100).toString().padStart(15, '0')
    const identificador = String(detalle._nroSocio || detalle.socioId || '').padEnd(15, ' ').slice(0, 15)
    const codigoAlta = detalle._esPrimerDebito ? 'E' : ' '

    montoTotal += detalle.importeEnviado

    const lineaDetalle = [
      '1',                                        // Pos 1: Tipo registro
      tarjeta,                                    // Pos 2-17: Número tarjeta
      '   ',                                      // Pos 18-20: Espacios
      secuencia,                                  // Pos 21-28: Referencia
      fechaVto,                                   // Pos 29-36: Fecha vencimiento
      '0005',                                     // Pos 37-40: Código transacción
      importe,                                    // Pos 41-55: Importe
      identificador,                              // Pos 56-70: Identificador
      codigoAlta,                                 // Pos 71: Código alta
      '  ',                                       // Pos 72-73: Espacios
      ' '.repeat(26),                             // Pos 74-99: Espacios
      '*'                                         // Pos 100: Fin de registro
    ].join('')

    lineas.push(lineaDetalle)
  }

  // ==========================================
  // REGISTRO TRAILER (Tipo "9") - 100 caracteres
  // ==========================================
  // Pos 1 (1): Tipo registro = "9"
  // Pos 2-9 (8): Constante
  // Pos 10-19 (10): Número de establecimiento
  // Pos 20-29 (10): Constante "900000    "
  // Pos 30-37 (8): Fecha generación
  // Pos 38-41 (4): Hora generación
  // Pos 42-48 (7): Cantidad de registros detalle
  // Pos 49-63 (15): Sumatoria importes
  // Pos 64-99 (36): Espacios
  // Pos 100 (1): "*"

  const cantRegistros = String(detalles.length).padStart(7, '0')
  const sumatoriaImportes = Math.round(montoTotal * 100).toString().padStart(15, '0')

  const trailer = [
    '9',                                          // Pos 1: Tipo registro
    constante,                                    // Pos 2-9: Constante
    nroEstablecimiento.padEnd(10, ' ').slice(0, 10), // Pos 10-19: Nro establecimiento
    '900000    ',                                 // Pos 20-29: Constante
    fecha,                                        // Pos 30-37: Fecha
    hora,                                         // Pos 38-41: Hora
    cantRegistros,                                // Pos 42-48: Cantidad registros
    sumatoriaImportes,                            // Pos 49-63: Sumatoria importes
    ' '.repeat(36),                               // Pos 64-99: Espacios
    '*'                                           // Pos 100: Fin de registro
  ].join('')

  lineas.push(trailer)

  return lineas.join('\r\n')
}

// ============================================
// FUNCIONES DE PARSEO DE RESPUESTAS PRISMA
// ============================================

/**
 * Parsea archivo de respuesta/rendición de PRISMA
 *
 * Archivos de rendición:
 * - RDEBLIQC: VISA Crédito (300 caracteres)
 * - RDEBLIMC: Mastercard (300 caracteres)
 * - RDEBLIQD: VISA Débito validados (150 caracteres)
 * - LDEBLIQD: VISA Débito liquidados (150 caracteres)
 */
function parsearRespuestaPrisma(tipoArchivo, contenido, detallesOriginal) {
  const lineas = contenido.split(/\r?\n/).filter(l => l.trim())
  const resultados = []

  // Determinar formato según tipo de archivo
  const esVisaDebito = tipoArchivo === 'RDEBLIQD' || tipoArchivo === 'LDEBLIQD'
  const longitudLinea = esVisaDebito ? 150 : 300

  for (const linea of lineas) {
    // Solo procesar registros de detalle (tipo "1")
    if (!linea.startsWith('1')) continue

    // Asegurar longitud mínima
    const lineaPadded = linea.padEnd(longitudLinea, ' ')

    let tarjeta, importe, codigoError, descripcionError, estadoMovimiento

    if (esVisaDebito) {
      // Formato RDEBLIQD/LDEBLIQD (150 caracteres)
      // Pos 2-17: Número de tarjeta
      // Pos 41-55: Importe (15 caracteres, 2 decimales)
      // Pos 101-103: Código de error
      // Pos 104-143: Descripción del error
      tarjeta = lineaPadded.substring(1, 17).trim()
      importe = parseInt(lineaPadded.substring(40, 55)) / 100
      codigoError = lineaPadded.substring(100, 103).trim()
      descripcionError = lineaPadded.substring(103, 143).trim()
      // Si no hay código de error, está aprobado
      estadoMovimiento = codigoError === '' || codigoError === '000' ? 'A' : 'R'
    } else {
      // Formato RDEBLIQC/RDEBLIMC (300 caracteres)
      // Pos 27-42: Número de tarjeta
      // Pos 63-77: Importe (15 caracteres, 2 decimales)
      // Pos 130: Estado del movimiento (A=Aprobado, R=Rechazado)
      // Pos 131-132: Código motivo rechazo 1
      // Pos 133-161: Descripción motivo rechazo 1
      tarjeta = lineaPadded.substring(26, 42).trim()
      importe = parseInt(lineaPadded.substring(62, 77)) / 100
      estadoMovimiento = lineaPadded.substring(129, 130).trim()
      codigoError = lineaPadded.substring(130, 132).trim()
      descripcionError = lineaPadded.substring(132, 161).trim()
    }

    // Buscar el detalle correspondiente por número de tarjeta
    const detalle = detallesOriginal.find(d => {
      const tarjetaOriginal = (d.cbuEnviado || d.socio?.tarjetaNumero || '').trim()
      return tarjetaOriginal === tarjeta ||
             tarjetaOriginal.endsWith(tarjeta.slice(-4)) ||
             tarjeta.endsWith(tarjetaOriginal.slice(-4))
    })

    if (detalle) {
      const esCobrado = estadoMovimiento === 'A' || estadoMovimiento === '' ||
                        codigoError === '' || codigoError === '00' || codigoError === '000'

      resultados.push({
        detalleId: detalle.id,
        socioId: detalle.socioId,
        tarjeta,
        importe: importe || detalle.importeEnviado,
        estado: esCobrado ? 'COBRADO' : 'RECHAZADO',
        codigoRechazo: esCobrado ? null : codigoError,
        motivoRechazo: esCobrado ? null : (descripcionError || obtenerMotivoRechazo(codigoError))
      })
    }
  }

  // Si no se encontraron coincidencias por tarjeta, intentar por posición
  if (resultados.length === 0 && detallesOriginal.length > 0) {
    let idx = 0
    for (const linea of lineas) {
      if (!linea.startsWith('1')) continue
      if (idx >= detallesOriginal.length) break

      const detalle = detallesOriginal[idx]
      const lineaPadded = linea.padEnd(longitudLinea, ' ')

      let codigoError, descripcionError, estadoMovimiento, importe

      if (esVisaDebito) {
        importe = parseInt(lineaPadded.substring(40, 55)) / 100
        codigoError = lineaPadded.substring(100, 103).trim()
        descripcionError = lineaPadded.substring(103, 143).trim()
        estadoMovimiento = codigoError === '' || codigoError === '000' ? 'A' : 'R'
      } else {
        importe = parseInt(lineaPadded.substring(62, 77)) / 100
        estadoMovimiento = lineaPadded.substring(129, 130).trim()
        codigoError = lineaPadded.substring(130, 132).trim()
        descripcionError = lineaPadded.substring(132, 161).trim()
      }

      const esCobrado = estadoMovimiento === 'A' || estadoMovimiento === '' ||
                        codigoError === '' || codigoError === '00' || codigoError === '000'

      resultados.push({
        detalleId: detalle.id,
        socioId: detalle.socioId,
        tarjeta: detalle.cbuEnviado?.slice(-4) || '****',
        importe: importe || parseFloat(detalle.importeEnviado),
        estado: esCobrado ? 'COBRADO' : 'RECHAZADO',
        codigoRechazo: esCobrado ? null : codigoError,
        motivoRechazo: esCobrado ? null : (descripcionError || obtenerMotivoRechazo(codigoError))
      })

      idx++
    }
  }

  return resultados
}

// Obtener motivo de rechazo por código
function obtenerMotivoRechazo(codigo) {
  const motivos = {
    '01': 'Tarjeta vencida',
    '02': 'Tarjeta robada',
    '03': 'Tarjeta extraviada',
    '04': 'Tarjeta retenida',
    '05': 'Tarjeta rechazada',
    '10': 'Tarjeta no habilitada',
    '11': 'Fondos insuficientes',
    '12': 'Excede límite de crédito',
    '13': 'Cuenta inválida',
    '14': 'Número de tarjeta inválido',
    '15': 'Emisor no disponible',
    '21': 'Establecimiento no habilitado',
    '22': 'Comercio no existe',
    '30': 'Error de formato',
    '31': 'Archivo duplicado',
    '41': 'Tarjeta perdida',
    '43': 'Tarjeta robada',
    '51': 'Fondos insuficientes',
    '54': 'Tarjeta vencida',
    '55': 'PIN incorrecto',
    '57': 'Transacción no permitida',
    '58': 'Transacción no permitida',
    '61': 'Excede límite',
    '62': 'Tarjeta restringida',
    '65': 'Excede intentos',
    '75': 'Excede intentos PIN',
    '76': 'Cuenta no encontrada',
    '77': 'Cuenta inválida',
    '78': 'Cuenta no existente',
    '91': 'Emisor no disponible',
    '92': 'Destino no disponible',
    '93': 'Transacción no completada',
    '94': 'Transacción duplicada',
    '96': 'Error de sistema',
    '97': 'Error de verificación',
    '98': 'Error de proceso',
    '99': 'Error general',
    'SD': 'Stop Debit - Baja solicitada por cliente',
    'NC': 'Tarjeta no existe',
    'VE': 'Tarjeta vencida',
    'BA': 'Baja de adhesión'
  }
  return motivos[codigo] || `Rechazo código ${codigo}`
}

// ============================================
// PARSER RESPUESTA BANCARIA (CBU)
// ============================================

/**
 * Parsea el archivo de respuesta de débito bancario según el banco.
 * Cada banco tiene un formato de texto fijo distinto.
 * Matching por CBU completo (detalles.cbuEnviado).
 */
function parsearRespuestaBanco(banco, contenido, detallesOriginal) {
  const lineas = contenido.split(/\r?\n/)
  const resultados = []

  // Mapa CBU → detalle para búsqueda rápida
  const mapCBU = {}
  for (const d of detallesOriginal) {
    if (d.cbuEnviado) mapCBU[d.cbuEnviado.trim()] = d
  }

  // Códigos de rechazo bancarios comunes
  const motivosBancarios = {
    '00': 'Acreditado',
    '01': 'Cuenta inexistente',
    '02': 'CBU inválido',
    '03': 'Cuenta cerrada',
    '04': 'Cuenta bloqueada',
    '05': 'Fondos insuficientes',
    '06': 'Titular fallecido',
    '07': 'Orden de no pago',
    '08': 'Importe excede límite',
    '09': 'Dato inconsistente',
    '10': 'Moneda no habilitada',
    '11': 'Cuenta embargada',
    '12': 'Acuerdo rescindido',
    '13': 'CBU inhabilitado por el cliente',
    '14': 'Cuenta en gestión judicial',
    '99': 'Error general'
  }

  const obtenerMotivoB = (cod) => motivosBancarios[cod] || `Rechazo código ${cod}`

  if (banco === 'GALICIA') {
    // Formato Galicia: pos fija, CBU en col 10-32 (22 dígitos), importe col 55-69 (15 dígitos, 2 dec), resultado col 80-82
    for (const linea of lineas) {
      if (linea.length < 82) continue
      const tipo = linea.substring(0, 1)
      if (tipo !== '1' && tipo !== 'D') continue // solo registros de detalle
      const cbu = linea.substring(9, 31).trim()
      const importeStr = linea.substring(54, 69).trim()
      const resultado = linea.substring(79, 82).trim()
      const detalle = mapCBU[cbu]
      if (!detalle) continue
      const importe = parseInt(importeStr || '0') / 100
      const esCobrado = resultado === '000' || resultado === '00' || resultado === ''
      resultados.push({
        detalleId: detalle.id,
        socioId: detalle.socioId,
        tarjeta: cbu.slice(-4),
        importe: importe || parseFloat(detalle.importeEnviado),
        estado: esCobrado ? 'COBRADO' : 'RECHAZADO',
        codigoRechazo: esCobrado ? null : resultado,
        motivoRechazo: esCobrado ? null : obtenerMotivoB(resultado)
      })
    }
  } else if (banco === 'SANTANDER') {
    // Formato Santander: CBU col 3-24, importe col 40-53 (14 dígitos, 2 dec), código resultado col 75-77
    for (const linea of lineas) {
      if (linea.length < 77) continue
      if (linea.substring(0, 1) === '0' || linea.substring(0, 1) === '9') continue // cabecera/pie
      const cbu = linea.substring(2, 24).trim()
      const importeStr = linea.substring(39, 53).trim()
      const codigoRes = linea.substring(74, 77).trim()
      const detalle = mapCBU[cbu]
      if (!detalle) continue
      const importe = parseInt(importeStr || '0') / 100
      const esCobrado = codigoRes === '000' || codigoRes === '00' || codigoRes === ''
      resultados.push({
        detalleId: detalle.id,
        socioId: detalle.socioId,
        tarjeta: cbu.slice(-4),
        importe: importe || parseFloat(detalle.importeEnviado),
        estado: esCobrado ? 'COBRADO' : 'RECHAZADO',
        codigoRechazo: esCobrado ? null : codigoRes,
        motivoRechazo: esCobrado ? null : obtenerMotivoB(codigoRes)
      })
    }
  } else if (banco === 'MACRO') {
    // Formato Macro: tipo col 1, CBU col 2-23, importe col 40-54 (15 dígitos, 2 dec), estado col 70 ('A'=aprobado,'R'=rechazo), código col 71-73
    for (const linea of lineas) {
      if (linea.length < 73) continue
      const tipo = linea.substring(0, 1)
      if (tipo !== '1' && tipo !== 'D') continue
      const cbu = linea.substring(1, 23).trim()
      const importeStr = linea.substring(39, 54).trim()
      const estado = linea.substring(69, 70).trim()
      const codigoRes = linea.substring(70, 73).trim()
      const detalle = mapCBU[cbu]
      if (!detalle) continue
      const importe = parseInt(importeStr || '0') / 100
      const esCobrado = estado === 'A' || codigoRes === '000' || codigoRes === '00'
      resultados.push({
        detalleId: detalle.id,
        socioId: detalle.socioId,
        tarjeta: cbu.slice(-4),
        importe: importe || parseFloat(detalle.importeEnviado),
        estado: esCobrado ? 'COBRADO' : 'RECHAZADO',
        codigoRechazo: esCobrado ? null : codigoRes,
        motivoRechazo: esCobrado ? null : obtenerMotivoB(codigoRes)
      })
    }
  } else if (banco === 'PROVINCIA') {
    // Formato Provincia de Buenos Aires: CBU col 5-26, importe col 45-58 (14 dígitos, 2 dec), resultado col 80-82
    for (const linea of lineas) {
      if (linea.length < 82) continue
      if (linea.substring(0, 1) === '0' || linea.substring(0, 1) === '9') continue
      const cbu = linea.substring(4, 26).trim()
      const importeStr = linea.substring(44, 58).trim()
      const codigoRes = linea.substring(79, 82).trim()
      const detalle = mapCBU[cbu]
      if (!detalle) continue
      const importe = parseInt(importeStr || '0') / 100
      const esCobrado = codigoRes === '000' || codigoRes === '00' || codigoRes === ''
      resultados.push({
        detalleId: detalle.id,
        socioId: detalle.socioId,
        tarjeta: cbu.slice(-4),
        importe: importe || parseFloat(detalle.importeEnviado),
        estado: esCobrado ? 'COBRADO' : 'RECHAZADO',
        codigoRechazo: esCobrado ? null : codigoRes,
        motivoRechazo: esCobrado ? null : obtenerMotivoB(codigoRes)
      })
    }
  } else {
    // Fallback genérico: CSV con columnas cbu,importe,resultado
    for (const linea of lineas) {
      const partes = linea.split(/[,;|\t]/)
      if (partes.length < 3) continue
      const cbu = partes[0].trim()
      const importeStr = partes[1].trim()
      const codigoRes = partes[2].trim()
      const detalle = mapCBU[cbu]
      if (!detalle) continue
      const importe = parseFloat(importeStr.replace(',', '.')) || parseFloat(detalle.importeEnviado)
      const esCobrado = codigoRes === '00' || codigoRes === '000' || codigoRes.toLowerCase() === 'ok'
      resultados.push({
        detalleId: detalle.id,
        socioId: detalle.socioId,
        tarjeta: cbu.slice(-4),
        importe,
        estado: esCobrado ? 'COBRADO' : 'RECHAZADO',
        codigoRechazo: esCobrado ? null : codigoRes,
        motivoRechazo: esCobrado ? null : obtenerMotivoB(codigoRes)
      })
    }
  }

  // Si no se encontraron coincidencias por CBU, fallback por posición
  if (resultados.length === 0 && detallesOriginal.length > 0) {
    let idx = 0
    for (const linea of lineas) {
      if (linea.length < 10) continue
      if (linea.substring(0, 1) === '0' || linea.substring(0, 1) === '9') continue
      if (idx >= detallesOriginal.length) break
      const detalle = detallesOriginal[idx]
      resultados.push({
        detalleId: detalle.id,
        socioId: detalle.socioId,
        tarjeta: detalle.cbuEnviado?.slice(-4) || '****',
        importe: parseFloat(detalle.importeEnviado),
        estado: 'COBRADO',
        codigoRechazo: null,
        motivoRechazo: null
      })
      idx++
    }
  }

  return resultados
}

// POST /api/admin/debito/archivos/:id/importar-respuesta-banco - Importar respuesta de banco (CBU)
router.post('/archivos/:id/importar-respuesta-banco', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { contenido, nombreArchivo, banco } = req.body

  if (!contenido) {
    return res.status(400).json({ error: 'Se requiere el contenido del archivo' })
  }
  if (!banco) {
    return res.status(400).json({ error: 'Se requiere el banco (GALICIA, MACRO, SANTANDER, PROVINCIA)' })
  }

  const archivo = await req.db.archivoDebito.findFirst({
    where: { id: parseInt(id), tenantId: req.tenantId },
    include: {
      configuracion: true,
      detalles: {
        include: {
          socio: { select: { id: true, nroSocio: true } }
        }
      }
    }
  })

  if (!archivo) {
    return res.status(404).json({ error: 'Archivo no encontrado' })
  }

  const resultados = parsearRespuestaBanco(banco, contenido, archivo.detalles)

  if (resultados.length === 0) {
    return res.status(422).json({ error: 'No se encontraron registros coincidentes en el archivo. Verificá el formato y el banco seleccionado.' })
  }

  // Generar número de importación
  const ultimaImportacion = await req.db.importacionCobranza.findFirst({
    where: { tenantId: req.tenantId },
    orderBy: { numero: 'desc' }
  })
  const secuencia = ultimaImportacion
    ? parseInt(ultimaImportacion.numero.split('-').pop()) + 1
    : 1
  const numeroImportacion = `IMP-${new Date().getFullYear()}-${String(secuencia).padStart(4, '0')}`

  const resultado = await req.db.$transaction(async (tx) => {
    const importacion = await tx.importacionCobranza.create({
      data: {
        archivoDebitoId: parseInt(id),
        numero: numeroImportacion,
        tipo: 'DEBITO_BANCARIO',
        nombreArchivo: nombreArchivo || `${banco}_respuesta.txt`,
        registrosTotales: resultados.length,
        registrosCobrados: resultados.filter(r => r.estado === 'COBRADO').length,
        registrosRechazados: resultados.filter(r => r.estado === 'RECHAZADO').length,
        montoCobrado: resultados.filter(r => r.estado === 'COBRADO').reduce((s, r) => s + r.importe, 0),
        importadoPor: req.admin.id,
        tenantId: req.tenantId
      }
    })

    for (const res of resultados) {
      await tx.detalleDebito.update({
        where: { id: res.detalleId },
        data: {
          estado: res.estado,
          codigoRechazo: res.codigoRechazo,
          motivoRechazo: res.motivoRechazo,
          fechaProceso: new Date()
        }
      })

      if (res.estado === 'COBRADO') {
        const cargos = await tx.cargo.findMany({
          where: { socioId: res.socioId, incluidoEnDebitoId: parseInt(id), saldo: { gt: 0 } },
          include: { conceptoTesoreria: true }
        })

        if (cargos.length > 0) {
          const medioPagoId = await obtenerMedioPagoDebito(tx)
          const caja = await obtenerCajaDebito(tx)

          const ultimosPagos = await tx.pago.findMany({
            orderBy: { id: 'desc' },
            select: { numero: true },
            take: 100,
          })
          const ultimoNumeroValido = ultimosPagos
            .map(p => parseInt(p.numero, 10))
            .filter(n => Number.isFinite(n) && n > 0)
            .reduce((max, n) => Math.max(max, n), 0)
          const nuevoNumero = String(ultimoNumeroValido + 1).padStart(8, '0')

          const pago = await tx.pago.create({
            data: {
              numero: nuevoNumero,
              socioId: res.socioId,
              fecha: new Date(),
              montoTotal: res.importe,
              montoRecibido: res.importe,
              montoACuenta: 0,
              medioPagoId,
              cajaId: caja.id,
              origen: 'DEBITO_AUTOMATICO',
              observaciones: `Débito bancario ${banco} - ${archivo.numero}`,
              registradoPor: req.admin.id,
              tenantId: req.tenantId
            }
          })

          const anioMov = new Date().getFullYear()
          const prefijoMov = `MV-${anioMov}-`
          const ultimoMov = await tx.movimientoCaja.findFirst({
            where: { numero: { startsWith: prefijoMov } },
            orderBy: { numero: 'desc' }
          })
          const siguienteMov = ultimoMov
            ? (parseInt(ultimoMov.numero.split('-').pop()) || 0) + 1
            : 1
          const numeroMov = `${prefijoMov}${String(siguienteMov).padStart(5, '0')}`

          const movDB = await tx.movimientoCaja.create({
            data: {
              numero: numeroMov,
              cajaId: caja.id,
              cuentaContableId: caja.cuentaContableId,
              fecha: new Date(),
              tipo: 'INGRESO',
              concepto: 'Débito Bancario',
              conceptoTesoreriaId: cargos[0]?.conceptoTesoreriaId || null,
              monto: res.importe,
              descripcion: `Débito bancario ${banco} - Socio #${res.socioId} - ${archivo.numero}`,
              pagoId: pago.id,
              registradoPor: req.admin.id,
              centroCostoId: caja.centroCostoId ?? null,
              conciliado: !caja.requiereConciliacion,
              tenantId: req.tenantId
            }
          })

          // ItemMovimientoCaja — un ítem por concepto de cargo
          const gruposDB = {}
          for (const c of cargos) {
            const key = c.conceptoTesoreriaId ?? 'sin'
            if (!gruposDB[key]) {
              gruposDB[key] = {
                conceptoTesoreriaId: c.conceptoTesoreriaId,
                cuentaContableId: c.conceptoTesoreria?.cuentaContableId ?? caja.cuentaContableId,
                centroCostoId: c.centroCostoId ?? caja.centroCostoId ?? null,
                monto: 0,
              }
            }
            gruposDB[key].monto += Number(c.saldo)
          }
          const gruposDBArr = Object.values(gruposDB)
          const totalDB = gruposDBArr.reduce((s, g) => s + g.monto, 0)
          let montoAsigDB = 0
          for (let i = 0; i < gruposDBArr.length; i++) {
            const g = gruposDBArr[i]
            const esUltimo = i === gruposDBArr.length - 1
            const montoItem = esUltimo
              ? Math.round((res.importe - montoAsigDB) * 100) / 100
              : Math.round(res.importe * (totalDB > 0 ? g.monto / totalDB : 1 / gruposDBArr.length) * 100) / 100
            if (montoItem <= 0) continue
            montoAsigDB += montoItem
            await tx.itemMovimientoCaja.create({
              data: {
                tenantId: req.tenantId,
                movimientoCajaId: movDB.id,
                conceptoTesoreriaId: g.conceptoTesoreriaId,
                cuentaContableId: g.cuentaContableId,
                centroCostoId: g.centroCostoId,
                monto: montoItem,
                descripcion: `Débito bancario ${banco} - Socio #${res.socioId} - ${archivo.numero}`,
                orden: i,
              }
            })
          }

          await tx.caja.update({
            where: { id: caja.id },
            data: { saldoActual: { increment: res.importe } }
          })

          res.pagoId = pago.id

          let montoRestante = res.importe
          for (const cargo of cargos) {
            if (montoRestante <= 0) break
            const saldoCargo = parseFloat(cargo.saldo) + parseFloat(cargo.recargo || 0)
            const aplicar = Math.min(montoRestante, saldoCargo)
            await tx.cargo.update({
              where: { id: cargo.id },
              data: {
                pagoId: pago.id,
                estado: aplicar >= saldoCargo ? 'PAGADO' : 'PARCIAL',
                saldo: parseFloat(cargo.saldo) - Math.min(montoRestante, parseFloat(cargo.saldo)),
                recargo: 0,
                fechaPago: aplicar >= saldoCargo ? new Date() : null
              }
            })
            montoRestante -= aplicar
          }
        }
      }
    }

    const todosResueltos = resultados.every(r => r.estado !== 'PENDIENTE')
    if (todosResueltos) {
      await tx.archivoDebito.update({
        where: { id: parseInt(id) },
        data: { estado: 'PROCESADO', fechaProceso: new Date() }
      })
    }

    return importacion
  })

  // Enviar recibos (email + WhatsApp) a los cobrados
  const pagosIds = resultados.filter(r => r.estado === 'COBRADO' && r.pagoId).map(r => r.pagoId)
  const notifStats = await enviarNotificacionesRecibo(pagosIds, req.db)

  res.json({
    importacion: resultado,
    resumen: {
      total: resultados.length,
      cobrados: resultados.filter(r => r.estado === 'COBRADO').length,
      rechazados: resultados.filter(r => r.estado === 'RECHAZADO').length,
      montoCobrado: resultados.filter(r => r.estado === 'COBRADO').reduce((s, r) => s + r.importe, 0),
      notificaciones: notifStats,
      detalles: resultados.map(r => ({
        cbu: r.tarjeta,
        importe: r.importe,
        estado: r.estado,
        codigoRechazo: r.codigoRechazo,
        motivoRechazo: r.motivoRechazo
      }))
    }
  })
}))

// Obtener o crear medio de pago para débito automático
/**
 * Obtiene o crea una caja para débitos automáticos
 */
async function obtenerCajaDebito(tx) {
  // Buscar caja específica para débitos automáticos (valores pendientes)
  let caja = await tx.caja.findFirst({
    where: {
      codigo: 'DEBITO_AUTO',
      activo: true
    }
  })

  if (!caja) {
    // Buscar cualquier caja de tipo BANCO que requiera conciliación
    caja = await tx.caja.findFirst({
      where: {
        tipo: 'BANCO',
        requiereConciliacion: true,
        activo: true
      }
    })
  }

  if (!caja) {
    // Crear caja para débitos automáticos (valores pendientes de acreditación)
    caja = await tx.caja.create({
      data: {
        codigo: 'DEBITO_AUTO',
        nombre: 'Tarjetas Pendientes de Acreditar',
        tipo: 'VALORES_PENDIENTES',
        descripcion: 'Cobranzas con tarjeta pendientes de acreditación bancaria',
        saldoInicial: 0,
        saldoActual: 0,
        requiereConciliacion: true,
        activo: true
      }
    })
  }

  return caja
}

/**
 * Obtiene o crea un medio de pago para débitos automáticos
 */
async function obtenerMedioPagoDebito(tx) {
  let medioPago = await tx.medioPago.findFirst({
    where: {
      OR: [
        { nombre: 'DEBITO AUTOMATICO' },
        { codigo: 'DEBITO_AUTO' }
      ]
    }
  })

  if (!medioPago) {
    medioPago = await tx.medioPago.create({
      data: {
        codigo: 'DEBITO_AUTO',
        nombre: 'Débito Automático',
        tipo: 'BANCO',
        estado: 'ACTIVO',
        orden: 10
      }
    })
  }

  return medioPago.id
}

// ============================================
// GESTIÓN DE ADHESIONES DE SOCIOS
// ============================================

// GET /api/admin/debito/adhesiones - Listar solicitudes de adhesión pendientes
router.get('/adhesiones', authAdmin, asyncHandler(async (req, res) => {
  const { estado } = req.query // PENDIENTE, ACTIVO, RECHAZADO, todos

  // Buscar socios con CBU o tarjeta cargada
  const where = {
    OR: [
      { cbuDebito: { not: null } },
      { tarjetaUltimos4: { not: null } }
    ]
  }

  if (estado === 'PENDIENTE') {
    where.debitoVerificado = false
  } else if (estado === 'ACTIVO') {
    where.debitoVerificado = true
    where.enviaDebito = true
  }

  const socios = await req.db.socio.findMany({
    where,
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      documento: true,
      email: true,
      celular: true,
      debitoTipo: true,
      // CBU
      cbuDebito: true,
      bancoDebito: true,
      aliasDebito: true,
      // Tarjeta
      tarjetaMarca: true,
      tarjetaUltimos4: true,
      tarjetaVencimiento: true,
      // Estado
      enviaDebito: true,
      debitoVerificado: true,
      updatedAt: true
    },
    orderBy: { updatedAt: 'desc' }
  })

  // Agregar estado calculado
  const sociosConEstado = socios.map(s => ({
    ...s,
    estadoAdhesion: !s.debitoVerificado ? 'PENDIENTE' :
                    s.enviaDebito ? 'ACTIVO' : 'INACTIVO',
    cbuMasked: s.cbuDebito ? `****${s.cbuDebito.slice(-4)}` : null,
    debitoTipo: s.debitoTipo || (s.cbuDebito ? 'CBU' : 'TARJETA')
  }))

  res.json(sociosConEstado)
}))

// PUT /api/admin/debito/adhesiones/:socioId/aprobar - Aprobar adhesión
router.put('/adhesiones/:socioId/aprobar', authAdmin, asyncHandler(async (req, res) => {
  const { socioId } = req.params

  const socio = await req.db.socio.findUnique({
    where: { id: parseInt(socioId) }
  })

  if (!socio) {
    return res.status(404).json({ error: 'Socio no encontrado' })
  }

  // Verificar que tenga CBU o tarjeta
  if (!socio.cbuDebito && !socio.tarjetaUltimos4) {
    return res.status(400).json({ error: 'El socio no tiene medio de pago cargado' })
  }

  await req.db.socio.update({
    where: { id: parseInt(socioId) },
    data: {
      debitoVerificado: true,
      enviaDebito: true
    }
  })

  // Registrar en audit log
  const auditData = socio.debitoTipo === 'TARJETA'
    ? { tipo: 'TARJETA', marca: socio.tarjetaMarca, ultimos4: socio.tarjetaUltimos4 }
    : { tipo: 'CBU', banco: socio.bancoDebito }

  await prisma.auditLog.create({
    data: {
      tabla: 'socio',
      registroId: parseInt(socioId),
      accion: 'APROBAR_DEBITO',
      adminId: req.admin.id,
      datosNuevos: JSON.stringify(auditData),
      ip: req.ip
    }
  })

  res.json({ success: true, message: 'Adhesión aprobada correctamente' })
}))

// PUT /api/admin/debito/adhesiones/:socioId/rechazar - Rechazar adhesión
router.put('/adhesiones/:socioId/rechazar', authAdmin, asyncHandler(async (req, res) => {
  const { socioId } = req.params
  const { motivo } = req.body

  const socio = await req.db.socio.findUnique({
    where: { id: parseInt(socioId) }
  })

  if (!socio) {
    return res.status(404).json({ error: 'Socio no encontrado' })
  }

  // Limpiar todos los datos de débito (CBU y tarjeta)
  await req.db.socio.update({
    where: { id: parseInt(socioId) },
    data: {
      debitoTipo: null,
      // CBU
      cbuDebito: null,
      bancoDebito: null,
      aliasDebito: null,
      // Tarjeta
      tarjetaNumero: null,
      tarjetaMarca: null,
      tarjetaVencimiento: null,
      tarjetaUltimos4: null,
      // Estado
      debitoVerificado: false,
      enviaDebito: false
    }
  })

  // Registrar en audit log
  await prisma.auditLog.create({
    data: {
      tabla: 'socio',
      registroId: parseInt(socioId),
      accion: 'RECHAZAR_DEBITO',
      adminId: req.admin.id,
      datosNuevos: JSON.stringify({ motivo: motivo || 'No especificado' }),
      ip: req.ip
    }
  })

  res.json({ success: true, message: 'Adhesión rechazada' })
}))

// PUT /api/admin/debito/adhesiones/:socioId/desactivar - Desactivar débito activo
router.put('/adhesiones/:socioId/desactivar', authAdmin, asyncHandler(async (req, res) => {
  const { socioId } = req.params
  const { motivo } = req.body

  await req.db.socio.update({
    where: { id: parseInt(socioId) },
    data: {
      enviaDebito: false
    }
  })

  // Registrar en audit log
  await prisma.auditLog.create({
    data: {
      tabla: 'socio',
      registroId: parseInt(socioId),
      accion: 'DESACTIVAR_DEBITO',
      adminId: req.admin.id,
      datosNuevos: JSON.stringify({ motivo: motivo || 'Desactivado por admin' }),
      ip: req.ip
    }
  })

  res.json({ success: true, message: 'Débito automático desactivado' })
}))

export default router
