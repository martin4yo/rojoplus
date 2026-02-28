import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authAdmin, checkPermiso } from '../middleware/auth.js';
import {
  notificarNuevaComanda,
  notificarItemListo,
  notificarCuentaPedida,
  notificarMesaCobrada
} from '../services/socketService.js';

const router = express.Router();
const prisma = new PrismaClient();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Generar número único para comanda
async function generarNumeroComanda() {
  const hoy = new Date();
  const prefijo = `C${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`;

  const ultima = await prisma.comanda.findFirst({
    where: { numero: { startsWith: prefijo } },
    orderBy: { numero: 'desc' }
  });

  let secuencia = 1;
  if (ultima) {
    const partes = ultima.numero.split('-');
    secuencia = parseInt(partes[1] || '0') + 1;
  }

  return `${prefijo}-${String(secuencia).padStart(4, '0')}`;
}

// Generar número único para pedido take away
async function generarNumeroPedido() {
  const hoy = new Date();
  const prefijo = `TA${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`;

  const ultimo = await prisma.pedidoTakeAway.findFirst({
    where: { numero: { startsWith: prefijo } },
    orderBy: { numero: 'desc' }
  });

  let secuencia = 1;
  if (ultimo) {
    const partes = ultimo.numero.split('-');
    secuencia = parseInt(partes[1] || '0') + 1;
  }

  return `${prefijo}-${String(secuencia).padStart(4, '0')}`;
}

// Recalcular totales de comanda
async function recalcularTotalesComanda(comandaId) {
  const items = await prisma.itemComanda.findMany({
    where: { comandaId, estado: { not: 'ANULADO' } }
  });

  const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0);

  await prisma.comanda.update({
    where: { id: comandaId },
    data: { subtotal, total: subtotal }
  });
}

// Recalcular totales de pedido take away
async function recalcularTotalesPedido(pedidoId) {
  const items = await prisma.itemPedidoTakeAway.findMany({
    where: { pedidoId }
  });

  const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0);

  await prisma.pedidoTakeAway.update({
    where: { id: pedidoId },
    data: { subtotal, total: subtotal }
  });
}

// ============================================================================
// CONFIGURACIÓN - Cajas y Medios de Pago por Punto de Venta
// ============================================================================

// Obtener cajas disponibles para un punto de venta específico
router.get('/config/cajas/:puntoVenta', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const { puntoVenta } = req.params; // buffet, kiosco, takeaway

    const where = { activo: true };

    // Filtrar por punto de venta
    switch (puntoVenta) {
      case 'buffet':
        where.paraBuffet = true;
        break;
      case 'kiosco':
        where.paraKiosco = true;
        break;
      case 'takeaway':
        where.paraTakeaway = true;
        break;
      default:
        // Si no se especifica, devolver todas las activas
        break;
    }

    // Filtrar por cajas asignadas al rol del usuario (si no es super admin)
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      include: {
        rol: {
          include: {
            cajas: { select: { cajaId: true } }
          }
        }
      }
    });

    // Si el usuario tiene rol y no es super admin, filtrar por cajas asignadas
    if (admin?.rol && !admin.rol.esSuperAdmin && admin.rol.cajas.length > 0) {
      const cajasPermitidas = admin.rol.cajas.map(cr => cr.cajaId);
      where.id = { in: cajasPermitidas };
    }

    const cajas = await prisma.caja.findMany({
      where,
      orderBy: { nombre: 'asc' },
      select: { id: true, codigo: true, nombre: true, tipo: true, puntoVentaAfip: true }
    });

    res.json({ success: true, data: cajas });
  } catch (error) {
    console.error('Error al obtener cajas:', error);
    res.status(500).json({ success: false, error: 'Error al obtener cajas' });
  }
});

// Obtener medios de pago disponibles para un punto de venta específico
router.get('/config/medios-pago/:puntoVenta', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const { puntoVenta } = req.params; // buffet, kiosco, takeaway

    const where = { activo: true };

    // Filtrar por punto de venta
    switch (puntoVenta) {
      case 'buffet':
        where.paraBuffet = true;
        break;
      case 'kiosco':
        where.paraKiosco = true;
        break;
      case 'takeaway':
        where.paraTakeaway = true;
        break;
      default:
        break;
    }

    const mediosPago = await prisma.medioPago.findMany({
      where,
      orderBy: { orden: 'asc' },
      select: { id: true, codigo: true, nombre: true, tipo: true, comisionPct: true }
    });

    res.json({ success: true, data: mediosPago });
  } catch (error) {
    console.error('Error al obtener medios de pago:', error);
    res.status(500).json({ success: false, error: 'Error al obtener medios de pago' });
  }
});

// ============================================================================
// MESAS - CRUD
// ============================================================================

// Listar mesas
router.get('/mesas', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const { activo } = req.query;

    const where = {};
    if (activo !== undefined) where.activo = activo === 'true';

    const mesas = await prisma.mesa.findMany({
      where,
      orderBy: { numero: 'asc' },
      include: {
        comandas: {
          where: { estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] } },
          // No usar take: 1 para permitir múltiples comandas en mesas comunales
          include: {
            items: { include: { productoBuffet: true } },
            socio: { select: { id: true, nroSocio: true, apellidoNombre: true } }
          }
        }
      }
    });

    res.json({ success: true, data: mesas });
  } catch (error) {
    console.error('Error al listar mesas:', error);
    res.status(500).json({ success: false, error: 'Error al listar mesas' });
  }
});

// Estado de mesas para dashboard visual (DEBE ir antes de /mesas/:id)
router.get('/mesas/estado', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const { misMesas } = req.query;

    const where = { activo: true };

    // Si el usuario pide "mis mesas", filtrar por mozo asignado
    if (misMesas === 'true') {
      where.mozoAsignadoId = req.admin.id;
    }

    const mesas = await prisma.mesa.findMany({
      where,
      orderBy: { numero: 'asc' },
      include: {
        mozoAsignado: {
          select: { id: true, nombre: true, apellido: true }
        },
        comandas: {
          where: { estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] } },
          // No usar take: 1 para permitir múltiples comandas en mesas comunales
          select: {
            id: true,
            numero: true,
            estado: true,
            horaApertura: true,
            total: true,
            socio: { select: { nroSocio: true, apellidoNombre: true } },
            items: {
              select: {
                id: true,
                estado: true
              }
            },
            _count: { select: { items: true } }
          }
        }
      }
    });

    const mesasConInfo = mesas.map(mesa => ({
      id: mesa.id,
      numero: mesa.numero,
      nombre: mesa.nombre,
      capacidad: mesa.capacidad,
      zona: mesa.zona,
      estado: mesa.estado,
      esComunal: mesa.esComunal,
      mozoAsignado: mesa.mozoAsignado,
      comandas: mesa.comandas,
      comanda: mesa.comandas[0] || null,
      tiempoOcupada: mesa.comandas[0]?.horaApertura
        ? Math.floor((new Date() - new Date(mesa.comandas[0].horaApertura)) / 60000)
        : null
    }));

    res.json({ success: true, data: mesasConInfo });
  } catch (error) {
    console.error('Error al obtener estado mesas:', error);
    res.status(500).json({ success: false, error: 'Error al obtener estado' });
  }
});

// Listar mozos disponibles para asignación
router.get('/mozos', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    // Buscar admins que tengan permiso de BUFFET_MESAS (pueden atender mesas)
    // La relación es: Admin -> Rol -> PermisoRol -> Permiso
    const admins = await prisma.admin.findMany({
      where: {
        activo: true,
        rol: {
          permisos: {
            some: {
              permiso: { codigo: 'BUFFET_MESAS' }
            }
          }
        }
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        _count: {
          select: {
            mesasAsignadas: {
              where: { activo: true }
            }
          }
        }
      },
      orderBy: { nombre: 'asc' }
    });

    const mozos = admins.map(a => ({
      id: a.id,
      nombre: a.nombre,
      apellido: a.apellido,
      nombreCompleto: `${a.nombre} ${a.apellido || ''}`.trim(),
      email: a.email,
      mesasAsignadas: a._count.mesasAsignadas
    }));

    res.json({ success: true, data: mozos });
  } catch (error) {
    console.error('Error al listar mozos:', error);
    res.status(500).json({ success: false, error: 'Error al listar mozos' });
  }
});

// Asignar mozo a una mesa
router.post('/mesas/:id/asignar-mozo', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params;
    const { mozoId } = req.body;

    const mesa = await prisma.mesa.update({
      where: { id: parseInt(id) },
      data: { mozoAsignadoId: mozoId ? parseInt(mozoId) : null },
      include: {
        mozoAsignado: {
          select: { id: true, nombre: true, apellido: true }
        }
      }
    });

    res.json({ success: true, data: mesa });
  } catch (error) {
    console.error('Error al asignar mozo:', error);
    res.status(500).json({ success: false, error: 'Error al asignar mozo' });
  }
});

// Asignación masiva de mesas a mozos
router.post('/mesas/asignar-masivo', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { asignaciones } = req.body; // Array de { mesaId, mozoId }

    // Actualizar cada mesa
    const resultados = await Promise.all(
      asignaciones.map(({ mesaId, mozoId }) =>
        prisma.mesa.update({
          where: { id: parseInt(mesaId) },
          data: { mozoAsignadoId: mozoId ? parseInt(mozoId) : null }
        })
      )
    );

    res.json({ success: true, data: { actualizadas: resultados.length } });
  } catch (error) {
    console.error('Error en asignación masiva:', error);
    res.status(500).json({ success: false, error: 'Error en asignación masiva' });
  }
});

// Desasignar todas las mesas (limpiar turno)
router.post('/mesas/desasignar-todas', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const resultado = await prisma.mesa.updateMany({
      where: { activo: true },
      data: { mozoAsignadoId: null }
    });

    res.json({ success: true, data: { desasignadas: resultado.count } });
  } catch (error) {
    console.error('Error al desasignar mesas:', error);
    res.status(500).json({ success: false, error: 'Error al desasignar mesas' });
  }
});

// Obtener mesa por ID
router.get('/mesas/:id', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const { id } = req.params;

    const mesa = await prisma.mesa.findUnique({
      where: { id: parseInt(id) },
      include: {
        comandas: {
          where: { estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] } },
          include: {
            items: { include: { productoBuffet: true } },
            socio: { select: { id: true, nroSocio: true, apellidoNombre: true } }
          }
        }
      }
    });

    if (!mesa) {
      return res.status(404).json({ success: false, error: 'Mesa no encontrada' });
    }

    // Recalcular estado de comandas según items
    for (const comanda of mesa.comandas) {
      if (comanda.estado === 'EN_PREPARACION' && comanda.items.length > 0) {
        const todosProcesados = comanda.items.every(item =>
          ['LISTO', 'ENTREGADO', 'ANULADO'].includes(item.estado)
        );

        if (todosProcesados) {
          await prisma.comanda.update({
            where: { id: comanda.id },
            data: { estado: 'ABIERTA' }
          });
          comanda.estado = 'ABIERTA'; // Actualizar en el objeto de respuesta
        }
      }
    }

    res.json({ success: true, data: mesa });
  } catch (error) {
    console.error('Error al obtener mesa:', error);
    res.status(500).json({ success: false, error: 'Error al obtener mesa' });
  }
});

// Crear mesa
router.post('/mesas', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { numero, nombre, capacidad, zona, esComunal } = req.body;

    const existente = await prisma.mesa.findUnique({ where: { numero } });
    if (existente) {
      return res.status(400).json({ success: false, error: 'Ya existe una mesa con ese número' });
    }

    const mesa = await prisma.mesa.create({
      data: {
        numero,
        nombre: nombre || `Mesa ${numero}`,
        capacidad: capacidad || 4,
        zona,
        esComunal: esComunal || false
      }
    });

    res.status(201).json({ success: true, data: mesa });
  } catch (error) {
    console.error('Error al crear mesa:', error);
    res.status(500).json({ success: false, error: 'Error al crear mesa' });
  }
});

// Actualizar mesa (BUFFET_MESAS permite cambiar estado, BUFFET_CONFIG permite cambiar configuración)
router.put('/mesas/:id', authAdmin, checkPermiso('BUFFET_CONFIG', 'BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params;
    const { numero, nombre, capacidad, zona, activo, esComunal, estado } = req.body;

    const updateData = {};
    if (numero !== undefined) updateData.numero = numero;
    if (nombre !== undefined) updateData.nombre = nombre;
    if (capacidad !== undefined) updateData.capacidad = capacidad;
    if (zona !== undefined) updateData.zona = zona;
    if (activo !== undefined) updateData.activo = activo;
    if (esComunal !== undefined) updateData.esComunal = esComunal;
    if (estado !== undefined) updateData.estado = estado;

    // Si se pasa a LIBRE, cerrar todas las comandas activas
    if (estado === 'LIBRE') {
      await prisma.comanda.updateMany({
        where: {
          mesaId: parseInt(id),
          estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] }
        },
        data: {
          estado: 'CERRADA',
          horaCierre: new Date(),
          cerradoPor: req.admin.id
        }
      });
    }

    const mesa = await prisma.mesa.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json({ success: true, data: mesa });
  } catch (error) {
    console.error('Error al actualizar mesa:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar mesa' });
  }
});

// Eliminar mesa
router.delete('/mesas/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que no tenga comandas activas
    const comandasActivas = await prisma.comanda.count({
      where: { mesaId: parseInt(id), estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] } }
    });

    if (comandasActivas > 0) {
      return res.status(400).json({ success: false, error: 'No se puede eliminar una mesa con comandas activas' });
    }

    await prisma.mesa.delete({ where: { id: parseInt(id) } });

    res.json({ success: true, message: 'Mesa eliminada' });
  } catch (error) {
    console.error('Error al eliminar mesa:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar mesa' });
  }
});

// Cambiar estado de mesa
router.put('/mesas/:id/estado', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const estadosValidos = ['LIBRE', 'OCUPADA', 'CUENTA_PEDIDA', 'LIMPIEZA'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ success: false, error: 'Estado inválido' });
    }

    // Si se pasa a LIBRE, cerrar todas las comandas activas
    if (estado === 'LIBRE') {
      await prisma.comanda.updateMany({
        where: {
          mesaId: parseInt(id),
          estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] }
        },
        data: {
          estado: 'CERRADA',
          horaCierre: new Date(),
          cerradoPor: req.admin.id
        }
      });
    }

    const mesa = await prisma.mesa.update({
      where: { id: parseInt(id) },
      data: { estado }
    });

    res.json({ success: true, data: mesa });
  } catch (error) {
    console.error('Error al cambiar estado de mesa:', error);
    res.status(500).json({ success: false, error: 'Error al cambiar estado' });
  }
});

// ============================================================================
// CATEGORÍAS DE MENÚ - CRUD
// ============================================================================

// Listar categorías
router.get('/categorias', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const { activo } = req.query;

    const where = {};
    if (activo !== undefined) where.activo = activo === 'true';

    const categorias = await prisma.categoriaMenu.findMany({
      where,
      orderBy: { orden: 'asc' },
      include: {
        _count: { select: { productos: true } }
      }
    });

    res.json({ success: true, data: categorias });
  } catch (error) {
    console.error('Error al listar categorías:', error);
    res.status(500).json({ success: false, error: 'Error al listar categorías' });
  }
});

