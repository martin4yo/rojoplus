import express from 'express'
import prisma from '../lib/prisma.js'
import { authAdmin } from '../middleware/auth.js'

const router = express.Router()

// ============================================
// RUTAS PÚBLICAS
// ============================================

// GET /api/public/autoridades - Listado público de autoridades
router.get('/public', async (req, res) => {
  try {
    const autoridades = await prisma.autoridad.findMany({
      where: { activo: true },
      orderBy: [
        { seccion: 'asc' },
        { orden: 'asc' }
      ]
    })

    // Obtener período de la configuración
    const configPeriodo = await prisma.configuracion.findUnique({
      where: { clave: 'PERIODO_COMISION_DIRECTIVA' }
    })

    // Agrupar por sección
    const agrupadas = {
      COMISION_DIRECTIVA: autoridades.filter(a => a.seccion === 'COMISION_DIRECTIVA'),
      VOCALES: autoridades.filter(a => a.seccion === 'VOCALES'),
      REVISORES: autoridades.filter(a => a.seccion === 'REVISORES'),
      SUBCOMISIONES: autoridades.filter(a => a.seccion === 'SUBCOMISIONES'),
      periodoComision: configPeriodo?.valor || 'Período 2024 - 2026'
    }

    res.json({ success: true, data: agrupadas })
  } catch (error) {
    console.error('Error obteniendo autoridades:', error)
    res.status(500).json({ error: 'Error al obtener autoridades' })
  }
})

// ============================================
// RUTAS ADMIN (protegidas)
// ============================================

// GET /api/admin/autoridades/config/periodo - Obtener período
router.get('/config/periodo', authAdmin, async (req, res) => {
  try {
    const config = await prisma.configuracion.findUnique({
      where: { clave: 'PERIODO_COMISION_DIRECTIVA' }
    })
    res.json({ success: true, data: { periodo: config?.valor || 'Período 2024 - 2026' } })
  } catch (error) {
    console.error('Error obteniendo período:', error)
    res.status(500).json({ error: 'Error al obtener período' })
  }
})

// PUT /api/admin/autoridades/config/periodo - Actualizar período
router.put('/config/periodo', authAdmin, async (req, res) => {
  try {
    const { periodo } = req.body

    await prisma.configuracion.upsert({
      where: { clave: 'PERIODO_COMISION_DIRECTIVA' },
      update: { valor: periodo },
      create: { clave: 'PERIODO_COMISION_DIRECTIVA', valor: periodo, descripcion: 'Período de la Comisión Directiva' }
    })

    res.json({ success: true, data: { periodo } })
  } catch (error) {
    console.error('Error actualizando período:', error)
    res.status(500).json({ error: 'Error al actualizar período' })
  }
})

// GET /api/admin/autoridades - Listado completo para admin
router.get('/', authAdmin, async (req, res) => {
  try {
    const { seccion } = req.query

    const where = {}
    if (seccion) where.seccion = seccion

    const autoridades = await prisma.autoridad.findMany({
      where,
      orderBy: [
        { seccion: 'asc' },
        { orden: 'asc' }
      ]
    })

    res.json({ success: true, data: autoridades })
  } catch (error) {
    console.error('Error obteniendo autoridades:', error)
    res.status(500).json({ error: 'Error al obtener autoridades' })
  }
})

// GET /api/admin/autoridades/:id - Detalle de una autoridad
router.get('/:id', authAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const autoridad = await prisma.autoridad.findUnique({
      where: { id: parseInt(id) }
    })

    if (!autoridad) {
      return res.status(404).json({ error: 'Autoridad no encontrada' })
    }

    res.json({ success: true, data: autoridad })
  } catch (error) {
    console.error('Error obteniendo autoridad:', error)
    res.status(500).json({ error: 'Error al obtener autoridad' })
  }
})

