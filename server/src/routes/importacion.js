import express from 'express'
import prisma from '../lib/prisma.js'
import { authAdmin, checkPermiso } from '../middleware/auth.js'
import multer from 'multer'
import csv from 'csv-parser'
import { Readable } from 'stream'
import XLSX from 'xlsx'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Configurar multer para recibir archivos
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ext === '.csv' || ext === '.xlsx' || ext === '.xls') {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten archivos CSV o Excel (.xlsx, .xls)'))
    }
  }
})

/**
 * GET /api/importacion/plantilla
 * Descargar plantilla de importación
 */
router.get('/plantilla', authAdmin, (req, res) => {
  try {
    const { formato = 'csv' } = req.query

    if (formato === 'xlsx') {
      // Generar Excel con formato y ejemplos
      const wb = XLSX.utils.book_new()

      // Hoja de datos con ejemplos
      const ejemplos = [
        {
          codigo: 'CAFE001',
          nombre: 'Café Espresso',
          descripcion: 'Café espresso tradicional',
          categoria_menu: 'BEBIDAS_CALIENTES',
          precio: 150.00,
          codigo_barras: '7790001001234',
          activo: 'SI',
          disponible: 'SI',
          destacado: 'NO',
          venta_buffet: 'SI',
          venta_kiosco: 'SI',
          venta_takeaway: 'SI',
          orden: 1
        },
        {
          codigo: 'CAFE002',
          nombre: 'Café con Leche',
          descripcion: 'Café con leche cremoso',
          categoria_menu: 'BEBIDAS_CALIENTES',
          precio: 180.00,
          codigo_barras: '7790001001241',
          activo: 'SI',
          disponible: 'SI',
          destacado: 'SI',
          venta_buffet: 'SI',
          venta_kiosco: 'SI',
          venta_takeaway: 'NO',
          orden: 2
        },
        {
          codigo: 'MEDIALUNAS',
          nombre: 'Medialunas (x3)',
          descripcion: '3 Medialunas recién horneadas',
          categoria_menu: 'PANADERIA',
          precio: 200.00,
          codigo_barras: '',
          activo: 'SI',
          disponible: 'SI',
          destacado: 'NO',
          venta_buffet: 'SI',
          venta_kiosco: 'NO',
          venta_takeaway: 'SI',
          orden: 3
        }
      ]

      const ws = XLSX.utils.json_to_sheet(ejemplos)

      // Agregar ancho de columnas
      ws['!cols'] = [
        { wch: 12 }, // codigo
        { wch: 30 }, // nombre
        { wch: 35 }, // descripcion
        { wch: 20 }, // categoria_menu
        { wch: 10 }, // precio
        { wch: 15 }, // codigo_barras
        { wch: 8 },  // activo
        { wch: 10 }, // disponible
        { wch: 10 }, // destacado
        { wch: 12 }, // venta_buffet
        { wch: 12 }, // venta_kiosco
        { wch: 14 }, // venta_takeaway
        { wch: 8 }   // orden
      ]

      XLSX.utils.book_append_sheet(wb, ws, 'Productos')

      // Hoja de instrucciones
      const instrucciones = [
        { campo: 'codigo', requerido: 'SI', descripcion: 'Código único del producto (ej: CAFE001)', ejemplo: 'CAFE001' },
        { campo: 'nombre', requerido: 'SI', descripcion: 'Nombre del producto', ejemplo: 'Café Espresso' },
        { campo: 'descripcion', requerido: 'NO', descripcion: 'Descripción detallada', ejemplo: 'Café espresso tradicional' },
        { campo: 'categoria_menu', requerido: 'SI', descripcion: 'Código de la categoría del menú', ejemplo: 'BEBIDAS_CALIENTES' },
        { campo: 'precio', requerido: 'SI', descripcion: 'Precio de venta (número decimal)', ejemplo: '150.00' },
        { campo: 'codigo_barras', requerido: 'NO', descripcion: 'Código de barras EAN', ejemplo: '7790001001234' },
        { campo: 'activo', requerido: 'NO', descripcion: 'Si el producto está activo (SI/NO)', ejemplo: 'SI' },
        { campo: 'disponible', requerido: 'NO', descripcion: 'Si está disponible para venta (SI/NO)', ejemplo: 'SI' },
        { campo: 'destacado', requerido: 'NO', descripcion: 'Si se muestra destacado (SI/NO)', ejemplo: 'NO' },
        { campo: 'venta_buffet', requerido: 'NO', descripcion: 'Se vende en Buffet (SI/NO, por defecto SI)', ejemplo: 'SI' },
        { campo: 'venta_kiosco', requerido: 'NO', descripcion: 'Se vende en Kiosco (SI/NO, por defecto SI)', ejemplo: 'SI' },
        { campo: 'venta_takeaway', requerido: 'NO', descripcion: 'Se vende en TakeAway (SI/NO, por defecto SI)', ejemplo: 'NO' },
        { campo: 'orden', requerido: 'NO', descripcion: 'Orden de visualización (número)', ejemplo: '1' }
      ]

      const wsInstr = XLSX.utils.json_to_sheet(instrucciones)
      wsInstr['!cols'] = [
        { wch: 18 },
        { wch: 12 },
        { wch: 50 },
        { wch: 20 }
      ]
      XLSX.utils.book_append_sheet(wb, wsInstr, 'Instrucciones')

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

      res.setHeader('Content-Disposition', 'attachment; filename=plantilla_importacion_productos.xlsx')
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      return res.send(buffer)
    } else {
      // Enviar CSV
      const filePath = path.join(__dirname, '../../public/templates/plantilla_importacion_productos.csv')
      res.setHeader('Content-Disposition', 'attachment; filename=plantilla_importacion_productos.csv')
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      return res.sendFile(filePath)
    }
  } catch (error) {
    console.error('Error generando plantilla:', error)
    return res.status(500).json({ error: 'Error al generar la plantilla' })
  }
})