// Crear categoría
router.post('/categorias', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { codigo, nombre, descripcion, color, icono, orden } = req.body;

    const categoria = await prisma.categoriaMenu.create({
      data: { codigo, nombre, descripcion, color, icono, orden: orden || 0 }
    });

    res.status(201).json({ success: true, data: categoria });
  } catch (error) {
    console.error('Error al crear categoría:', error);
    res.status(500).json({ success: false, error: 'Error al crear categoría' });
  }
});

// Actualizar categoría
router.put('/categorias/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nombre, descripcion, color, icono, orden, activo } = req.body;

    const categoria = await prisma.categoriaMenu.update({
      where: { id: parseInt(id) },
      data: { codigo, nombre, descripcion, color, icono, orden, activo }
    });

    res.json({ success: true, data: categoria });
  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar categoría' });
  }
});

// Eliminar categoría
router.delete('/categorias/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que no tenga productos
    const productos = await prisma.productoBuffet.count({ where: { categoriaMenuId: parseInt(id) } });
    if (productos > 0) {
      return res.status(400).json({ success: false, error: 'No se puede eliminar una categoría con productos' });
    }

    await prisma.categoriaMenu.delete({ where: { id: parseInt(id) } });

    res.json({ success: true, message: 'Categoría eliminada' });
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar categoría' });
  }
});

// ============================================================================
// PRODUCTOS DEL BUFFET
// ============================================================================

// Listar productos del buffet
router.get('/productos', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const { categoriaId, disponible, activo, tipoVenta, busqueda } = req.query;

    const where = {};
    if (categoriaId) where.categoriaMenuId = parseInt(categoriaId);
    if (disponible !== undefined) where.disponible = disponible === 'true';
    if (activo !== undefined) where.activo = activo === 'true';

    // Filtrar por tipo de venta (array contains)
    if (tipoVenta) {
      where.tiposVenta = { has: tipoVenta };
    }

    // Búsqueda por nombre, descripción o código de barras
    if (busqueda) {
      where.OR = [
        { nombre: { contains: busqueda, mode: 'insensitive' } },
        { descripcion: { contains: busqueda, mode: 'insensitive' } },
        { codigoBarras: { equals: busqueda } }
      ];
    }

    const productos = await prisma.productoBuffet.findMany({
      where,
      orderBy: [{ categoriaMenuId: 'asc' }, { orden: 'asc' }],
      include: {
        categoriaMenu: true,
        producto: { select: { id: true, codigo: true, nombre: true } }
      }
    });

    res.json({ success: true, data: productos });
  } catch (error) {
    console.error('Error al listar productos:', error);
    res.status(500).json({ success: false, error: 'Error al listar productos' });
  }
});

// Buscar producto por código de barras (para kiosco)
router.get('/productos/barcode/:codigo', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const { codigo } = req.params;

    const producto = await prisma.productoBuffet.findFirst({
      where: {
        codigoBarras: codigo,
        activo: true,
        disponible: true,
        tiposVenta: { has: 'KIOSCO' }
      },
      include: {
        categoriaMenu: true
      }
    });

    if (!producto) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }

    res.json({ success: true, data: producto });
  } catch (error) {
    console.error('Error al buscar producto:', error);
    res.status(500).json({ success: false, error: 'Error al buscar producto' });
  }
});

// Crear producto completo (Stock + Buffet) - Para crear desde el módulo buffet
router.post('/productos/crear-completo', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const {
      codigo,
      categoriaStockId,
      nombre,
      descripcion,
      codigoBarras,
      precio,
      categoriaMenuId,
      imagen,
      tiposVenta,
      disponible,
      destacado,
      orden
    } = req.body;

    // Validaciones
    if (!codigo || !nombre || !precio || !categoriaMenuId) {
      return res.status(400).json({ success: false, error: 'Faltan campos obligatorios' });
    }

    // Verificar código único
    const existente = await prisma.producto.findUnique({ where: { codigo } });
    if (existente) {
      return res.status(400).json({ success: false, error: 'Ya existe un producto con ese código' });
    }

    // Crear en transacción: Producto (stock) + ProductoBuffet
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Crear producto en stock
      const productoStock = await tx.producto.create({
        data: {
          codigo,
          nombre,
          descripcion,
          categoriaId: categoriaStockId || null,
          precioVenta: precio,
          activo: true
        }
      });

      // 2. Crear producto buffet vinculado
      const productoBuffet = await tx.productoBuffet.create({
        data: {
          productoId: productoStock.id,
          categoriaMenuId,
          nombre,
          descripcion,
          codigoBarras: codigoBarras || null,
          precio,
          imagen,
          tiposVenta: tiposVenta || ['BUFFET', 'KIOSCO'],
          disponible: disponible !== false,
          destacado: destacado || false,
          orden: orden || 0
        },
        include: { categoriaMenu: true, producto: true }
      });

      return productoBuffet;
    });

    res.status(201).json({ success: true, data: resultado });
  } catch (error) {
    console.error('Error al crear producto completo:', error);
    res.status(500).json({ success: false, error: 'Error al crear producto' });
  }
});

// Vincular producto existente del stock al buffet
router.post('/productos', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { productoId, categoriaMenuId, nombre, descripcion, codigoBarras, precio, imagen, tiposVenta, disponible, destacado, orden } = req.body;

    // Verificar que el producto del stock exista
    const productoStock = await prisma.producto.findUnique({ where: { id: productoId } });
    if (!productoStock) {
      return res.status(400).json({ success: false, error: 'Producto del stock no encontrado' });
    }

    // Verificar que no esté ya vinculado
    const yaVinculado = await prisma.productoBuffet.findUnique({ where: { productoId } });
    if (yaVinculado) {
      return res.status(400).json({ success: false, error: 'Este producto ya está en el menú del buffet' });
    }

    const producto = await prisma.productoBuffet.create({
      data: {
        productoId,
        categoriaMenuId,
        nombre: nombre || productoStock.nombre,
        descripcion,
        codigoBarras: codigoBarras || null,
        precio,
        imagen,
        tiposVenta: tiposVenta || ['BUFFET', 'KIOSCO'],
        disponible: disponible !== false,
        destacado: destacado || false,
        orden: orden || 0
      },
      include: { categoriaMenu: true, producto: true }
    });

    res.status(201).json({ success: true, data: producto });
  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ success: false, error: 'Error al crear producto' });
  }
});

// Actualizar precios masivamente (DEBE IR ANTES de /productos/:id)
router.put('/productos/precios', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { productos } = req.body; // [{ id, precio }, { id, precio }, ...]

    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({ success: false, error: 'Debe enviar un array de productos con id y precio' });
    }

    // Actualizar en transacción
    const actualizaciones = await prisma.$transaction(
      productos.map(({ id, precio }) =>
        prisma.productoBuffet.update({
          where: { id: parseInt(id) },
          data: { precio: parseFloat(precio) }
        })
      )
    );

    res.json({ success: true, data: actualizaciones, count: actualizaciones.length });
  } catch (error) {
    console.error('Error al actualizar precios:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar precios' });
  }
});

// Actualizar producto del buffet
router.put('/productos/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params;
    const { categoriaMenuId, nombre, descripcion, codigoBarras, precio, imagen, tiposVenta, disponible, destacado, orden, activo } = req.body;

    const producto = await prisma.productoBuffet.update({
      where: { id: parseInt(id) },
      data: {
        categoriaMenuId,
        nombre,
        descripcion,
        codigoBarras: codigoBarras || null,
        precio,
        imagen,
        tiposVenta: tiposVenta || undefined,
        disponible,
        destacado,
        orden,
        activo
      },
      include: { categoriaMenu: true, producto: true }
    });

    res.json({ success: true, data: producto });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar producto' });
  }
});

// Eliminar producto del buffet
router.delete('/productos/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.productoBuffet.delete({ where: { id: parseInt(id) } });

    res.json({ success: true, message: 'Producto eliminado' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar producto' });
  }
});

// Cambiar disponibilidad rápido
router.put('/productos/:id/disponibilidad', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params;
    const { disponible } = req.body;

    const producto = await prisma.productoBuffet.update({
      where: { id: parseInt(id) },
      data: { disponible }
    });

    res.json({ success: true, data: producto });
  } catch (error) {
    console.error('Error al cambiar disponibilidad:', error);
    res.status(500).json({ success: false, error: 'Error al cambiar disponibilidad' });
  }
});

// ============================================================================
// SECTORES DE BUFFET
// ============================================================================

// Listar sectores
router.get('/sectores', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const sectores = await prisma.sectorBuffet.findMany({
      orderBy: { orden: 'asc' },
      include: { impresoras: true }
    });
    res.json({ success: true, data: sectores });
  } catch (error) {
    console.error('Error al listar sectores:', error);
    res.status(500).json({ success: false, error: 'Error al listar sectores' });
  }
});

// Listar sectores activos (para KDS)
router.get('/sectores/activos', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const sectores = await prisma.sectorBuffet.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
      include: {
        impresoras: {
          where: { activo: true }
        }
      }
    });
    res.json({ success: true, data: sectores });
  } catch (error) {
    console.error('Error al listar sectores activos:', error);
    res.status(500).json({ success: false, error: 'Error al listar sectores' });
  }
});

// Crear sector
router.post('/sectores', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { codigo, nombre, icono, color, orden } = req.body;

    const sector = await prisma.sectorBuffet.create({
      data: { codigo: codigo.toUpperCase(), nombre, icono, color, orden: orden || 0 }
    });

    res.status(201).json({ success: true, data: sector });
  } catch (error) {
    console.error('Error al crear sector:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, error: 'Ya existe un sector con ese código' });
    }
    res.status(500).json({ success: false, error: 'Error al crear sector' });
  }
});

// Actualizar sector
router.put('/sectores/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nombre, icono, color, orden, activo } = req.body;

    const sector = await prisma.sectorBuffet.update({
      where: { id: parseInt(id) },
      data: { codigo: codigo?.toUpperCase(), nombre, icono, color, orden, activo }
    });

    res.json({ success: true, data: sector });
  } catch (error) {
    console.error('Error al actualizar sector:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar sector' });
  }
});

// Eliminar sector
router.delete('/sectores/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que no tenga impresoras asociadas
    const impresoras = await prisma.impresoraTermica.count({ where: { sectorId: parseInt(id) } });
    if (impresoras > 0) {
      return res.status(400).json({ success: false, error: 'No se puede eliminar un sector con impresoras asociadas' });
    }

    await prisma.sectorBuffet.delete({ where: { id: parseInt(id) } });

    res.json({ success: true, message: 'Sector eliminado' });
  } catch (error) {
    console.error('Error al eliminar sector:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar sector' });
  }
});

// ============================================================================
// IMPRESORAS TÉRMICAS
// ============================================================================

// Listar impresoras
router.get('/impresoras', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const impresoras = await prisma.impresoraTermica.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        sector: true,
        destinosImpresion: { include: { categoriaMenu: true } }
      }
    });

    res.json({ success: true, data: impresoras });
  } catch (error) {
    console.error('Error al listar impresoras:', error);
    res.status(500).json({ success: false, error: 'Error al listar impresoras' });
  }
});

// Crear impresora
router.post('/impresoras', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { nombre, sectorId, ip, puerto } = req.body;

    const impresora = await prisma.impresoraTermica.create({
      data: { nombre, sectorId: sectorId ? parseInt(sectorId) : null, ip, puerto: puerto || 9100 },
      include: { sector: true }
    });

    res.status(201).json({ success: true, data: impresora });
  } catch (error) {
    console.error('Error al crear impresora:', error);
    res.status(500).json({ success: false, error: 'Error al crear impresora' });
  }
});

// Actualizar impresora
router.put('/impresoras/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, sectorId, ip, puerto, activo } = req.body;

    const impresora = await prisma.impresoraTermica.update({
      where: { id: parseInt(id) },
      data: {
        nombre,
        sectorId: sectorId !== undefined ? (sectorId ? parseInt(sectorId) : null) : undefined,
        ip,
        puerto,
        activo
      },
      include: { sector: true }
    });

    res.json({ success: true, data: impresora });
  } catch (error) {
    console.error('Error al actualizar impresora:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar impresora' });
  }
});

// Eliminar impresora
router.delete('/impresoras/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.impresoraTermica.delete({ where: { id: parseInt(id) } });

    res.json({ success: true, message: 'Impresora eliminada' });
  } catch (error) {
    console.error('Error al eliminar impresora:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar impresora' });
  }
});

// Test de conexión a impresora
router.post('/impresoras/:id/test', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params;

    const impresora = await prisma.impresoraTermica.findUnique({ where: { id: parseInt(id) } });
    if (!impresora) {
      return res.status(404).json({ success: false, error: 'Impresora no encontrada' });
    }

    // TODO: Implementar test real de conexión ESC/POS
    // Por ahora solo verificamos que la IP sea válida
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(impresora.ip)) {
      return res.status(400).json({ success: false, error: 'IP inválida' });
    }

    res.json({ success: true, message: 'Conexión OK (simulada)' });
  } catch (error) {
    console.error('Error en test de impresora:', error);
    res.status(500).json({ success: false, error: 'Error en test de conexión' });
  }
});

// ============================================================================
// DESTINOS DE IMPRESIÓN
// ============================================================================

// Listar destinos
router.get('/destinos-impresion', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const destinos = await prisma.destinoImpresion.findMany({
      include: {
        categoriaMenu: true,
        impresora: true
      }
    });

    res.json({ success: true, data: destinos });
  } catch (error) {
    console.error('Error al listar destinos:', error);
    res.status(500).json({ success: false, error: 'Error al listar destinos' });
  }
});

// Crear/Actualizar destino
router.post('/destinos-impresion', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { categoriaMenuId, impresoraId } = req.body;

    const destino = await prisma.destinoImpresion.upsert({
      where: {
        categoriaMenuId_impresoraId: { categoriaMenuId, impresoraId }
      },
      update: {},
      create: { categoriaMenuId, impresoraId }
    });

    res.json({ success: true, data: destino });
  } catch (error) {
    console.error('Error al crear destino:', error);
    res.status(500).json({ success: false, error: 'Error al crear destino' });
  }
});

// Eliminar destino
router.delete('/destinos-impresion/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.destinoImpresion.delete({ where: { id: parseInt(id) } });

    res.json({ success: true, message: 'Destino eliminado' });
  } catch (error) {
    console.error('Error al eliminar destino:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar destino' });
  }
});

// ============================================================================
// COMANDAS
// ============================================================================

