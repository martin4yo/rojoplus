import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { ArrowLeft, X, CreditCard, BookOpen, ChevronRight, Eye } from 'lucide-react'

const fmt = (v) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(v ?? 0)

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-AR') : '-'

const TIPOS_INGRESO_CONTABLE = ['FACTURA_VENTA', 'RECIBO_COBRO', 'NOTA_CREDITO_CLIENTE']

const TIPO_LABEL = {
  FACTURA_VENTA: 'Factura Venta', RECIBO_COBRO: 'Recibo Cobro',
  NOTA_CREDITO_CLIENTE: 'NC Cliente', FACTURA_COMPRA: 'Factura Compra',
  ORDEN_PAGO: 'Orden Pago', PAGO: 'Pago', NOTA_CREDITO_PROVEEDOR: 'NC Proveedor',
}

// Devuelve la ruta al detalle dedicado, o null si hay que caer al SlideOver
function rutaDetalle(mov, tipoTab) {
  if (tipoTab === 'caja') return `/admin/tesoreria/movimientos/${mov.id}`
  switch (mov.tipo) {
    case 'FACTURA_VENTA':   return `/admin/ingresos/facturas/${mov.id}`
    case 'RECIBO_COBRO':    return `/admin/ingresos/recibos/${mov.id}`
    case 'FACTURA_COMPRA':  return `/admin/egresos/facturas/${mov.id}`
    case 'ORDEN_PAGO':      return `/admin/egresos/ordenes-pago/${mov.id}`
    default: return null
  }
}

function Badge({ tipo }) {
  const esIngreso = tipo === 'INGRESO' || TIPOS_INGRESO_CONTABLE.includes(tipo)
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
      esIngreso ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {tipo === 'INGRESO' || tipo === 'EGRESO' ? tipo : (TIPO_LABEL[tipo] || tipo)}
    </span>
  )
}

