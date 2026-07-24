import crypto from 'crypto'
import prisma from '../lib/prisma.js'
import { ACCIONES, ROLES } from './aiConstants.js'
import { getTenantFrontendUrl } from '../lib/tenantUrl.js'
import {
  crearSocio as crearSocioService,
  cambiarEstadoSocio as cambiarEstadoSocioService,
  actualizarTipoSocio as actualizarTipoSocioService,
} from './socioService.js'
import { crearCargo as crearCargoService } from './cargoService.js'
import { inscribirActividad as inscribirActividadService } from './inscripcionService.js'

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

        case ACCIONES.CONSULTAR_ULTIMOS_MOVIMIENTOS:
          return await this.consultarUltimosMovimientos(action.entidades, context)

        case ACCIONES.GENERAR_LINK_PAGO:
          return await this.generarLinkPago(action.entidades, context)

        case ACCIONES.LISTAR_ACTIVIDADES:
          return await this.listarActividades(action.entidades, context)

        case ACCIONES.MIS_ACTIVIDADES:
          return await this.misActividades(action.entidades, context)

        case ACCIONES.INSCRIBIR_ACTIVIDAD:
          // Colisión socio/admin: el socio se auto-inscribe (context.socioId);
          // el admin inscribe a un tercero por nroSocio + centro de costo.
          return context.role === ROLES.ADMIN
            ? await this.inscribirActividadAdmin(action.entidades, context)
            : await this.inscribirActividad(action.entidades, context)

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

        case ACCIONES.ENVIAR_LINK_PORTAL:
          return await this.enviarLinkPortal(action.entidades, context)

        case ACCIONES.ENVIAR_QR_COMERCIOS:
          return await this.enviarQrComercios(action.entidades, context)

        case ACCIONES.ENVIAR_LINK_WEB:
          return await this.enviarLinkWeb(action.entidades, context)

        case ACCIONES.INFO_CLUB:
          return await this.infoClub(action.entidades, context)

        case ACCIONES.DERIVAR_HUMANO:
          return await this.derivarHumano(action.entidades, context)

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

        case ACCIONES.LISTAR_CENTROS_COSTO:
          return await this.listarCentrosCosto(action.entidades, context)

        case ACCIONES.LISTAR_ESTADOS_SOCIO:
          return await this.listarEstadosSocio(action.entidades, context)

        case ACCIONES.LISTAR_TIPOS_SOCIO:
          return await this.listarTiposSocio(action.entidades, context)

        // ========== ACCIONES DE ADMIN — write ops (post-confirmación) ==========
        case ACCIONES.CREAR_SOCIO:
          return await this.crearSocio(action.entidades, context)

        case ACCIONES.GENERAR_CARGO:
          return await this.generarCargo(action.entidades, context)

        case ACCIONES.CAMBIAR_ESTADO_SOCIO:
          return await this.cambiarEstadoSocio(action.entidades, context)

        case ACCIONES.ACTUALIZAR_TIPO_SOCIO:
          return await this.actualizarTipoSocio(action.entidades, context)

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
  // ACCIONES DE ADMIN — write ops (ejecutan tras confirmación del hub)
  // =============================================================================

  /**
   * Crea un socio con la MISMA lógica que el alta de admin (nroSocio, cuota
   * social automática, auditoría) vía socioService. El hub ya validó los datos
   * requeridos (nroSocio, apellidoNombre) y pidió confirmación.
   */
  async crearSocio(entidades, context) {
    try {
      // actorId: null — el chat admin aún no tiene auth de admin real (context.userId
      // es un placeholder). creadoPor queda null; la auditoría marca origen CHAT.
      const { socio, cuotaSocialGenerada } = await crearSocioService(
        this.prisma, context.tenantId, entidades, { actorId: null, origen: 'CHAT' }
      )

      let message = `✅ Socio creado: *${socio.apellidoNombre}* (Nro ${socio.nroSocio})`
      if (cuotaSocialGenerada) {
        const monto = Number(cuotaSocialGenerada.montoTotal).toLocaleString('es-AR')
        message += `\n💳 Cuota social generada: $${monto}`
      }
      return {
        success: true,
        message,
        data: { socioId: socio.id, nroSocio: socio.nroSocio },
      }
    } catch (err) {
      console.error('❌ Error creando socio:', err)
      return {
        success: false,
        message: `❌ No pude crear el socio: ${err.message}`,
      }
    }
  }

  /**
   * Resuelve una opción de catálogo por nombre/código (case-insensitive). Si no
   * matchea, devuelve un mensaje con la lista para que el admin elija. Reutilizado
   * por las write ops que necesitan un dato de catálogo (estado, tipo, categoría).
   */
  async _resolverOMostrarLista(modelName, input, where, titulo) {
    const model = this.prisma[modelName]
    const q = (input || '').trim()
    const match = q
      ? await model.findFirst({
          where: {
            ...where,
            OR: [
              { nombre: { equals: q, mode: 'insensitive' } },
              { codigo: { equals: q, mode: 'insensitive' } },
            ],
          },
          select: { id: true, nombre: true },
        })
      : null
    if (match) return { match }
    const lista = await model.findMany({
      where, select: { nombre: true }, orderBy: { nombre: 'asc' }, take: 25,
    })
    const opciones = lista.map((c, i) => `${i + 1}. ${c.nombre}`).join('\n')
    return { listMessage: `${titulo}\n\n${opciones}` }
  }

  async listarEstadosSocio() {
    const lista = await this.prisma.estadoSocio.findMany({
      select: { nombre: true }, orderBy: { nombre: 'asc' }, take: 30,
    })
    if (!lista.length) return { success: false, message: 'No hay estados de socio configurados.' }
    return { success: true, message: `📋 *Estados de socio:*\n\n${lista.map((e, i) => `${i + 1}. ${e.nombre}`).join('\n')}` }
  }

  async listarTiposSocio() {
    const lista = await this.prisma.tipoSocio.findMany({
      select: { nombre: true }, orderBy: { nombre: 'asc' }, take: 30,
    })
    if (!lista.length) return { success: false, message: 'No hay tipos de socio configurados.' }
    return { success: true, message: `📋 *Tipos de socio:*\n\n${lista.map((t, i) => `${i + 1}. ${t.nombre}`).join('\n')}` }
  }

  /**
   * Cambia el estado de un socio (identificado por nroSocio). Resuelve el estado
   * por nombre; si no matchea, muestra la lista. Setea/limpia baja según el estado.
   */
  async cambiarEstadoSocio(entidades, context) {
    try {
      const socio = await this.prisma.socio.findFirst({
        where: { nroSocio: String(entidades.nroSocio) },
        select: { id: true, nroSocio: true, apellidoNombre: true },
      })
      if (!socio) return { success: false, message: `❌ No encontré ningún socio con el número ${entidades.nroSocio}.` }

      const r = await this._resolverOMostrarLista(
        'estadoSocio', entidades.estado, {}, `No encontré el estado "${entidades.estado || ''}". Elegí uno:`)
      if (!r.match) return { success: false, message: `${r.listMessage}\n\nDecime el nombre y cambio el estado.` }

      const { socio: upd, estado } = await cambiarEstadoSocioService(
        this.prisma, context.tenantId,
        { socioId: socio.id, estadoSocioId: r.match.id, motivo: entidades.motivo },
        { actorId: null })

      return {
        success: true,
        message: `✅ Estado de *${upd.apellidoNombre}* (Nro ${upd.nroSocio}) → *${estado.nombre}*`,
        data: { socioId: upd.id },
      }
    } catch (err) {
      console.error('❌ Error cambiando estado:', err)
      return { success: false, message: `❌ No pude cambiar el estado: ${err.message}` }
    }
  }

  /**
   * Actualiza tipo y/o categoría de un socio (por nroSocio). Resuelve tipo y
   * categoría por nombre; si alguno no matchea, muestra la lista correspondiente.
   */
  async actualizarTipoSocio(entidades, context) {
    try {
      const socio = await this.prisma.socio.findFirst({
        where: { nroSocio: String(entidades.nroSocio) },
        select: { id: true, nroSocio: true, apellidoNombre: true },
      })
      if (!socio) return { success: false, message: `❌ No encontré ningún socio con el número ${entidades.nroSocio}.` }

      if (!entidades.tipoSocio && !entidades.categoria) {
        return { success: false, message: '¿Qué querés cambiar: el tipo de socio, la categoría, o ambos? Decime el nombre.' }
      }

      let tipoSocioRelId = null, categoriaSocioId = null
      const cambios = []
      if (entidades.tipoSocio) {
        const r = await this._resolverOMostrarLista(
          'tipoSocio', entidades.tipoSocio, {}, `No encontré el tipo de socio "${entidades.tipoSocio}". Elegí uno:`)
        if (!r.match) return { success: false, message: r.listMessage }
        tipoSocioRelId = r.match.id
        cambios.push(`tipo → ${r.match.nombre}`)
      }
      if (entidades.categoria) {
        const r = await this._resolverOMostrarLista(
          'categoriaSocio', entidades.categoria, {}, `No encontré la categoría "${entidades.categoria}". Elegí una:`)
        if (!r.match) return { success: false, message: r.listMessage }
        categoriaSocioId = r.match.id
        cambios.push(`categoría → ${r.match.nombre}`)
      }

      const { socio: upd } = await actualizarTipoSocioService(
        this.prisma, context.tenantId,
        { socioId: socio.id, tipoSocioRelId, categoriaSocioId },
        { actorId: null })

      return {
        success: true,
        message: `✅ Socio *${upd.apellidoNombre}* (Nro ${upd.nroSocio}): ${cambios.join(', ')}`,
        data: { socioId: upd.id },
      }
    } catch (err) {
      console.error('❌ Error actualizando tipo/categoría:', err)
      return { success: false, message: `❌ No pude actualizar: ${err.message}` }
    }
  }

  /**
   * Lista los centros de costo activos para que el admin elija (usado antes de
   * generar un cargo / inscribir). Lectura, sin confirmación.
   */
  async listarCentrosCosto() {
    const lista = await this.prisma.centroCosto.findMany({
      where: { activo: true },
      select: { nombre: true },
      orderBy: { orden: 'asc' },
      take: 30,
    })
    if (lista.length === 0) {
      return { success: false, message: 'No hay centros de costo activos configurados.' }
    }
    const opciones = lista.map((c, i) => `${i + 1}. ${c.nombre}`).join('\n')
    return { success: true, message: `🏷️ *Centros de costo disponibles:*\n\n${opciones}` }
  }

  /**
   * Genera un cargo manual. Identifica al socio por nroSocio y al centro de costo
   * por nombre (si no matchea, muestra la lista para que el admin elija). El hub
   * ya validó nroSocio/monto/centroCosto y pidió confirmación.
   */
  async generarCargo(entidades, context) {
    try {
      // Socio por número
      const socio = await this.prisma.socio.findFirst({
        where: { nroSocio: String(entidades.nroSocio) },
        select: { id: true, nroSocio: true, apellidoNombre: true },
      })
      if (!socio) {
        return { success: false, message: `❌ No encontré ningún socio con el número ${entidades.nroSocio}.` }
      }

      // Centro de costo por nombre (o código). Si no matchea, mostrar la lista.
      const ccInput = (entidades.centroCosto || '').trim()
      const centro = ccInput
        ? await this.prisma.centroCosto.findFirst({
            where: {
              activo: true,
              OR: [
                { nombre: { equals: ccInput, mode: 'insensitive' } },
                { codigo: { equals: ccInput, mode: 'insensitive' } },
              ],
            },
            select: { id: true, nombre: true },
          })
        : null
      if (!centro) {
        const lista = await this.prisma.centroCosto.findMany({
          where: { activo: true }, select: { nombre: true }, orderBy: { orden: 'asc' }, take: 20,
        })
        const opciones = lista.map((c, i) => `${i + 1}. ${c.nombre}`).join('\n')
        return {
          success: false,
          message: `No encontré el centro de costo "${ccInput}". Elegí uno:\n\n${opciones}\n\nDecime el nombre y genero el cargo.`,
        }
      }

      const cargo = await crearCargoService(this.prisma, context.tenantId, {
        socioId: socio.id,
        centroCostoId: centro.id,
        montoOriginal: entidades.montoOriginal,
        descripcion: entidades.descripcion,
        categoria: entidades.categoria,
        fechaVencimiento: entidades.fechaVencimiento,
      }, { actorId: null })

      const monto = Number(cargo.montoTotal).toLocaleString('es-AR')
      return {
        success: true,
        message: `✅ Cargo generado para *${socio.apellidoNombre}* (Nro ${socio.nroSocio})\n💵 ${cargo.descripcion || cargo.categoria}: $${monto}\n🏷️ Centro de costo: ${centro.nombre}`,
        data: { cargoId: cargo.id, montoTotal: Number(cargo.montoTotal) },
      }
    } catch (err) {
      console.error('❌ Error generando cargo:', err)
      return { success: false, message: `❌ No pude generar el cargo: ${err.message}` }
    }
  }

  /**
   * Inscribe a un socio (identificado por nroSocio) en una actividad (por nombre)
   * vía inscripcionService, con la MISMA lógica que el alta de admin (valida socio
   * activo/edad/cupo, genera la cuota de actividad). Resuelve la actividad y el
   * centro de costo por nombre; si alguno no matchea, muestra la lista para elegir.
   */
  async inscribirActividadAdmin(entidades, context) {
    try {
      // Socio por número
      const socio = await this.prisma.socio.findFirst({
        where: { nroSocio: String(entidades.nroSocio) },
        select: { id: true, nroSocio: true, apellidoNombre: true },
      })
      if (!socio) {
        return { success: false, message: `❌ No encontré ningún socio con el número ${entidades.nroSocio}.` }
      }

      // Categoría de actividad por nombre de actividad (+ categoría/turno opcional)
      const actInput = (entidades.actividad || '').trim()
      const categoria = actInput
        ? await this.prisma.categoriaActividad.findFirst({
            where: {
              activo: true,
              actividad: { nombre: { contains: actInput, mode: 'insensitive' } },
              ...(entidades.categoria ? { nombre: { contains: entidades.categoria.trim(), mode: 'insensitive' } } : {}),
            },
            include: { actividad: { select: { nombre: true } } },
          })
        : null
      if (!categoria) {
        const disponibles = await this.prisma.categoriaActividad.findMany({
          where: { activo: true },
          include: { actividad: { select: { nombre: true } } },
          orderBy: [{ actividad: { nombre: 'asc' } }, { nombre: 'asc' }],
          take: 25,
        })
        if (!disponibles.length) {
          return { success: false, message: 'No hay actividades activas configuradas.' }
        }
        const opciones = disponibles.map((c, i) => `${i + 1}. ${c.actividad?.nombre || ''} - ${c.nombre}`).join('\n')
        return {
          success: false,
          message: `No encontré la actividad "${actInput}". Elegí una:\n\n${opciones}\n\nDecime el nombre (y la categoría/turno si hace falta) y hago la inscripción.`,
        }
      }

      // Centro de costo por nombre (o código). Si no matchea, mostrar la lista.
      const cc = await this._resolverOMostrarLista(
        'centroCosto', entidades.centroCosto, { activo: true },
        `No encontré el centro de costo "${entidades.centroCosto || ''}". Elegí uno:`)
      if (!cc.match) return { success: false, message: `${cc.listMessage}\n\nDecime el nombre y hago la inscripción.` }

      const { inscripcion, cargoGenerado } = await inscribirActividadService(
        this.prisma, context.tenantId,
        {
          socioId: socio.id,
          categoriaActividadId: categoria.id,
          centroCostoId: cc.match.id,
          fechaInicio: entidades.fechaInicio,
        },
        { actorId: null, origen: 'CHAT' })

      const actNombre = `${categoria.actividad?.nombre || ''} - ${categoria.nombre}`
      let message = `✅ *${socio.apellidoNombre}* (Nro ${socio.nroSocio}) inscripto en *${actNombre}*\n🏷️ Centro de costo: ${cc.match.nombre}`
      if (cargoGenerado) {
        const monto = Number(cargoGenerado.montoTotal).toLocaleString('es-AR')
        message += `\n💳 Cuota de actividad generada: $${monto}`
      }
      return {
        success: true,
        message,
        data: { inscripcionId: inscripcion.id, cargoId: cargoGenerado?.id || null },
      }
    } catch (err) {
      console.error('❌ Error inscribiendo en actividad:', err)
      return { success: false, message: `❌ No pude inscribir al socio: ${err.message}` }
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
    // "Moroso" varía por club: algunos cuentan cualquier cargo vencido,
    // otros solo cuota social, otros toleran 6 meses de antigüedad, etc.
    // Los parámetros viven en Configuracion del tenant para que cada admin
    // ajuste su política sin tocar código:
    //
    //   MOROSIDAD_CATEGORIAS  (CSV)
    //     Categorías de cargo que cuentan como morosidad.
    //     Default: 'CUOTA_SOCIAL'.
    //     Valores válidos: CUOTA_SOCIAL, CUOTA_ACTIVIDAD, CARGO_EVENTO, etc.
    //     Vacío o 'TODAS' → cuenta todas las categorías.
    //
    //   MOROSIDAD_MESES_ANTIGUEDAD  (entero)
    //     Cuántos meses hacia atrás se consideran los cargos vencidos.
    //     Cargos más viejos se asumen incobrables y no inflan la tasa.
    //     Default: 12. Poner 0 (o vacío) para "sin límite de antigüedad".
    //
    //   MOROSIDAD_SOLO_SOCIOS_ACTIVOS  ('true'/'false')
    //     Si true, solo cuenta socios con estado ACTIVO (excluye ex-socios
    //     con deuda histórica). Default: 'true'.
    const filtro = entidades?.filtro || 'porcentaje_morosidad'

    const cfg = await this._cargarPolicyMorosidad()

    const cargoWhere = {
      estado: 'PENDIENTE',
      fechaVencimiento: { lt: new Date() },
    }
    if (cfg.categorias.length > 0) {
      cargoWhere.categoria = { in: cfg.categorias }
    }
    if (cfg.fechaMinima) {
      cargoWhere.fechaVencimiento = { lt: new Date(), gte: cfg.fechaMinima }
    }
    if (cfg.soloActivos) {
      cargoWhere.socio = { estadoSocioRel: { nombre: 'ACTIVO' } }
    }

    try {
      const [activos, morosos, total] = await Promise.all([
        this.prisma.socio.count({
          where: { estadoSocioRel: { nombre: 'ACTIVO' } },
        }),
        this.prisma.cargo.findMany({
          where: cargoWhere,
          select: { socioId: true },
          distinct: ['socioId'],
        }).then(rows => rows.length),
        this.prisma.socio.count(),
      ])

      const porcentaje = activos > 0 ? +(morosos * 100 / activos).toFixed(1) : 0

      let mensaje
      if (filtro === 'morosos') {
        mensaje = `📊 Socios morosos (activos con cuotas vencidas): **${morosos}**`
      } else if (filtro === 'activos') {
        mensaje = `📊 Socios activos: **${activos}**`
      } else if (filtro === 'todos') {
        mensaje = `📊 Socios totales: **${total}** (activos: ${activos}, morosos: ${morosos})`
      } else {
        // porcentaje_morosidad (default)
        mensaje =
          `📊 **Resumen de socios**\n\n` +
          `• Padrón total: ${total}\n` +
          `• Socios activos: ${activos}\n` +
          `• Morosos (activos con cuotas vencidas): ${morosos}\n` +
          `• **Porcentaje de morosidad: ${porcentaje}%**`
      }

      return {
        success: true,
        message: mensaje,
        data: { total, activos, morosos, porcentajeMorosidad: porcentaje },
      }
    } catch (err) {
      console.error('[estadisticasSocios] Error:', err.message)
      return {
        success: false,
        message: 'No pude calcular las estadísticas. Verificá que el módulo de socios esté configurado.',
        error: err.message,
      }
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
  // ACCIONES DE SOCIO — LINKS, INFO Y DERIVACIÓN
  // =============================================================================
  // Devuelven el link/dato dentro del campo `message` para que cada canal
  // (web chat / WhatsApp) lo muestre o lo mande según corresponda. Antes el
  // agente WA generaba un envío extra de WhatsApp con el link — eso se elimina
  // y se unifica acá: el message ES la respuesta al usuario.

  async consultarUltimosMovimientos(entidades, context) {
    const socio = await this.getSocioFromContext(context)
    const limite = Math.min(Math.max(parseInt(entidades.limite, 10) || 5, 1), 20)

    const pagos = await this.prisma.pago.findMany({
      where: { socioId: socio.id },
      orderBy: { fecha: 'desc' },
      take: limite,
    }).catch(() => [])

    if (pagos.length === 0) {
      return {
        success: true,
        message: '📭 No tenés movimientos registrados todavía.',
        data: { pagos: [] },
      }
    }

    let mensaje = `💼 **Últimos movimientos** (${pagos.length})\n\n`
    pagos.forEach((p, i) => {
      const fecha = new Date(p.fecha).toLocaleDateString('es-AR')
      const monto = parseFloat(p.montoTotal || 0).toLocaleString('es-AR')
      mensaje += `${i + 1}. ${fecha} — ${p.concepto || 'Pago'}: $${monto}\n`
    })

    return { success: true, message: mensaje, data: { pagos } }
  }

  async misActividades(entidades, context) {
    const socio = await this.getSocioFromContext(context)
    const hoy = new Date()

    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        socioId: socio.id,
        estado: 'ACTIVA',
        OR: [{ fechaFin: null }, { fechaFin: { gte: hoy } }],
      },
      include: {
        categoriaActividad: {
          include: { actividad: { select: { nombre: true } } },
        },
      },
    }).catch(() => [])

    if (inscripciones.length === 0) {
      return {
        success: true,
        message: '📋 No estás inscripto en ninguna actividad. ¿Querés ver el listado disponible?',
        data: { inscripciones: [] },
      }
    }

    let mensaje = `🏃 **Tus actividades** (${inscripciones.length})\n\n`
    inscripciones.forEach((i, idx) => {
      const cat = i.categoriaActividad
      mensaje += `${idx + 1}. **${cat?.actividad?.nombre || 'Actividad'}** — ${cat?.nombre || ''}\n`
      if (cat?.diasEntrenamiento) mensaje += `   📅 ${cat.diasEntrenamiento}\n`
      if (cat?.horarioEntrenamiento) mensaje += `   ⏰ ${cat.horarioEntrenamiento}\n`
    })

    return { success: true, message: mensaje, data: { inscripciones } }
  }

  async enviarLinkPortal(entidades, context) {
    const socio = await this.getSocioFromContext(context)

    const token = crypto.randomBytes(32).toString('hex')
    const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await this.prisma.socio.update({
      where: { id: socio.id },
      data: { tokenPortal: token, tokenPortalExpira: expira },
    })

    const baseUrl = await this._getBaseUrlTenant(context)
    const link = `${baseUrl}/portal-socio/${token}`
    const venc = expira.toLocaleDateString('es-AR')

    return {
      success: true,
      message: `🔗 Acá está tu link de acceso al portal:\n${link}\n\n_Válido hasta el ${venc}. No lo compartas._`,
      data: { link, expira: expira.toISOString() },
    }
  }

  async enviarQrComercios(entidades, context) {
    const socio = await this.getSocioFromContext(context)

    // Si no tiene token vigente, generamos uno para que el QR funcione.
    let token = socio.tokenPortal
    if (!token || (socio.tokenPortalExpira && new Date(socio.tokenPortalExpira) < new Date())) {
      token = crypto.randomBytes(32).toString('hex')
      const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      await this.prisma.socio.update({
        where: { id: socio.id },
        data: { tokenPortal: token, tokenPortalExpira: expira },
      })
    }

    const baseUrl = await this._getBaseUrlTenant(context)
    const link = `${baseUrl}/portal-socio/${token}`

    return {
      success: true,
      message: `🎟 Tu QR para usar beneficios en comercios adheridos:\n${link}\n\n_Mostrá este link o el QR en el comercio para acceder a tu descuento._`,
      data: { link },
    }
  }

  async enviarLinkWeb(entidades, context) {
    const url = await this._getBaseUrlTenant(context)
    return {
      success: true,
      message: `🌐 Sitio web del club:\n${url}`,
      data: { url },
    }
  }

  async infoClub(entidades, context) {
    const configs = await this.prisma.configuracion.findMany({
      where: {
        clave: {
          in: ['HORARIO_ATENCION', 'TELEFONO_CONTACTO', 'DIRECCION', 'EMAIL_CONTACTO', 'NOMBRE_CLUB', 'nombre'],
        },
      },
    }).catch(() => [])
    const cfg = Object.fromEntries(configs.map(c => [c.clave, c.valor]))

    const nombre = cfg.NOMBRE_CLUB || cfg.nombre || 'el club'
    let mensaje = `🏛 **${nombre}**\n\n`
    if (cfg.DIRECCION) mensaje += `📍 ${cfg.DIRECCION}\n`
    if (cfg.HORARIO_ATENCION) mensaje += `🕐 ${cfg.HORARIO_ATENCION}\n`
    if (cfg.TELEFONO_CONTACTO) mensaje += `📞 ${cfg.TELEFONO_CONTACTO}\n`
    if (cfg.EMAIL_CONTACTO) mensaje += `✉️  ${cfg.EMAIL_CONTACTO}\n`

    if (!cfg.DIRECCION && !cfg.HORARIO_ATENCION && !cfg.TELEFONO_CONTACTO && !cfg.EMAIL_CONTACTO) {
      mensaje += 'No tengo cargada la información de contacto. Probá consultar en administración.'
    }

    return { success: true, message: mensaje, data: cfg }
  }

  async derivarHumano(entidades, context) {
    const motivo = (entidades.motivo || '').trim() || '(sin motivo especificado)'
    const tenantId = context.tenantId || context.metadata?.tenantId || null

    // TODO: notificar a administradores (WhatsApp/email/in-app). Por ahora se loguea.
    console.log(`[ActionExecutor] derivar_humano tenant=${tenantId} usuario=${context.userName || context.userId} motivo="${motivo}"`)

    return {
      success: true,
      message: 'Le pasé tu consulta a la administración. Pronto te van a contactar. 🤝',
      data: { derivado: true, motivo },
    }
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  /**
   * Resuelve la URL pública del tenant usando el helper canónico
   * `getTenantFrontendUrl`, que respeta dominioCustom (dominio propio), normaliza
   * www y arma <subdomain>.<APP_DOMAIN> en prod. Usa la prisma global porque la
   * tabla tenant vive fuera del scope tenant-aislado.
   */
  async _getBaseUrlTenant(context) {
    const tenantId = context?.tenantId || context?.metadata?.tenantId || null
    if (!tenantId) return getTenantFrontendUrl(null)

    const tenant = await prisma.tenant
      .findUnique({ where: { id: tenantId }, select: { subdomain: true, dominioCustom: true } })
      .catch(() => null)

    return getTenantFrontendUrl(tenant)
  }

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