// Listar comandas
router.get('/comandas', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const { estado, mesaId, fecha } = req.query;

    const where = {};
    if (estado) where.estado = estado;
    if (mesaId) where.mesaId = parseInt(mesaId);
    if (fecha) {
      const fechaInicio = new Date(fecha);
      fechaInicio.setHours(0, 0, 0, 0);
      const fechaFin = new Date(fecha);
      fechaFin.setHours(23, 59, 59, 999);
      where.horaApertura = { gte: fechaInicio, lte: fechaFin };
    }

    const comandas = await prisma.comanda.findMany({
      where,
      orderBy: { horaApertura: 'desc' },
      include: {
        mesa: true,
        socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
        items: { include: { productoBuffet: true } },
        atendedor: { select: { id: true, nombre: true } }
      }
    });

    res.json({ success: true, data: comandas });
  } catch (error) {
    console.error('Error al listar comandas:', error);
    res.status(500).json({ success: false, error: 'Error al listar comandas' });
  }
});

// Obtener comanda por ID
router.get('/comandas/:id', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const { id } = req.params;

    const comanda = await prisma.comanda.findUnique({
      where: { id: parseInt(id) },
      include: {
        mesa: true,
        socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
        items: {
          include: { productoBuffet: { include: { categoriaMenu: true } } },
          orderBy: { createdAt: 'asc' }
        },
        atendedor: { select: { id: true, nombre: true } },
        cerrador: { select: { id: true, nombre: true } },
        movimientosCaja: true
      }
    });

    if (!comanda) {
      return res.status(404).json({ success: false, error: 'Comanda no encontrada' });
    }

    res.json({ success: true, data: comanda });
  } catch (error) {
    console.error('Error al obtener comanda:', error);
    res.status(500).json({ success: false, error: 'Error al obtener comanda' });
  }
});

// Abrir comanda en mesa
router.post('/comandas', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { mesaId, socioId, observaciones, centroCostoId } = req.body;

    // Verificar mesa
    const mesa = await prisma.mesa.findUnique({ where: { id: mesaId } });
    if (!mesa) {
      return res.status(404).json({ success: false, error: 'Mesa no encontrada' });
    }

    // Para mesas NO comunitarias, verificar que no haya comanda abierta
    if (!mesa.esComunal) {
      const comandaExistente = await prisma.comanda.findFirst({
        where: { mesaId, estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] } }
      });

      if (comandaExistente) {
        return res.status(400).json({ success: false, error: 'La mesa ya tiene una comanda abierta' });
      }
    }

    const numero = await generarNumeroComanda();

    const comanda = await prisma.comanda.create({
      data: {
        numero,
        mesaId,
        socioId,
        observaciones,
        centroCostoId,
        atendidoPor: req.admin.id
      },
      include: { mesa: true, socio: true }
    });

    // Actualizar estado de mesa
    await prisma.mesa.update({
      where: { id: mesaId },
      data: { estado: 'OCUPADA' }
    });

    res.status(201).json({ success: true, data: comanda });
  } catch (error) {
    console.error('Error al crear comanda:', error);
    res.status(500).json({ success: false, error: 'Error al crear comanda' });
  }
});

// Actualizar datos de comanda (socio, observaciones)
router.put('/comandas/:id', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params;
    const { socioId, observaciones } = req.body;

    const comanda = await prisma.comanda.findUnique({
      where: { id: parseInt(id) }
    });

    if (!comanda) {
      return res.status(404).json({ success: false, error: 'Comanda no encontrada' });
    }

    if (comanda.estado === 'CERRADA' || comanda.estado === 'ANULADA') {
      return res.status(400).json({ success: false, error: 'No se puede editar una comanda cerrada' });
    }

    const comandaActualizada = await prisma.comanda.update({
      where: { id: parseInt(id) },
      data: {
        socioId: socioId || null,
        observaciones: observaciones || null
      },
      include: {
        socio: {
          select: { id: true, nombre: true, apellido: true, apellidoNombre: true, nroSocio: true }
        },
        mesa: true,
        items: {
          include: { productoBuffet: true },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    res.json({ success: true, data: comandaActualizada });
  } catch (error) {
    console.error('Error al actualizar comanda:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar comanda' });
  }
});

// Agregar items a comanda
router.post('/comandas/:id/items', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body; // [{ productoBuffetId, cantidad, observaciones }]

    const comanda = await prisma.comanda.findUnique({ where: { id: parseInt(id) } });
    if (!comanda) {
      return res.status(404).json({ success: false, error: 'Comanda no encontrada' });
    }

    if (comanda.estado === 'CERRADA' || comanda.estado === 'ANULADA') {
      return res.status(400).json({ success: false, error: 'No se pueden agregar items a una comanda cerrada' });
    }

    const itemsCreados = [];

    for (const item of items) {
      const producto = await prisma.productoBuffet.findUnique({
        where: { id: item.productoBuffetId },
        include: { categoriaMenu: true }
      });
      if (!producto) continue;

      // Determinar estado inicial según destino de impresión
      let estadoInicial = 'PENDIENTE';
      if (producto.categoriaMenuId) {
        const destino = await prisma.destinoImpresion.findFirst({
          where: { categoriaMenuId: producto.categoriaMenuId },
          include: { impresora: { include: { sector: true } } }
        });

        if (destino && destino.impresora) {
          const codigoSector = destino.impresora.sector?.codigo;
          if (codigoSector === 'COCINA') {
            estadoInicial = 'ENVIADO_COCINA';
          } else if (codigoSector === 'BARRA') {
            estadoInicial = 'ENVIADO_BARRA';
          }
        }
      }

      const itemCreado = await prisma.itemComanda.create({
        data: {
          comandaId: parseInt(id),
          productoBuffetId: item.productoBuffetId,
          cantidad: item.cantidad || 1,
          precioUnitario: producto.precio,
          subtotal: Number(producto.precio) * (item.cantidad || 1),
          observaciones: item.observaciones,
          estado: estadoInicial
        },
        include: { productoBuffet: true }
      });

      itemsCreados.push(itemCreado);
    }

    await recalcularTotalesComanda(parseInt(id));

    res.status(201).json({ success: true, data: itemsCreados });
  } catch (error) {
    console.error('Error al agregar items:', error);
    res.status(500).json({ success: false, error: 'Error al agregar items' });
  }
});

// Modificar item de comanda
router.put('/comandas/:comandaId/items/:itemId', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { comandaId, itemId } = req.params;
    const { cantidad, observaciones } = req.body;

    const item = await prisma.itemComanda.findUnique({
      where: { id: parseInt(itemId) },
      include: { productoBuffet: true }
    });

    if (!item || item.comandaId !== parseInt(comandaId)) {
      return res.status(404).json({ success: false, error: 'Item no encontrado' });
    }

    if (item.estado !== 'PENDIENTE') {
      return res.status(400).json({ success: false, error: 'Solo se pueden modificar items pendientes' });
    }

    const itemActualizado = await prisma.itemComanda.update({
      where: { id: parseInt(itemId) },
      data: {
        cantidad,
        subtotal: Number(item.precioUnitario) * cantidad,
        observaciones
      },
      include: { productoBuffet: true }
    });

    await recalcularTotalesComanda(parseInt(comandaId));

    res.json({ success: true, data: itemActualizado });
  } catch (error) {
    console.error('Error al modificar item:', error);
    res.status(500).json({ success: false, error: 'Error al modificar item' });
  }
});

// Anular item de comanda
router.delete('/comandas/:comandaId/items/:itemId', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { comandaId, itemId } = req.params;

    const item = await prisma.itemComanda.findUnique({ where: { id: parseInt(itemId) } });

    if (!item || item.comandaId !== parseInt(comandaId)) {
      return res.status(404).json({ success: false, error: 'Item no encontrado' });
    }

    if (item.estado === 'ENTREGADO') {
      return res.status(400).json({ success: false, error: 'No se pueden anular items entregados' });
    }

    await prisma.itemComanda.update({
      where: { id: parseInt(itemId) },
      data: { estado: 'ANULADO' }
    });

    await recalcularTotalesComanda(parseInt(comandaId));

    res.json({ success: true, message: 'Item anulado' });
  } catch (error) {
    console.error('Error al anular item:', error);
    res.status(500).json({ success: false, error: 'Error al anular item' });
  }
});

// Marcar item como entregado
router.post('/comandas/:comandaId/items/:itemId/entregar', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { comandaId, itemId } = req.params;

    const item = await prisma.itemComanda.findUnique({
      where: { id: parseInt(itemId) },
      include: { comanda: true }
    });

    if (!item || item.comandaId !== parseInt(comandaId)) {
      return res.status(404).json({ success: false, error: 'Item no encontrado' });
    }

    if (item.estado === 'ANULADO') {
      return res.status(400).json({ success: false, error: 'No se pueden entregar items anulados' });
    }

    if (item.estado === 'ENTREGADO') {
      return res.status(400).json({ success: false, error: 'El item ya fue entregado' });
    }

    const itemActualizado = await prisma.itemComanda.update({
      where: { id: parseInt(itemId) },
      data: {
        estado: 'ENTREGADO',
        entregadoAt: new Date()
      },
      include: { productoBuffet: true }
    });

    res.json({ success: true, data: itemActualizado });
  } catch (error) {
    console.error('Error al marcar item como entregado:', error);
    res.status(500).json({ success: false, error: 'Error al marcar item como entregado' });
  }
});

// Enviar a cocina
router.post('/comandas/:id/enviar-cocina', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params;

    const comanda = await prisma.comanda.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          where: { estado: 'PENDIENTE' },
          include: { productoBuffet: { include: { categoriaMenu: true } } }
        },
        mesa: true
      }
    });

    if (!comanda) {
      return res.status(404).json({ success: false, error: 'Comanda no encontrada' });
    }

    if (comanda.items.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay items pendientes para enviar' });
    }

    // Actualizar items a ENVIADO_COCINA
    await prisma.itemComanda.updateMany({
      where: { comandaId: parseInt(id), estado: 'PENDIENTE' },
      data: { estado: 'ENVIADO_COCINA', enviadoCocinaAt: new Date() }
    });

    // Actualizar estado de comanda
    const comandaActualizada = await prisma.comanda.update({
      where: { id: parseInt(id) },
      data: { estado: 'EN_PREPARACION' },
      include: { mesa: true }
    });

    // TODO: Imprimir en impresoras correspondientes según destinos

    // Notificar a cocina/barra según destinos de impresión
    notificarNuevaComanda(comandaActualizada, comanda.items).catch(err =>
      console.error('Error notificando nueva comanda:', err)
    );

    res.json({ success: true, message: 'Items enviados a cocina' });
  } catch (error) {
    console.error('Error al enviar a cocina:', error);
    res.status(500).json({ success: false, error: 'Error al enviar a cocina' });
  }
});

// Pedir cuenta (notifica al cajero)
router.post('/comandas/:id/pedir-cuenta', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params;
    const { imprimirTicket } = req.body; // Opcional: generar ticket de pre-cuenta

    const comanda = await prisma.comanda.findUnique({
      where: { id: parseInt(id) },
      include: {
        mesa: true,
        socio: true,
        items: {
          where: { estado: { not: 'ANULADO' } },
          include: { producto: true }
        }
      }
    });

    if (!comanda) {
      return res.status(404).json({ success: false, error: 'Comanda no encontrada' });
    }

    if (comanda.estado === 'CERRADA') {
      return res.status(400).json({ success: false, error: 'La comanda ya está cerrada' });
    }

    // Calcular descuento si el socio está al día
    let descuentoInfo = { porcentaje: 0, monto: 0 };
    if (comanda.socioId) {
      const configDescuento = await prisma.configuracion.findUnique({
        where: { clave: 'BUFFET_DESCUENTO_SOCIO' }
      });
      const descuentoPorcentaje = configDescuento ? parseFloat(configDescuento.valor) : 0;

      if (descuentoPorcentaje > 0) {
        // Verificar si el socio está al día
        const cargoPendiente = await prisma.cargo.findFirst({
          where: {
            socioId: comanda.socioId,
            estado: 'PENDIENTE',
            fechaVencimiento: { lt: new Date() }
          }
        });

        if (!cargoPendiente) {
          descuentoInfo = {
            porcentaje: descuentoPorcentaje,
            monto: (Number(comanda.subtotal) * descuentoPorcentaje) / 100
          };
        }
      }
    }

    // Actualizar estado de comanda
    const comandaActualizada = await prisma.comanda.update({
      where: { id: parseInt(id) },
      data: { estado: 'CUENTA_PEDIDA' },
      include: { mesa: true, socio: true }
    });

    // Actualizar estado de mesa
    await prisma.mesa.update({
      where: { id: comanda.mesaId },
      data: { estado: 'CUENTA_PEDIDA' }
    });

    // Generar ticket de pre-cuenta si se solicita
    let ticketBase64 = null;
    if (imprimirTicket !== false) {
      try {
        const { renderTicketPreCuenta, toBase64 } = await import('../services/ticketService.js');

        // Obtener nombre del mozo
        let mozoNombre = null;
        if (comanda.creadoPorId) {
          const mozo = await prisma.admin.findUnique({
            where: { id: comanda.creadoPorId },
            select: { nombre: true, apellido: true }
          });
          if (mozo) mozoNombre = `${mozo.nombre} ${mozo.apellido || ''}`.trim();
        }

        const ticketData = renderTicketPreCuenta({
          comanda: {
            ...comanda,
            mozo: mozoNombre
          },
          items: comanda.items,
          descuento: descuentoInfo,
          socio: comanda.socio
        });

        ticketBase64 = toBase64(ticketData);
      } catch (ticketError) {
        console.error('Error generando ticket pre-cuenta:', ticketError);
      }
    }

    // Notificar al cajero
    notificarCuentaPedida(comandaActualizada).catch(err =>
      console.error('Error notificando cuenta pedida:', err)
    );

    res.json({
      success: true,
      message: 'Cuenta solicitada',
      data: {
        comanda: comandaActualizada,
        descuento: descuentoInfo,
        totalEstimado: Number(comanda.subtotal) - descuentoInfo.monto,
        ticket: ticketBase64
      }
    });
  } catch (error) {
    console.error('Error al pedir cuenta:', error);
    res.status(500).json({ success: false, error: 'Error al pedir cuenta' });
  }
});

// Verificar descuento aplicable para una comanda
router.get('/comandas/:id/descuento', authAdmin, checkPermiso('BUFFET_COBRAR'), async (req, res) => {
  try {
    const { id } = req.params;

    const comanda = await prisma.comanda.findUnique({
      where: { id: parseInt(id) },
      include: { socio: true }
    });

    if (!comanda) {
      return res.status(404).json({ success: false, error: 'Comanda no encontrada' });
    }

    let descuentoInfo = {
      aplicable: false,
      porcentaje: 0,
      monto: 0,
      motivo: null,
      socioAlDia: false
    };

    if (comanda.socioId) {
      // Obtener configuración de descuento para socios
      const configDescuento = await prisma.configuracion.findUnique({
        where: { clave: 'BUFFET_DESCUENTO_SOCIO' }
      });

      const porcentajeDescuento = configDescuento ? parseFloat(configDescuento.valor) : 0;

      if (porcentajeDescuento > 0) {
        // Verificar si el socio está al día
        const cargoPendiente = await prisma.cargo.findFirst({
          where: {
            socioId: comanda.socioId,
            estado: 'PENDIENTE',
            fechaVencimiento: { lt: new Date() }
          }
        });

        const socioAlDia = !cargoPendiente;

        if (socioAlDia) {
          const montoDescuento = (Number(comanda.subtotal) * porcentajeDescuento) / 100;
          descuentoInfo = {
            aplicable: true,
            porcentaje: porcentajeDescuento,
            monto: montoDescuento,
            motivo: `Descuento socio ${porcentajeDescuento}%`,
            socioAlDia: true
          };
        } else {
          descuentoInfo.motivo = 'El socio tiene cuotas vencidas';
          descuentoInfo.socioAlDia = false;
        }
      }
    }

    res.json({ success: true, data: descuentoInfo });
  } catch (error) {
    console.error('Error verificando descuento:', error);
    res.status(500).json({ success: false, error: 'Error verificando descuento' });
  }
});

