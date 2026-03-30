import { useState, useEffect } from 'react'
import {
  CreditCardIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import api from '../../../services/api'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../../components/LoadingSpinner'

// Detectar marca de tarjeta por número
const detectarMarca = (numero) => {
  const num = numero.replace(/\s/g, '')
  if (!num) return null

  // Visa: empieza con 4
  if (/^4/.test(num)) return 'VISA'

  // Mastercard: 51-55 o 2221-2720
  if (/^5[1-5]/.test(num) || /^2(2[2-9][1-9]|2[3-9]\d|[3-6]\d{2}|7[01]\d|720)/.test(num)) return 'MASTERCARD'

  // American Express: 34 o 37
  if (/^3[47]/.test(num)) return 'AMEX'

  // Cabal: 6042, 6043, 6044, 6045, 5896
  if (/^(6042|6043|6044|6045|5896)/.test(num)) return 'CABAL'

  // Naranja: 589562
  if (/^589562/.test(num)) return 'NARANJA'

  return null
}

const MARCAS_INFO = {
  VISA: { label: 'Visa', color: 'text-blue-600', bg: 'bg-blue-50' },
  MASTERCARD: { label: 'Mastercard', color: 'text-orange-600', bg: 'bg-orange-50' },
  AMEX: { label: 'American Express', color: 'text-blue-800', bg: 'bg-blue-100' },
  CABAL: { label: 'Cabal', color: 'text-red-600', bg: 'bg-red-50' },
  NARANJA: { label: 'Naranja', color: 'text-orange-500', bg: 'bg-orange-50' },
}

// Componente logo de marca
const MarcaLogo = ({ marca, size = 'normal' }) => {
  const sizeClass = size === 'small' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
  const info = MARCAS_INFO[marca]
  if (!info) return null

  return (
    <span className={`inline-flex items-center gap-1.5 font-bold rounded-md ${sizeClass} ${info.bg} ${info.color}`}>
      {marca === 'VISA' && (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102h2.037zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.013 1.08.963 1.683 1.7 2.042.756.368 1.01.604 1.006.933-.005.504-.603.727-1.16.735-.975.015-1.54-.263-1.992-.474l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.375-2.568zm5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488l.233 1.12zm-2.166-2.656l1.02-2.815.588 2.815h-1.608zm-8.151-4.84l-1.603 7.496H8.34l1.605-7.496h1.944z"/>
        </svg>
      )}
      {marca === 'MASTERCARD' && (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.245 17.831h-6.49v-11.662h6.49v11.662zM9.167 12a7.404 7.404 0 012.833-5.831 7.39 7.39 0 00-4.6-1.593C3.313 4.576 0 7.889 0 12s3.313 7.424 7.4 7.424a7.39 7.39 0 004.6-1.593A7.404 7.404 0 019.167 12zM24 12c0 4.111-3.313 7.424-7.4 7.424a7.39 7.39 0 01-4.6-1.593 7.404 7.404 0 000-11.662 7.39 7.39 0 014.6-1.593C20.687 4.576 24 7.889 24 12z"/>
        </svg>
      )}
      {marca === 'AMEX' && (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm-1.5 6l-3 8h2l.5-1.5h3l.5 1.5h2l-3-8h-2zm1 1.5l1 3h-2l1-3zm4.5-1.5v8h2v-3h2v-2h-2v-1h2.5v-2h-4.5z"/>
        </svg>
      )}
      {(marca === 'CABAL' || marca === 'NARANJA') && (
        <CreditCardIcon className="w-4 h-4" />
      )}
      {info.label}
    </span>
  )
}

export default function DebitoAutomaticoSocio({ tokenPortal }) {
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [estado, setEstado] = useState(null)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [mostrarBaja, setMostrarBaja] = useState(false)

  const [formData, setFormData] = useState({
    tarjetaNumero: '',
    tarjetaVencimiento: '',
    tarjetaTitular: '',
  })

  // Marca detectada automáticamente
  const marcaDetectada = detectarMarca(formData.tarjetaNumero)

  const [motivoBaja, setMotivoBaja] = useState('')

  useEffect(() => {
    cargarEstado()
  }, [tokenPortal])

  const cargarEstado = async () => {
    try {
      setLoading(true)
      const data = await api.get(`/socio/${tokenPortal}/debito-automatico`)
      setEstado(data)
    } catch (err) {
      console.error('Error cargando estado de débito:', err)
      toast.error('Error al cargar información de débito automático')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validaciones de tarjeta
    if (!formData.tarjetaNumero || formData.tarjetaNumero.replace(/\s/g, '').length < 13) {
      toast.error('Ingresa un número de tarjeta válido')
      return
    }
    if (!marcaDetectada) {
      toast.error('No se pudo detectar la marca de la tarjeta. Verifica el número.')
      return
    }
    if (!formData.tarjetaVencimiento || !/^\d{2}\/\d{2}$/.test(formData.tarjetaVencimiento)) {
      toast.error('Ingresa el vencimiento en formato MM/AA')
      return
    }
    if (!formData.tarjetaTitular) {
      toast.error('Ingresa el nombre del titular de la tarjeta')
      return
    }

    try {
      setEnviando(true)
      const payload = {
        tipo: 'TARJETA',
        tarjetaNumero: formData.tarjetaNumero.replace(/\s/g, ''),
        tarjetaMarca: marcaDetectada,
        tarjetaVencimiento: formData.tarjetaVencimiento,
        tarjetaTitular: formData.tarjetaTitular,
      }
      const res = await api.post(`/socio/${tokenPortal}/debito-automatico/solicitar`, payload)
      toast.success(res.message || 'Solicitud enviada correctamente')
      setMostrarFormulario(false)
      setFormData({ tarjetaNumero: '', tarjetaVencimiento: '', tarjetaTitular: '' })
      cargarEstado()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al enviar solicitud')
    } finally {
      setEnviando(false)
    }
  }

  const handleBaja = async () => {
    try {
      setEnviando(true)
      const res = await api.post(`/socio/${tokenPortal}/debito-automatico/baja`, { motivo: motivoBaja })
      toast.success(res.message || 'Baja procesada correctamente')
      setMostrarBaja(false)
      setMotivoBaja('')
      cargarEstado()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al procesar la baja')
    } finally {
      setEnviando(false)
    }
  }

  const getEstadoInfo = () => {
    switch (estado?.estado) {
      case 'ACTIVO':
        return {
          icon: CheckCircleIcon,
          color: 'text-green-600',
          bg: 'bg-green-50',
          border: 'border-green-200',
          titulo: 'Débito Automático Activo',
          descripcion: 'Tus cuotas se debitan automáticamente cada mes.',
        }
      case 'PENDIENTE_APROBACION':
        return {
          icon: ClockIcon,
          color: 'text-yellow-600',
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          titulo: 'Solicitud Pendiente',
          descripcion: 'Tu solicitud está siendo revisada. Te notificaremos cuando sea aprobada.',
        }
      case 'BAJA_PENDIENTE':
        return {
          icon: ExclamationTriangleIcon,
          color: 'text-orange-600',
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          titulo: 'Débito Desactivado',
          descripcion: 'El débito automático está desactivado. Puedes volver a activarlo.',
        }
      default:
        return {
          icon: XCircleIcon,
          color: 'text-gray-500',
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          titulo: 'No Adherido',
          descripcion: 'Adherite al débito automático para pagar tus cuotas sin preocuparte.',
        }
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  const estadoInfo = getEstadoInfo()
  const EstadoIcon = estadoInfo.icon

  return (
    <div className="space-y-6">
      {/* Título */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-red-100 rounded-lg">
          <CreditCardIcon className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Débito Automático</h2>
          <p className="text-sm text-gray-500">Gestiona la adhesión al débito automático</p>
        </div>
      </div>

      {/* Estado actual */}
      <div className={`rounded-xl p-6 ${estadoInfo.bg} border ${estadoInfo.border}`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-full ${estadoInfo.bg}`}>
            <EstadoIcon className={`w-8 h-8 ${estadoInfo.color}`} />
          </div>
          <div className="flex-1">
            <h3 className={`text-lg font-semibold ${estadoInfo.color}`}>
              {estadoInfo.titulo}
            </h3>
            <p className="text-gray-600 mt-1">{estadoInfo.descripcion}</p>

            {/* Mostrar datos de tarjeta */}
            {estado?.tarjetaUltimos4 && (
              <div className="mt-4">
                <div className="flex items-center gap-3 text-sm">
                  <MarcaLogo marca={estado.tarjetaMarca} size="small" />
                  <span className="font-mono text-gray-600">**** **** **** {estado.tarjetaUltimos4}</span>
                  {estado.tarjetaVencimiento && (
                    <span className="text-gray-500 text-xs">Vto: {estado.tarjetaVencimiento}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Botones según estado */}
        <div className="mt-6 flex flex-wrap gap-3">
          {estado?.estado === 'NO_ADHERIDO' && (
            <button
              onClick={() => setMostrarFormulario(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              Adherirme al Débito Automático
            </button>
          )}

          {estado?.estado === 'ACTIVO' && (
            <button
              onClick={() => setMostrarBaja(true)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Dar de Baja
            </button>
          )}

          {estado?.estado === 'BAJA_PENDIENTE' && (
            <button
              onClick={() => setMostrarFormulario(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              Reactivar Débito Automático
            </button>
          )}
        </div>
      </div>

      {/* Beneficios */}
      {estado?.estado === 'NO_ADHERIDO' && (
        <div className="bg-gray-100 rounded-xl p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Beneficios del Débito Automático</h4>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-600">Nunca más te olvides de pagar la cuota</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-600">Evitá recargos por mora</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-600">Descuento del 5% en la cuota mensual</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-600">Comodidad: no tenés que acercarte al club</span>
            </li>
          </ul>
        </div>
      )}

      {/* Modal de adhesión */}
      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <CreditCardIcon className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                Adhesión con Tarjeta de Crédito
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Número + Vencimiento en la misma fila */}
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de tarjeta *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.tarjetaNumero}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 16)
                        const formatted = value.replace(/(\d{4})(?=\d)/g, '$1 ')
                        setFormData({ ...formData, tarjetaNumero: formatted })
                      }}
                      placeholder="1234 5678 9012 3456"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono text-sm pr-28"
                      required
                      maxLength={19}
                    />
                    {marcaDetectada && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <MarcaLogo marca={marcaDetectada} size="small" />
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vto *
                  </label>
                  <input
                    type="text"
                    value={formData.tarjetaVencimiento}
                    onChange={(e) => {
                      let value = e.target.value.replace(/\D/g, '').slice(0, 4)
                      if (value.length >= 2) {
                        value = value.slice(0, 2) + '/' + value.slice(2)
                      }
                      setFormData({ ...formData, tarjetaVencimiento: value })
                    }}
                    placeholder="MM/AA"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono text-sm text-center"
                    required
                    maxLength={5}
                  />
                </div>
              </div>

              {/* Titular */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titular (como figura en la tarjeta) *
                </label>
                <input
                  type="text"
                  value={formData.tarjetaTitular}
                  onChange={(e) => setFormData({ ...formData, tarjetaTitular: e.target.value.toUpperCase() })}
                  placeholder="JUAN PEREZ"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 uppercase text-sm"
                  required
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                <p className="text-xs text-blue-800">
                  <strong>Nota:</strong> El CVV no se solicita por seguridad.
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5">
                <p className="text-xs text-yellow-800">
                  <strong>Importante:</strong> La tarjeta debe estar a tu nombre o de un familiar autorizado.
                  La adhesión será revisada por el club antes de activarse.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMostrarFormulario(false)
                    setFormData({ tarjetaNumero: '', tarjetaVencimiento: '', tarjetaTitular: '' })
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm"
                  disabled={enviando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 text-sm"
                  disabled={enviando}
                >
                  {enviando ? 'Enviando...' : 'Enviar Solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de baja */}
      {mostrarBaja && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Dar de Baja el Débito Automático
            </h3>

            <p className="text-gray-600 mb-4">
              ¿Estás seguro que querés dar de baja el débito automático?
              Deberás pagar tus cuotas por otros medios.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo (opcional)
              </label>
              <textarea
                value={motivoBaja}
                onChange={(e) => setMotivoBaja(e.target.value)}
                placeholder="Contanos por qué das de baja..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setMostrarBaja(false)
                  setMotivoBaja('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                disabled={enviando}
              >
                Cancelar
              </button>
              <button
                onClick={handleBaja}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                disabled={enviando}
              >
                {enviando ? 'Procesando...' : 'Confirmar Baja'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
