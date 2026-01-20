import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, ChevronRight, ChevronDown, Edit2, Trash2, BookOpen, Layers } from 'lucide-react'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import api from '../../../services/api'

const TIPO_COLORES = {
  ACTIVO: 'bg-blue-100 text-blue-700',
  PASIVO: 'bg-red-100 text-red-700',
  PATRIMONIO: 'bg-purple-100 text-purple-700',
  INGRESO: 'bg-green-100 text-green-700',
  EGRESO: 'bg-orange-100 text-orange-700'
}

function CuentaItem({ cuenta, nivel = 0, onEdit, onDelete, onAddHijo, expandedIds, toggleExpand }) {
  const tieneHijos = cuenta.hijos && cuenta.hijos.length > 0
  const isExpanded = expandedIds.has(cuenta.id)
  const colorClase = TIPO_COLORES[cuenta.tipo] || 'bg-gray-100 text-gray-700'

  return (
    <>
      <tr className={`hover:bg-gray-50 ${!cuenta.activo ? 'opacity-50' : ''}`}>
        <td className="px-4 py-2">
          <div className="flex items-center" style={{ paddingLeft: `${nivel * 24}px` }}>
            {tieneHijos ? (
              <button
                onClick={() => toggleExpand(cuenta.id)}
                className="p-1 hover:bg-gray-200 rounded mr-2"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </button>
            ) : (
              <span className="w-6 mr-2" />
            )}
            <span className="font-mono text-sm text-gray-600">{cuenta.codigo}</span>
          </div>
        </td>
        <td className="px-4 py-2">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${cuenta.esImputable ? 'text-gray-900' : 'text-gray-600'}`}>
              {cuenta.nombre}
            </span>
            {!cuenta.esImputable && (
              <span className="text-xs text-gray-400">(agrupadora)</span>
            )}
          </div>
        </td>
        <td className="px-4 py-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClase}`}>
            {cuenta.tipo}
          </span>
        </td>
        <td className="px-4 py-2 text-center text-sm text-gray-500">
          {cuenta.nivel}
        </td>
        <td className="px-4 py-2 text-center">
          {cuenta.activo ? (
            <span className="text-green-600 text-sm">Activa</span>
          ) : (
            <span className="text-red-600 text-sm">Inactiva</span>
          )}
        </td>
        <td className="px-4 py-2 text-right">
          <div className="flex justify-end gap-1">
            <button
              onClick={() => onAddHijo(cuenta)}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
              title="Agregar subcuenta"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEdit(cuenta.id)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
              title="Editar"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            {cuenta.esImputable && (!cuenta.hijos || cuenta.hijos.length === 0) && (
              <button
                onClick={() => onDelete(cuenta.id)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </td>
      </tr>
      {tieneHijos && isExpanded && cuenta.hijos.map(hijo => (
        <CuentaItem
          key={hijo.id}
          cuenta={hijo}
          nivel={nivel + 1}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddHijo={onAddHijo}
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
        />
      ))}
    </>
  )
}

export default function PlanCuentasLista() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [cuentas, setCuentas] = useState([])
  const [expandedIds, setExpandedIds] = useState(new Set())
  const [filtroTipo, setFiltroTipo] = useState('')

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
      const res = await api.getFull('/admin/cuentas-contables')
      setCuentas(res.data || [])
      // Expandir primer nivel por defecto
      const primerNivel = new Set((res.data || []).map(c => c.id))
      setExpandedIds(primerNivel)
    } catch (err) {
      setError('Error al cargar el plan de cuentas')
    } finally {
      setLoading(false)
    }
  }

  function toggleExpand(id) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function expandirTodo() {
    // Recolectar todos los IDs recursivamente
    function collectIds(cuentas) {
      let ids = []
      for (const c of cuentas) {
        ids.push(c.id)
        if (c.hijos && c.hijos.length > 0) {
          ids = ids.concat(collectIds(c.hijos))
        }
      }
      return ids
    }
    setExpandedIds(new Set(collectIds(cuentas)))
  }

  function contraerTodo() {
    setExpandedIds(new Set())
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta cuenta contable?')) return

    try {
      await api.delete(`/admin/cuentas-contables/${id}`)
      setSuccess('Cuenta eliminada correctamente')
      cargarDatos()
    } catch (err) {
      setError(err.message || 'Error al eliminar')
    }
  }

  function handleAddHijo(cuentaPadre) {
    navigate(`/admin/contabilidad/plan-cuentas/nuevo?padreId=${cuentaPadre.id}&tipo=${cuentaPadre.tipo}`)
  }

  // Filtrar por tipo si hay filtro
  const cuentasFiltradas = filtroTipo
    ? cuentas.filter(c => c.tipo === filtroTipo)
    : cuentas

  // Contar cuentas por tipo
  function contarPorTipo(cuentas, tipo) {
    let count = 0
    for (const c of cuentas) {
      if (c.tipo === tipo) count++
      if (c.hijos) count += contarPorTipo(c.hijos, tipo)
    }
    return count
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/configuracion')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100">
              <BookOpen className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Plan de Cuentas</h1>
              <p className="text-gray-500 text-sm">Estructura contable del club</p>
            </div>
          </div>
        </div>
        <Button onClick={() => navigate('/admin/contabilidad/plan-cuentas/nuevo')}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Cuenta
        </Button>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success" className="mb-4" onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Resumen por tipo */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'EGRESO'].map(tipo => (
          <button
            key={tipo}
            onClick={() => setFiltroTipo(filtroTipo === tipo ? '' : tipo)}
            className={`p-3 rounded-lg border transition ${
              filtroTipo === tipo
                ? 'border-primary bg-primary/5'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${TIPO_COLORES[tipo]}`}>
              {tipo}
            </span>
            <p className="text-2xl font-bold text-gray-800 mt-1">
              {contarPorTipo(cuentas, tipo)}
            </p>
          </button>
        ))}
      </div>

      {/* Controles */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={expandirTodo}
          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1"
        >
          <Layers className="w-4 h-4" />
          Expandir todo
        </button>
        <button
          onClick={contraerTodo}
          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1"
        >
          <Layers className="w-4 h-4" />
          Contraer todo
        </button>
        {filtroTipo && (
          <button
            onClick={() => setFiltroTipo('')}
            className="px-3 py-1.5 text-sm text-primary hover:bg-primary/5 rounded-lg"
          >
            Limpiar filtro
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Codigo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Nivel</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {cuentasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No hay cuentas registradas
                </td>
              </tr>
            ) : (
              cuentasFiltradas.map(cuenta => (
                <CuentaItem
                  key={cuenta.id}
                  cuenta={cuenta}
                  nivel={0}
                  onEdit={(id) => navigate(`/admin/contabilidad/plan-cuentas/${id}`)}
                  onDelete={handleDelete}
                  onAddHijo={handleAddHijo}
                  expandedIds={expandedIds}
                  toggleExpand={toggleExpand}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