// Cobrar comanda
router.post('/comandas/:id/cobrar', authAdmin, checkPermiso('BUFFET_COBRAR'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      medioPagoId,
      cajaId,
      observaciones,
      aplicarDescuento,
      propina,
      pagosParciales,
      // Nuevos parámetros para facturación
      emitirFactura,
      esVentaInterna,
      tipoComprobante, // 11=FC (default), 6=FB, 1=FA
      datosCliente // { tipoDoc, documento, nombre, condicionIva }
    } = req.body;

    const comanda = await prisma.comanda.findUnique({
      where: { id: parseInt(id) },
      include: { mesa: true, socio: true, items: { include: { productoBuffet: true } } }
    });

    if (!comanda) {
      return res.status(404).json({ success: false, error: 'Comanda no encontrada' });
    }

    if (comanda.estado === 'CERRADA') {
      return res.status(400).json({ success: false, error: 'La comanda ya fue cobrada' });
    }

    // Validar acceso a la caja según el rol del usuario
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      include: {
        rol: {
          include: {
            cajas: { select: { cajaId: true } }
          }
        }
      }
    });

    if (admin?.rol && !admin.rol.esSuperAdmin && admin.rol.cajas.length > 0) {
      const cajasPermitidas = admin.rol.cajas.map(cr => cr.cajaId);
      const cajaIdPrincipal = cajaId || (pagosParciales?.[0]?.cajaId);

      if (cajaIdPrincipal && !cajasPermitidas.includes(parseInt(cajaIdPrincipal))) {
        return res.status(403).json({
          success: false,
          error: 'No tiene permiso para cobrar en esta caja'
        });
      }
    }

    // Calcular descuento si aplica
    let descuentoMonto = 0;
    let descuentoPorcentaje = 0;

    if (aplicarDescuento && comanda.socioId) {
      const configDescuento = await prisma.configuracion.findUnique({
        where: { clave: 'BUFFET_DESCUENTO_SOCIO' }
      });

      descuentoPorcentaje = configDescuento ? parseFloat(configDescuento.valor) : 0;

      if (descuentoPorcentaje > 0) {
        // Verificar si el socio está al día
        const cargoPendiente = await prisma.cargo.findFirst({
          where: {
            socioId: comanda.socioId,
            estado: 'PENDIENTE',
            fechaVencimiento: { lt: new Date() }
          }
        });

        if (!cargoPendiente) {
          descuentoMonto = (Number(comanda.subtotal) * descuentoPorcentaje) / 100;
        }
      }
    }

    // Calcular total con descuento y propina
    const propinaMonto = propina && propina > 0 ? parseFloat(propina) : 0;
    const totalFinal = Number(comanda.subtotal) - descuentoMonto + propinaMonto;

    // Obtener cuenta contable de ventas buffet
    let cuentaContable = await prisma.cuentaContable.findFirst({
      where: { codigo: { contains: 'BUFFET' }, esImputable: true }
    });

    if (!cuentaContable) {
      cuentaContable = await prisma.cuentaContable.findFirst({
        where: { codigo: '4.1.1.01', esImputable: true }
      });
    }

    // Obtener centro de costo BUFFET
    const centroCosto = await prisma.centroCosto.findFirst({
      where: { codigo: 'BUFFET' }
    });

    // Determinar si es pago múltiple o simple
    const usaPagosMultiples = pagosParciales && Array.isArray(pagosParciales) && pagosParciales.length > 0;
    const movimientos = [];

    if (usaPagosMultiples) {
      // PAGOS MÚLTIPLES: Validar que la suma coincida con el total
      const totalPagos = pagosParciales.reduce((sum, pago) => sum + parseFloat(pago.monto), 0);

      if (Math.abs(totalPagos - totalFinal) > 0.01) {
        return res.status(400).json({
          success: false,
          error: `La suma de pagos (${totalPagos}) no coincide con el total (${totalFinal})`
        });
      }

      // Crear un movimiento de caja por cada pago
      for (const pago of pagosParciales) {
        const medioPago = await prisma.medioPago.findUnique({ where: { id: parseInt(pago.medioPagoId) } });
        if (!medioPago) {
          return res.status(400).json({ success: false, error: `Medio de pago ${pago.medioPagoId} no encontrado` });
        }

        const caja = await prisma.caja.findUnique({ where: { id: parseInt(pago.cajaId || cajaId) } });
        if (!caja) {
          return res.status(400).json({ success: false, error: `Caja ${pago.cajaId || cajaId} no encontrada` });
        }

        // Generar número de movimiento
        const ultimoMov = await prisma.movimientoCaja.findFirst({
          orderBy: { id: 'desc' }
        });
        const nuevoNumero = `MOV-${String((ultimoMov?.id || 0) + 1).padStart(8, '0')}`;

        const movimiento = await prisma.movimientoCaja.create({
          data: {
            numero: nuevoNumero,
            cajaId: parseInt(pago.cajaId || cajaId),
            tipo: 'INGRESO',
            cuentaContableId: cuentaContable?.id || 1,
            centroCostoId: centroCosto?.id,
            monto: parseFloat(pago.monto),
            concepto: `Venta Buffet - Comanda ${comanda.numero} - ${medioPago.nombre}${descuentoMonto > 0 ? ` (Desc. ${descuentoPorcentaje}%)` : ''}${propinaMonto > 0 ? ` + Propina` : ''}`,
            descripcion: observaciones,
            comandaId: parseInt(id),
            registradoPor: req.admin.id
          }
        });

        movimientos.push(movimiento);
      }
    } else {
      // PAGO SIMPLE: Un solo medio de pago
      const medioPago = await prisma.medioPago.findUnique({ where: { id: medioPagoId } });
      if (!medioPago) {
        return res.status(400).json({ success: false, error: 'Medio de pago no encontrado' });
      }

      const caja = await prisma.caja.findUnique({ where: { id: cajaId } });
      if (!caja) {
        return res.status(400).json({ success: false, error: 'Caja no encontrada' });
      }

      // Generar número de movimiento
      const ultimoMov = await prisma.movimientoCaja.findFirst({
        orderBy: { id: 'desc' }
      });
      const nuevoNumero = `MOV-${String((ultimoMov?.id || 0) + 1).padStart(8, '0')}`;

      const movimiento = await prisma.movimientoCaja.create({
        data: {
          numero: nuevoNumero,
          cajaId,
          tipo: 'INGRESO',
          cuentaContableId: cuentaContable?.id || 1,
          centroCostoId: centroCosto?.id,
          monto: totalFinal,
          concepto: `Venta Buffet - Comanda ${comanda.numero}${descuentoMonto > 0 ? ` (Desc. ${descuentoPorcentaje}%)` : ''}${propinaMonto > 0 ? ` + Propina` : ''}`,
          descripcion: observaciones,
          comandaId: parseInt(id),
          registradoPor: req.admin.id
        }
      });

      movimientos.push(movimiento);
    }

    // Actualizar y cerrar comanda
    const comandaActualizada = await prisma.comanda.update({
      where: { id: parseInt(id) },
      data: {
        estado: 'CERRADA',
        descuento: descuentoMonto,
        propina: propinaMonto,
        total: totalFinal,
        horaCierre: new Date(),
        cerradoPor: req.admin.id,
        esVentaInterna: esVentaInterna || false
      }
    });

    // Variables para facturación
    let comprobanteFiscal = null;
    let ticketBase64 = null;
    let qrUrl = null;

    // Emitir factura si se solicita y no es venta interna
    if (emitirFactura && !esVentaInterna) {
      try {
        // Importar servicios de facturación dinámicamente
        const { requestCAE, getLastAuthorizedNumber } = await import('../services/afipWSFEService.js');
        const { getConfiguracionFiscal } = await import('../services/afipWSAAService.js');
        const { generateQRData } = await import('../services/afipQRService.js');
        const { renderTicketFiscal, toBase64 } = await import('../services/ticketService.js');

        const config = await getConfiguracionFiscal();

        // Obtener punto de venta de la caja
        const cajaUsada = await prisma.caja.findUnique({ where: { id: cajaId || movimientos[0]?.cajaId } });
        const puntoVenta = cajaUsada?.puntoVentaAfip || 1;

        // Determinar tipo de comprobante automáticamente según condición IVA del cliente
        // RI (1) o Monotributo (6) → Factura A (1)
        // CF (5), Exento (4), otros → Factura B (6)
        let tipoAfip;
        if (datosCliente?.condicionIva === 1 || datosCliente?.condicionIva === 6) {
          tipoAfip = 1; // Factura A
        } else {
          tipoAfip = 6; // Factura B (para CF, Exentos, etc.)
        }

        // Obtener siguiente número
        const ultimoNumero = await getLastAuthorizedNumber(puntoVenta, tipoAfip);
        const numeroComprobante = ultimoNumero + 1;

        // Preparar items para AFIP
        const itemsFactura = comanda.items.map(item => ({
          descripcion: item.productoBuffet?.nombre || item.nombre || 'Producto',
          cantidad: item.cantidad,
          precioUnitario: parseFloat(item.precioUnitario),
          subtotal: parseFloat(item.subtotal),
          ivaRate: 21,
          ivaAmount: tipoAfip === 6 ? 0 : (parseFloat(item.subtotal) * 21) / 121 // Factura B no discrimina IVA
        }));

        // Calcular totales
        // Factura A discrimina IVA, Factura B no discrimina (igual que C)
        const discriminaIva = tipoAfip === 1;
        const subtotalNeto = discriminaIva ? itemsFactura.reduce((sum, i) => sum + (i.subtotal - i.ivaAmount), 0) : totalFinal;
        const ivaTotal = discriminaIva ? itemsFactura.reduce((sum, i) => sum + i.ivaAmount, 0) : 0;

        // Solicitar CAE
        const resultadoCAE = await requestCAE({
          puntoVenta,
          tipoComprobante: tipoAfip,
          numeroComprobante,
          fecha: new Date(),
          tipoDocCliente: datosCliente?.tipoDoc || 99,
          docCliente: datosCliente?.documento || '',
          condicionIvaCliente: datosCliente?.condicionIva || 5,
          subtotal: subtotalNeto,
          iva: ivaTotal,
          total: totalFinal,
          items: itemsFactura
        });

        // Determinar nombre del tipo de comprobante
        const tiposNombre = {
          1: 'FACTURA A', 6: 'FACTURA B', 11: 'FACTURA C',
          2: 'NOTA DE DEBITO A', 7: 'NOTA DE DEBITO B', 12: 'NOTA DE DEBITO C',
          3: 'NOTA DE CREDITO A', 8: 'NOTA DE CREDITO B', 13: 'NOTA DE CREDITO C'
        };

        // Guardar comprobante en base de datos
        comprobanteFiscal = await prisma.comprobanteElectronico.create({
          data: {
            tipo: tiposNombre[tipoAfip] || 'FACTURA C',
            tipoAfip,
            puntoVenta,
            numero: numeroComprobante,
            fecha: new Date(),
            cae: resultadoCAE.cae,
            fechaVtoCae: resultadoCAE.caeExpiration,
            cuitReceptor: datosCliente?.tipoDoc === 80 ? datosCliente.documento : null,
            nombreReceptor: datosCliente?.nombre || 'Consumidor Final',
            condicionIvaReceptor: datosCliente?.condicionIva === 1 ? 'IVA Responsable Inscripto' :
              datosCliente?.condicionIva === 6 ? 'Responsable Monotributo' : 'Consumidor Final',
            subtotal: subtotalNeto,
            iva21: ivaTotal,
            iva105: 0,
            total: totalFinal,
            metodoPago: 'VARIOS',
            comandaId: parseInt(id),
            cajaId: cajaId || movimientos[0]?.cajaId,
            creadoPorId: req.admin.id,
            estado: 'EMITIDO'
          }
        });

        // Generar URL del QR
        qrUrl = generateQRData({
          cuit: config.cuit,
          tipoComprobante: tipoAfip,
          puntoVenta,
          numeroComprobante,
          importe: totalFinal,
          fecha: new Date(),
          tipoDocCliente: datosCliente?.tipoDoc || 99,
          docCliente: datosCliente?.documento || '',
          cae: resultadoCAE.cae
        });

        // Generar ticket para impresión
        const ticketData = renderTicketFiscal({
          empresa: {
            razonSocial: config.razonSocial,
            domicilio: config.domicilioFiscal,
            cuit: config.cuit,
            condicionIva: config.condicionIva
          },
          comprobante: {
            tipo: tiposNombre[tipoAfip],
            tipoAfip,
            puntoVenta,
            numero: numeroComprobante,
            fecha: new Date(),
            cae: resultadoCAE.cae,
            fechaVtoCae: resultadoCAE.caeExpiration,
            cuit: config.cuit,
            nombreCliente: datosCliente?.nombre || 'Consumidor Final',
            tipoDocCliente: datosCliente?.tipoDoc || 99,
            docCliente: datosCliente?.documento,
            subtotal: subtotalNeto,
            iva: ivaTotal,
            total: totalFinal
          },
          comanda: comandaActualizada,
          items: itemsFactura
        });

        ticketBase64 = toBase64(ticketData);

        console.log(`[Buffet] Factura emitida: ${tiposNombre[tipoAfip]} ${puntoVenta}-${numeroComprobante} CAE: ${resultadoCAE.cae}`);
      } catch (facError) {
        console.error('Error emitiendo factura:', facError);
        // No fallamos el cobro si falla la facturación, pero informamos
      }
    } else if (esVentaInterna || !emitirFactura) {
      // Generar ticket NO fiscal para venta interna
      try {
        const { renderTicketNoFiscal, toBase64 } = await import('../services/ticketService.js');

        // Preparar items
        const itemsTicket = comanda.items.map(item => ({
          nombre: item.productoBuffet?.nombre || item.nombre || 'Producto',
          cantidad: item.cantidad,
          precioUnitario: parseFloat(item.precioUnitario),
          subtotal: parseFloat(item.subtotal)
        }));

        // Obtener nombre del cajero
        let cajeroNombre = null;
        if (req.admin?.id) {
          const cajero = await prisma.admin.findUnique({
            where: { id: req.admin.id },
            select: { nombre: true, apellido: true }
          });
          if (cajero) cajeroNombre = `${cajero.nombre} ${cajero.apellido || ''}`.trim();
        }

        const medioPago = await prisma.medioPago.findUnique({ where: { id: medioPagoId || pagosParciales?.[0]?.medioPagoId } });

        const ticketData = renderTicketNoFiscal({
          empresa: { razonSocial: 'CLUB SPORTIVO PILAR' },
          comanda: {
            ...comandaActualizada,
            metodoPago: medioPago?.nombre || 'VARIOS',
            cobradoPor: cajeroNombre
          },
          items: itemsTicket
        });

        ticketBase64 = toBase64(ticketData);
        console.log(`[Buffet] Ticket no fiscal generado para comanda ${comanda.numero}`);
      } catch (ticketError) {
        console.error('Error generando ticket no fiscal:', ticketError);
      }
    }

    // Liberar mesa
    const mesaActualizada = await prisma.mesa.update({
      where: { id: comanda.mesaId },
      data: { estado: 'LIMPIEZA' }
    });

    // Notificar al mozo que la mesa fue cobrada (para limpiar)
    notificarMesaCobrada(mesaActualizada, comanda).catch(err =>
      console.error('Error notificando mesa cobrada:', err)
    );

    res.json({
      success: true,
      data: {
        comanda: comandaActualizada,
        movimientos,
        descuentoAplicado: descuentoMonto > 0 ? {
          porcentaje: descuentoPorcentaje,
          monto: descuentoMonto
        } : null,
        propinaAplicada: propinaMonto > 0 ? propinaMonto : null,
        // Datos de facturación
        comprobante: comprobanteFiscal,
        ticket: ticketBase64,
        qrUrl
      }
    });
  } catch (error) {
    console.error('Error al cobrar comanda:', error);
    res.status(500).json({ success: false, error: 'Error al cobrar comanda' });
  }
});

