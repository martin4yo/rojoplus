import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Edit2, Trash2, Tag, Users, Activity, Wallet, Briefcase, Percent, CreditCard } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import api from '../../services/api'
import { tienePermiso, onPermisosLoaded, PERMISOS } from '../../services/permisos'
import { useConfirm } from '../../hooks/useConfirm'
import LoadingSpinner from '../../components/LoadingSpinner'

const COLORES = {
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  purple: 'bg-purple-100 text-purple-800',
  gray: 'bg-gray-100 text-gray-800',
  orange: 'bg-orange-100 text-orange-800',
}

const TITULOS = {
  'tipos-socio': 'Tipos de Socio',
  'categorias-socio': 'Categorías de Socio',
  'estados-socio': 'Estados de Socio',
  'conceptos-tesoreria': 'Conceptos',
  'cargos-personal': 'Cargos de Personal',
  'descuentos-disponibles': 'Descuentos Disponibles',
  'rubros': 'Rubros',
  'medios-pago': 'Medios de Pago',
  'categorias-cargo': 'Categorías de Cargo',
}

const ICONOS = {
  'tipos-socio': { icon: Tag, bgColor: 'bg-blue-100', color: 'text-blue-600' },
  'categorias-socio': { icon: Users, bgColor: 'bg-purple-100', color: 'text-purple-600' },
  'estados-socio': { icon: Activity, bgColor: 'bg-green-100', color: 'text-green-600' },
  'conceptos-tesoreria': { icon: Wallet, bgColor: 'bg-emerald-100', color: 'text-emerald-600' },
  'cargos-personal': { icon: Briefcase, bgColor: 'bg-rose-100', color: 'text-rose-600' },
  'descuentos-disponibles': { icon: Percent, bgColor: 'bg-amber-100', color: 'text-amber-600' },
  'rubros': { icon: Tag, bgColor: 'bg-cyan-100', color: 'text-cyan-600' },
  'medios-pago': { icon: CreditCard, bgColor: 'bg-violet-100', color: 'text-violet-600' },
  'categorias-cargo': { icon: Tag, bgColor: 'bg-orange-100', color: 'text-orange-600' },
}

export default function ConfiguracionLista() {
  const { tabla } = useParams()
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirm()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [items, setItems] = useState([])
  const [, forceUpdate] = useState(0)

  useEffect(() => onPermisosLoaded(() => forceUpdate(v => v + 1)), [])

  const titulo = TITULOS[tabla] || 'Configuración'
  const iconConfig = ICONOS[tabla] || { icon: Tag, bgColor: 'bg-gray-100', color: 'text-gray-600' }
  const Icon = iconConfig.icon

  useEffect(() => {
    cargarDatos()
  }, [tabla])

  async function cargarDatos() {
    setLoading(true)
    try {
      const data = await api.get(`/admin/${tabla}`)
      setItems(data || [])
    } catch (err) {
      setError('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  async function eliminar(id) {
    const confirmed = await confirm('Eliminar registro', '¿Eliminar este registro?')
    if (!confirmed) return

    setError(null)
    try {
      await api.delete(`/admin/${tabla}/${id}`)
      setSuccess('Eliminado correctamente')
      cargarDatos()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al eliminar')
    }
  }

  if (loading) {
    return (
      <LoadingSpinner />
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
            <div className={`p-2 rounded-lg ${iconConfig.bgColor}`}>
              <Icon className={`w-6 h-6 ${iconConfig.color}`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{titulo}</h1>
              <p className="text-gray-500 text-sm">{items.length} registros</p>
            </div>
          </div>
        </div>
{tienePermiso(PERMISOS.CONFIG_EDITAR) && (
          <Button
            onClick={() => navigate(`/admin/configuracion/${tabla}/nuevo`)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuevo
          </Button>
        )}
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success" className="mb-4" onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
              {tabla === 'tipos-socio' && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cuota Mensual</th>
              )}
              {tabla === 'categorias-socio' && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">% Descuento</th>
              )}
              {tabla === 'descuentos-disponibles' && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Porcentaje</th>
              )}
              {tabla === 'estados-socio' && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clubix</th>
              )}
              {tabla === 'medios-pago' && (
                <>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comisión</th>
                </>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map(item => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono text-gray-600">
                  {tabla === 'descuentos-disponibles' ? `#${item.id}` : tabla === 'rubros' ? `#${item.id}` : item.codigo}
                </td>
                <td className="px-4 py-3">
                  {tabla === 'rubros' || tabla === 'descuentos-disponibles' || tabla === 'medios-pago' ? (
                    <span className="text-sm font-medium text-gray-800">{item.nombre}</span>
                  ) : (
                    <span className={`px-2 py-1 text-sm rounded-full ${COLORES[item.color] || COLORES.gray}`}>
                      {item.nombre}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.descripcion || '-'}</td>
                {tabla === 'categorias-socio' && (
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.porcentajeDescuento > 0 ? `${item.porcentajeDescuento}%` : '-'}
                  </td>
                )}
                {tabla === 'descuentos-disponibles' && (
                  <td className="px-4 py-3 text-sm font-semibold text-green-600">
                    {item.porcentaje}%
                  </td>
                )}
                {tabla === 'estados-socio' && (
                  <td className="px-4 py-3 text-sm">
                    {item.permiteDescuentos ? (
                      <span className="text-green-600 font-medium">Habilitado</span>
                    ) : (
                      <span className="text-gray-400">No</span>
                    )}
                  </td>
                )}
                {tabla === 'medios-pago' && (
                  <>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.tipo}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {Number(item.comisionPct) > 0 ? `${item.comisionPct}%` : '-'}
                    </td>
                  </>
                )}
                <td className="px-4 py-3 text-sm text-gray-600">{item.orden}</td>
                <td className="px-4 py-3 text-sm">
                  {item.activo ? (
                    <span className="text-green-600">Activo</span>
                  ) : (
                    <span className="text-red-600">Inactivo</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {tienePermiso(PERMISOS.CONFIG_EDITAR) && (
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => navigate(`/admin/configuracion/${tabla}/${item.id}`)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => eliminar(item.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No hay registros. Haz clic en "Nuevo" para agregar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ConfirmDialog */}
      <ConfirmDialog />
    </div>
  )
}