// POST /api/admin/autoridades - Crear autoridad
router.post('/', authAdmin, async (req, res) => {
  try {
    const {
      seccion,
      cargo,
      nombre,
      tipo,
      desde,
      email,
      telefono,
      foto,
      descripcion,
      responsable,
      orden,
      activo
    } = req.body

    if (!seccion || !nombre) {
      return res.status(400).json({ error: 'Sección y nombre son requeridos' })
    }

    // Obtener el máximo orden para la sección si no se especifica
    let ordenFinal = orden
    if (ordenFinal === undefined || ordenFinal === null) {
      const maxOrden = await prisma.autoridad.aggregate({
        where: { seccion },
        _max: { orden: true }
      })
      ordenFinal = (maxOrden._max.orden || 0) + 1
    }

    const autoridad = await prisma.autoridad.create({
      data: {
        seccion,
        cargo: cargo || null,
        nombre,
        tipo: tipo || null,
        desde: desde || null,
        email: email || null,
        telefono: telefono || null,
        foto: foto || null,
        descripcion: descripcion || null,
        responsable: responsable || null,
        orden: ordenFinal,
        activo: activo !== false
      }
    })

    res.status(201).json({ success: true, data: autoridad })
  } catch (error) {
    console.error('Error creando autoridad:', error)
    res.status(500).json({ error: 'Error al crear autoridad' })
  }
})

// PUT /api/admin/autoridades/:id - Actualizar autoridad
router.put('/:id', authAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const {
      seccion,
      cargo,
      nombre,
      tipo,
      desde,
      email,
      telefono,
      foto,
      descripcion,
      responsable,
      orden,
      activo
    } = req.body

    const autoridad = await prisma.autoridad.update({
      where: { id: parseInt(id) },
      data: {
        seccion,
        cargo: cargo || null,
        nombre,
        tipo: tipo || null,
        desde: desde || null,
        email: email || null,
        telefono: telefono || null,
        foto: foto || null,
        descripcion: descripcion || null,
        responsable: responsable || null,
        orden,
        activo
      }
    })

    res.json({ success: true, data: autoridad })
  } catch (error) {
    console.error('Error actualizando autoridad:', error)
    res.status(500).json({ error: 'Error al actualizar autoridad' })
  }
})

// DELETE /api/admin/autoridades/:id - Eliminar autoridad
router.delete('/:id', authAdmin, async (req, res) => {
  try {
    const { id } = req.params

    await prisma.autoridad.delete({
      where: { id: parseInt(id) }
    })

    res.json({ success: true, data: { message: 'Autoridad eliminada correctamente' } })
  } catch (error) {
    console.error('Error eliminando autoridad:', error)
    res.status(500).json({ error: 'Error al eliminar autoridad' })
  }
})

// PUT /api/admin/autoridades/reordenar/batch - Reordenar autoridades
router.put('/reordenar/batch', authAdmin, async (req, res) => {
  try {
    const { items } = req.body // [{ id: 1, orden: 0 }, { id: 2, orden: 1 }, ...]

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items es requerido y debe ser un array' })
    }

    // Actualizar orden de cada item
    for (const item of items) {
      await prisma.autoridad.update({
        where: { id: item.id },
        data: { orden: item.orden }
      })
    }

    res.json({ success: true, data: { message: 'Orden actualizado correctamente' } })
  } catch (error) {
    console.error('Error reordenando autoridades:', error)
    res.status(500).json({ error: 'Error al reordenar autoridades' })
  }
})