// Cerrar mesa (después de limpiar)
router.post('/comandas/:id/cerrar', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params;

    const comanda = await prisma.comanda.findUnique({
      where: { id: parseInt(id) },
      include: { mesa: true }
    });

    if (!comanda) {
      return res.status(404).json({ success: false, error: 'Comanda no encontrada' });
    }

    // Cerrar la comanda
    await prisma.comanda.update({
      where: { id: parseInt(id) },
      data: {
        estado: 'CERRADA',
        horaCierre: new Date(),
        cerradoPor: req.admin.id
      }
    });

    // Verificar si hay otras comandas activas en la mesa (mesas comunales)
    const comandasActivas = await prisma.comanda.count({
      where: {
        mesaId: comanda.mesaId,
        estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] }
      }
    });

    // Solo liberar mesa si no hay otras comandas activas
    if (comandasActivas === 0) {
      await prisma.mesa.update({
        where: { id: comanda.mesaId },
        data: { estado: 'LIBRE' }
      });
    }

    res.json({ success: true, message: 'Mesa liberada' });
  } catch (error) {
    console.error('Error al cerrar mesa:', error);
    res.status(500).json({ success: false, error: 'Error al cerrar mesa' });
  }
});

// Eliminar comanda vacía
router.delete('/comandas/:id', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params;

    const comanda = await prisma.comanda.findUnique({
      where: { id: parseInt(id) },
      include: { items: true, mesa: true }
    });

    if (!comanda) {
      return res.status(404).json({ success: false, error: 'Comanda no encontrada' });
    }

    // Solo permitir eliminar comandas vacías (sin items)
    if (comanda.items && comanda.items.length > 0) {
      return res.status(400).json({ success: false, error: 'No se puede eliminar una comanda con items. Anule los items primero.' });
    }

    // Solo comandas abiertas
    if (comanda.estado === 'CERRADA' || comanda.estado === 'ANULADA') {
      return res.status(400).json({ success: false, error: 'No se puede eliminar una comanda cerrada o anulada' });
    }

    // Eliminar la comanda
    await prisma.comanda.delete({ where: { id: parseInt(id) } });

    // Verificar si hay otras comandas activas en la mesa
    const otrasComandas = await prisma.comanda.findFirst({
      where: {
        mesaId: comanda.mesaId,
        estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] }
      }
    });

    // Si no hay más comandas activas, liberar la mesa
    if (!otrasComandas) {
      await prisma.mesa.update({
        where: { id: comanda.mesaId },
        data: { estado: 'LIBRE' }
      });
    }

    res.json({ success: true, message: 'Comanda eliminada' });
  } catch (error) {
    console.error('Error al eliminar comanda:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar comanda' });
  }
});

// ============================================================================
// TAKE AWAY
// ============================================================================

// Listar pedidos take away
router.get('/takeaway', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const { estado, fecha } = req.query;

    const where = {};
    if (estado) where.estado = estado;
    if (fecha) {
      const fechaInicio = new Date(fecha);
      fechaInicio.setHours(0, 0, 0, 0);
      const fechaFin = new Date(fecha);
      fechaFin.setHours(23, 59, 59, 999);
      where.horaRecibido = { gte: fechaInicio, lte: fechaFin };
    }

    const pedidos = await prisma.pedidoTakeAway.findMany({
      where,
      orderBy: { horaRecibido: 'desc' },
      include: {
        socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
        items: { include: { productoBuffet: true } },
        atendedor: { select: { id: true, nombre: true } }
      }
    });

    res.json({ success: true, data: pedidos });
  } catch (error) {
    console.error('Error al listar pedidos:', error);
    res.status(500).json({ success: false, error: 'Error al listar pedidos' });
  }
});

// Crear pedido take away
router.post('/takeaway', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { nombreCliente, telefono, socioId, horaEstimada, observaciones, items, tipo, centroCostoId } = req.body;

    const numero = await generarNumeroPedido();

    const pedido = await prisma.pedidoTakeAway.create({
      data: {
        numero,
        nombreCliente,
        telefono,
        socioId,
        tipo: tipo || 'RETIRO',
        centroCostoId: centroCostoId ? parseInt(centroCostoId) : null,
        horaEstimada: horaEstimada ? new Date(horaEstimada) : null,
        observaciones,
        atendidoPor: req.admin.id
      }
    });

    // Agregar items si se proporcionan
    if (items && items.length > 0) {
      for (const item of items) {
        const producto = await prisma.productoBuffet.findUnique({ where: { id: item.productoBuffetId } });
        if (!producto) continue;

        await prisma.itemPedidoTakeAway.create({
          data: {
            pedidoId: pedido.id,
            productoBuffetId: item.productoBuffetId,
            cantidad: item.cantidad || 1,
            precioUnitario: producto.precio,
            subtotal: Number(producto.precio) * (item.cantidad || 1),
            observaciones: item.observaciones
          }
        });
      }

      await recalcularTotalesPedido(pedido.id);
    }

    const pedidoCompleto = await prisma.pedidoTakeAway.findUnique({
      where: { id: pedido.id },
      include: { items: { include: { productoBuffet: true } } }
    });

    res.status(201).json({ success: true, data: pedidoCompleto });
  } catch (error) {
    console.error('Error al crear pedido:', error);
    res.status(500).json({ success: false, error: 'Error al crear pedido' });
  }
});

// Agregar items a pedido take away
router.post('/takeaway/:id/items', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    const pedido = await prisma.pedidoTakeAway.findUnique({ where: { id: parseInt(id) } });
    if (!pedido) {
      return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
    }

    if (pedido.estado === 'ENTREGADO' || pedido.estado === 'CANCELADO') {
      return res.status(400).json({ success: false, error: 'No se pueden agregar items a este pedido' });
    }

    const itemsCreados = [];

    for (const item of items) {
      const producto = await prisma.productoBuffet.findUnique({
        where: { id: item.productoBuffetId },
        include: { categoriaMenu: true }
      });
      if (!producto) continue;

      // Determinar estado inicial según destino de impresión
      let estadoInicial = 'PENDIENTE';
      if (producto.categoriaMenuId) {
        const destino = await prisma.destinoImpresion.findFirst({
          where: { categoriaMenuId: producto.categoriaMenuId },
          include: { impresora: { include: { sector: true } } }
        });

        if (destino && destino.impresora) {
          const codigoSector = destino.impresora.sector?.codigo;
          if (codigoSector === 'COCINA') {
            estadoInicial = 'ENVIADO_COCINA';
          } else if (codigoSector === 'BARRA') {
            estadoInicial = 'ENVIADO_BARRA';
          }
        }
      }

      const itemCreado = await prisma.itemPedidoTakeAway.create({
        data: {
          pedidoId: parseInt(id),
          productoBuffetId: item.productoBuffetId,
          cantidad: item.cantidad || 1,
          precioUnitario: producto.precio,
          subtotal: Number(producto.precio) * (item.cantidad || 1),
          observaciones: item.observaciones,
          estado: estadoInicial
        },
        include: { productoBuffet: true }
      });

      itemsCreados.push(itemCreado);
    }

    await recalcularTotalesPedido(parseInt(id));

    res.status(201).json({ success: true, data: itemsCreados });
  } catch (error) {
    console.error('Error al agregar items:', error);
    res.status(500).json({ success: false, error: 'Error al agregar items' });
  }
});

// Obtener pedido individual
router.get('/takeaway/:id', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const { id } = req.params;

    const pedido = await prisma.pedidoTakeAway.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            productoBuffet: {
              include: { categoriaMenu: true }
            }
          }
        },
        socio: {
          select: {
            id: true,
            nroSocio: true,
            apellido: true,
            nombre: true,
            apellidoNombre: true
          }
        },
        centroCosto: true
      }
    });

    if (!pedido) {
      return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
    }

    // Recalcular estado según items si está EN_PREPARACION
    if (pedido.estado === 'EN_PREPARACION' && pedido.items.length > 0) {
      const todosProcesados = pedido.items.every(item =>
        ['LISTO', 'ENTREGADO', 'ANULADO'].includes(item.estado)
      );

      if (todosProcesados) {
        await prisma.pedidoTakeAway.update({
          where: { id: pedido.id },
          data: { estado: 'LISTO', horaListo: new Date() }
        });
        pedido.estado = 'LISTO';
        pedido.horaListo = new Date();
      }
    }

    res.json({ success: true, data: pedido });
  } catch (error) {
    console.error('Error al obtener pedido:', error);
    res.status(500).json({ success: false, error: 'Error al obtener pedido' });
  }
});

// Modificar cantidad de item
router.put('/takeaway/:id/items/:itemId', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { cantidad } = req.body;

    const item = await prisma.itemPedidoTakeAway.findUnique({
      where: { id: parseInt(itemId) },
      include: { productoBuffet: true }
    });

    if (!item || item.pedidoId !== parseInt(id)) {
      return res.status(404).json({ success: false, error: 'Item no encontrado' });
    }

    if (item.estado !== 'PENDIENTE') {
      return res.status(400).json({ success: false, error: 'Solo se pueden modificar items pendientes' });
    }

    const nuevoSubtotal = Number(item.precioUnitario) * parseInt(cantidad);

    const itemActualizado = await prisma.itemPedidoTakeAway.update({
      where: { id: parseInt(itemId) },
      data: {
        cantidad: parseInt(cantidad),
        subtotal: nuevoSubtotal
      },
      include: { productoBuffet: true }
    });

    await recalcularTotalesPedido(parseInt(id));

    res.json({ success: true, data: itemActualizado });
  } catch (error) {
    console.error('Error al modificar item:', error);
    res.status(500).json({ success: false, error: 'Error al modificar item' });
  }
});

// Anular item
router.delete('/takeaway/:id/items/:itemId', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id, itemId } = req.params;

    const item = await prisma.itemPedidoTakeAway.findUnique({
      where: { id: parseInt(itemId) }
    });

    if (!item || item.pedidoId !== parseInt(id)) {
      return res.status(404).json({ success: false, error: 'Item no encontrado' });
    }

    if (item.estado === 'ENTREGADO') {
      return res.status(400).json({ success: false, error: 'No se pueden anular items entregados' });
    }

    await prisma.itemPedidoTakeAway.update({
      where: { id: parseInt(itemId) },
      data: { estado: 'ANULADO' }
    });

    await recalcularTotalesPedido(parseInt(id));

    res.json({ success: true, message: 'Item anulado' });
  } catch (error) {
    console.error('Error al anular item:', error);
    res.status(500).json({ success: false, error: 'Error al anular item' });
  }
});

// Marcar item de takeaway como entregado
router.post('/takeaway/:id/items/:itemId/entregar', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id, itemId } = req.params;

    const item = await prisma.itemPedidoTakeAway.findUnique({
      where: { id: parseInt(itemId) },
      include: { pedido: true }
    });

    if (!item || item.pedidoId !== parseInt(id)) {
      return res.status(404).json({ success: false, error: 'Item no encontrado' });
    }

    if (item.estado === 'ANULADO') {
      return res.status(400).json({ success: false, error: 'No se pueden entregar items anulados' });
    }

    if (item.estado === 'ENTREGADO') {
      return res.status(400).json({ success: false, error: 'El item ya fue entregado' });
    }

    const itemActualizado = await prisma.itemPedidoTakeAway.update({
      where: { id: parseInt(itemId) },
      data: {
        estado: 'ENTREGADO',
        entregadoAt: new Date()
      },
      include: { productoBuffet: true }
    });

    res.json({ success: true, data: itemActualizado });
  } catch (error) {
    console.error('Error al marcar item como entregado:', error);
    res.status(500).json({ success: false, error: 'Error al marcar item como entregado' });
  }
});

// Enviar a cocina (take away)
router.post('/takeaway/:id/enviar-cocina', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params;

    const pedido = await prisma.pedidoTakeAway.findUnique({
      where: { id: parseInt(id) },
      include: { items: { where: { estado: 'PENDIENTE' } } }
    });

    if (!pedido) {
      return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
    }

    if (pedido.items.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay items pendientes' });
    }

    await prisma.itemPedidoTakeAway.updateMany({
      where: { pedidoId: parseInt(id), estado: 'PENDIENTE' },
      data: { estado: 'EN_PREPARACION' }
    });

    await prisma.pedidoTakeAway.update({
      where: { id: parseInt(id) },
      data: { estado: 'EN_PREPARACION' }
    });

    res.json({ success: true, message: 'Pedido enviado a cocina' });
  } catch (error) {
    console.error('Error al enviar a cocina:', error);
    res.status(500).json({ success: false, error: 'Error al enviar a cocina' });
  }
});

// Marcar listo (take away)
router.put('/takeaway/:id/listo', authAdmin, checkPermiso('BUFFET_COCINA'), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.itemPedidoTakeAway.updateMany({
      where: { pedidoId: parseInt(id), estado: 'EN_PREPARACION' },
      data: { estado: 'LISTO' }
    });

    const pedido = await prisma.pedidoTakeAway.update({
      where: { id: parseInt(id) },
      data: { estado: 'LISTO', horaListo: new Date() }
    });

    res.json({ success: true, data: pedido });
  } catch (error) {
    console.error('Error al marcar listo:', error);
    res.status(500).json({ success: false, error: 'Error al marcar listo' });
  }
});

