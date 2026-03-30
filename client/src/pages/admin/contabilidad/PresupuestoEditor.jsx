import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2, Calculator, AlertCircle, Star } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default function PresupuestoEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()

  const [presupuesto, setPresupuesto] = useState(null)
  const [cuentas, setCuentas] = useState([])
  const [conceptos, setConceptos] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Filas del presupuesto: { tipo: 'CUENTA'|'CONCEPTO', id, nombre, meses: {1: monto, 2: monto, ...}, total }
  const [filas, setFilas] = useState([])
  const [filasModificadas, setFilasModificadas] = useState(new Set())

  // Modal para agregar línea
  const [showAddModal, setShowAddModal] = useState(false)
  const [tipoNuevaLinea, setTipoNuevaLinea] = useState('CUENTA')
  const [seleccionNuevaLinea, setSeleccionNuevaLinea] = useState('')

  // Modal para distribuir total
  const [showDistribuirModal, setShowDistribuirModal] = useState(false)
  const [filaDistribuir, setFilaDistribuir] = useState(null)
  const [montoDistribuir, setMontoDistribuir] = useState('')

  useEffect(() => {
    cargarDatos()
  }, [id])

  async function cargarDatos() {
    try {
      setLoading(true)
      const [presRes, cuentasRes, conceptosRes] = await Promise.all([
        api.getFull(`/admin/presupuestos/${id}`),
        api.getFull('/admin/cuentas-contables?flat=true'),
        api.getFull('/admin/conceptos-tesoreria')
      ])

      setPresupuesto(presRes.data)
      setCuentas(cuentasRes.data || [])
      setConceptos(conceptosRes.data || [])

      // Convertir lineas a filas agrupadas
      const filasMap = {}
      for (const linea of (presRes.data.lineas || [])) {
        let key, nombre, tipo, itemId, tipoCuenta
        if (linea.cuentaContableId) {
          key = `cuenta_${linea.cuentaContableId}`
          nombre = linea.cuentaContable?.nombre || 'Cuenta sin nombre'
          tipo = 'CUENTA'
          itemId = linea.cuentaContableId
          tipoCuenta = linea.cuentaContable?.tipo || 'EGRESO'
        } else {
          key = `concepto_${linea.conceptoId}`
          nombre = linea.concepto?.nombre || 'Concepto sin nombre'
          tipo = 'CONCEPTO'
          itemId = linea.conceptoId
          // Para conceptos, usar el tipo de la cuenta contable asociada
          tipoCuenta = linea.concepto?.cuentaContable?.tipo || linea.concepto?.tipo || 'EGRESO'
        }

        if (!filasMap[key]) {
          filasMap[key] = {
            key,
            tipo,
            id: itemId,
            nombre,
            tipoCuenta, // INGRESO o EGRESO
            meses: {},
            total: 0
          }
        }

        filasMap[key].meses[linea.mes] = parseFloat(linea.montoPresupuestado)
        filasMap[key].total += parseFloat(linea.montoPresupuestado)
      }

      setFilas(Object.values(filasMap))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleMontoChange(filaKey, mes, valor) {
    setFilas(prev => prev.map(fila => {
      if (fila.key !== filaKey) return fila

      const nuevosMeses = { ...fila.meses }
      const nuevoValor = valor === '' ? 0 : parseFloat(valor) || 0
      nuevosMeses[mes] = nuevoValor

      const nuevoTotal = Object.values(nuevosMeses).reduce((sum, v) => sum + (v || 0), 0)

      return { ...fila, meses: nuevosMeses, total: nuevoTotal }
    }))
    setFilasModificadas(prev => new Set([...prev, filaKey]))
  }

  function agregarLinea() {
    if (!seleccionNuevaLinea) {
      showModal({ type: 'warning', message: 'Seleccione una cuenta o concepto' })
      return
    }

    const itemId = parseInt(seleccionNuevaLinea)
    const key = tipoNuevaLinea === 'CUENTA' ? `cuenta_${itemId}` : `concepto_${itemId}`

    // Verificar si ya existe
    if (filas.find(f => f.key === key)) {
      showModal({ type: 'warning', message: 'Esta cuenta/concepto ya está en el presupuesto' })
      return
    }

    const item = tipoNuevaLinea === 'CUENTA'
      ? cuentas.find(c => c.id === itemId)
      : conceptos.find(c => c.id === itemId)

    if (!item) return

    // Determinar tipoCuenta (INGRESO/EGRESO)
    let tipoCuenta = 'EGRESO'
    if (tipoNuevaLinea === 'CUENTA') {
      tipoCuenta = item.tipo || 'EGRESO'
    } else {
      // Para conceptos, usar el tipo de la cuenta contable asociada o el tipo del concepto
      tipoCuenta = item.cuentaContable?.tipo || item.tipo || 'EGRESO'
    }

    const nuevaFila = {
      key,
      tipo: tipoNuevaLinea,
      id: itemId,
      nombre: item.nombre,
      tipoCuenta,
      meses: {},
      total: 0
    }

    setFilas(prev => [...prev, nuevaFila])
    setShowAddModal(false)
    setSeleccionNuevaLinea('')
  }

  function eliminarLinea(filaKey) {
    showModal({
      type: 'warning',
      title: 'Eliminar línea',
      message: '¿Eliminar esta línea del presupuesto?',
      showCancel: true,
      confirmText: 'Eliminar',
      onConfirm: () => {
        setFilas(prev => prev.filter(f => f.key !== filaKey))
        setFilasModificadas(prev => {
          const nuevo = new Set(prev)
          nuevo.add(filaKey + '_deleted')
          return nuevo
        })
      }
    })
  }

  function abrirDistribuirModal(fila) {
    setFilaDistribuir(fila)
    setMontoDistribuir(fila.total > 0 ? String(fila.total) : '')
    setShowDistribuirModal(true)
  }

  function distribuirMonto() {
    if (!filaDistribuir || !montoDistribuir) return

    const total = parseFloat(montoDistribuir) || 0
    const montoPorMes = Math.round((total / 12) * 100) / 100 // Redondear a 2 decimales

    // Calcular el ajuste para que sume exactamente el total
    const sumaRedondeada = montoPorMes * 12
    const diferencia = Math.round((total - sumaRedondeada) * 100) / 100

    setFilas(prev => prev.map(fila => {
      if (fila.key !== filaDistribuir.key) return fila

      const nuevosMeses = {}
      for (let mes = 1; mes <= 12; mes++) {
        // Agregar la diferencia al último mes para que sume exacto
        nuevosMeses[mes] = mes === 12 ? montoPorMes + diferencia : montoPorMes
      }

      return { ...fila, meses: nuevosMeses, total }
    }))

    setFilasModificadas(prev => new Set([...prev, filaDistribuir.key]))
    setShowDistribuirModal(false)
    setFilaDistribuir(null)
    setMontoDistribuir('')
  }

  async function guardarPresupuesto() {
    if (presupuesto.estado === 'CERRADO') {
      showModal({ type: 'warning', message: 'No se puede modificar un presupuesto cerrado' })
      return
    }

    setSaving(true)
    try {
      // Preparar todas las líneas para guardar
      const lineas = []
      for (const fila of filas) {
        for (let mes = 1; mes <= 12; mes++) {
          const monto = fila.meses[mes] || 0
          lineas.push({
            cuentaContableId: fila.tipo === 'CUENTA' ? fila.id : null,
            conceptoId: fila.tipo === 'CONCEPTO' ? fila.id : null,
            mes,
            montoPresupuestado: monto
          })
        }
      }

      await api.post(`/admin/presupuestos/${id}/lineas/bulk`, { lineas })

      setFilasModificadas(new Set())
      showModal({ type: 'success', message: 'Presupuesto guardado correctamente' })
    } catch (err) {
      showModal({ type: 'error', message: err.message || 'Error al guardar' })
    } finally {
      setSaving(false)
    }
  }

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(amount || 0)
  }

  // Calcular totales separados para ingresos, egresos y resultado
  const totalIngresos = filas
    .filter(f => f.tipoCuenta === 'INGRESO')
    .reduce((sum, fila) => sum + fila.total, 0)
  const totalEgresos = filas
    .filter(f => f.tipoCuenta !== 'INGRESO')
    .reduce((sum, fila) => sum + fila.total, 0)
  const totalGeneral = totalIngresos + totalEgresos // Egresos ya son negativos

  const totalesPorMes = {}
  const ingresosPorMes = {}
  const egresosPorMes = {}
  for (let mes = 1; mes <= 12; mes++) {
    ingresosPorMes[mes] = filas
      .filter(f => f.tipoCuenta === 'INGRESO')
      .reduce((sum, fila) => sum + (fila.meses[mes] || 0), 0)
    egresosPorMes[mes] = filas
      .filter(f => f.tipoCuenta !== 'INGRESO')
      .reduce((sum, fila) => sum + (fila.meses[mes] || 0), 0)
    totalesPorMes[mes] = ingresosPorMes[mes] + egresosPorMes[mes]
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  if (!presupuesto) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        Presupuesto no encontrado
      </div>
    )
  }

  const esEditable = presupuesto.estado !== 'CERRADO'

  return (
    <div className="space-y-6">
      {ModalComponent}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link to="/admin/contabilidad/presupuestos">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {presupuesto.nombre || `Presupuesto ${presupuesto.anio}`}
              </h1>
              <span className="text-sm text-gray-400">v{presupuesto.version}</span>
              {presupuesto.esPrincipal && (
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" title="Versión Principal" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                presupuesto.estado === 'BORRADOR' ? 'bg-yellow-100 text-yellow-800' :
                presupuesto.estado === 'APROBADO' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {presupuesto.estado}
              </span>
              {filasModificadas.size > 0 && (
                <span className="text-sm text-orange-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  Cambios sin guardar
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {esEditable && (
            <>
              <Button variant="outline" onClick={() => setShowAddModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Agregar Línea
              </Button>
              <Button onClick={guardarPresupuesto} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Grilla de Presupuesto */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64 sticky left-0 bg-gray-50">
                  Cuenta / Concepto
                </th>
                {MESES.map((mes, index) => (
                  <th key={index} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    {mes}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32 bg-gray-100">
                  Total
                </th>
                {esEditable && (
                  <th className="px-2 py-3 w-12"></th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filas.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-8 text-center text-gray-500">
                    No hay líneas en este presupuesto. Use "Agregar Línea" para comenzar.
                  </td>
                </tr>
              ) : (
                filas.map((fila) => (
                  <tr key={fila.key} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap sticky left-0 bg-white">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 text-xs rounded ${
                          fila.tipo === 'CUENTA' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {fila.tipo === 'CUENTA' ? 'Cta' : 'Cpto'}
                        </span>
                        <span className={`px-1.5 py-0.5 text-xs rounded font-bold ${
                          fila.tipoCuenta === 'INGRESO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`} title={fila.tipoCuenta === 'INGRESO' ? 'Ingreso (usar valor positivo)' : 'Egreso (usar valor negativo)'}>
                          {fila.tipoCuenta === 'INGRESO' ? '+' : '−'}
                        </span>
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[160px]" title={fila.nombre}>
                          {fila.nombre}
                        </span>
                      </div>
                    </td>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map((mes) => (
                      <td key={mes} className="px-1 py-2">
                        {esEditable ? (
                          <input
                            type="number"
                            className="w-full px-2 py-1 text-right text-sm border border-gray-200 rounded focus:border-red-500 focus:ring-1 focus:ring-red-500"
                            value={fila.meses[mes] || ''}
                            onChange={(e) => handleMontoChange(fila.key, mes, e.target.value)}
                            placeholder="0"
                          />
                        ) : (
                          <div className="text-sm text-right text-gray-700">
                            {formatMoney(fila.meses[mes] || 0)}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-medium text-gray-900 bg-gray-50">
                      {esEditable ? (
                        <button
                          onClick={() => abrirDistribuirModal(fila)}
                          className="flex items-center justify-end gap-1 w-full hover:text-red-600 group"
                          title="Click para distribuir total en todos los meses"
                        >
                          <Calculator className="w-3 h-3 opacity-0 group-hover:opacity-100 text-red-500" />
                          {formatMoney(fila.total)}
                        </button>
                      ) : (
                        formatMoney(fila.total)
                      )}
                    </td>
                    {esEditable && (
                      <td className="px-2 py-2">
                        <button
                          onClick={() => eliminarLinea(fila.key)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Eliminar línea"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              {/* Fila de Ingresos */}
              <tr className="bg-green-50 font-medium">
                <td className="px-4 py-2 text-sm text-green-800 sticky left-0 bg-green-50">
                  <span className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 text-xs rounded font-bold bg-green-200 text-green-700">+</span>
                    INGRESOS
                  </span>
                </td>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map((mes) => (
                  <td key={mes} className="px-2 py-2 text-right text-sm text-green-700">
                    {formatMoney(ingresosPorMes[mes])}
                  </td>
                ))}
                <td className="px-4 py-2 text-right text-sm font-bold text-green-800 bg-green-100">
                  {formatMoney(totalIngresos)}
                </td>
                {esEditable && <td className="bg-green-50"></td>}
              </tr>
              {/* Fila de Egresos */}
              <tr className="bg-red-50 font-medium">
                <td className="px-4 py-2 text-sm text-red-800 sticky left-0 bg-red-50">
                  <span className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 text-xs rounded font-bold bg-red-200 text-red-700">−</span>
                    EGRESOS
                  </span>
                </td>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map((mes) => (
                  <td key={mes} className="px-2 py-2 text-right text-sm text-red-700">
                    {formatMoney(egresosPorMes[mes])}
                  </td>
                ))}
                <td className="px-4 py-2 text-right text-sm font-bold text-red-800 bg-red-100">
                  {formatMoney(totalEgresos)}
                </td>
                {esEditable && <td className="bg-red-50"></td>}
              </tr>
              {/* Fila de Resultado */}
              <tr className="bg-gray-200 font-bold">
                <td className="px-4 py-3 text-sm text-gray-900 sticky left-0 bg-gray-200">
                  RESULTADO
                </td>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map((mes) => (
                  <td key={mes} className={`px-2 py-3 text-right text-sm ${totalesPorMes[mes] >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatMoney(totalesPorMes[mes])}
                  </td>
                ))}
                <td className={`px-4 py-3 text-right text-base bg-gray-300 ${totalGeneral >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatMoney(totalGeneral)}
                </td>
                {esEditable && <td className="bg-gray-200"></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Modal Agregar Línea */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Agregar Línea</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                <div className="flex gap-2">
                  <button
                    className={`flex-1 py-2 px-4 rounded-lg border ${
                      tipoNuevaLinea === 'CUENTA'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-white border-gray-300 text-gray-700'
                    }`}
                    onClick={() => { setTipoNuevaLinea('CUENTA'); setSeleccionNuevaLinea('') }}
                  >
                    Cuenta Contable
                  </button>
                  <button
                    className={`flex-1 py-2 px-4 rounded-lg border ${
                      tipoNuevaLinea === 'CONCEPTO'
                        ? 'bg-purple-50 border-purple-500 text-purple-700'
                        : 'bg-white border-gray-300 text-gray-700'
                    }`}
                    onClick={() => { setTipoNuevaLinea('CONCEPTO'); setSeleccionNuevaLinea('') }}
                  >
                    Concepto
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {tipoNuevaLinea === 'CUENTA' ? 'Cuenta Contable' : 'Concepto'}
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  value={seleccionNuevaLinea}
                  onChange={(e) => setSeleccionNuevaLinea(e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {tipoNuevaLinea === 'CUENTA' ? (
                    cuentas
                      .filter(c => c.esImputable)
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>
                      ))
                  ) : (
                    conceptos.map(c => (
                      <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Cancelar
              </Button>
              <Button onClick={agregarLinea}>
                Agregar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Distribuir Total */}
      {showDistribuirModal && filaDistribuir && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Distribuir Total</h3>
            <p className="text-sm text-gray-500 mb-4">
              {filaDistribuir.nombre}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto anual a distribuir
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-right text-lg"
                    value={montoDistribuir}
                    onChange={(e) => setMontoDistribuir(e.target.value)}
                    placeholder="0"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') distribuirMonto()
                      if (e.key === 'Escape') setShowDistribuirModal(false)
                    }}
                  />
                </div>
              </div>

              {montoDistribuir && parseFloat(montoDistribuir) !== 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-600">
                    Se asignará <span className={`font-semibold ${parseFloat(montoDistribuir) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatMoney(parseFloat(montoDistribuir) / 12)}
                    </span> a cada mes
                  </p>
                  {parseFloat(montoDistribuir) < 0 && (
                    <p className="text-xs text-gray-500 mt-1">Valor negativo = Egreso</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowDistribuirModal(false)}>
                Cancelar
              </Button>
              <Button onClick={distribuirMonto} disabled={!montoDistribuir || parseFloat(montoDistribuir) === 0}>
                <Calculator className="w-4 h-4 mr-2" />
                Distribuir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
