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
  {
    key: 'socios_listado_firma',
    label: 'Listado de Socios para Firma',
    category: 'socios',
    description: 'Listado en grilla con espacio para firma. Filtros por tipo, estado, categoría, mayor/menor.',
    defaultParams: async (db, tenantId) => {
      if (!db || !tenantId) {
        return [
          { name: 'tipoSocioId', label: 'Tipo de socio', type: 'select', required: false, defaultValue: '', options: [] },
          { name: 'estadoSocioId', label: 'Estado', type: 'select', required: false, defaultValue: '', options: [] },
          { name: 'categoriaSocioId', label: 'Categoría', type: 'select', required: false, defaultValue: '', options: [] },
          { name: 'soloMenores', label: 'Solo menores', type: 'select', required: false, defaultValue: '',
            options: [{ value: 'menores', label: 'Solo menores' }, { value: 'mayores', label: 'Solo mayores' }] },
        ]
      }
      const [tipos, estados, categorias] = await Promise.all([
        db.tipoSocio.findMany({ where: { tenantId, activo: true }, select: { id: true, nombre: true }, orderBy: { orden: 'asc' } }),
        db.estadoSocio.findMany({ where: { tenantId, activo: true }, select: { id: true, nombre: true }, orderBy: { orden: 'asc' } }),
        db.categoriaSocio.findMany({ where: { tenantId, activo: true }, select: { id: true, nombre: true }, orderBy: { orden: 'asc' } }),
      ])
      return [
        { name: 'tipoSocioId', label: 'Tipo de socio', type: 'multiselect', required: false, defaultValue: [],
          options: tipos.map(t => ({ value: String(t.id), label: t.nombre })) },
        { name: 'estadoSocioId', label: 'Estado', type: 'multiselect', required: false, defaultValue: [],
          options: estados.map(e => ({ value: String(e.id), label: e.nombre })) },
        { name: 'categoriaSocioId', label: 'Categoría', type: 'multiselect', required: false, defaultValue: [],
          options: categorias.map(c => ({ value: String(c.id), label: c.nombre })) },
        { name: 'soloMenores', label: 'Edad', type: 'select', required: false, defaultValue: '',
          options: [
            { value: 'menores', label: 'Solo menores' },
            { value: 'mayores', label: 'Solo mayores' },
          ] },
      ]
    },
    run: async (db, tenantId, params) => {
      const where = { tenantId }
      // Helper: param multiselect → array de ints. Acepta array, csv string o single value.
      const toIntArr = (v) => {
        if (v == null || v === '') return []
        const arr = Array.isArray(v) ? v : String(v).split(',')
        return arr.map(x => parseInt(x)).filter(n => Number.isFinite(n))
      }
      const tipoIds = toIntArr(params.tipoSocioId)
      const estadoIds = toIntArr(params.estadoSocioId)
      const categoriaIds = toIntArr(params.categoriaSocioId)
      if (tipoIds.length === 1) where.tipoSocioRelId = tipoIds[0]
      else if (tipoIds.length > 1) where.tipoSocioRelId = { in: tipoIds }
      if (estadoIds.length === 1) where.estadoSocioId = estadoIds[0]
      else if (estadoIds.length > 1) where.estadoSocioId = { in: estadoIds }
      if (categoriaIds.length === 1) where.categoriaSocioId = categoriaIds[0]
      else if (categoriaIds.length > 1) where.categoriaSocioId = { in: categoriaIds }
      if (params.soloMenores === 'menores' || params.soloMenores === 'mayores') {
        // Filtrar por fecha real, no por la columna `esMenor` que queda obsoleta.
        const hoy = new Date()
        const cutoff = new Date(hoy.getFullYear() - 18, hoy.getMonth(), hoy.getDate())
        where.fechaNacimiento = params.soloMenores === 'menores'
          ? { gt: cutoff }
          : { lte: cutoff }
      }

      const socios = await db.socio.findMany({
        where,
        select: {
          id: true,
          nroSocio: true,
          documento: true,
          apellidoNombre: true,
          esMenor: true,
          categoriaSocioRel: { select: { nombre: true } },
          tipoSocioRel: { select: { nombre: true } },
          estadoSocioRel: { select: { nombre: true } },
        },
        orderBy: { apellidoNombre: 'asc' },
      })

      const items = socios.map(s => ({
        nroSocio: s.nroSocio || '',
        documento: s.documento || '',
        apellidoNombre: s.apellidoNombre || '',
        categoria: s.categoriaSocioRel?.nombre || '',
        tipoSocio: s.tipoSocioRel?.nombre || '',
        estado: s.estadoSocioRel?.nombre || '',
        esMenor: s.esMenor,
      }))

      return { items, summary: { total: items.length } }
    },
  },
  {
    key: 'morosos_por_actividad',
    label: 'Socios morosos por actividad / categoría',
    category: 'cuotas',
    description: 'Detalle de socios con cuotas vencidas, agrupado por actividad y categoría con salto de página entre grupos.',
    defaultParams: async (db, tenantId) => {
      if (!db || !tenantId) {
        return [
          { name: 'actividadIds', label: 'Actividad', type: 'multiselect', defaultValue: [], options: [] },
          { name: 'categoriaIds', label: 'Categoría', type: 'multiselect', defaultValue: [], options: [] },
          { name: 'fechaDesde', label: 'Vence desde', type: 'date', defaultValue: '' },
          { name: 'fechaHasta', label: 'Vence hasta', type: 'date', defaultValue: '' },
        ]
      }
      const [actividades, categorias] = await Promise.all([
        db.actividad.findMany({
          where: { tenantId, activo: true },
          select: { id: true, nombre: true },
          orderBy: { nombre: 'asc' },
        }),
        db.categoriaActividad.findMany({
          where: { tenantId, activo: true },
          select: { id: true, nombre: true, actividadId: true, actividad: { select: { nombre: true } } },
          orderBy: [{ actividad: { nombre: 'asc' } }, { nombre: 'asc' }],
        }),
      ])
      return [
        { name: 'actividadIds', label: 'Actividad', type: 'multiselect', defaultValue: [],
          options: actividades.map(a => ({ value: String(a.id), label: a.nombre })) },
        { name: 'categoriaIds', label: 'Categoría', type: 'multiselect', defaultValue: [],
          // dependsOn: filtra opciones según selección de actividadIds (campo `actividadId` en cada opción).
          dependsOn: { param: 'actividadIds', field: 'actividadId' },
          options: categorias.map(c => ({
            value: String(c.id),
            label: `${c.actividad?.nombre || ''} — ${c.nombre}`,
            actividadId: String(c.actividadId),
          })) },
        { name: 'fechaDesde', label: 'Vence desde', type: 'date', defaultValue: '' },
        { name: 'fechaHasta', label: 'Vence hasta', type: 'date', defaultValue: '' },
      ]
    },
    run: async (db, tenantId, params) => {
      const toIntArr = (v) => {
        if (v == null || v === '') return []
        const arr = Array.isArray(v) ? v : String(v).split(',')
        return arr.map(x => parseInt(x)).filter(n => Number.isFinite(n))
      }
      const actividadIds = toIntArr(params.actividadIds)
      const categoriaIds = toIntArr(params.categoriaIds)
      const hoy = new Date()

      // Filtro base: cargos pendientes ASOCIADOS A UNA ACTIVIDAD (no cuota social)
      const where = {
        tenantId,
        estado: 'PENDIENTE',
        categoriaActividadId: { not: null },
      }

      // Vencimiento: por defecto vencidas (fechaVencimiento < hoy);
      // si el usuario especifica un rango lo aplicamos sobre fechaVencimiento.
      if (params.fechaDesde || params.fechaHasta) {
        where.fechaVencimiento = {}
        if (params.fechaDesde) where.fechaVencimiento.gte = new Date(params.fechaDesde)
        if (params.fechaHasta) where.fechaVencimiento.lte = new Date(params.fechaHasta + 'T23:59:59')
      } else {
        where.fechaVencimiento = { lt: hoy }
      }

      // Si vienen ambos filtros, AND: la categoría debe estar en la lista Y pertenecer
      // a una de las actividades elegidas.
      if (categoriaIds.length > 0 && actividadIds.length > 0) {
        where.categoriaActividadId = { in: categoriaIds }
        where.categoriaActividad = { actividadId: { in: actividadIds } }
      } else if (categoriaIds.length > 0) {
        where.categoriaActividadId = { in: categoriaIds }
      } else if (actividadIds.length > 0) {
        where.categoriaActividad = { actividadId: { in: actividadIds } }
      }

      const cargos = await db.cargo.findMany({
        where,
        include: {
          socio: { select: { nroSocio: true, apellidoNombre: true, documento: true, celular: true, email: true } },
          periodo: { select: { nombre: true, anio: true, mes: true } },
          categoriaActividad: {
            select: {
              id: true, nombre: true,
              actividad: { select: { id: true, nombre: true } },
            },
          },
        },
        orderBy: [
          { categoriaActividad: { actividad: { nombre: 'asc' } } },
          { categoriaActividad: { nombre: 'asc' } },
          { socio: { apellidoNombre: 'asc' } },
          { fechaVencimiento: 'asc' },
        ],
      })

      // Agrupar: actividad → categoría → socio → cuotas
      const groupsMap = new Map()
      for (const c of cargos) {
        const actNombre = c.categoriaActividad?.actividad?.nombre || 'Sin actividad'
        const catNombre = c.categoriaActividad?.nombre || 'Sin categoría'
        const groupKey = `${actNombre}::${catNombre}`
        if (!groupsMap.has(groupKey)) {
          groupsMap.set(groupKey, {
            actividad: actNombre,
            categoria: catNombre,
            socios: new Map(),
          })
        }
        const g = groupsMap.get(groupKey)
        const sid = c.socioId
        if (!g.socios.has(sid)) {
          g.socios.set(sid, {
            nroSocio: c.socio?.nroSocio || '',
            apellidoNombre: c.socio?.apellidoNombre || '',
            documento: c.socio?.documento || '',
            celular: c.socio?.celular || '',
            email: c.socio?.email || '',
            cuotas: [],
            totalDeuda: 0,
            cantCuotas: 0,
          })
        }
        const s = g.socios.get(sid)
        const diasMora = c.fechaVencimiento
          ? Math.floor((hoy - new Date(c.fechaVencimiento)) / 86400000)
          : 0
        s.cuotas.push({
          periodo: c.periodo?.nombre || '',
          descripcion: c.descripcion || '',
          fechaVencimiento: c.fechaVencimiento,
          montoTotal: Number(c.montoTotal),
          diasMora: diasMora > 0 ? diasMora : 0,
        })
        s.totalDeuda += Number(c.montoTotal)
        s.cantCuotas++
      }

      // Convertir a array final + totales por grupo
      const groups = []
      let totalDeudaGeneral = 0
      let totalCuotasGeneral = 0
      let totalSociosGeneral = 0
      for (const g of groupsMap.values()) {
        const socios = Array.from(g.socios.values())
        const totalDeuda = socios.reduce((s, x) => s + x.totalDeuda, 0)
        const cantCuotas = socios.reduce((s, x) => s + x.cantCuotas, 0)
        groups.push({
          actividad: g.actividad,
          categoria: g.categoria,
          socios,
          totalDeuda,
          cantCuotas,
          cantSocios: socios.length,
        })
        totalDeudaGeneral += totalDeuda
        totalCuotasGeneral += cantCuotas
        totalSociosGeneral += socios.length
      }

      return {
        items: groups,
        summary: {
          totalGrupos: groups.length,
          totalSocios: totalSociosGeneral,
          totalCuotas: totalCuotasGeneral,
          totalDeuda: totalDeudaGeneral,
        },
      }
    },
  },
]

export async function listQueryDefinitions(db = null, tenantId = null) {
  return Promise.all(QUERY_DEFINITIONS.map(async d => ({
    key: d.key,
    label: d.label,
    category: d.category,
    description: d.description,
    defaultParams: typeof d.defaultParams === 'function'
      ? await d.defaultParams(db, tenantId)
      : d.defaultParams,
  })))
}

export function getQueryDefinition(key) {
  return QUERY_DEFINITIONS.find(d => d.key === key) || null
}

export async function runQuery(key, db, tenantId, params) {
  const def = getQueryDefinition(key)
  if (!def) throw new Error(`Query "${key}" no encontrada`)
  return def.run(db, tenantId, params)
}