// Cobrar pedido (take away)
router.post('/takeaway/:id/cobrar', authAdmin, checkPermiso('BUFFET_COBRAR'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      medioPagoId,
      cajaId,
      observaciones,
      propina,
      pagosParciales,
      // Parámetros de facturación
      emitirFactura,
      esVentaInterna,
      tipoComprobante,
      datosCliente
    } = req.body;

    const pedido = await prisma.pedidoTakeAway.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: { include: { producto: true } }
      }
    });

    if (!pedido) {
      return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
    }

    if (pedido.estado === 'PAGADO') {
      return res.status(400).json({ success: false, error: 'El pedido ya fue cobrado' });
    }

    if (pedido.estado === 'ENTREGADO') {
      return res.status(400).json({ success: false, error: 'El pedido ya fue entregado' });
    }

    if (pedido.estado === 'CANCELADO') {
      return res.status(400).json({ success: false, error: 'No se puede cobrar un pedido cancelado' });
    }

    // Calcular total con propina
    const propinaMonto = propina && propina > 0 ? parseFloat(propina) : 0;
    const totalFinal = Number(pedido.total) + propinaMonto;

    // Obtener cuenta contable
    let cuentaContable = await prisma.cuentaContable.findFirst({
      where: { codigo: { contains: 'BUFFET' }, esImputable: true }
    });

    if (!cuentaContable) {
      cuentaContable = await prisma.cuentaContable.findFirst({
        where: { codigo: '4.1.1.01', esImputable: true }
      });
    }

    // Obtener centro de costo
    const centroCosto = await prisma.centroCosto.findFirst({
      where: { codigo: 'BUFFET' }
    });

    // Determinar si es pago múltiple o simple
    const usaPagosMultiples = pagosParciales && Array.isArray(pagosParciales) && pagosParciales.length > 0;
    const movimientos = [];

    if (usaPagosMultiples) {
      // PAGOS MÚLTIPLES: Validar que la suma coincida con el total
      const totalPagos = pagosParciales.reduce((sum, pago) => sum + parseFloat(pago.monto), 0);

      if (Math.abs(totalPagos - totalFinal) > 0.01) {
        return res.status(400).json({
          success: false,
          error: `La suma de pagos (${totalPagos}) no coincide con el total (${totalFinal})`
        });
      }

      // Crear un movimiento de caja por cada pago
      for (const pago of pagosParciales) {
        const medioPago = await prisma.medioPago.findUnique({ where: { id: parseInt(pago.medioPagoId) } });
        if (!medioPago) {
          return res.status(400).json({ success: false, error: `Medio de pago ${pago.medioPagoId} no encontrado` });
        }

        const caja = await prisma.caja.findUnique({ where: { id: parseInt(pago.cajaId || cajaId) } });
        if (!caja) {
          return res.status(400).json({ success: false, error: `Caja ${pago.cajaId || cajaId} no encontrada` });
        }

        // Generar número de movimiento
        const ultimoMov = await prisma.movimientoCaja.findFirst({
          orderBy: { id: 'desc' }
        });
        const nuevoNumero = `MOV-${String((ultimoMov?.id || 0) + 1).padStart(8, '0')}`;

        const movimiento = await prisma.movimientoCaja.create({
          data: {
            numero: nuevoNumero,
            cajaId: parseInt(pago.cajaId || cajaId),
            tipo: 'INGRESO',
            cuentaContableId: cuentaContable?.id || 1,
            centroCostoId: centroCosto?.id,
            monto: parseFloat(pago.monto),
            concepto: `Take Away - Pedido ${pedido.numero} - ${medioPago.nombre}${propinaMonto > 0 ? ` + Propina` : ''}`,
            descripcion: observaciones,
            pedidoTakeAwayId: parseInt(id),
            registradoPor: req.admin.id
          }
        });

        movimientos.push(movimiento);
      }
    } else {
      // PAGO SIMPLE: Un solo medio de pago
      const medioPago = await prisma.medioPago.findUnique({ where: { id: medioPagoId } });
      if (!medioPago) {
        return res.status(400).json({ success: false, error: 'Medio de pago no encontrado' });
      }

      const caja = await prisma.caja.findUnique({ where: { id: cajaId } });
      if (!caja) {
        return res.status(400).json({ success: false, error: 'Caja no encontrada' });
      }

      // Generar número de movimiento
      const ultimoMov = await prisma.movimientoCaja.findFirst({
        orderBy: { id: 'desc' }
      });
      const nuevoNumero = `MOV-${String((ultimoMov?.id || 0) + 1).padStart(8, '0')}`;

      const movimiento = await prisma.movimientoCaja.create({
        data: {
          numero: nuevoNumero,
          cajaId,
          tipo: 'INGRESO',
          cuentaContableId: cuentaContable?.id || 1,
          centroCostoId: centroCosto?.id,
          monto: totalFinal,
          concepto: `Take Away - Pedido ${pedido.numero}${propinaMonto > 0 ? ` + Propina` : ''}`,
          descripcion: observaciones,
          pedidoTakeAwayId: parseInt(id),
          registradoPor: req.admin.id
        }
      });

      movimientos.push(movimiento);
    }

    // Actualizar pedido a PAGADO (no ENTREGADO)
    const pedidoActualizado = await prisma.pedidoTakeAway.update({
      where: { id: parseInt(id) },
      data: {
        estado: 'PAGADO',
        propina: propinaMonto,
        total: totalFinal,
        horaPagado: new Date(),
        esVentaInterna: esVentaInterna || false
      }
    });

    // Variables para facturación
    let comprobanteFiscal = null;
    let ticketBase64 = null;
    let qrUrl = null;

    // Emitir factura o ticket según corresponda
    if (emitirFactura && !esVentaInterna) {
      try {
        const { requestCAE, getLastAuthorizedNumber } = await import('../services/afipWSFEService.js');
        const { getConfiguracionFiscal } = await import('../services/afipWSAAService.js');
        const { generateQRData } = await import('../services/afipQRService.js');
        const { renderTicketFiscal, toBase64 } = await import('../services/ticketService.js');

        const config = await getConfiguracionFiscal();
        const cajaUsada = await prisma.caja.findUnique({ where: { id: cajaId || movimientos[0]?.cajaId } });
        const puntoVenta = cajaUsada?.puntoVentaAfip || 1;
        const tipoAfip = tipoComprobante || 11;

        const ultimoNumero = await getLastAuthorizedNumber(puntoVenta, tipoAfip);
        const numeroComprobante = ultimoNumero + 1;

        const itemsFactura = pedido.items.map(item => ({
          descripcion: item.productoBuffet?.nombre || 'Producto',
          cantidad: item.cantidad,
          precioUnitario: parseFloat(item.precioUnitario),
          subtotal: parseFloat(item.subtotal),
          ivaRate: 21,
          ivaAmount: tipoAfip === 11 ? 0 : (parseFloat(item.subtotal) * 21) / 121
        }));

        const subtotalNeto = tipoAfip === 11 ? totalFinal : itemsFactura.reduce((sum, i) => sum + (i.subtotal - i.ivaAmount), 0);
        const ivaTotal = tipoAfip === 11 ? 0 : itemsFactura.reduce((sum, i) => sum + i.ivaAmount, 0);

        const resultadoCAE = await requestCAE({
          puntoVenta,
          tipoComprobante: tipoAfip,
          numeroComprobante,
          fecha: new Date(),
          tipoDocCliente: datosCliente?.tipoDoc || 99,
          docCliente: datosCliente?.documento || '',
          condicionIvaCliente: datosCliente?.condicionIva || 5,
          subtotal: subtotalNeto,
          iva: ivaTotal,
          total: totalFinal,
          items: itemsFactura
        });

        const tiposNombre = { 1: 'FACTURA A', 6: 'FACTURA B', 11: 'FACTURA C' };

        comprobanteFiscal = await prisma.comprobanteElectronico.create({
          data: {
            tipo: tiposNombre[tipoAfip] || 'FACTURA C',
            tipoAfip,
            puntoVenta,
            numero: numeroComprobante,
            fecha: new Date(),
            cae: resultadoCAE.cae,
            fechaVtoCae: resultadoCAE.caeExpiration,
            nombreReceptor: datosCliente?.nombre || 'Consumidor Final',
            subtotal: subtotalNeto,
            iva21: ivaTotal,
            iva105: 0,
            total: totalFinal,
            metodoPago: 'VARIOS',
            pedidoTakeAwayId: parseInt(id),
            cajaId: cajaId || movimientos[0]?.cajaId,
            creadoPorId: req.admin.id,
            estado: 'EMITIDO'
          }
        });

        qrUrl = generateQRData({
          cuit: config.cuit,
          tipoComprobante: tipoAfip,
          puntoVenta,
          numeroComprobante,
          importe: totalFinal,
          fecha: new Date(),
          tipoDocCliente: datosCliente?.tipoDoc || 99,
          docCliente: datosCliente?.documento || '',
          cae: resultadoCAE.cae
        });

        const ticketData = renderTicketFiscal({
          empresa: { razonSocial: config.razonSocial, domicilio: config.domicilioFiscal, cuit: config.cuit, condicionIva: config.condicionIva },
          comprobante: { tipo: tiposNombre[tipoAfip], tipoAfip, puntoVenta, numero: numeroComprobante, fecha: new Date(), cae: resultadoCAE.cae, fechaVtoCae: resultadoCAE.caeExpiration, cuit: config.cuit, nombreCliente: datosCliente?.nombre || 'Consumidor Final', total: totalFinal },
          comanda: pedidoActualizado,
          items: itemsFactura
        });
        ticketBase64 = toBase64(ticketData);

        console.log(`[TakeAway] Factura emitida: ${tiposNombre[tipoAfip]} ${puntoVenta}-${numeroComprobante}`);
      } catch (facError) {
        console.error('Error emitiendo factura takeaway:', facError);
      }
    } else {
      // Ticket no fiscal
      try {
        const { renderTicketNoFiscal, toBase64 } = await import('../services/ticketService.js');
        const itemsTicket = pedido.items.map(item => ({
          nombre: item.productoBuffet?.nombre || 'Producto',
          cantidad: item.cantidad,
          precioUnitario: parseFloat(item.precioUnitario),
          subtotal: parseFloat(item.subtotal)
        }));

        const ticketData = renderTicketNoFiscal({
          empresa: { razonSocial: 'CLUB SPORTIVO PILAR' },
          comanda: { ...pedidoActualizado, origen: 'TAKEAWAY', metodoPago: 'VARIOS' },
          items: itemsTicket
        });
        ticketBase64 = toBase64(ticketData);
      } catch (ticketError) {
        console.error('Error generando ticket takeaway:', ticketError);
      }
    }

    res.json({
      success: true,
      data: {
        pedido: pedidoActualizado,
        movimientos,
        propinaAplicada: propinaMonto > 0 ? propinaMonto : null,
        comprobante: comprobanteFiscal,
        ticket: ticketBase64,
        qrUrl
      }
    });
  } catch (error) {
    console.error('Error al cobrar pedido:', error);
    res.status(500).json({ success: false, error: 'Error al cobrar pedido' });
  }
});

// Marcar pedido como entregado
router.post('/takeaway/:id/entregar', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params;

    const pedido = await prisma.pedidoTakeAway.findUnique({
      where: { id: parseInt(id) },
      include: { items: true }
    });

    if (!pedido) {
      return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
    }

    if (pedido.estado === 'ENTREGADO') {
      return res.status(400).json({ success: false, error: 'El pedido ya fue entregado' });
    }

    if (pedido.estado !== 'PAGADO') {
      return res.status(400).json({ success: false, error: 'Solo se pueden entregar pedidos pagados' });
    }

    const pedidoActualizado = await prisma.pedidoTakeAway.update({
      where: { id: parseInt(id) },
      data: {
        estado: 'ENTREGADO',
        horaEntregado: new Date()
      }
    });

    res.json({ success: true, data: pedidoActualizado });
  } catch (error) {
    console.error('Error al marcar como entregado:', error);
    res.status(500).json({ success: false, error: 'Error al marcar como entregado' });
  }
});

// ============================================================================
// KIOSCO (Venta Rápida)
// ============================================================================