/**
 * POST /api/importacion/productos
 * Importar productos desde archivo CSV o Excel
 */
router.post('/productos', authAdmin, checkPermiso('BUFFET_PRODUCTOS'), upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' })
    }

    // Parsear sobreescribir (viene como string desde FormData)
    const sobreescribir = req.body.sobreescribir === 'true' || req.body.sobreescribir === true
    let registros = []

    // Determinar tipo de archivo y parsear
    const ext = path.extname(req.file.originalname).toLowerCase()

    if (ext === '.csv') {
      // Parsear CSV
      registros = await parsearCSV(req.file.buffer)
    } else if (ext === '.xlsx' || ext === '.xls') {
      // Parsear Excel
      registros = await parsearExcel(req.file.buffer)
    } else {
      return res.status(400).json({ error: 'Formato de archivo no soportado' })
    }

    if (registros.length === 0) {
      return res.status(400).json({ error: 'El archivo está vacío o no tiene el formato correcto' })
    }

    // Validar y procesar registros
    const resultado = await procesarImportacion(req.db, registros, sobreescribir)

    return res.json({
      success: true,
      mensaje: 'Importación completada',
      resultado
    })
  } catch (error) {
    console.error('Error en importación:', error)
    return res.status(500).json({
      error: error.message || 'Error al procesar la importación'
    })
  }
})

/**
 * Parsear archivo CSV
 */
async function parsearCSV(buffer) {
  return new Promise((resolve, reject) => {
    const registros = []
    const stream = Readable.from(buffer.toString('utf-8'))

    stream
      .pipe(csv())
      .on('data', (row) => {
        registros.push(row)
      })
      .on('end', () => {
        resolve(registros)
      })
      .on('error', (error) => {
        reject(error)
      })
  })
}

/**
 * Parsear archivo Excel
 */
async function parsearExcel(buffer) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const registros = XLSX.utils.sheet_to_json(worksheet)
    return registros
  } catch (error) {
    throw new Error('Error al leer el archivo Excel: ' + error.message)
  }
}

/**
 * Procesar importación de productos
 */
