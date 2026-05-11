import { ACCIONES } from './aiAssistant.js'

/**
 * Action Executor Service
 *
 * Ejecuta las acciones identificadas por el AI Assistant
 * llamando a las APIs correspondientes de Clubix
 */

class ActionExecutor {
  constructor(prisma) {
    this.prisma = prisma
  }

  /**
   * Ejecuta una acción
   *
   * @param {Object} action - Acción del AI
   * @param {Object} context - Contexto del usuario
   * @returns {Promise<Object>} Resultado de la ejecución
   */
  async executeAction(action, context) {
    try {
      console.log(`\n🎬 [ActionExecutor] Ejecutando: ${action.accion}`)

      switch (action.accion) {
        // ========== ACCIONES DE SOCIOS ==========
        case ACCIONES.CONSULTAR_DEUDA:
          return await this.consultarDeuda(action.entidades, context)

        case ACCIONES.GENERAR_LINK_PAGO:
          return await this.generarLinkPago(action.entidades, context)

        case ACCIONES.LISTAR_ACTIVIDADES:
          return await this.listarActividades(action.entidades, context)

        case ACCIONES.INSCRIBIR_ACTIVIDAD:
          return await this.inscribirActividad(action.entidades, context)

        case ACCIONES.BAJA_ACTIVIDAD:
          return await this.bajaActividad(action.entidades, context)

        case ACCIONES.VER_GRUPO_FAMILIAR:
          return await this.verGrupoFamiliar(action.entidades, context)

        case ACCIONES.VER_CONVOCATORIAS:
          return await this.verConvocatorias(action.entidades, context)

        case ACCIONES.CONFIRMAR_CONVOCATORIA:
          return await this.confirmarConvocatoria(action.entidades, context)

        case ACCIONES.VER_MENU_BUFFET:
          return await this.verMenuBuffet(action.entidades, context)

        case ACCIONES.PEDIR_TAKEAWAY:
          return await this.pedirTakeaway(action.entidades, context)

        // ========== ACCIONES DE CAMAREROS ==========
        case ACCIONES.VER_MESAS:
          return await this.verMesas(action.entidades, context)

        case ACCIONES.ABRIR_MESA:
          return await this.abrirMesa(action.entidades, context)

        case ACCIONES.AGREGAR_ITEMS_MESA:
          return await this.agregarItemsMesa(action.entidades, context)

        case ACCIONES.VER_COMANDA_MESA:
          return await this.verComandaMesa(action.entidades, context)

        case ACCIONES.CERRAR_MESA:
          return await this.cerrarMesa(action.entidades, context)

        case ACCIONES.CANCELAR_ITEM:
          return await this.cancelarItem(action.entidades, context)

        case ACCIONES.VER_COMANDAS_PENDIENTES:
          return await this.verComandasPendientes(action.entidades, context)

        // ========== ACCIONES DE ADMIN ==========
        case ACCIONES.ESTADISTICAS_SOCIOS:
          return await this.estadisticasSocios(action.entidades, context)

        case ACCIONES.VENTAS_BUFFET:
          return await this.ventasBuffet(action.entidades, context)

        // ========== UNKNOWN ==========
        case ACCIONES.UNKNOWN:
        default:
          return {
            success: false,
            message: action.error || '🤔 No entendí bien qué necesitás. ¿Podés explicármelo de otra forma?',
            requiresUserAction: null
          }
      }

    } catch (error) {
      console.error('❌ Error ejecutando acción:', error)
      return {
        success: false,
        message: '😅 ¡Ups! Algo salió mal. ¿Podés intentar de nuevo?',
        error: error.message
      }
    }
  }

  // =============================================================================
  // ACCIONES DE SOCIOS
  // =============================================================================