// Venta directa kiosco
router.post('/kiosco/venta', authAdmin, checkPermiso('BUFFET_KIOSCO'), async (req, res) => {
  try {
    const {
      items,
      medioPagoId,
      cajaId,
      socioId,
      observaciones,
      propina,
      pagosParciales,
      // Parámetros de facturación
      emitirFactura,
      esVentaInterna,
      tipoComprobante,
      datosCliente
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Debe agregar al menos un producto' });
    }

    // Calcular total de items y guardar productos para facturación
    let totalItems = 0;
    const detalleItems = [];
    const productosVenta = []; // Para facturación

    for (const item of items) {
      const producto = await prisma.productoBuffet.findUnique({ where: { id: item.productoBuffetId } });
      if (!producto) continue;

      const cantidad = item.cantidad || 1;
      const subtotal = Number(producto.precio) * cantidad;
      totalItems += subtotal;
      detalleItems.push(`${cantidad}x ${producto.nombre}`);

      productosVenta.push({
        nombre: producto.nombre,
        cantidad,
        precioUnitario: Number(producto.precio),
        subtotal
      });
    }

    // Calcular total con propina
    const propinaMonto = propina && propina > 0 ? parseFloat(propina) : 0;
    const totalFinal = totalItems + propinaMonto;

    // Obtener cuenta contable
    let cuentaContable = await prisma.cuentaContable.findFirst({
      where: { codigo: { contains: 'BUFFET' }, esImputable: true }
    });

    if (!cuentaContable) {
      cuentaContable = await prisma.cuentaContable.findFirst({
        where: { codigo: '4.1.1.01', esImputable: true }
      });
    }

    // Obtener centro de costo
    const centroCosto = await prisma.centroCosto.findFirst({
      where: { codigo: 'BUFFET' }
    });

    // Determinar si es pago múltiple o simple
    const usaPagosMultiples = pagosParciales && Array.isArray(pagosParciales) && pagosParciales.length > 0;
    const movimientos = [];

    if (usaPagosMultiples) {
      // PAGOS MÚLTIPLES: Validar que la suma coincida con el total
      const totalPagos = pagosParciales.reduce((sum, pago) => sum + parseFloat(pago.monto), 0);

      if (Math.abs(totalPagos - totalFinal) > 0.01) {
        return res.status(400).json({
          success: false,
          error: `La suma de pagos (${totalPagos}) no coincide con el total (${totalFinal})`
        });
      }

      // Crear un movimiento de caja por cada pago
      for (const pago of pagosParciales) {
        const medioPago = await prisma.medioPago.findUnique({ where: { id: parseInt(pago.medioPagoId) } });
        if (!medioPago) {
          return res.status(400).json({ success: false, error: `Medio de pago ${pago.medioPagoId} no encontrado` });
        }

        const caja = await prisma.caja.findUnique({ where: { id: parseInt(pago.cajaId || cajaId) } });
        if (!caja) {
          return res.status(400).json({ success: false, error: `Caja ${pago.cajaId || cajaId} no encontrada` });
        }

        // Generar número de movimiento
        const ultimoMov = await prisma.movimientoCaja.findFirst({
          orderBy: { id: 'desc' }
        });
        const nuevoNumero = `MOV-${String((ultimoMov?.id || 0) + 1).padStart(8, '0')}`;

        const movimiento = await prisma.movimientoCaja.create({
          data: {
            numero: nuevoNumero,
            cajaId: parseInt(pago.cajaId || cajaId),
            tipo: 'INGRESO',
            cuentaContableId: cuentaContable?.id || 1,
            centroCostoId: centroCosto?.id,
            monto: parseFloat(pago.monto),
            concepto: `Kiosco - ${detalleItems.join(', ')} - ${medioPago.nombre}${propinaMonto > 0 ? ` + Propina` : ''}`,
            descripcion: observaciones,
            registradoPor: req.admin.id
          }
        });

        movimientos.push(movimiento);
      }
    } else {
      // PAGO SIMPLE: Un solo medio de pago
      const medioPago = await prisma.medioPago.findUnique({ where: { id: medioPagoId } });
      if (!medioPago) {
        return res.status(400).json({ success: false, error: 'Medio de pago no encontrado' });
      }

      const caja = await prisma.caja.findUnique({ where: { id: cajaId } });
      if (!caja) {
        return res.status(400).json({ success: false, error: 'Caja no encontrada' });
      }

      // Generar número de movimiento
      const ultimoMov = await prisma.movimientoCaja.findFirst({
        orderBy: { id: 'desc' }
      });
      const nuevoNumero = `MOV-${String((ultimoMov?.id || 0) + 1).padStart(8, '0')}`;

      const movimiento = await prisma.movimientoCaja.create({
        data: {
          numero: nuevoNumero,
          cajaId,
          tipo: 'INGRESO',
          cuentaContableId: cuentaContable?.id || 1,
          centroCostoId: centroCosto?.id,
          monto: totalFinal,
          concepto: `Kiosco - ${detalleItems.join(', ')}${propinaMonto > 0 ? ` + Propina` : ''}`,
          descripcion: observaciones,
          registradoPor: req.admin.id
        }
      });

      movimientos.push(movimiento);
    }

    // Variables para facturación
    let comprobanteFiscal = null;
    let ticketBase64 = null;
    let qrUrl = null;

    // Emitir factura o ticket según corresponda
    if (emitirFactura && !esVentaInterna) {
      try {
        const { requestCAE, getLastAuthorizedNumber } = await import('../services/afipWSFEService.js');
        const { getConfiguracionFiscal } = await import('../services/afipWSAAService.js');
        const { generateQRData } = await import('../services/afipQRService.js');
        const { renderTicketFiscal, toBase64 } = await import('../services/ticketService.js');

        const config = await getConfiguracionFiscal();
        const cajaUsada = await prisma.caja.findUnique({ where: { id: cajaId || movimientos[0]?.cajaId } });
        const puntoVenta = cajaUsada?.puntoVentaAfip || 1;
        const tipoAfip = tipoComprobante || 11;

        const ultimoNumero = await getLastAuthorizedNumber(puntoVenta, tipoAfip);
        const numeroComprobante = ultimoNumero + 1;

        const itemsFactura = productosVenta.map(item => ({
          descripcion: item.nombre,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          subtotal: item.subtotal,
          ivaRate: 21,
          ivaAmount: tipoAfip === 11 ? 0 : (item.subtotal * 21) / 121
        }));

        const subtotalNeto = tipoAfip === 11 ? totalFinal : itemsFactura.reduce((sum, i) => sum + (i.subtotal - i.ivaAmount), 0);
        const ivaTotal = tipoAfip === 11 ? 0 : itemsFactura.reduce((sum, i) => sum + i.ivaAmount, 0);

        const resultadoCAE = await requestCAE({
          puntoVenta,
          tipoComprobante: tipoAfip,
          numeroComprobante,
          fecha: new Date(),
          tipoDocCliente: datosCliente?.tipoDoc || 99,
          docCliente: datosCliente?.documento || '',
          condicionIvaCliente: datosCliente?.condicionIva || 5,
          subtotal: subtotalNeto,
          iva: ivaTotal,
          total: totalFinal,
          items: itemsFactura
        });

        const tiposNombre = { 1: 'FACTURA A', 6: 'FACTURA B', 11: 'FACTURA C' };

        comprobanteFiscal = await prisma.comprobanteElectronico.create({
          data: {
            tipo: tiposNombre[tipoAfip] || 'FACTURA C',
            tipoAfip,
            puntoVenta,
            numero: numeroComprobante,
            fecha: new Date(),
            cae: resultadoCAE.cae,
            fechaVtoCae: resultadoCAE.caeExpiration,
            nombreReceptor: datosCliente?.nombre || 'Consumidor Final',
            subtotal: subtotalNeto,
            iva21: ivaTotal,
            iva105: 0,
            total: totalFinal,
            metodoPago: 'VARIOS',
            cajaId: cajaId || movimientos[0]?.cajaId,
            creadoPorId: req.admin.id,
            estado: 'EMITIDO'
          }
        });

        qrUrl = generateQRData({
          cuit: config.cuit,
          tipoComprobante: tipoAfip,
          puntoVenta,
          numeroComprobante,
          importe: totalFinal,
          fecha: new Date(),
          tipoDocCliente: datosCliente?.tipoDoc || 99,
          docCliente: datosCliente?.documento || '',
          cae: resultadoCAE.cae
        });

        const ticketData = renderTicketFiscal({
          empresa: { razonSocial: config.razonSocial, domicilio: config.domicilioFiscal, cuit: config.cuit, condicionIva: config.condicionIva },
          comprobante: { tipo: tiposNombre[tipoAfip], tipoAfip, puntoVenta, numero: numeroComprobante, fecha: new Date(), cae: resultadoCAE.cae, fechaVtoCae: resultadoCAE.caeExpiration, cuit: config.cuit, nombreCliente: datosCliente?.nombre || 'Consumidor Final', total: totalFinal },
          comanda: { numero: `K-${movimientos[0]?.id || Date.now()}` },
          items: itemsFactura
        });
        ticketBase64 = toBase64(ticketData);

        console.log(`[Kiosco] Factura emitida: ${tiposNombre[tipoAfip]} ${puntoVenta}-${numeroComprobante}`);
      } catch (facError) {
        console.error('Error emitiendo factura kiosco:', facError);
      }
    } else {
      // Ticket no fiscal
      try {
        const { renderTicketNoFiscal, toBase64 } = await import('../services/ticketService.js');

        const ticketData = renderTicketNoFiscal({
          empresa: { razonSocial: 'CLUB SPORTIVO PILAR' },
          comanda: { numero: `K-${movimientos[0]?.id || Date.now()}`, origen: 'KIOSCO', metodoPago: 'VARIOS', total: totalFinal },
          items: productosVenta
        });
        ticketBase64 = toBase64(ticketData);
      } catch (ticketError) {
        console.error('Error generando ticket kiosco:', ticketError);
      }
    }

    res.json({
      success: true,
      data: {
        movimientos,
        total: totalFinal,
        items: detalleItems,
        propinaAplicada: propinaMonto > 0 ? propinaMonto : null,
        comprobante: comprobanteFiscal,
        ticket: ticketBase64,
        qrUrl
      }
    });
  } catch (error) {
    console.error('Error en venta kiosco:', error);
    res.status(500).json({ success: false, error: 'Error en venta kiosco' });
  }
});

// ============================================================================
// KDS GENÉRICO (por tipo de impresora/sector)
// ============================================================================

// Items pendientes para un sector específico (por código o ID)
router.get('/kds/:sector/pendientes', authAdmin, async (req, res) => {
  try {
    const { sector } = req.params; // Código del sector (ej: COCINA) o ID numérico

    // Buscar el sector por código o ID
    const sectorId = parseInt(sector);
    const sectorData = await prisma.sectorBuffet.findFirst({
      where: isNaN(sectorId)
        ? { codigo: sector.toUpperCase(), activo: true }
        : { id: sectorId, activo: true }
    });

    if (!sectorData) {
      return res.json({ success: true, data: [] });
    }

    // Obtener IDs de categorías que van a impresoras de este sector
    const destinos = await prisma.destinoImpresion.findMany({
      where: {
        impresora: { sectorId: sectorData.id, activo: true }
      },
      select: { categoriaMenuId: true }
    });
    const categoriasIds = destinos.map(d => d.categoriaMenuId);

    if (categoriasIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Determinar estados según el sector
    let estadosPendientes = [];
    if (sectorData.codigo === 'BARRA') {
      estadosPendientes = ['ENVIADO_BARRA', 'EN_PREPARACION'];
    } else if (sectorData.codigo === 'COCINA') {
      estadosPendientes = ['ENVIADO_COCINA', 'EN_PREPARACION'];
    } else {
      // Para otros sectores, incluir ambos por si acaso
      estadosPendientes = ['ENVIADO_COCINA', 'ENVIADO_BARRA', 'EN_PREPARACION'];
    }

    // Items de comandas - solo los que van a este sector
    const itemsComanda = await prisma.itemComanda.findMany({
      where: {
        estado: { in: estadosPendientes },
        productoBuffet: {
          categoriaMenuId: { in: categoriasIds }
        }
      },
      include: {
        productoBuffet: { include: { categoriaMenu: true } },
        comanda: { include: { mesa: true } }
      },
      orderBy: { enviadoCocinaAt: 'asc' }
    });

    // Items de take away - solo los que van a este sector
    const itemsTakeAway = await prisma.itemPedidoTakeAway.findMany({
      where: {
        estado: { in: estadosPendientes },
        productoBuffet: {
          categoriaMenuId: { in: categoriasIds }
        }
      },
      include: {
        productoBuffet: { include: { categoriaMenu: true } },
        pedido: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // Formatear para KDS
    const pendientes = [
      ...itemsComanda.map(item => ({
        id: item.id,
        tipo: 'COMANDA',
        origen: `Mesa ${item.comanda.mesa.numero}`,
        origenId: item.comanda.id,
        producto: item.productoBuffet.nombre,
        categoria: item.productoBuffet.categoriaMenu?.nombre,
        cantidad: item.cantidad,
        observaciones: item.observaciones,
        estado: item.estado,
        horaEnvio: item.enviadoCocinaAt,
        tiempoEspera: item.enviadoCocinaAt ? Math.floor((new Date() - new Date(item.enviadoCocinaAt)) / 60000) : 0
      })),
      ...itemsTakeAway.map(item => ({
        id: item.id,
        tipo: 'TAKEAWAY',
        origen: `Take Away ${item.pedido.numero}`,
        origenId: item.pedido.id,
        producto: item.productoBuffet.nombre,
        categoria: item.productoBuffet.categoriaMenu?.nombre,
        cantidad: item.cantidad,
        observaciones: item.observaciones,
        estado: item.estado,
        horaEnvio: item.createdAt,
        tiempoEspera: Math.floor((new Date() - new Date(item.createdAt)) / 60000)
      }))
    ].sort((a, b) => new Date(a.horaEnvio) - new Date(b.horaEnvio));

    res.json({ success: true, data: pendientes });
  } catch (error) {
    console.error('Error al listar pendientes KDS:', error);
    res.status(500).json({ success: false, error: 'Error al listar pendientes' });
  }
});

// Marcar item en preparación (genérico)
router.put('/kds/items/:id/preparando', authAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo } = req.body;

    if (tipo === 'COMANDA') {
      await prisma.itemComanda.update({
        where: { id: parseInt(id) },
        data: { estado: 'EN_PREPARACION' }
      });
    } else {
      await prisma.itemPedidoTakeAway.update({
        where: { id: parseInt(id) },
        data: { estado: 'EN_PREPARACION' }
      });
    }

    res.json({ success: true, message: 'Item marcado en preparación' });
  } catch (error) {
    console.error('Error al marcar preparando:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar item' });
  }
});

// Marcar item listo (genérico)
router.put('/kds/items/:id/listo', authAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo } = req.body;

    if (tipo === 'COMANDA') {
      const item = await prisma.itemComanda.update({
        where: { id: parseInt(id) },
        data: { estado: 'LISTO', listoAt: new Date() },
        include: {
          productoBuffet: true,
          comanda: { include: { mesa: true } }
        }
      });

      // Notificar al mozo
      await notificarItemListo(item, item.comanda);
    } else {
      await prisma.itemPedidoTakeAway.update({
        where: { id: parseInt(id) },
        data: { estado: 'LISTO' }
      });
    }

    res.json({ success: true, message: 'Item marcado como listo' });
  } catch (error) {
    console.error('Error al marcar listo:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar item' });
  }
});

// Obtener sectores disponibles para KDS
router.get('/kds/sectores', authAdmin, async (req, res) => {
  try {
    const sectores = await prisma.sectorBuffet.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
      select: { id: true, codigo: true, nombre: true, icono: true, color: true }
    });

    res.json({ success: true, data: sectores });
  } catch (error) {
    console.error('Error al listar sectores:', error);
    res.status(500).json({ success: false, error: 'Error al listar sectores' });
  }
});

// ============================================================================
// COCINA (KDS) - Mantener por compatibilidad
// ============================================================================