async function procesarImportacion(db, registros, sobreescribir) {
  const errores = []
  const advertencias = []
  const exitosos = []
  const omitidos = []

  // Cargar categorías de menú para validación
  const categoriasMenu = await db.categoriaMenu.findMany({
    where: { activo: true }
  })
  const mapaCategoriasMenu = new Map(
    categoriasMenu.map(cat => [cat.codigo.toUpperCase(), cat])
  )

  for (let i = 0; i < registros.length; i++) {
    const fila = i + 2 // +2 porque la fila 1 es el header y empezamos en 0
    const registro = registros[i]

    try {
      // Validar campos requeridos
      const validacion = validarRegistro(registro, fila, mapaCategoriasMenu)

      if (validacion.errores.length > 0) {
        errores.push(...validacion.errores)
        continue
      }

      if (validacion.advertencias.length > 0) {
        advertencias.push(...validacion.advertencias)
      }

      // Normalizar datos
      const datosNormalizados = normalizarDatos(registro, mapaCategoriasMenu)

      // Verificar si existe el producto
      const productoExistente = await db.producto.findFirst({
        where: { codigo: datosNormalizados.codigo },
        include: { productoBuffet: true }
      })

      if (productoExistente && !sobreescribir) {
        omitidos.push({
          fila,
          codigo: datosNormalizados.codigo,
          nombre: datosNormalizados.nombre,
          motivo: 'Producto ya existe (use opción "Sobreescribir" para actualizar)'
        })
        continue
      }

      // Crear o actualizar producto
      if (productoExistente && sobreescribir) {
        // Actualizar
        await actualizarProducto(db, productoExistente, datosNormalizados)
        exitosos.push({
          fila,
          codigo: datosNormalizados.codigo,
          nombre: datosNormalizados.nombre,
          accion: 'actualizado'
        })
      } else {
        // Crear nuevo
        await crearProducto(db, datosNormalizados)
        exitosos.push({
          fila,
          codigo: datosNormalizados.codigo,
          nombre: datosNormalizados.nombre,
          accion: 'creado'
        })
      }
    } catch (error) {
      console.error(`Error procesando fila ${fila}:`, error)
      errores.push({
        fila,
        codigo: registro.codigo,
        error: error.message || 'Error desconocido al procesar el registro'
      })
    }
  }

  return {
    total: registros.length,
    exitosos: exitosos.length,
    errores: errores.length,
    advertencias: advertencias.length,
    omitidos: omitidos.length,
    detalleExitosos: exitosos,
    detalleErrores: errores,
    detalleAdvertencias: advertencias,
    detalleOmitidos: omitidos
  }
}

/**
 * Validar registro
 */
function validarRegistro(registro, fila, mapaCategoriasMenu) {
  const errores = []
  const advertencias = []

  // Campos requeridos
  if (!registro.codigo || registro.codigo.trim() === '') {
    errores.push({ fila, campo: 'codigo', error: 'Campo requerido' })
  }

  if (!registro.nombre || registro.nombre.trim() === '') {
    errores.push({ fila, campo: 'nombre', error: 'Campo requerido' })
  }

  if (!registro.categoria_menu || registro.categoria_menu.trim() === '') {
    errores.push({ fila, campo: 'categoria_menu', error: 'Campo requerido' })
  } else {
    // Validar que exista la categoría
    const categoriaKey = registro.categoria_menu.toUpperCase().trim()
    if (!mapaCategoriasMenu.has(categoriaKey)) {
      errores.push({
        fila,
        campo: 'categoria_menu',
        error: `Categoría "${registro.categoria_menu}" no existe`
      })
    }
  }

  if (!registro.precio) {
    errores.push({ fila, campo: 'precio', error: 'Campo requerido' })
  } else {
    const precio = parseFloat(registro.precio)
    if (isNaN(precio) || precio < 0) {
      errores.push({ fila, campo: 'precio', error: 'Debe ser un número positivo' })
    }
  }

  // Validar formato de campos opcionales
  if (registro.activo && !['SI', 'NO', 'si', 'no', 'S', 'N', 's', 'n'].includes(registro.activo.toString().trim())) {
    errores.push({ fila, campo: 'activo', error: 'Debe ser SI o NO' })
  }

  if (registro.disponible && !['SI', 'NO', 'si', 'no', 'S', 'N', 's', 'n'].includes(registro.disponible.toString().trim())) {
    errores.push({ fila, campo: 'disponible', error: 'Debe ser SI o NO' })
  }

  if (registro.destacado && !['SI', 'NO', 'si', 'no', 'S', 'N', 's', 'n'].includes(registro.destacado.toString().trim())) {
    errores.push({ fila, campo: 'destacado', error: 'Debe ser SI o NO' })
  }

  // Validar campos de venta (opcional)
  if (registro.venta_buffet && !['SI', 'NO', 'si', 'no', 'S', 'N', 's', 'n'].includes(registro.venta_buffet.toString().trim())) {
    errores.push({ fila, campo: 'venta_buffet', error: 'Debe ser SI o NO' })
  }

  if (registro.venta_kiosco && !['SI', 'NO', 'si', 'no', 'S', 'N', 's', 'n'].includes(registro.venta_kiosco.toString().trim())) {
    errores.push({ fila, campo: 'venta_kiosco', error: 'Debe ser SI o NO' })
  }

  if (registro.venta_takeaway && !['SI', 'NO', 'si', 'no', 'S', 'N', 's', 'n'].includes(registro.venta_takeaway.toString().trim())) {
    errores.push({ fila, campo: 'venta_takeaway', error: 'Debe ser SI o NO' })
  }

  if (registro.orden && isNaN(parseInt(registro.orden))) {
    advertencias.push({ fila, campo: 'orden', advertencia: 'No es un número válido, se usará 0' })
  }

  return { errores, advertencias }
}