function SlideOver({ mov, tipo, onClose }) {
  if (!mov) return null
  const esCaja = tipo === 'caja'
  const mc = esCaja ? mov.movimientoContable : null
  const movsCaja = !esCaja ? mov.movimientosCaja : null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div>
            <p className="text-xs text-gray-500">{esCaja ? 'Movimiento de Caja' : 'Movimiento Contable'}</p>
            <h2 className="text-lg font-bold text-gray-900">#{mov.numero}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-gray-500">Fecha</p><p className="font-medium">{fmtDate(mov.fecha)}</p></div>
            {esCaja ? (
              <>
                <div><p className="text-gray-500">Tipo</p><Badge tipo={mov.tipo} /></div>
                <div><p className="text-gray-500">Caja</p><p className="font-medium">{mov.caja?.nombre || '-'}</p></div>
                <div><p className="text-gray-500">Medio de pago</p><p className="font-medium">{mov.medioPagoRel?.nombre || '-'}</p></div>
                <div className="col-span-2"><p className="text-gray-500">Concepto</p><p className="font-medium">{mov.concepto}</p></div>
                {mov.pago?.socio && <div className="col-span-2"><p className="text-gray-500">Socio</p><p className="font-medium">{mov.pago.socio.apellidoNombre} (#{mov.pago.socio.nroSocio})</p></div>}
                <div><p className="text-gray-500">Monto</p><p className={`font-bold text-lg ${mov.tipo === 'INGRESO' ? 'text-green-600' : 'text-red-600'}`}>{fmt(mov.monto)}</p></div>
              </>
            ) : (
              <>
                <div><p className="text-gray-500">Tipo</p><Badge tipo={mov.tipo} /></div>
                <div><p className="text-gray-500">Comprobante</p><p className="font-medium">{mov.tipoComprobante} {mov.numeroComprobante || '-'}</p></div>
                <div><p className="text-gray-500">Estado</p><p className="font-medium">{mov.estado}</p></div>
                {mov.entidad && <div className="col-span-2"><p className="text-gray-500">Entidad</p><p className="font-medium">{mov.entidad.razonSocial}</p></div>}
                {mov.socio && <div className="col-span-2"><p className="text-gray-500">Socio</p><p className="font-medium">{mov.socio.apellidoNombre} (#{mov.socio.nroSocio})</p></div>}
                {mov.concepto && <div className="col-span-2"><p className="text-gray-500">Concepto</p><p className="font-medium">{mov.concepto.nombre}</p></div>}
                <div><p className="text-gray-500">Total</p><p className="font-bold text-lg">{fmt(mov.montoTotal)}</p></div>
                <div><p className="text-gray-500">Pagado</p><p className="font-medium text-green-600">{fmt(mov.montoPagado)}</p></div>
              </>
            )}
          </div>

          {!esCaja && mov.items?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Items
              </h3>
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-500 border-b"><th className="text-left pb-1">Descripción</th><th className="text-right pb-1">Cant.</th><th className="text-right pb-1">Subtotal</th></tr></thead>
                <tbody>
                  {mov.items.map((item, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1">{item.descripcion || '-'}</td>
                      <td className="text-right">{item.cantidad}</td>
                      <td className="text-right font-medium">{fmt(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {esCaja && mc && (
            <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
              <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Asiento contable vinculado
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-blue-600 text-xs">Número</p><p className="font-medium">#{mc.numero}</p></div>
                <div><p className="text-blue-600 text-xs">Total</p><p className="font-bold">{fmt(mc.montoTotal)}</p></div>
                {(mc.entidad || mc.socio) && (
                  <div className="col-span-2"><p className="text-blue-600 text-xs">Contraparte</p>
                    <p className="font-medium">{mc.entidad?.razonSocial || mc.socio?.apellidoNombre}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {!esCaja && movsCaja?.length > 0 && (
            <div className="border rounded-lg p-4 bg-green-50 border-green-200">
              <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Movimientos de caja vinculados
              </h3>
              <div className="space-y-2">
                {movsCaja.map(mc2 => (
                  <div key={mc2.id} className="flex items-center justify-between text-sm bg-white rounded p-2 border border-green-100">
                    <div>
                      <span className="font-medium">#{mc2.numero}</span>
                      <span className="text-gray-500 ml-2">{fmtDate(mc2.fecha)}</span>
                      <span className="text-gray-500 ml-2">{mc2.caja?.nombre}</span>
                    </div>
                    <span className={`font-bold ${mc2.tipo === 'INGRESO' ? 'text-green-600' : 'text-red-600'}`}>
                      {fmt(mc2.monto)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MovimientosCentroCosto() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [centros, setCentros] = useState([])
  const [centroCostoId, setCentroCostoId] = useState(searchParams.get('centroId') || '')
  const [fechaDesde, setFechaDesde] = useState(searchParams.get('fechaDesde') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [fechaHasta, setFechaHasta] = useState(searchParams.get('fechaHasta') || new Date().toISOString().slice(0, 10))
  const [tipo, setTipo] = useState('caja')

  // Nivel de navegación: null = grupos, string = concepto seleccionado
  const [conceptoSeleccionado, setConceptoSeleccionado] = useState(null)
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)

  useEffect(() => {
    api.get('/admin/centros-costo')
      .then(res => setCentros(Array.isArray(res) ? res : (res?.data || [])))
      .catch(() => {})
  }, [])

  // Al cambiar filtros principales, volver a nivel de grupos
  useEffect(() => {
    setConceptoSeleccionado(null)
    setPage(1)
  }, [centroCostoId, tipo, fechaDesde, fechaHasta])

  const cargar = useCallback(async () => {
    if (!centroCostoId) return
    setLoading(true)
    try {
      setError(null)
      const params = { tipo, fechaDesde, fechaHasta }
      if (conceptoSeleccionado) {
        params.concepto = conceptoSeleccionado
        params.page = page
      } else {
        params.agrupar = 1
      }
      const res = await api.get(`/admin/centros-costo/${centroCostoId}/movimientos`, { params })
      setData(res)
    } catch (err) {
      setError(err.message || 'Error al cargar movimientos')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [centroCostoId, tipo, fechaDesde, fechaHasta, conceptoSeleccionado, page])

  useEffect(() => { cargar() }, [cargar])

  const resultado = (data?.totales?.ingresos || 0) - (data?.totales?.egresos || 0)

  return (
    <div className="space-y-4">
      {/* Header con breadcrumb */}
      <div className="flex items-center gap-2">
        {conceptoSeleccionado ? (
          <>
            <button onClick={() => { setConceptoSeleccionado(null); setPage(1) }}
              className="p-1.5 rounded hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <button onClick={() => navigate('/admin/reportes/centros-costo')}
              className="text-sm text-gray-500 hover:text-gray-700">
              Centros de Costo
            </button>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <button onClick={() => { setConceptoSeleccionado(null); setPage(1) }}
              className="text-sm text-gray-500 hover:text-gray-700">
              {data?.centro?.nombre || 'Movimientos'}
            </button>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-800">{conceptoSeleccionado}</span>
          </>
        ) : (
          <>
            <button onClick={() => navigate('/admin/reportes/centros-costo')}
              className="p-1.5 rounded hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {data?.centro?.nombre || 'Movimientos por Centro de Costo'}
              </h1>
              {data?.centro && <p className="text-sm text-gray-500">{data.centro.codigo}</p>}
            </div>
          </>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-gray-600 mb-1">Centro de costo</label>
            <select value={centroCostoId} onChange={e => setCentroCostoId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/40 focus:border-primary">
              <option value="">Seleccionar...</option>
              {centros.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
            <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
            <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[['caja', 'Caja', CreditCard], ['contable', 'Contabilidad', BookOpen]].map(([val, label, Icon]) => (
          <button key={val} onClick={() => setTipo(val)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tipo === val ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* Totales */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-500">Ingresos</p>
            <p className="text-lg font-bold text-green-600">{fmt(data.totales.ingresos)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-500">Egresos</p>
            <p className="text-lg font-bold text-red-600">{fmt(data.totales.egresos)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-500">Resultado</p>
            <p className={`text-lg font-bold ${resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(resultado)}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? <LoadingSpinner /> : !centroCostoId ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-400">
          Seleccioná un centro de costo para ver sus movimientos
        </div>
      ) : !conceptoSeleccionado ? (
        /* ── Nivel 1: grupos por concepto ── */
        !data?.grupos?.length ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-400">
            Sin movimientos en el período
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Concepto</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Movimientos</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Ingresos</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Egresos</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Resultado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.grupos.map(g => {
                  const res = g.ingresos - g.egresos
                  return (
                    <tr key={g.concepto}
                      onClick={() => { setConceptoSeleccionado(g.concepto); setPage(1) }}
                      className="hover:bg-gray-50 cursor-pointer transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800">{TIPO_LABEL[g.concepto] || g.concepto}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{g.cantidad}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">{g.ingresos > 0 ? fmt(g.ingresos) : '-'}</td>
                      <td className="px-4 py-3 text-right text-red-600 font-medium">{g.egresos > 0 ? fmt(g.egresos) : '-'}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${res >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(res)}</td>
                      <td className="px-4 py-3 text-right"><ChevronRight className="w-4 h-4 text-gray-400 inline" /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* ── Nivel 2: movimientos individuales del concepto ── */
        !data?.movimientos?.length ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-400">
            Sin movimientos para este concepto
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Referencia</th>
                  {tipo === 'caja' && <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Caja</th>}
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Monto</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.movimientos.map(mov => {
                  const esIngreso = tipo === 'caja' ? mov.tipo === 'INGRESO' : TIPOS_INGRESO_CONTABLE.includes(mov.tipo)
                  const referencia = mov.pago?.socio?.apellidoNombre || mov.socio?.apellidoNombre || mov.entidad?.razonSocial
                    || (tipo === 'contable' ? `${mov.tipoComprobante || ''} ${mov.numeroComprobante || mov.numero}`.trim() : mov.numero)
                  const monto = tipo === 'caja' ? mov.monto : mov.montoTotal
                  const ruta = rutaDetalle(mov, tipo)
                  const abrirDetalle = () => ruta ? navigate(ruta) : setSeleccionado(mov)
                  return (
                    <tr key={mov.id} onClick={abrirDetalle}
                      className="hover:bg-gray-50 cursor-pointer transition-colors">
                      <td className="px-4 py-3 text-gray-600">{fmtDate(mov.fecha)}</td>
                      <td className="px-4 py-3"><Badge tipo={mov.tipo} /></td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{referencia}</td>
                      {tipo === 'caja' && <td className="px-4 py-3 text-gray-500">{mov.caja?.nombre || '-'}</td>}
                      <td className={`px-4 py-3 text-right font-semibold ${esIngreso ? 'text-green-600' : 'text-red-600'}`}>
                        {fmt(monto)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {tipo === 'caja' && mov.movimientoContable && <BookOpen className="w-3.5 h-3.5 text-blue-400" title="Tiene asiento contable vinculado" />}
                          {tipo === 'contable' && mov.movimientosCaja?.length > 0 && <CreditCard className="w-3.5 h-3.5 text-green-400" title="Tiene movimientos de caja vinculados" />}
                          <button
                            onClick={(e) => { e.stopPropagation(); abrirDetalle() }}
                            title="Ver detalle"
                            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-primary transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {data.pagination?.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <span className="text-sm text-gray-500">
                  Página {data.pagination.page} de {data.pagination.pages} · {data.pagination.total} registros
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-100">
                    Anterior
                  </button>
                  <button onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))} disabled={page >= data.pagination.pages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-100">
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      )}

      <SlideOver mov={seleccionado} tipo={tipo} onClose={() => setSeleccionado(null)} />
    </div>
  )
}