// Items pendientes para cocina
router.get('/cocina/pendientes', authAdmin, checkPermiso('BUFFET_COCINA'), async (req, res) => {
  try {
    // Obtener IDs de categorías que van a COCINA
    const destinosCocina = await prisma.destinoImpresion.findMany({
      where: {
        impresora: { tipo: 'COCINA', activo: true }
      },
      select: { categoriaMenuId: true }
    });
    const categoriasCocinaIds = destinosCocina.map(d => d.categoriaMenuId);

    // Items de comandas - solo los que van a cocina
    const itemsComanda = await prisma.itemComanda.findMany({
      where: {
        estado: { in: ['ENVIADO_COCINA', 'EN_PREPARACION'] },
        productoBuffet: {
          categoriaMenuId: { in: categoriasCocinaIds }
        }
      },
      include: {
        productoBuffet: { include: { categoriaMenu: true } },
        comanda: { include: { mesa: true } }
      },
      orderBy: { enviadoCocinaAt: 'asc' }
    });

    // Items de take away - solo los que van a cocina
    const itemsTakeAway = await prisma.itemPedidoTakeAway.findMany({
      where: {
        estado: { in: ['EN_PREPARACION'] },
        productoBuffet: {
          categoriaMenuId: { in: categoriasCocinaIds }
        }
      },
      include: {
        productoBuffet: { include: { categoriaMenu: true } },
        pedido: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // Formatear para KDS
    const pendientes = [
      ...itemsComanda.map(item => ({
        id: item.id,
        tipo: 'COMANDA',
        origen: `Mesa ${item.comanda.mesa.numero}`,
        origenId: item.comanda.id,
        producto: item.productoBuffet.nombre,
        categoria: item.productoBuffet.categoriaMenu?.nombre,
        cantidad: item.cantidad,
        observaciones: item.observaciones,
        estado: item.estado,
        horaEnvio: item.enviadoCocinaAt,
        tiempoEspera: item.enviadoCocinaAt ? Math.floor((new Date() - new Date(item.enviadoCocinaAt)) / 60000) : 0
      })),
      ...itemsTakeAway.map(item => ({
        id: item.id,
        tipo: 'TAKEAWAY',
        origen: `Take Away ${item.pedido.numero}`,
        origenId: item.pedido.id,
        producto: item.productoBuffet.nombre,
        categoria: item.productoBuffet.categoriaMenu?.nombre,
        cantidad: item.cantidad,
        observaciones: item.observaciones,
        estado: item.estado,
        horaEnvio: item.createdAt,
        tiempoEspera: Math.floor((new Date() - new Date(item.createdAt)) / 60000)
      }))
    ].sort((a, b) => new Date(a.horaEnvio) - new Date(b.horaEnvio));

    res.json({ success: true, data: pendientes });
  } catch (error) {
    console.error('Error al listar pendientes cocina:', error);
    res.status(500).json({ success: false, error: 'Error al listar pendientes' });
  }
});

// Items pendientes para barra (bebidas)
router.get('/barra/pendientes', authAdmin, checkPermiso('BUFFET_BARRA'), async (req, res) => {
  try {
    // Obtener IDs de categorías que van a BARRA
    const destinosBarra = await prisma.destinoImpresion.findMany({
      where: {
        impresora: { tipo: 'BARRA', activo: true }
      },
      select: { categoriaMenuId: true }
    });
    const categoriasBarraIds = destinosBarra.map(d => d.categoriaMenuId);

    // Items de comandas - solo los que van a barra
    const itemsComanda = await prisma.itemComanda.findMany({
      where: {
        estado: { in: ['ENVIADO_COCINA', 'EN_PREPARACION'] },
        productoBuffet: {
          categoriaMenuId: { in: categoriasBarraIds }
        }
      },
      include: {
        productoBuffet: { include: { categoriaMenu: true } },
        comanda: { include: { mesa: true } }
      },
      orderBy: { enviadoCocinaAt: 'asc' }
    });

    // Items de take away - solo los que van a barra
    const itemsTakeAway = await prisma.itemPedidoTakeAway.findMany({
      where: {
        estado: { in: ['EN_PREPARACION'] },
        productoBuffet: {
          categoriaMenuId: { in: categoriasBarraIds }
        }
      },
      include: {
        productoBuffet: { include: { categoriaMenu: true } },
        pedido: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // Formatear para KDS
    const pendientes = [
      ...itemsComanda.map(item => ({
        id: item.id,
        tipo: 'COMANDA',
        origen: `Mesa ${item.comanda.mesa.numero}`,
        origenId: item.comanda.id,
        producto: item.productoBuffet.nombre,
        categoria: item.productoBuffet.categoriaMenu?.nombre,
        cantidad: item.cantidad,
        observaciones: item.observaciones,
        estado: item.estado,
        horaEnvio: item.enviadoCocinaAt,
        tiempoEspera: item.enviadoCocinaAt ? Math.floor((new Date() - new Date(item.enviadoCocinaAt)) / 60000) : 0
      })),
      ...itemsTakeAway.map(item => ({
        id: item.id,
        tipo: 'TAKEAWAY',
        origen: `Take Away ${item.pedido.numero}`,
        origenId: item.pedido.id,
        producto: item.productoBuffet.nombre,
        categoria: item.productoBuffet.categoriaMenu?.nombre,
        cantidad: item.cantidad,
        observaciones: item.observaciones,
        estado: item.estado,
        horaEnvio: item.createdAt,
        tiempoEspera: Math.floor((new Date() - new Date(item.createdAt)) / 60000)
      }))
    ].sort((a, b) => new Date(a.horaEnvio) - new Date(b.horaEnvio));

    res.json({ success: true, data: pendientes });
  } catch (error) {
    console.error('Error al listar pendientes barra:', error);
    res.status(500).json({ success: false, error: 'Error al listar pendientes' });
  }
});

// Marcar item en preparación (barra)
router.put('/barra/items/:id/preparando', authAdmin, checkPermiso('BUFFET_BARRA'), async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo } = req.body;

    if (tipo === 'COMANDA') {
      await prisma.itemComanda.update({
        where: { id: parseInt(id) },
        data: { estado: 'EN_PREPARACION' }
      });
    } else {
      await prisma.itemPedidoTakeAway.update({
        where: { id: parseInt(id) },
        data: { estado: 'EN_PREPARACION' }
      });
    }

    res.json({ success: true, message: 'Item marcado en preparación' });
  } catch (error) {
    console.error('Error al marcar preparando:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar item' });
  }
});

// Marcar item listo (barra)
router.put('/barra/items/:id/listo', authAdmin, checkPermiso('BUFFET_BARRA'), async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo } = req.body;

    if (tipo === 'COMANDA') {
      const item = await prisma.itemComanda.update({
        where: { id: parseInt(id) },
        data: { estado: 'LISTO', listoAt: new Date() },
        include: {
          productoBuffet: true,
          comanda: { include: { mesa: true } }
        }
      });

      // Notificar al mozo
      await notificarItemListo(item, item.comanda);
    } else {
      await prisma.itemPedidoTakeAway.update({
        where: { id: parseInt(id) },
        data: { estado: 'LISTO' }
      });
    }

    res.json({ success: true, message: 'Item marcado como listo' });
  } catch (error) {
    console.error('Error al marcar listo:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar item' });
  }
});

// Marcar item en preparación
router.put('/cocina/items/:id/preparando', authAdmin, checkPermiso('BUFFET_COCINA'), async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo } = req.body; // 'COMANDA' o 'TAKEAWAY'

    if (tipo === 'COMANDA') {
      await prisma.itemComanda.update({
        where: { id: parseInt(id) },
        data: { estado: 'EN_PREPARACION' }
      });
    } else {
      await prisma.itemPedidoTakeAway.update({
        where: { id: parseInt(id) },
        data: { estado: 'EN_PREPARACION' }
      });
    }

    res.json({ success: true, message: 'Item marcado en preparación' });
  } catch (error) {
    console.error('Error al marcar preparando:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar item' });
  }
});

// Marcar item listo
router.put('/cocina/items/:id/listo', authAdmin, checkPermiso('BUFFET_COCINA'), async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo } = req.body;

    if (tipo === 'COMANDA') {
      const item = await prisma.itemComanda.update({
        where: { id: parseInt(id) },
        data: { estado: 'LISTO', listoAt: new Date() },
        include: {
          productoBuffet: true,
          comanda: {
            include: { mesa: true, items: true }
          }
        }
      });

      // Notificar al mozo que el item está listo
      notificarItemListo(item, item.comanda).catch(err =>
        console.error('Error notificando item listo:', err)
      );

      // Verificar si todos los items de la comanda están listos o entregados
      // Excluimos el item actual (que ya sabemos está LISTO) y verificamos los demás
      const otrosItemsPendientes = item.comanda.items.filter(i =>
        i.id !== item.id && !['LISTO', 'ENTREGADO', 'ANULADO'].includes(i.estado)
      );

      // Si no hay otros items pendientes, actualizar estado de comanda a ABIERTA
      if (otrosItemsPendientes.length === 0 && item.comanda.estado === 'EN_PREPARACION') {
        await prisma.comanda.update({
          where: { id: item.comanda.id },
          data: { estado: 'ABIERTA' }
        });
      }
    } else {
      await prisma.itemPedidoTakeAway.update({
        where: { id: parseInt(id) },
        data: { estado: 'LISTO' }
      });
      // TODO: Notificar take away listo
    }

    res.json({ success: true, message: 'Item marcado como listo' });
  } catch (error) {
    console.error('Error al marcar listo:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar item' });
  }
});

// ============================================================================
// DASHBOARD
// ============================================================================

// KPIs del buffet
router.get('/dashboard', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    // Mesas
    const mesasTotal = await prisma.mesa.count({ where: { activo: true } });
    const mesasOcupadas = await prisma.mesa.count({ where: { activo: true, estado: 'OCUPADA' } });

    // Comandas del día
    const comandasActivas = await prisma.comanda.count({
      where: { estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] } }
    });

    const comandasCerradas = await prisma.comanda.count({
      where: {
        estado: 'CERRADA',
        horaCierre: { gte: hoy, lt: manana }
      }
    });

    // Take away del día
    const takeAwayPendientes = await prisma.pedidoTakeAway.count({
      where: { estado: { in: ['RECIBIDO', 'EN_PREPARACION', 'LISTO'] } }
    });

    const takeAwayEntregados = await prisma.pedidoTakeAway.count({
      where: {
        estado: 'ENTREGADO',
        horaEntregado: { gte: hoy, lt: manana }
      }
    });

    // Ventas del día
    const ventasBuffet = await prisma.movimientoCaja.aggregate({
      where: {
        OR: [
          { comandaId: { not: null } },
          { pedidoTakeAwayId: { not: null } },
          { concepto: { startsWith: 'Kiosco' } }
        ],
        fecha: { gte: hoy, lt: manana },
        anulado: false
      },
      _sum: { monto: true }
    });

    // Items pendientes cocina
    const itemsPendientesCocina = await prisma.itemComanda.count({
      where: { estado: { in: ['ENVIADO_COCINA', 'EN_PREPARACION'] } }
    });

    res.json({
      success: true,
      data: {
        mesas: {
          total: mesasTotal,
          ocupadas: mesasOcupadas,
          libres: mesasTotal - mesasOcupadas
        },
        comandas: {
          activas: comandasActivas,
          cerradasHoy: comandasCerradas
        },
        takeAway: {
          pendientes: takeAwayPendientes,
          entregadosHoy: takeAwayEntregados
        },
        cocina: {
          itemsPendientes: itemsPendientesCocina
        },
        ventas: {
          totalHoy: Number(ventasBuffet._sum.monto || 0)
        }
      }
    });
  } catch (error) {
    console.error('Error en dashboard:', error);
    res.status(500).json({ success: false, error: 'Error al cargar dashboard' });
  }
});

// ============================================================================
// MENÚ PÚBLICO (sin autenticación)
// ============================================================================

router.get('/menu-publico', async (req, res) => {
  try {
    const categorias = await prisma.categoriaMenu.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
      include: {
        productos: {
          where: { activo: true, disponible: true },
          orderBy: { orden: 'asc' },
          select: {
            id: true,
            nombre: true,
            descripcion: true,
            precio: true,
            imagen: true,
            destacado: true
          }
        }
      }
    });

    res.json({ success: true, data: categorias });
  } catch (error) {
    console.error('Error al obtener menú público:', error);
    res.status(500).json({ success: false, error: 'Error al obtener menú' });
  }
});

// ============================================================================
// NOTIFICACIONES
// ============================================================================

// Obtener notificaciones no vistas del usuario actual
router.get('/notificaciones', authAdmin, async (req, res) => {
  try {
    const adminId = req.admin.id;
    const permisos = req.admin.permisos || [];

    // Determinar destinos según permisos
    const destinos = [];
    if (permisos.includes('BUFFET_COCINA')) destinos.push('COCINA');
    if (permisos.includes('BUFFET_BARRA')) destinos.push('BARRA');
    if (permisos.includes('BUFFET_COBRAR')) destinos.push('CAJA');

    // Buscar notificaciones no vistas
    const notificaciones = await prisma.notificacionBuffet.findMany({
      where: {
        OR: [
          // Notificaciones para el usuario específico
          { paraUsuarioId: adminId },
          // Notificaciones para sus destinos
          { paraDestino: { in: destinos } },
          // Notificaciones generales (si tiene algún permiso de buffet)
          ...(permisos.some(p => p.startsWith('BUFFET_')) ? [{ paraUsuarioId: null, paraDestino: null }] : [])
        ],
        // Que no haya sido marcada como vista por este usuario
        vistas: {
          none: { adminId }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json({ success: true, data: notificaciones });
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({ success: false, error: 'Error al obtener notificaciones' });
  }
});

// Marcar notificación como vista
router.post('/notificaciones/:id/vista', authAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.admin.id;

    await prisma.notificacionVista.upsert({
      where: {
        notificacionId_adminId: {
          notificacionId: parseInt(id),
          adminId
        }
      },
      create: {
        notificacionId: parseInt(id),
        adminId
      },
      update: {}
    });

    res.json({ success: true, message: 'Notificación marcada como vista' });
  } catch (error) {
    console.error('Error al marcar notificación:', error);
    res.status(500).json({ success: false, error: 'Error al marcar notificación' });
  }
});

// Marcar todas las notificaciones como vistas
router.post('/notificaciones/marcar-todas', authAdmin, async (req, res) => {
  try {
    const adminId = req.admin.id;
    const permisos = req.admin.permisos || [];

    // Determinar destinos según permisos
    const destinos = [];
    if (permisos.includes('BUFFET_COCINA')) destinos.push('COCINA');
    if (permisos.includes('BUFFET_BARRA')) destinos.push('BARRA');
    if (permisos.includes('BUFFET_COBRAR')) destinos.push('CAJA');

    // Obtener notificaciones no vistas
    const notificaciones = await prisma.notificacionBuffet.findMany({
      where: {
        OR: [
          { paraUsuarioId: adminId },
          { paraDestino: { in: destinos } },
          ...(permisos.some(p => p.startsWith('BUFFET_')) ? [{ paraUsuarioId: null, paraDestino: null }] : [])
        ],
        vistas: {
          none: { adminId }
        }
      },
      select: { id: true }
    });

    // Marcar todas como vistas
    if (notificaciones.length > 0) {
      await prisma.notificacionVista.createMany({
        data: notificaciones.map(n => ({
          notificacionId: n.id,
          adminId
        })),
        skipDuplicates: true
      });
    }

    res.json({ success: true, message: `${notificaciones.length} notificaciones marcadas como vistas` });
  } catch (error) {
    console.error('Error al marcar notificaciones:', error);
    res.status(500).json({ success: false, error: 'Error al marcar notificaciones' });
  }
});

// Historial de notificaciones (últimas 100)
router.get('/notificaciones/historial', authAdmin, async (req, res) => {
  try {
    const adminId = req.admin.id;
    const permisos = req.admin.permisos || [];

    const destinos = [];
    if (permisos.includes('BUFFET_COCINA')) destinos.push('COCINA');
    if (permisos.includes('BUFFET_BARRA')) destinos.push('BARRA');
    if (permisos.includes('BUFFET_COBRAR')) destinos.push('CAJA');

    const notificaciones = await prisma.notificacionBuffet.findMany({
      where: {
        OR: [
          { paraUsuarioId: adminId },
          { paraDestino: { in: destinos } },
          ...(permisos.some(p => p.startsWith('BUFFET_')) ? [{ paraUsuarioId: null, paraDestino: null }] : [])
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        vistas: {
          where: { adminId },
          select: { vistaAt: true }
        }
      }
    });

    // Formatear respuesta
    const formateadas = notificaciones.map(n => ({
      ...n,
      vista: n.vistas.length > 0,
      vistaAt: n.vistas[0]?.vistaAt || null,
      vistas: undefined
    }));

    res.json({ success: true, data: formateadas });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ success: false, error: 'Error al obtener historial' });
  }
});

export default router;