// POST /api/admin/autoridades/seed - Cargar datos iniciales
router.post('/seed', authAdmin, async (req, res) => {
  try {
    // Verificar si ya hay datos
    const count = await prisma.autoridad.count()
    if (count > 0) {
      return res.status(400).json({ error: 'Ya existen autoridades cargadas. Elimínelas primero si desea reiniciar.' })
    }

    // Datos iniciales
    const datosIniciales = [
      // Comisión Directiva
      { seccion: 'COMISION_DIRECTIVA', cargo: 'Presidente', nombre: 'Carlos Alberto Fernández', desde: '2024', email: 'presidente@sportivopilar.com.ar', orden: 1 },
      { seccion: 'COMISION_DIRECTIVA', cargo: 'Vicepresidente', nombre: 'María Elena Rodríguez', desde: '2024', orden: 2 },
      { seccion: 'COMISION_DIRECTIVA', cargo: 'Secretario', nombre: 'Juan Pablo Martínez', desde: '2024', email: 'secretaria@sportivopilar.com.ar', orden: 3 },
      { seccion: 'COMISION_DIRECTIVA', cargo: 'Prosecretario', nombre: 'Laura Beatriz González', desde: '2024', orden: 4 },
      { seccion: 'COMISION_DIRECTIVA', cargo: 'Tesorero', nombre: 'Ricardo Antonio López', desde: '2024', email: 'tesoreria@sportivopilar.com.ar', orden: 5 },
      { seccion: 'COMISION_DIRECTIVA', cargo: 'Protesorero', nombre: 'Andrea Soledad Pérez', desde: '2024', orden: 6 },

      // Vocales
      { seccion: 'VOCALES', nombre: 'Martín Ignacio Silva', tipo: 'TITULAR', orden: 1 },
      { seccion: 'VOCALES', nombre: 'Gabriela Fernanda Torres', tipo: 'TITULAR', orden: 2 },
      { seccion: 'VOCALES', nombre: 'Diego Alejandro Ruiz', tipo: 'TITULAR', orden: 3 },
      { seccion: 'VOCALES', nombre: 'Patricia Lorena Díaz', tipo: 'SUPLENTE', orden: 4 },
      { seccion: 'VOCALES', nombre: 'Fernando Javier Castro', tipo: 'SUPLENTE', orden: 5 },
      { seccion: 'VOCALES', nombre: 'Luciana Mabel Romero', tipo: 'SUPLENTE', orden: 6 },

      // Revisores de Cuentas
      { seccion: 'REVISORES', nombre: 'Eduardo César Morales', tipo: 'TITULAR', orden: 1 },
      { seccion: 'REVISORES', nombre: 'Claudia Verónica Sánchez', tipo: 'TITULAR', orden: 2 },
      { seccion: 'REVISORES', nombre: 'Roberto Daniel Acosta', tipo: 'SUPLENTE', orden: 3 },

      // Subcomisiones
      { seccion: 'SUBCOMISIONES', nombre: 'Subcomisión de Básquet', responsable: 'Martín Ignacio Silva', descripcion: 'Coordinación de todas las actividades de básquet: Liga Federal, formativas y recreativo.', orden: 1 },
      { seccion: 'SUBCOMISIONES', nombre: 'Subcomisión de Deportes', responsable: 'Gabriela Fernanda Torres', descripcion: 'Gestión de las demás actividades deportivas: fútbol, gimnasia, natación, etc.', orden: 2 },
      { seccion: 'SUBCOMISIONES', nombre: 'Subcomisión de Eventos', responsable: 'Patricia Lorena Díaz', descripcion: 'Organización de eventos sociales, fiestas y actividades para socios.', orden: 3 },
      { seccion: 'SUBCOMISIONES', nombre: 'Subcomisión de Infraestructura', responsable: 'Fernando Javier Castro', descripcion: 'Mantenimiento y mejoras de las instalaciones del club.', orden: 4 },
    ]

    // Insertar todos
    await prisma.autoridad.createMany({
      data: datosIniciales.map(d => ({
        ...d,
        activo: true
      }))
    })

    res.json({ success: true, data: { message: `Se cargaron ${datosIniciales.length} autoridades iniciales` } })
  } catch (error) {
    console.error('Error en seed de autoridades:', error)
    res.status(500).json({ error: 'Error al cargar datos iniciales' })
  }
})

export default router
