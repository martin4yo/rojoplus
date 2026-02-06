import { Router } from 'express'
import { PrismaClient, Prisma } from '@prisma/client'
import { authAdmin } from '../middleware/auth.js'
import { enviarReciboPago } from '../services/email.js'

const router = Router()
const prisma = new PrismaClient()

// Helper para manejar errores async
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

// ============================================
// CONFIGURACIONES DE DÉBITO
// ============================================

// GET /api/admin/debito/configuraciones - Listar configuraciones
router.get('/configuraciones', authAdmin, asyncHandler(async (req, res) => {
  const configuraciones = await prisma.configuracionDebito.findMany({
    orderBy: { nombre: 'asc' },
    include: {
      _count: {
        select: { archivos: true }
      }
    }
  })

  res.json(configuraciones)
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

  const configuracion = await prisma.configuracionDebito.create({
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

  res.status(201).json(configuracion)
}))

// PUT /api/admin/debito/configuraciones/:id - Actualizar configuración
router.put('/configuraciones/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const data = req.body

  const configuracion = await prisma.configuracionDebito.update({
    where: { id: parseInt(id) },
    data
  })

  res.json(configuracion)
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

  await prisma.configuracionDebito.delete({
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
  const socios = await prisma.socio.findMany({
    where: {
      enviaDebito: true,
      activo: true,
      tarjetaNumero: { not: null }, // Requiere número de tarjeta
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
  const configuracion = await prisma.configuracionDebito.findUnique({
    where: { id: parseInt(configuracionId) }
  })

  if (!configuracion) {
    return res.status(404).json({ error: 'Configuración no encontrada' })
  }

  // Obtener socios con sus cargos pendientes
  const socios = await prisma.socio.findMany({
    where: {
      id: { in: socioIds.map(id => parseInt(id)) },
      enviaDebito: true,
      activo: true,
      tarjetaNumero: { not: null }
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
  const archivo = await prisma.$transaction(async (tx) => {
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
  const resultado = await prisma.$transaction(async (tx) => {
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
          }
        })

        if (cargos.length > 0) {
          // Obtener o crear medio de pago y caja para débitos
          const medioPagoId = await obtenerMedioPagoDebito(tx)
          const cajaId = await obtenerCajaDebito(tx)

          // Generar número de pago único
          const ultimoPago = await tx.pago.findFirst({
            orderBy: { id: 'desc' },
            select: { numero: true }
          })
          const nuevoNumero = ultimoPago
            ? String(parseInt(ultimoPago.numero) + 1).padStart(8, '0')
            : '00000001'

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
              cajaId,
              origen: 'DEBITO_AUTOMATICO',
              observaciones: `Débito automático - ${archivo.numero}`,
              registradoPor: req.admin.id
            }
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

  // Enviar recibos por email a los socios con pagos exitosos (fuera de la transacción)
  const pagosExitosos = resultados.filter(r => r.estado === 'COBRADO' && r.pagoId)
  for (const item of pagosExitosos) {
    try {
      // Obtener pago completo con relaciones para el email
      const pagoCompleto = await prisma.pago.findUnique({
        where: { id: item.pagoId },
        include: {
          socio: {
            select: {
              id: true,
              nroSocio: true,
              apellidoNombre: true,
              documento: true,
              email: true
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

      if (pagoCompleto) {
        // Enviar recibo async (no esperar, no debe fallar el proceso)
        enviarReciboPago(pagoCompleto).catch(err => {
          console.error(`Error enviando recibo para pago ${pagoCompleto.numero}:`, err)
        })
      }
    } catch (err) {
      console.error(`Error obteniendo pago ${item.pagoId} para enviar recibo:`, err)
    }
  }

  res.json({
    importacion: resultado,
    resumen: {
      total: resultados.length,
      cobrados: resultados.filter(r => r.estado === 'COBRADO').length,
      rechazados: resultados.filter(r => r.estado === 'RECHAZADO').length,
      montoCobrado: resultados
        .filter(r => r.estado === 'COBRADO')
        .reduce((sum, r) => sum + r.importe, 0),
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
  const nuevoArchivo = await prisma.$transaction(async (tx) => {
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
  const sociosConDebito = await prisma.socio.count({
    where: {
      enviaDebito: true,
      activo: true,
      tarjetaNumero: { not: null }
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
      codigoRechazo: { not: null },
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

// Obtener o crear medio de pago para débito automático
/**
 * Obtiene o crea una caja para débitos automáticos
 */
async function obtenerCajaDebito(tx) {
  // Buscar caja de tipo BANCO o específica para débitos
  let caja = await tx.caja.findFirst({
    where: {
      OR: [
        { codigo: 'DEBITO_AUTO' },
        { codigo: 'BANCO' },
        { tipo: 'BANCO' }
      ],
      activo: true
    }
  })

  if (!caja) {
    // Crear caja para débitos automáticos
    caja = await tx.caja.create({
      data: {
        codigo: 'DEBITO_AUTO',
        nombre: 'Débitos Automáticos',
        tipo: 'BANCO',
        descripcion: 'Caja virtual para débitos automáticos con tarjeta',
        saldoInicial: 0,
        saldoActual: 0,
        activo: true
      }
    })
  }

  return caja.id
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
        activo: true,
        orden: 10
      }
    })
  }

  return medioPago.id
}

export default router
