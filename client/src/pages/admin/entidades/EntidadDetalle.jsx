import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Edit, Building2, UserCheck, Briefcase, Mail, Phone, MapPin, CreditCard, FileText } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'

const TIPO_CONFIG = {
  PROVEEDOR: {
    titulo: 'Proveedor',
    icon: Building2,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    ruta: '/admin/egresos/proveedores'
  },
  CLIENTE: {
    titulo: 'Cliente',
    icon: UserCheck,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    ruta: '/admin/ingresos/clientes'
  },
  PERSONAL: {
    titulo: 'Personal',
    icon: Briefcase,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    ruta: '/admin/egresos/personal'
  }
}

export default function EntidadDetalle({ tipo }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const config = TIPO_CONFIG[tipo]
  const Icon = config.icon

  const [entidad, setEntidad] = useState(null)
  const [cuentaCorriente, setCuentaCorriente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('datos')

  useEffect(() => {
    cargarDatos()
  }, [id])

  async function cargarDatos() {
    setLoading(true)
    try {
      const [entidadData, ccData] = await Promise.all([
        api.get(`/admin/entidades/${id}`),
        api.get(`/admin/entidades/${id}/cuenta-corriente`).catch(() => null)
      ])
      setEntidad(entidadData)
      setCuentaCorriente(ccData)
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!entidad) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Entidad no encontrada</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(config.ruta)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bgColor}`}>
              <Icon className={`w-6 h-6 ${config.color}`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{entidad.razonSocial}</h1>
              <p className="text-gray-500 text-sm">
                {entidad.codigo} - {entidad.nombreFantasia || config.titulo}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
            entidad.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {entidad.activo ? 'Activo' : 'Inactivo'}
          </span>
          <Button onClick={() => navigate(`${config.ruta}/${id}/editar`)}>
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => setTab('datos')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${
              tab === 'datos'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Datos
          </button>
          <button
            onClick={() => setTab('cuenta')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${
              tab === 'cuenta'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Cuenta Corriente
          </button>
        </div>
      </div>

      {tab === 'datos' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Datos basicos */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos Basicos</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-500">Tipo Documento</dt>
                <dd className="text-gray-800 font-medium">{entidad.tipoDocumento}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Documento</dt>
                <dd className="text-gray-800 font-medium">{entidad.documento || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Condicion IVA</dt>
                <dd className="text-gray-800 font-medium">{entidad.condicionIva || '-'}</dd>
              </div>
              {entidad.tipo === 'PERSONAL' && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Legajo</dt>
                    <dd className="text-gray-800 font-medium">{entidad.legajo || '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Cargo</dt>
                    <dd className="text-gray-800 font-medium">{entidad.cargo || '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Sueldo Basico</dt>
                    <dd className="text-gray-800 font-medium">
                      {entidad.sueldoBasico ? `$${Number(entidad.sueldoBasico).toLocaleString()}` : '-'}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          {/* Contacto */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Contacto</h2>
            <div className="space-y-3">
              {entidad.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <a href={`mailto:${entidad.email}`} className="text-primary hover:underline">
                    {entidad.email}
                  </a>
                </div>
              )}
              {entidad.telefono && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <a href={`tel:${entidad.telefono}`} className="text-primary hover:underline">
                    {entidad.telefono}
                  </a>
                </div>
              )}
              {(entidad.direccion || entidad.ciudad) && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-800">
                    {[entidad.direccion, entidad.ciudad].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Datos bancarios */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos Bancarios</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-gray-800">{entidad.banco || 'Sin banco registrado'}</p>
                  {entidad.cbu && <p className="text-sm text-gray-500 font-mono">CBU: {entidad.cbu}</p>}
                  {entidad.alias && <p className="text-sm text-gray-500">Alias: {entidad.alias}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Saldo */}
          {cuentaCorriente && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Saldo Cuenta Corriente</h2>
              <div className={`text-3xl font-bold ${
                cuentaCorriente.saldoPendiente > 0 ? 'text-red-600' :
                cuentaCorriente.saldoPendiente < 0 ? 'text-green-600' : 'text-gray-600'
              }`}>
                ${Math.abs(cuentaCorriente.saldoPendiente).toLocaleString()}
                {cuentaCorriente.saldoPendiente > 0 && <span className="text-sm font-normal ml-2">a pagar</span>}
                {cuentaCorriente.saldoPendiente < 0 && <span className="text-sm font-normal ml-2">a favor</span>}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Cuenta Corriente */
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Movimientos</h2>
            <div className={`text-lg font-bold ${
              cuentaCorriente?.saldoPendiente > 0 ? 'text-red-600' :
              cuentaCorriente?.saldoPendiente < 0 ? 'text-green-600' : 'text-gray-600'
            }`}>
              Saldo: ${Math.abs(cuentaCorriente?.saldoPendiente || 0).toLocaleString()}
            </div>
          </div>

          {cuentaCorriente?.movimientos?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Fecha</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Numero</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Tipo</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Concepto</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Monto</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Saldo</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {cuentaCorriente.movimientos.map((mov) => (
                    <tr key={mov.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        {new Date(mov.fecha).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm">{mov.numero}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">{mov.tipo.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-sm">{mov.concepto?.nombre || '-'}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        ${Number(mov.montoTotal).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        ${Number(mov.saldoPendiente).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          mov.estado === 'PAGADO' ? 'bg-green-100 text-green-700' :
                          mov.estado === 'PENDIENTE' ? 'bg-yellow-100 text-yellow-700' :
                          mov.estado === 'ANULADO' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {mov.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No hay movimientos registrados</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
