import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Calendar, Edit, Trash2, Copy, Eye, CheckCircle, Lock, FileText, Star, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'

export default function PresupuestosLista() {
  const [anios, setAnios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedAnios, setExpandedAnios] = useState([])
  const { showModal, ModalComponent } = useModal()
  const navigate = useNavigate()

  useEffect(() => {
    cargarPresupuestos()
  }, [])

  async function cargarPresupuestos() {
    try {
      setLoading(true)
      const res = await api.getFull('/admin/presupuestos/anios')
      setAnios(res.data || [])
      // Expandir el primer año por defecto
      if (res.data?.length > 0) {
        setExpandedAnios([res.data[0].anio])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function toggleAnio(anio) {
    setExpandedAnios(prev =>
      prev.includes(anio) ? prev.filter(a => a !== anio) : [...prev, anio]
    )
  }

  function crearPresupuesto() {
    const anioActual = new Date().getFullYear()
    showModal({
      type: 'info',
      title: 'Nuevo Presupuesto',
      message: 'Ingrese el año del presupuesto:',
      prompt: true,
      promptLabel: 'Año',
      promptPlaceholder: String(anioActual + 1),
      confirmText: 'Crear',
      onConfirm: async (anio) => {
        if (!anio) return
        try {
          const presupuesto = await api.post('/admin/presupuestos', { anio: parseInt(anio) })
          navigate(`/admin/contabilidad/presupuestos/${presupuesto.id}`)
        } catch (err) {
          showModal({
            type: 'error',
            message: err.message || 'Error al crear presupuesto'
          })
        }
      }
    })
  }

  function crearNuevaVersion(presupuesto) {
    showModal({
      type: 'info',
      title: 'Nueva Versión',
      message: `Crear nueva versión basada en "${presupuesto.nombre || 'v' + presupuesto.version}"`,
      prompt: true,
      promptLabel: 'Nombre (opcional)',
      promptPlaceholder: `Presupuesto ${presupuesto.anio} v${presupuesto.version + 1}`,
      confirmText: 'Crear',
      onConfirm: async (nombre) => {
        try {
          const nuevo = await api.post(`/admin/presupuestos/${presupuesto.id}/copiar`, {
            nombre: nombre || undefined
          })
          navigate(`/admin/contabilidad/presupuestos/${nuevo.id}`)
        } catch (err) {
          showModal({
            type: 'error',
            message: err.message || 'Error al crear versión'
          })
        }
      }
    })
  }

  function copiarAOtroAnio(presupuesto) {
    showModal({
      type: 'info',
      title: 'Copiar a otro año',
      message: `Copiar presupuesto ${presupuesto.anio} al año:`,
      prompt: true,
      promptLabel: 'Año destino',
      promptPlaceholder: String(presupuesto.anio + 1),
      confirmText: 'Siguiente',
      onConfirm: async (anioDestino) => {
        if (!anioDestino) return
        showModal({
          type: 'info',
          title: 'Ajuste de Montos',
          message: 'Porcentaje de ajuste (ej: 25 para +25%, -10 para -10%):',
          prompt: true,
          promptLabel: 'Porcentaje',
          promptPlaceholder: '0',
          confirmText: 'Copiar',
          onConfirm: async (porcentaje) => {
            try {
              const res = await api.post(`/admin/presupuestos/${presupuesto.id}/copiar`, {
                anioDestino: parseInt(anioDestino),
                porcentajeAjuste: parseFloat(porcentaje || 0)
              })
              showModal({
                type: 'success',
                message: `Presupuesto copiado al año ${anioDestino}`
              })
              cargarPresupuestos()
            } catch (err) {
              showModal({
                type: 'error',
                message: err.message || 'Error al copiar presupuesto'
              })
            }
          }
        })
      }
    })
  }

  function establecerPrincipal(presupuesto) {
    showModal({
      type: 'info',
      title: 'Establecer como Principal',
      message: `¿Establecer "${presupuesto.nombre || 'v' + presupuesto.version}" como versión principal para ${presupuesto.anio}?`,
      showCancel: true,
      confirmText: 'Confirmar',
      onConfirm: async () => {
        try {
          await api.post(`/admin/presupuestos/${presupuesto.id}/set-principal`)
          showModal({ type: 'success', message: 'Versión establecida como principal' })
          cargarPresupuestos()
        } catch (err) {
          showModal({ type: 'error', message: err.message || 'Error' })
        }
      }
    })
  }

  function eliminarPresupuesto(presupuesto) {
    if (presupuesto.estado !== 'BORRADOR') {
      showModal({
        type: 'warning',
        message: 'Solo se pueden eliminar presupuestos en estado BORRADOR'
      })
      return
    }

    showModal({
      type: 'warning',
      title: 'Eliminar Presupuesto',
      message: `¿Eliminar "${presupuesto.nombre || 'v' + presupuesto.version}"?`,
      confirmText: 'Eliminar',
      showCancel: true,
      onConfirm: async () => {
        try {
          await api.delete(`/admin/presupuestos/${presupuesto.id}`)
          showModal({ type: 'success', message: 'Presupuesto eliminado' })
          cargarPresupuestos()
        } catch (err) {
          showModal({ type: 'error', message: err.message || 'Error al eliminar' })
        }
      }
    })
  }

  function cambiarEstado(presupuesto, nuevoEstado) {
    const acciones = {
      APROBADO: { titulo: 'Aprobar', mensaje: '¿Aprobar este presupuesto?' },
      CERRADO: { titulo: 'Cerrar', mensaje: '¿Cerrar este presupuesto? No se podrán hacer más modificaciones.' }
    }

    const accion = acciones[nuevoEstado]
    if (!accion) return

    showModal({
      type: 'warning',
      title: accion.titulo,
      message: accion.mensaje,
      confirmText: accion.titulo,
      showCancel: true,
      onConfirm: async () => {
        try {
          await api.put(`/admin/presupuestos/${presupuesto.id}`, { estado: nuevoEstado })
          showModal({ type: 'success', message: `Presupuesto ${nuevoEstado.toLowerCase()}` })
          cargarPresupuestos()
        } catch (err) {
          showModal({ type: 'error', message: err.message || 'Error' })
        }
      }
    })
  }

  const getEstadoBadge = (estado) => {
    const estilos = {
      BORRADOR: 'bg-yellow-100 text-yellow-800',
      APROBADO: 'bg-green-100 text-green-800',
      CERRADO: 'bg-gray-100 text-gray-800'
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${estilos[estado] || 'bg-gray-100'}`}>
        {estado}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {ModalComponent}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Presupuestos Anuales</h1>
          <p className="text-gray-500 mt-1">Gestión de presupuestos con múltiples versiones por año</p>
        </div>
        <Button onClick={crearPresupuesto}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Presupuesto
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Lista por Años */}
      {anios.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No hay presupuestos</h3>
          <p className="text-gray-500 mt-2">Cree un nuevo presupuesto para comenzar</p>
        </div>
      ) : (
        <div className="space-y-4">
          {anios.map((grupo) => (
            <div key={grupo.anio} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Header del Año */}
              <div
                className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
                onClick={() => toggleAnio(grupo.anio)}
              >
                <div className="flex items-center gap-3">
                  {expandedAnios.includes(grupo.anio) ? (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  )}
                  <Calendar className="w-6 h-6 text-red-600" />
                  <h2 className="text-xl font-bold text-gray-900">{grupo.anio}</h2>
                  <span className="text-sm text-gray-500">
                    ({grupo.versiones.length} {grupo.versiones.length === 1 ? 'versión' : 'versiones'})
                  </span>
                </div>
              </div>

              {/* Versiones */}
              {expandedAnios.includes(grupo.anio) && (
                <div className="divide-y divide-gray-100">
                  {grupo.versiones.map((presupuesto) => (
                    <div
                      key={presupuesto.id}
                      className={`p-4 hover:bg-gray-50 ${presupuesto.esPrincipal ? 'bg-blue-50/50' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {presupuesto.esPrincipal && (
                            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" title="Versión Principal" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {presupuesto.nombre || `Versión ${presupuesto.version}`}
                              </span>
                              <span className="text-xs text-gray-400">v{presupuesto.version}</span>
                              {getEstadoBadge(presupuesto.estado)}
                            </div>
                            <span className="text-sm text-gray-500">
                              {presupuesto._count?.lineas || 0} líneas
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {!presupuesto.esPrincipal && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => establecerPrincipal(presupuesto)}
                              title="Establecer como principal"
                            >
                              <Star className="w-4 h-4 text-gray-400" />
                            </Button>
                          )}
                          {presupuesto.estado === 'BORRADOR' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cambiarEstado(presupuesto, 'APROBADO')}
                              title="Aprobar"
                            >
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          {presupuesto.estado === 'APROBADO' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cambiarEstado(presupuesto, 'CERRADO')}
                              title="Cerrar"
                            >
                              <Lock className="w-4 h-4 text-gray-600" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => crearNuevaVersion(presupuesto)}
                            title="Nueva versión"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copiarAOtroAnio(presupuesto)}
                            title="Copiar a otro año"
                          >
                            <Calendar className="w-4 h-4" />
                          </Button>
                          <Link to={`/admin/contabilidad/presupuestos/${presupuesto.id}/ejecucion`}>
                            <Button variant="ghost" size="sm" title="Ver ejecución">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link to={`/admin/contabilidad/presupuestos/${presupuesto.id}`}>
                            <Button variant="ghost" size="sm" title="Editar">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          {presupuesto.estado === 'BORRADOR' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => eliminarPresupuesto(presupuesto)}
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
