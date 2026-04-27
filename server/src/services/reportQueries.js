// Query definitions for Clubix domain reports

const QUERY_DEFINITIONS = [
  {
    key: 'socios_activos',
    label: 'Socios Activos',
    category: 'socios',
    description: 'Listado completo de socios activos con datos de contacto',
    defaultParams: [
      { name: 'categoria', label: 'Categoría (opcional)', type: 'text', required: false, defaultValue: '' },
    ],
    run: async (db, tenantId, params) => {
      const where = { tenantId, activo: true }
      const socios = await db.socio.findMany({
        where,
        select: {
          id: true, nombre: true, apellido: true, dni: true, email: true, telefono: true,
          categoria: { select: { nombre: true } },
        },
        orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
      })
      let items = socios.map(s => ({
        nombre: s.nombre || '',
        apellido: s.apellido || '',
        dni: s.dni || '',
        email: s.email || '',
        telefono: s.telefono || '',
        categoria: s.categoria?.nombre || '',
      }))
      if (params.categoria) {
        const cat = params.categoria.toLowerCase()
        items = items.filter(i => i.categoria.toLowerCase().includes(cat))
      }
      return { items, summary: { total: items.length } }
    },
  },
  {
    key: 'cuotas_cobranza',
    label: 'Estado de Cobranza de Cuotas',
    category: 'finanzas',
    description: 'Cuotas en un período con su estado de pago',
    defaultParams: [
      { name: 'fechaDesde', label: 'Desde', type: 'date', required: true, defaultValue: '' },
      { name: 'fechaHasta', label: 'Hasta', type: 'date', required: true, defaultValue: '' },
      { name: 'estado', label: 'Estado', type: 'select', required: false, defaultValue: '',
        options: [{ value: 'PENDIENTE', label: 'Pendiente' }, { value: 'PAGADO', label: 'Pagado' }] },
    ],
    run: async (db, tenantId, params) => {
      const where = { tenantId }
      if (params.fechaDesde || params.fechaHasta) {
        where.vencimiento = {}
        if (params.fechaDesde) where.vencimiento.gte = new Date(params.fechaDesde)
        if (params.fechaHasta) where.vencimiento.lte = new Date(params.fechaHasta + 'T23:59:59')
      }
      if (params.estado) where.estado = params.estado
      const cargos = await db.cargo.findMany({
        where,
        include: { socio: { select: { nombre: true, apellido: true } } },
        orderBy: { vencimiento: 'asc' },
      })
      const items = cargos.map(c => ({
        socio: c.socio ? `${c.socio.apellido}, ${c.socio.nombre}` : '—',
        descripcion: c.descripcion || '',
        vencimiento: c.vencimiento,
        estado: c.estado || '',
        importe: Number(c.importe) || 0,
      }))
      const total = items.reduce((acc, i) => acc + i.importe, 0)
      return { items, summary: { total, count: items.length } }
    },
  },
  {
    key: 'socios_morosos',
    label: 'Socios Morosos',
    category: 'finanzas',
    description: 'Socios con cuotas pendientes vencidas, ordenados por deuda',
    defaultParams: [],
    run: async (db, tenantId, params) => {
      const hoy = new Date()
      const cargos = await db.cargo.findMany({
        where: { tenantId, estado: 'PENDIENTE', vencimiento: { lt: hoy } },
        include: { socio: { select: { id: true, nombre: true, apellido: true, dni: true, email: true } } },
        orderBy: [{ socioId: 'asc' }, { vencimiento: 'asc' }],
      })
      const map = new Map()
      for (const c of cargos) {
        if (!c.socio) continue
        const key = c.socioId
        if (!map.has(key)) map.set(key, { socio: c.socio, deuda: 0, cuotas: 0 })
        const entry = map.get(key)
        entry.deuda += Number(c.importe) || 0
        entry.cuotas += 1
      }
      const items = [...map.values()].map(e => ({
        nombre: `${e.socio.apellido}, ${e.socio.nombre}`,
        dni: e.socio.dni || '',
        email: e.socio.email || '',
        cuotas: e.cuotas,
        deuda: e.deuda,
      })).sort((a, b) => b.deuda - a.deuda)
      const totalDeuda = items.reduce((acc, i) => acc + i.deuda, 0)
      return { items, summary: { totalSocios: items.length, totalDeuda } }
    },
  },
  {
    key: 'movimientos_caja',
    label: 'Movimientos de Caja',
    category: 'finanzas',
    description: 'Ingresos y egresos de caja por período',
    defaultParams: [
      { name: 'fechaDesde', label: 'Desde', type: 'date', required: true, defaultValue: '' },
      { name: 'fechaHasta', label: 'Hasta', type: 'date', required: true, defaultValue: '' },
    ],
    run: async (db, tenantId, params) => {
      const where = { tenantId }
      if (params.fechaDesde || params.fechaHasta) {
        where.fecha = {}
        if (params.fechaDesde) where.fecha.gte = new Date(params.fechaDesde)
        if (params.fechaHasta) where.fecha.lte = new Date(params.fechaHasta + 'T23:59:59')
      }
      const movimientos = await db.movimientoCaja.findMany({
        where,
        include: { caja: { select: { nombre: true } } },
        orderBy: { fecha: 'asc' },
      })
      const items = movimientos.map(m => ({
        fecha: m.fecha,
        tipo: m.tipo || '',
        descripcion: m.descripcion || '',
        caja: m.caja?.nombre || '',
        importe: Number(m.importe) || 0,
      }))
      const ingresos = items.filter(i => i.tipo === 'INGRESO').reduce((a, i) => a + i.importe, 0)
      const egresos = items.filter(i => i.tipo === 'EGRESO').reduce((a, i) => a + i.importe, 0)
      return { items, summary: { ingresos, egresos, saldo: ingresos - egresos, count: items.length } }
    },
  },
  {
    key: 'actividades_inscripciones',
    label: 'Inscripciones por Actividad',
    category: 'actividades',
    description: 'Listado de inscripciones activas agrupadas por actividad',
    defaultParams: [],
    run: async (db, tenantId, params) => {
      const inscripciones = await db.inscripcion.findMany({
        where: { tenantId, activa: true },
        include: {
          actividad: { select: { nombre: true } },
          categoria: { select: { nombre: true } },
          socio: { select: { nombre: true, apellido: true } },
        },
        orderBy: [{ actividadId: 'asc' }, { socio: { apellido: 'asc' } }],
      })
      const items = inscripciones.map(i => ({
        actividad: i.actividad?.nombre || '',
        categoria: i.categoria?.nombre || '',
        socio: i.socio ? `${i.socio.apellido}, ${i.socio.nombre}` : '',
      }))
      return { items, summary: { total: items.length } }
    },
  },
  {
    key: 'recibo_cobro',
    label: 'Recibo de Cobranza',
    category: 'finanzas',
    description: 'Imprime un recibo de pago con logo del club, conceptos cobrados y medios de pago',
    defaultParams: [
      { name: 'numeroPago', label: 'Nro. de Pago (ej: MV-2026-00013)', type: 'text', required: true, defaultValue: '', visible: true },
    ],
    run: async (db, tenantId, params) => {
      if (!params.numeroPago) throw new Error('numeroPago es requerido')

      // MV-YYYY-NNNNN es el número del MovimientoCaja; buscar el Pago asociado
      const movimiento = await db.movimientoCaja.findFirst({
        where: { numero: params.numeroPago, tenantId },
        select: { pagoId: true },
      })
      const pagoId = movimiento?.pagoId
      if (!pagoId) throw new Error(`Movimiento "${params.numeroPago}" no encontrado o no tiene pago asociado`)

      const pago = await db.pago.findFirst({
        where: { id: pagoId, tenantId },
        include: {
          socio: { select: { nombre: true, apellido: true, documento: true, email: true, celular: true } },
          medioPago: { select: { nombre: true, tipo: true } },
          cargos: {
            select: {
              descripcion: true, montoTotal: true, fechaVencimiento: true, tipoCuota: true,
              periodo: { select: { nombre: true } },
            },
          },
          caja: { select: { nombre: true } },
          cobrador: { select: { nombre: true } },
        },
      })

      if (!pago) throw new Error(`Pago asociado al movimiento "${params.numeroPago}" no encontrado`)

      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: { nombre: true, logoUrl: true, direccion: true, telefono: true, email: true, cuit: true },
      }).catch(() => null)

      const conceptos = (pago.cargos || []).map(c => ({
        descripcion: c.descripcion || c.tipoCuota || '—',
        periodo: c.periodo?.nombre || '',
        vencimiento: c.fechaVencimiento,
        importe: Number(c.montoTotal) || 0,
      }))

      const items = [{
        numero: pago.numero,
        fecha: pago.fecha,
        socio: pago.socio ? `${pago.socio.apellido || ''} ${pago.socio.nombre || ''}`.trim() : '—',
        documento: pago.socio?.documento || '',
        email: pago.socio?.email || '',
        celular: pago.socio?.celular || '',
        medioPago: pago.medioPago?.nombre || '',
        tipoMedioPago: pago.medioPago?.tipo || '',
        caja: pago.caja?.nombre || '',
        cobrador: pago.cobrador?.nombre || '',
        nroOperacion: pago.nroOperacion || '',
        bancoOrigen: pago.bancoOrigen || '',
        montoTotal: Number(pago.montoTotal) || 0,
        montoRecibido: Number(pago.montoRecibido) || 0,
        montoACuenta: Number(pago.montoACuenta) || 0,
        conceptos,
        observaciones: pago.observaciones || '',
      }]

      return {
        items,
        summary: {
          numero: pago.numero,
          fecha: pago.fecha,
          total: Number(pago.montoTotal) || 0,
          tenant,
        },
      }
    },
  },
  {
    key: 'orden_trabajo',
    label: 'Orden de Trabajo',
    category: 'mantenimiento',
    description: 'Imprime una orden de trabajo de mantenimiento con datos del responsable, ubicación, costos e historial de comentarios y cambios de estado',
    defaultParams: [
      { name: 'numero', label: 'Nro. de Orden (ej: OT-2026-0001)', type: 'text', required: true, defaultValue: '', visible: true },
    ],
    run: async (db, tenantId, params) => {
      if (!params.numero) throw new Error('numero es requerido')

      const orden = await db.ordenTrabajo.findFirst({
        where: { numero: params.numero, tenantId },
        include: {
          responsable: { select: { razonSocial: true, tipo: true, telefono: true, email: true } },
          espacio: { select: { nombre: true } },
          centroCosto: { select: { nombre: true } },
          historial: { orderBy: { fecha: 'asc' } },
        },
      })

      if (!orden) throw new Error(`Orden "${params.numero}" no encontrada`)

      // Resolver nombres de admins del historial
      const adminIds = [...new Set(orden.historial.map(h => h.adminId))]
      const admins = adminIds.length
        ? await db.admin.findMany({
            where: { id: { in: adminIds } },
            select: { id: true, nombre: true, apellido: true, email: true },
          })
        : []
      const adminMap = new Map(admins.map(a => [a.id, a]))

      const historial = orden.historial.map(h => {
        const a = adminMap.get(h.adminId)
        return {
          fecha: h.fecha,
          tipo: h.tipo,
          estadoAnterior: h.estadoAnterior,
          estadoNuevo: h.estadoNuevo,
          comentario: h.comentario,
          admin: a ? `${a.nombre || ''} ${a.apellido || ''}`.trim() || a.email : 'Sistema',
        }
      })

      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: { nombre: true, logoUrl: true, direccion: true, telefono: true, email: true, cuit: true },
      }).catch(() => null)

      const items = [{
        numero: orden.numero,
        titulo: orden.titulo,
        descripcion: orden.descripcion || '',
        tipo: orden.tipo,
        prioridad: orden.prioridad,
        estado: orden.estado,
        ubicacion: orden.espacio?.nombre || orden.ubicacion || '',
        responsable: orden.responsable?.razonSocial || '',
        responsableTipo: orden.responsable?.tipo || '',
        responsableTel: orden.responsable?.telefono || '',
        responsableEmail: orden.responsable?.email || '',
        centroCosto: orden.centroCosto?.nombre || '',
        fechaApertura: orden.fechaApertura,
        fechaInicio: orden.fechaInicio,
        fechaResolucion: orden.fechaResolucion,
        costoEstimado: orden.costoEstimado != null ? Number(orden.costoEstimado) : null,
        costoReal: orden.costoReal != null ? Number(orden.costoReal) : null,
        resolucion: orden.resolucion || '',
        historial,
      }]

      return {
        items,
        summary: {
          numero: orden.numero,
          estado: orden.estado,
          tenant,
        },
      }
    },
  },
]

export function listQueryDefinitions() {
  return QUERY_DEFINITIONS.map(d => ({
    key: d.key,
    label: d.label,
    category: d.category,
    description: d.description,
    defaultParams: d.defaultParams,
  }))
}

export function getQueryDefinition(key) {
  return QUERY_DEFINITIONS.find(d => d.key === key) || null
}

export async function runQuery(key, db, tenantId, params) {
  const def = getQueryDefinition(key)
  if (!def) throw new Error(`Query "${key}" no encontrada`)
  return def.run(db, tenantId, params)
}