  async consultarDeuda(entidades, context) {
    const socio = await this.getSocioFromContext(context)

    // Obtener cuenta corriente
    const incluirFamilia = entidades.incluirFamilia || false
    let socioIds = [socio.id]

    if (incluirFamilia && socio.miembrosFamilia?.length > 0) {
      socioIds = [socio.id, ...socio.miembrosFamilia.map(m => m.id)]
    }

    const cargos = await this.prisma.cargo.findMany({
      where: {
        socioId: { in: socioIds },
        estado: { in: ['PENDIENTE', 'VENCIDO'] }
      },
      include: {
        periodo: true,
        socio: { select: { nroSocio: true, apellidoNombre: true } }
      },
      orderBy: { fechaVencimiento: 'asc' }
    })

    const totalPendiente = cargos.reduce((sum, c) => sum + parseFloat(c.montoTotal || 0), 0)

    let mensaje = `💳 **Estado de Cuenta**\n\n`
    mensaje += `📊 **Resumen:**\n`
    mensaje += `• Cuotas pendientes: ${cargos.length}\n`
    mensaje += `• Total a pagar: $${totalPendiente.toLocaleString('es-AR')}\n\n`

    if (cargos.length > 0) {
      mensaje += `📋 **Detalle:**\n`
      cargos.slice(0, 5).forEach((cargo, i) => {
        const periodo = cargo.periodo ? `${cargo.periodo.nombre}/${cargo.periodo.anio}` : ''
        const vencido = cargo.fechaVencimiento && new Date(cargo.fechaVencimiento) < new Date()
        mensaje += `${i + 1}. ${cargo.descripcion || cargo.categoria}`
        if (periodo) mensaje += ` - ${periodo}`
        mensaje += `: $${parseFloat(cargo.montoTotal).toLocaleString('es-AR')}`
        if (vencido) mensaje += ` ⚠️ VENCIDA`
        if (incluirFamilia && cargo.socio) {
          mensaje += ` (${cargo.socio.apellidoNombre})`
        }
        mensaje += '\n'
      })

      if (cargos.length > 5) {
        mensaje += `... y ${cargos.length - 5} cuota(s) más\n`
      }

      mensaje += `\n¿Querés generar un link de pago?`
    } else {
      mensaje += `✅ ¡No tenés deuda! Estás al día con el club.`
    }

    return {
      success: true,
      message: mensaje,
      data: {
        cargos,
        totalPendiente,
        cantidadCuotas: cargos.length
      }
    }
  }

