import { useState, useEffect } from 'react'
import api from '../../../services/api'
import { formatDate, formatCurrency } from '../../../utils/formatters'
import {
  CalendarIcon,
  MapPinIcon,
  TicketIcon,
  UserGroupIcon,
  XCircleIcon,
  ClockIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline'
import { useModal } from '../../../components/Modal'
import toast from 'react-hot-toast'

export default function EventosSocio({ socio, tokenPortal }) {
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [comprando, setComprando] = useState(false)
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null)
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null)
  const [cantidad, setCantidad] = useState(1)
  const { showModal, ModalComponent } = useModal()

  useEffect(() => {
    cargarEventos()
  }, [tokenPortal])

  const cargarEventos = async () => {
    try {
      setLoading(true)
      const data = await api.get(`/eventos/socio/${tokenPortal}/eventos`)
      setEventos(data || [])
    } catch (err) {
      console.error('Error cargando eventos:', err)
      toast.error('No se pudieron cargar los eventos')
    } finally {
      setLoading(false)
    }
  }

  const abrirModalCompra = (evento) => {
    setEventoSeleccionado(evento)
    setCategoriaSeleccionada(evento.categorias[0] || null)
    setCantidad(1)
  }

  const cerrarModal = () => {
    setEventoSeleccionado(null)
    setCategoriaSeleccionada(null)
    setCantidad(1)
  }

  const confirmarCompra = async () => {
    if (!categoriaSeleccionada) {
      toast.error('Selecciona una categoría')
      return
    }

    if (cantidad <= 0) {
      toast.error('La cantidad debe ser mayor a 0')
      return
    }

    // Validar capacidad disponible
    const disponibles = categoriaSeleccionada.capacidad
      ? categoriaSeleccionada.capacidad - categoriaSeleccionada.entradasVendidas
      : 999999

    if (cantidad > disponibles) {
      toast.error(`Solo quedan ${disponibles} entradas disponibles`)
      return
    }

    // Mostrar modal de confirmación antes de redirigir
    showModal({
      type: 'confirm',
      title: '¿Proceder con el pago?',
      message: (
        <div className="text-left space-y-3">
          <p>
            Serás redirigido a <strong>Mercado Pago</strong> para completar el pago de manera segura.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>💡 Importante:</strong> Si cambias de opinión, busca el botón{' '}
              <strong>"Volver"</strong> o <strong>"Volver al sitio"</strong> en la parte superior
              de la pantalla de Mercado Pago.
            </p>
          </div>
          <p className="text-sm text-gray-600">
            Total a pagar: <strong>{formatCurrency(categoriaSeleccionada.precioSocio * cantidad)}</strong>
          </p>
        </div>
      ),
      confirmText: 'Ir a Mercado Pago',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          setComprando(true)

          const response = await api.post(
            `/eventos/socio/${tokenPortal}/eventos/${eventoSeleccionado.id}/comprar`,
            {
              categoriaId: categoriaSeleccionada.id,
              cantidad: parseInt(cantidad)
            }
          )

          // Redirigir a Mercado Pago
          if (response.linkPago?.initPoint) {
            toast.success('Redirigiendo a Mercado Pago...')
            // Pequeña pausa para que el usuario vea el mensaje
            setTimeout(() => {
              window.location.href = response.linkPago.initPoint
            }, 1000)
          } else {
            throw new Error('No se pudo generar el link de pago')
          }
        } catch (err) {
          console.error('Error comprando entradas:', err)
          toast.error(err.message || 'Error al comprar entradas')
          setComprando(false)
        }
      }
    })
  }

  const getEstadoEvento = (evento) => {
    if (evento.estado === 'CANCELADO') {
      return { texto: 'Cancelado', color: 'text-red-600', bgColor: 'bg-red-100' }
    }
    if (evento.estado === 'FINALIZADO') {
      return { texto: 'Finalizado', color: 'text-gray-600', bgColor: 'bg-gray-100' }
    }
    if (evento.entradasVendidas >= evento.capacidadTotal && !evento.permiteSobreventa) {
      return { texto: 'Agotado', color: 'text-orange-600', bgColor: 'bg-orange-100' }
    }
    return { texto: 'Disponible', color: 'text-green-600', bgColor: 'bg-green-100' }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    )
  }

  if (eventos.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <TicketIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay eventos disponibles</h3>
        <p className="text-gray-500">
          Por el momento no hay eventos con venta de entradas habilitada.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header athletic */}
      <div>
        <div className="pub-eyebrow mb-3" style={{ color: 'var(--text-dim)' }}>
          Calendario
        </div>
        <h1 className="font-display-sport" style={{ fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: 0.96, color: 'var(--text)' }}>
          Próximos <span style={{ color: 'var(--color-primary)' }}>eventos</span>
        </h1>
        <p className="mt-3 text-sm md:text-base" style={{ color: 'var(--text-dim)' }}>
          Comprá tus entradas y cargalas a tu cuenta corriente.
        </p>
      </div>

      {/* Lista de eventos */}
      <div className="space-y-4">
        {eventos.map((evento) => {
          const estado = getEstadoEvento(evento)
          const disponibles = evento.capacidadTotal - evento.entradasVendidas

          return (
            <div
              key={evento.id}
              className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{evento.nombre}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${estado.bgColor} ${estado.color}`}
                      >
                        {estado.texto}
                      </span>
                    </div>
                    {evento.descripcion && (
                      <p className="text-gray-600 text-sm mb-3">{evento.descripcion}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center text-gray-700">
                    <CalendarIcon className="h-5 w-5 mr-2 text-red-500" />
                    <span className="text-sm">{formatDate(evento.fecha)}</span>
                  </div>
                  {evento.ubicacion && (
                    <div className="flex items-center text-gray-700">
                      <MapPinIcon className="h-5 w-5 mr-2 text-red-500" />
                      <span className="text-sm">{evento.ubicacion}</span>
                    </div>
                  )}
                  <div className="flex items-center text-gray-700">
                    <UserGroupIcon className="h-5 w-5 mr-2 text-red-500" />
                    <span className="text-sm">
                      {disponibles} / {evento.capacidadTotal} disponibles
                    </span>
                  </div>
                </div>

                {/* Categorías */}
                {evento.categorias.length > 0 && (
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                      Categorías de entrada
                    </h4>
                    <div className="space-y-2">
                      {evento.categorias.map((categoria) => {
                        const catDisponibles = categoria.capacidad
                          ? categoria.capacidad - categoria.entradasVendidas
                          : disponibles

                        return (
                          <div
                            key={categoria.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">
                                  {categoria.nombre}
                                </span>
                                {catDisponibles === 0 ? (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">
                                    Agotado
                                  </span>
                                ) : catDisponibles <= 10 ? (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-600">
                                    Últimas {catDisponibles}
                                  </span>
                                ) : null}
                              </div>
                              {categoria.descripcion && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {categoria.descripcion}
                                </p>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <div className="text-lg font-bold text-red-600">
                                {formatCurrency(categoria.precioSocio)}
                              </div>
                              <div className="text-xs text-gray-500">precio socio</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Botón comprar */}
                {estado.texto === 'Disponible' && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => abrirModalCompra(evento)}
                      className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center space-x-2"
                    >
                      <ShoppingCartIcon className="h-5 w-5" />
                      <span>Comprar Entradas</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal de compra */}
      {eventoSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Comprar Entradas</h3>
              <button
                onClick={cerrarModal}
                className="text-gray-400 hover:text-gray-600"
                disabled={comprando}
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-1">{eventoSeleccionado.nombre}</h4>
              <div className="flex items-center text-sm text-gray-600 space-x-3">
                <span className="flex items-center">
                  <CalendarIcon className="h-4 w-4 mr-1" />
                  {formatDate(eventoSeleccionado.fecha)}
                </span>
                {eventoSeleccionado.ubicacion && (
                  <span className="flex items-center">
                    <MapPinIcon className="h-4 w-4 mr-1" />
                    {eventoSeleccionado.ubicacion}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-4 mb-6">
              {/* Selector de categoría */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoría
                </label>
                <div className="space-y-2">
                  {eventoSeleccionado.categorias.map((categoria) => {
                    const catDisponibles = categoria.capacidad
                      ? categoria.capacidad - categoria.entradasVendidas
                      : 999999

                    return (
                      <button
                        key={categoria.id}
                        onClick={() => setCategoriaSeleccionada(categoria)}
                        disabled={catDisponibles === 0}
                        className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                          categoriaSeleccionada?.id === categoria.id
                            ? 'border-red-500 bg-red-50'
                            : catDisponibles === 0
                            ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                            : 'border-gray-200 hover:border-red-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">{categoria.nombre}</div>
                            {catDisponibles > 0 && (
                              <div className="text-xs text-gray-500">
                                {catDisponibles} disponibles
                              </div>
                            )}
                            {catDisponibles === 0 && (
                              <div className="text-xs text-red-600 font-semibold">Agotado</div>
                            )}
                          </div>
                          <div className="text-lg font-bold text-red-600">
                            {formatCurrency(categoria.precioSocio)}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Cantidad */}
              {categoriaSeleccionada && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cantidad
                  </label>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                      disabled={cantidad <= 1}
                      className="w-10 h-10 rounded-lg border-2 border-gray-300 flex items-center justify-center text-gray-600 font-bold hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      −
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cantidad}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '')
                        if (val === '') {
                          setCantidad('')
                        } else {
                          const num = parseInt(val)
                          const max = categoriaSeleccionada.capacidad
                            ? categoriaSeleccionada.capacidad - categoriaSeleccionada.entradasVendidas
                            : 100
                          setCantidad(Math.min(num, max))
                        }
                      }}
                      onBlur={() => {
                        if (cantidad === '' || cantidad < 1) {
                          setCantidad(1)
                        }
                      }}
                      className="w-20 h-10 text-center text-lg font-semibold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const max = categoriaSeleccionada.capacidad
                          ? categoriaSeleccionada.capacidad - categoriaSeleccionada.entradasVendidas
                          : 100
                        setCantidad(Math.min(cantidad + 1, max))
                      }}
                      disabled={
                        categoriaSeleccionada.capacidad &&
                        cantidad >= categoriaSeleccionada.capacidad - categoriaSeleccionada.entradasVendidas
                      }
                      className="w-10 h-10 rounded-lg border-2 border-gray-300 flex items-center justify-center text-gray-600 font-bold hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Máximo disponible:{' '}
                    {categoriaSeleccionada.capacidad
                      ? categoriaSeleccionada.capacidad - categoriaSeleccionada.entradasVendidas
                      : 'ilimitado'}
                  </p>
                </div>
              )}
            </div>

            {/* Total */}
            {categoriaSeleccionada && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">
                    {formatCurrency(categoriaSeleccionada.precioSocio * cantidad)}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex items-center justify-between">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <span className="text-xl font-bold text-red-600">
                    {formatCurrency(categoriaSeleccionada.precioSocio * cantidad)}
                  </span>
                </div>
              </div>
            )}

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-blue-800">
                <strong>Importante:</strong> Serás redirigido a Mercado Pago para completar el pago
                de manera segura. Una vez aprobado, recibirás tus entradas por email.
              </p>
            </div>

            {/* Botones */}
            <div className="flex space-x-3">
              <button
                onClick={cerrarModal}
                disabled={comprando}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarCompra}
                disabled={comprando || !categoriaSeleccionada}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {comprando ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <ShoppingCartIcon className="h-5 w-5" />
                    <span>Comprar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {ModalComponent}
    </div>
  )
}