/**
 * Normalizar datos del registro
 */
function normalizarDatos(registro, mapaCategoriasMenu) {
  const convertirBoolean = (valor) => {
    if (!valor) return true // Por defecto true
    const str = valor.toString().toUpperCase().trim()
    return ['SI', 'S', 'YES', 'Y', '1', 'TRUE'].includes(str)
  }

  const categoriaKey = registro.categoria_menu.toUpperCase().trim()
  const categoria = mapaCategoriasMenu.get(categoriaKey)

  // Construir array de tipos de venta según columnas
  const tiposVenta = []
  if (convertirBoolean(registro.venta_buffet)) tiposVenta.push('BUFFET')
  if (convertirBoolean(registro.venta_kiosco)) tiposVenta.push('KIOSCO')
  if (convertirBoolean(registro.venta_takeaway)) tiposVenta.push('TAKEAWAY')

  // Si no se especificó ninguno, usar todos por defecto
  if (tiposVenta.length === 0) {
    tiposVenta.push('BUFFET', 'KIOSCO', 'TAKEAWAY')
  }

  return {
    codigo: registro.codigo.trim().toUpperCase(),
    nombre: registro.nombre.trim(),
    descripcion: registro.descripcion?.trim() || null,
    codigoBarras: registro.codigo_barras?.trim() || null,
    categoriaMenuId: categoria.id,
    precio: parseFloat(registro.precio),
    activo: convertirBoolean(registro.activo),
    disponible: convertirBoolean(registro.disponible),
    destacado: convertirBoolean(registro.destacado),
    tiposVenta,
    orden: registro.orden ? parseInt(registro.orden) : 0
  }
}

/**
 * Crear producto nuevo
 */
async function crearProducto(db, datos) {
  return await db.$transaction(async (tx) => {
    // 1. Crear producto en tabla general
    const producto = await tx.producto.create({
      data: {
        codigo: datos.codigo,
        nombre: datos.nombre,
        descripcion: datos.descripcion,
        precioVenta: datos.precio,
        activo: datos.activo
      }
    })

    // 2. Crear producto buffet
    await tx.productoBuffet.create({
      data: {
        productoId: producto.id,
        categoriaMenuId: datos.categoriaMenuId,
        nombre: datos.nombre,
        descripcion: datos.descripcion,
        precio: datos.precio,
        disponible: datos.disponible,
        destacado: datos.destacado,
        activo: datos.activo,
        codigoBarras: datos.codigoBarras,
        tiposVenta: datos.tiposVenta,
        orden: datos.orden
      }
    })

    return producto
  })
}

/**
 * Actualizar producto existente
 */
async function actualizarProducto(db, productoExistente, datos) {
  return await db.$transaction(async (tx) => {
    // 1. Actualizar producto general
    await tx.producto.update({
      where: { id: productoExistente.id },
      data: {
        nombre: datos.nombre,
        descripcion: datos.descripcion,
        precioVenta: datos.precio,
        activo: datos.activo
      }
    })

    // 2. Actualizar o crear producto buffet
    if (productoExistente.productoBuffet) {
      await tx.productoBuffet.update({
        where: { productoId: productoExistente.id },
        data: {
          categoriaMenuId: datos.categoriaMenuId,
          nombre: datos.nombre,
          descripcion: datos.descripcion,
          precio: datos.precio,
          disponible: datos.disponible,
          destacado: datos.destacado,
          activo: datos.activo,
          codigoBarras: datos.codigoBarras,
          tiposVenta: datos.tiposVenta,
          orden: datos.orden
        }
      })
    } else {
      await tx.productoBuffet.create({
        data: {
          productoId: productoExistente.id,
          categoriaMenuId: datos.categoriaMenuId,
          nombre: datos.nombre,
          descripcion: datos.descripcion,
          precio: datos.precio,
          disponible: datos.disponible,
          destacado: datos.destacado,
          activo: datos.activo,
          codigoBarras: datos.codigoBarras,
          tiposVenta: datos.tiposVenta,
          orden: datos.orden
        }
      })
    }
  })
}

/**
 * GET /api/importacion/categorias-menu
 * Obtener listado de categorías de menú disponibles
 */
router.get('/categorias-menu', authAdmin, async (req, res) => {
  try {
    const categorias = await req.db.categoriaMenu.findMany({
      where: { activo: true },
      select: {
        codigo: true,
        nombre: true,
        descripcion: true
      },
      orderBy: { orden: 'asc' }
    })

    return res.json(categorias)
  } catch (error) {
    console.error('Error obteniendo categorías:', error)
    return res.status(500).json({ error: 'Error al obtener categorías' })
  }
})

export default router