  async generarLinkPago(entidades, context) {
    const socio = await this.getSocioFromContext(context)

    // Determinar qué cuotas pagar
    let cuotasIds = entidades.cuotasIds

    if (cuotasIds === 'todas') {
      const cargos = await this.prisma.cargo.findMany({
        where: {
          socioId: socio.id,
          estado: { in: ['PENDIENTE', 'VENCIDO'] }
        },
        select: { id: true }
      })
      cuotasIds = cargos.map(c => c.id)
    }

    if (!cuotasIds || cuotasIds.length === 0) {
      return {
        success: false,
        message: '❌ No hay cuotas pendientes para pagar'
      }
    }

    // Obtener cargos
    const cargos = await this.prisma.cargo.findMany({
      where: {
        id: { in: cuotasIds },
        socioId: socio.id,
        estado: { in: ['PENDIENTE', 'VENCIDO'] }
      },
      include: { periodo: true }
    })

    if (cargos.length === 0) {
      return {
        success: false,
        message: '❌ No se encontraron cuotas pendientes'
      }
    }

    const montoTotal = cargos.reduce((sum, c) => sum + parseFloat(c.montoTotal), 0)

    // Crear link de pago
    const linkPago = await this.prisma.linkPago.create({
      data: {
        socioId: socio.id,
        concepto: `Pago de ${cargos.length} cuota(s)`,
        descripcion: cargos.map(c => c.descripcion || c.categoria).join(', '),
        montoTotal,
        cargosIds: JSON.stringify(cargos.map(c => c.id)),
        plataforma: entidades.metodoPago || 'MERCADOPAGO',
        estado: 'PENDIENTE',
        initPoint: '', // Se actualiza después
        fechaExpiracion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 días
      }
    })

    // Generar preferencia de MercadoPago
    const { crearPreferenciaPago } = await import('./mercadopago.js')
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

    const preferencia = await crearPreferenciaPago({
      title: `Pago de ${cargos.length} cuota(s)`,
      description: cargos.map(c => {
        const periodo = c.periodo ? `${c.periodo.nombre}/${c.periodo.anio}` : ''
        return `${c.descripcion || c.categoria}${periodo ? ' (' + periodo + ')' : ''}`
      }).join(', '),
      amount: montoTotal,
      quantity: 1,
      externalReference: linkPago.id.toString(),
      payer: {
        email: socio.email || 'socio@sportivo.com.ar',
        name: socio.apellidoNombre
      },
      notificationUrl: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/pagos/webhook/mercadopago`,
      successUrl: `${baseUrl}/portal-socio/${socio.tokenPortal}?pago=exito`,
      failureUrl: `${baseUrl}/portal-socio/${socio.tokenPortal}?pago=error`,
      pendingUrl: `${baseUrl}/portal-socio/${socio.tokenPortal}?pago=pendiente`
    })

    const initPoint = preferencia.init_point

    // Actualizar link de pago
    await this.prisma.linkPago.update({
      where: { id: linkPago.id },
      data: { initPoint }
    })

    let mensaje = `✅ **Link de pago generado**\n\n`
    mensaje += `💰 Monto total: $${montoTotal.toLocaleString('es-AR')}\n`
    mensaje += `📝 Concepto: ${cargos.length} cuota(s)\n\n`
    mensaje += `🔗 **[Pagar con MercadoPago](${initPoint})**\n\n`
    mensaje += `El link expira en 30 días.`

    return {
      success: true,
      message: mensaje,
      data: {
        linkPago: initPoint,
        linkPagoId: linkPago.id,
        montoTotal,
        cantidadCuotas: cargos.length
      },
      requiresUserAction: 'payment'
    }
  }

  async listarActividades(entidades, context) {
    const actividades = await this.prisma.categoriaActividad.findMany({
      where: { activo: true },
      include: {
        actividad: { select: { nombre: true, descripcion: true } },
        entrenadores: {
          include: {
            entrenador: { select: { entidad: { select: { razonSocial: true } } } }
          }
        },
        _count: {
          select: {
            inscripciones: { where: { estado: 'ACTIVA' } }
          }
        }
      },
      orderBy: [
        { actividad: { nombre: 'asc' } },
        { nombre: 'asc' }
      ]
    })

    let mensaje = `🏃 **Actividades Disponibles**\n\n`

    actividades.forEach((cat, i) => {
      mensaje += `${i + 1}. **${cat.actividad.nombre}** - ${cat.nombre}\n`
      if (cat.descripcion) mensaje += `   ${cat.descripcion}\n`
      if (cat.horarios) mensaje += `   ⏰ ${cat.horarios}\n`
      if (cat.cuotaMensual) mensaje += `   💰 $${cat.cuotaMensual.toLocaleString('es-AR')}/mes\n`
      if (cat.entrenadores[0]) mensaje += `   👨‍🏫 ${cat.entrenadores[0].entrenador.entidad?.razonSocial || ''}\n`

      const cuposDisponibles = cat.cupoMaximo ? cat.cupoMaximo - cat._count.inscripciones : null
      if (cuposDisponibles !== null) {
        mensaje += `   📊 ${cuposDisponibles} cupos disponibles\n`
      }
      mensaje += '\n'
    })

    return {
      success: true,
      message: mensaje,
      data: actividades
    }
  }

  async inscribirActividad(entidades, context) {
    const socio = await this.getSocioFromContext(context)

    // Buscar la actividad
    const categoria = await this.prisma.categoriaActividad.findFirst({
      where: {
        actividad: {
          nombre: { contains: entidades.actividad, mode: 'insensitive' }
        },
        ...(entidades.categoria ? { nombre: { contains: entidades.categoria, mode: 'insensitive' } } : {}),
        activo: true
      },
      include: {
        actividad: true,
        _count: {
          select: {
            inscripciones: { where: { estado: 'ACTIVA' } }
          }
        }
      }
    })

    if (!categoria) {
      return {
        success: false,
        message: `❌ No encontré la actividad "${entidades.actividad}". ¿Querés ver todas las actividades disponibles?`
      }
    }

    // Verificar cupos
    if (categoria.cupoMaximo && categoria._count.inscripciones >= categoria.cupoMaximo) {
      return {
        success: false,
        message: `❌ No hay cupos disponibles en ${categoria.actividad.nombre} - ${categoria.nombre}`
      }
    }

    // Verificar si ya está inscripto
    const inscripcionExistente = await this.prisma.inscripcion.findFirst({
      where: {
        socioId: socio.id,
        categoriaActividadId: categoria.id,
        estado: 'ACTIVA'
      }
    })

    if (inscripcionExistente) {
      return {
        success: false,
        message: `⚠️ Ya estás inscripto en ${categoria.actividad.nombre} - ${categoria.nombre}`
      }
    }

    // Crear inscripción
    const inscripcion = await this.prisma.inscripcion.create({
      data: {
        socioId: socio.id,
        categoriaActividadId: categoria.id,
        fechaInscripcion: new Date(),
        fechaInicio: new Date(),
        estado: 'ACTIVA'
      }
    })

    let mensaje = `✅ **¡Inscripción exitosa!**\n\n`
    mensaje += `🎉 Te inscribiste en **${categoria.actividad.nombre} - ${categoria.nombre}**\n\n`
    if (categoria.horarios) mensaje += `⏰ Horarios: ${categoria.horarios}\n`
    if (categoria.cuotaMensual) mensaje += `💰 Cuota mensual: $${categoria.cuotaMensual.toLocaleString('es-AR')}\n`
    mensaje += `\n¡Nos vemos en la cancha! 🏆`

    return {
      success: true,
      message: mensaje,
      data: inscripcion
    }
  }

  async bajaActividad(entidades, context) {
    // TODO: Implementar baja de actividad
    return {
      success: false,
      message: '🚧 Esta funcionalidad está en desarrollo'
    }
  }

  async verGrupoFamiliar(entidades, context) {
    const socio = await this.getSocioFromContext(context)

    let mensaje = `👨‍👩‍👧 **Grupo Familiar**\n\n`

    if (socio.titularFamiliaId) {
      // Es miembro de un grupo
      const titular = await this.prisma.socio.findUnique({
        where: { id: socio.titularFamiliaId },
        include: {
          miembrosFamilia: {
            where: { estado: { contains: 'ACTIV' } },
            select: {
              id: true,
              nroSocio: true,
              apellidoNombre: true,
              documento: true,
              fechaNacimiento: true
            }
          }
        }
      })

      mensaje += `**Titular:** ${titular.apellidoNombre} (${titular.nroSocio})\n\n`
      mensaje += `**Integrantes:**\n`
      titular.miembrosFamilia.forEach((m, i) => {
        mensaje += `${i + 1}. ${m.apellidoNombre} (${m.nroSocio})\n`
      })
    } else if (socio.miembrosFamilia?.length > 0) {
      // Es titular
      mensaje += `**Titular:** ${socio.apellidoNombre} (${socio.nroSocio})\n\n`
      mensaje += `**Integrantes:**\n`
      socio.miembrosFamilia.forEach((m, i) => {
        mensaje += `${i + 1}. ${m.apellidoNombre} (${m.nroSocio})\n`
      })
    } else {
      mensaje += `No tenés grupo familiar configurado.`
    }

    return {
      success: true,
      message: mensaje,
      data: socio
    }
  }

  async verConvocatorias(entidades, context) {
    const socio = await this.getSocioFromContext(context)

    const convocatorias = await this.prisma.convocatoria.findMany({
      where: {
        socioId: socio.id,
        partido: {
          fecha: { gte: new Date() }
        }
      },
      include: {
        partido: {
          include: {
            categoriaActividad: {
              include: {
                actividad: true
              }
            },
            espacio: true
          }
        }
      },
      orderBy: {
        partido: { fecha: 'asc' }
      }
    })

    if (convocatorias.length === 0) {
      return {
        success: true,
        message: '📅 No tenés convocatorias pendientes'
      }
    }

    let mensaje = `⚽ **Tus Convocatorias**\n\n`

    convocatorias.forEach((conv, i) => {
      const p = conv.partido
      const fecha = new Date(p.fecha).toLocaleDateString('es-AR')
      const estado = conv.confirmado === null ? '❓ Pendiente' : conv.confirmado ? '✅ Confirmado' : '❌ Rechazado'

      mensaje += `${i + 1}. **${p.categoriaActividad.actividad.nombre}**\n`
      mensaje += `   📅 ${fecha} ${p.hora}\n`
      mensaje += `   🏟️ ${p.equipoLocal} vs ${p.equipoVisitante}\n`
      mensaje += `   📍 ${p.espacio?.nombre || p.lugar}\n`
      mensaje += `   ${estado}\n\n`
    })

    return {
      success: true,
      message: mensaje,
      data: convocatorias
    }
  }

  async confirmarConvocatoria(entidades, context) {
    // TODO: Implementar confirmación de convocatoria
    return {
      success: false,
      message: '🚧 Esta funcionalidad está en desarrollo'
    }
  }

  async verMenuBuffet(entidades, context) {
    const productos = await this.prisma.productoBuffet.findMany({
      where: {
        activo: true,
        tiposVenta: { has: 'BUFFET' }
      },
      include: {
        categoria: true
      },
      orderBy: [
        { categoria: { orden: 'asc' } },
        { nombre: 'asc' }
      ]
    })

    let mensaje = `🍔 **Menú del Buffet**\n\n`

    const categorias = {}
    productos.forEach(p => {
      const catNombre = p.categoria?.nombre || 'Sin categoría'
      if (!categorias[catNombre]) {
        categorias[catNombre] = []
      }
      categorias[catNombre].push(p)
    })

    Object.keys(categorias).forEach(cat => {
      mensaje += `**${cat}**\n`
      categorias[cat].forEach(p => {
        mensaje += `• ${p.nombre} - $${p.precio.toLocaleString('es-AR')}\n`
        if (p.descripcion) mensaje += `  _${p.descripcion}_\n`
      })
      mensaje += '\n'
    })

    return {
      success: true,
      message: mensaje,
      data: productos
    }
  }

  async pedirTakeaway(entidades, context) {
    // TODO: Implementar pedido takeaway
    return {
      success: false,
      message: '🚧 Esta funcionalidad está en desarrollo'
    }
  }

  // =============================================================================
  // ACCIONES DE CAMAREROS
  // =============================================================================

  async verMesas(entidades, context) {
    const where = {}

    if (entidades.filtro === 'ocupadas') {
      where.estado = 'OCUPADA'
    } else if (entidades.filtro === 'libres') {
      where.estado = 'LIBRE'
    }

    if (entidades.zona) {
      where.zona = {
        nombre: { contains: entidades.zona, mode: 'insensitive' }
      }
    }

    const mesas = await this.prisma.mesa.findMany({
      where,
      include: {
        zona: true,
        comanda: {
          where: { estado: { in: ['PENDIENTE', 'EN_PREPARACION'] } },
          include: {
            items: {
              include: { producto: true }
              }
            }
        }
      },
      orderBy: [
        { zona: { nombre: 'asc' } },
        { numero: 'asc' }
      ]
    })

    let mensaje = `🍽️ **Estado de Mesas**\n\n`

    const zonas = {}
    mesas.forEach(m => {
      const zonaNombre = m.zona?.nombre || 'Sin zona'
      if (!zonas[zonaNombre]) {
        zonas[zonaNombre] = []
      }
      zonas[zonaNombre].push(m)
    })

    Object.keys(zonas).forEach(zona => {
      mensaje += `**${zona}:**\n`
      zonas[zona].forEach(m => {
        const icono = m.estado === 'OCUPADA' ? '🔴' : '🟢'
        mensaje += `${icono} Mesa ${m.numero}`
        if (m.comanda) {
          const total = m.comanda.items.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0)
          mensaje += ` - $${total.toLocaleString('es-AR')}`
        }
        mensaje += '\n'
      })
      mensaje += '\n'
    })

    return {
      success: true,
      message: mensaje,
      data: mesas
    }
  }

  async abrirMesa(entidades, context) {
    const mesa = await this.prisma.mesa.findFirst({
      where: { numero: entidades.mesaNumero }
    })

    if (!mesa) {
      return {
        success: false,
        message: `❌ No existe la mesa ${entidades.mesaNumero}`
      }
    }

    if (mesa.estado === 'OCUPADA') {
      return {
        success: false,
        message: `⚠️ La mesa ${entidades.mesaNumero} ya está ocupada`
      }
    }

    await this.prisma.mesa.update({
      where: { id: mesa.id },
      data: { estado: 'OCUPADA' }
    })

    let mensaje = `✅ **Mesa ${entidades.mesaNumero} abierta**\n\n`
    if (entidades.nombreCliente) {
      mensaje += `Cliente: ${entidades.nombreCliente}\n`
    }
    mensaje += `Podés agregar items ahora.`

    return {
      success: true,
      message: mensaje,
      data: { mesaId: mesa.id }
    }
  }

  async agregarItemsMesa(entidades, context) {
    const mesa = await this.prisma.mesa.findFirst({
      where: { numero: entidades.mesaNumero },
      include: { comanda: { where: { estado: { in: ['PENDIENTE', 'EN_PREPARACION'] } } } }
    })

    if (!mesa) {
      return {
        success: false,
        message: `❌ No existe la mesa ${entidades.mesaNumero}`
      }
    }

    // Buscar o crear comanda
    let comanda = mesa.comanda?.[0]

    if (!comanda) {
      comanda = await this.prisma.comanda.create({
        data: {
          mesaId: mesa.id,
          tipo: 'MESA',
          estado: 'PENDIENTE',
          fecha: new Date()
        }
      })

      // Activar mesa si estaba libre
      if (mesa.estado === 'LIBRE') {
        await this.prisma.mesa.update({
          where: { id: mesa.id },
          data: { estado: 'OCUPADA' }
        })
      }
    }

    // Agregar items
    const itemsCreados = []
    for (const item of entidades.items) {
      // Buscar producto
      const producto = await this.prisma.productoBuffet.findFirst({
        where: {
          nombre: { contains: item.producto, mode: 'insensitive' },
          activo: true
        }
      })

      if (!producto) {
        console.warn(`⚠️ Producto no encontrado: ${item.producto}`)
        continue
      }

      const itemCreado = await this.prisma.itemComanda.create({
        data: {
          comandaId: comanda.id,
          productoId: producto.id,
          cantidad: item.cantidad,
          precioUnitario: producto.precio,
          subtotal: producto.precio * item.cantidad,
          observaciones: item.observaciones,
          estado: 'PENDIENTE'
        },
        include: { producto: true }
      })

      itemsCreados.push(itemCreado)
    }

    // Actualizar total de comanda
    const totalComanda = await this.prisma.itemComanda.aggregate({
      where: { comandaId: comanda.id },
      _sum: { subtotal: true }
    })

    await this.prisma.comanda.update({
      where: { id: comanda.id },
      data: { total: totalComanda._sum.subtotal || 0 }
    })

    let mensaje = `✅ **Items agregados a Mesa ${entidades.mesaNumero}**\n\n`
    itemsCreados.forEach(item => {
      mensaje += `• ${item.cantidad}x ${item.producto.nombre} - $${item.subtotal.toLocaleString('es-AR')}\n`
      if (item.observaciones) mensaje += `  _${item.observaciones}_\n`
    })
    mensaje += `\n💰 Total mesa: $${(totalComanda._sum.subtotal || 0).toLocaleString('es-AR')}`

    return {
      success: true,
      message: mensaje,
      data: { comandaId: comanda.id, items: itemsCreados }
    }
  }

  async verComandaMesa(entidades, context) {
    const mesa = await this.prisma.mesa.findFirst({
      where: { numero: entidades.mesaNumero },
      include: {
        comanda: {
          where: { estado: { in: ['PENDIENTE', 'EN_PREPARACION', 'LISTA'] } },
          include: {
            items: {
              include: { producto: true }
            }
          }
        }
      }
    })

    if (!mesa) {
      return {
        success: false,
        message: `❌ No existe la mesa ${entidades.mesaNumero}`
      }
    }

    const comanda = mesa.comanda?.[0]

    if (!comanda) {
      return {
        success: true,
        message: `📋 Mesa ${entidades.mesaNumero} no tiene comanda activa`
      }
    }

    let mensaje = `📋 **Cuenta Mesa ${entidades.mesaNumero}**\n\n`
    comanda.items.forEach((item, i) => {
      mensaje += `${i + 1}. ${item.cantidad}x ${item.producto.nombre} - $${item.subtotal.toLocaleString('es-AR')}\n`
      if (item.observaciones) mensaje += `   _${item.observaciones}_\n`
    })
    mensaje += `\n💰 **Total: $${comanda.total.toLocaleString('es-AR')}**`

    return {
      success: true,
      message: mensaje,
      data: comanda
    }
  }

  async cerrarMesa(entidades, context) {
    // TODO: Implementar cierre de mesa con cobro
    return {
      success: false,
      message: '🚧 Para cerrar la mesa, usá el sistema de cobro normal por ahora'
    }
  }

  async cancelarItem(entidades, context) {
    // TODO: Implementar cancelación de item
    return {
      success: false,
      message: '🚧 Esta funcionalidad está en desarrollo'
    }
  }

  async verComandasPendientes(entidades, context) {
    const comandas = await this.prisma.comanda.findMany({
      where: {
        estado: { in: ['PENDIENTE', 'EN_PREPARACION'] }
      },
      include: {
        mesa: true,
        items: {
          include: { producto: true },
          where: { estado: { in: ['PENDIENTE', 'EN_PREPARACION'] } }
        }
      },
      orderBy: { fecha: 'asc' }
    })

    if (comandas.length === 0) {
      return {
        success: true,
        message: '✅ No hay comandas pendientes'
      }
    }

    let mensaje = `📋 **Comandas Pendientes**\n\n`

    comandas.forEach((com, i) => {
      mensaje += `${i + 1}. Mesa ${com.mesa?.numero || 'Takeaway'} - ${com.items.length} items\n`
      mensaje += `   Estado: ${com.estado === 'PENDIENTE' ? '🔴 Pendiente' : '🟡 En Preparación'}\n`
      mensaje += `   Hora: ${new Date(com.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}\n\n`
    })

    return {
      success: true,
      message: mensaje,
      data: comandas
    }
  }

  // =============================================================================
  // ACCIONES DE ADMIN
  // =============================================================================

  async estadisticasSocios(entidades, context) {
    // TODO: Implementar estadísticas de socios
    return {
      success: false,
      message: '🚧 Esta funcionalidad está en desarrollo'
    }
  }

  async ventasBuffet(entidades, context) {
    // TODO: Implementar reporte de ventas
    return {
      success: false,
      message: '🚧 Esta funcionalidad está en desarrollo'
    }
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  async getSocioFromContext(context) {
    if (!context.socioId) {
      throw new Error('No hay socio en el contexto')
    }

    const socio = await this.prisma.socio.findUnique({
      where: { id: context.socioId },
      include: {
        miembrosFamilia: {
          where: { estado: { contains: 'ACTIV' } },
          select: { id: true, nroSocio: true, apellidoNombre: true }
        }
      }
    })

    if (!socio) {
      throw new Error('Socio no encontrado')
    }

    return socio
  }
}

export default ActionExecutor
