import { useState, useEffect } from 'react'
import {
  Building2, Save, Shield, Upload, TestTube,
  CheckCircle, XCircle, Loader2, AlertTriangle,
  FileKey, Server
} from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'

const CONDICIONES_IVA = [
  { value: 'IVA Responsable Inscripto', label: 'IVA Responsable Inscripto' },
  { value: 'IVA Sujeto Exento', label: 'IVA Sujeto Exento' },
  { value: 'Responsable Monotributo', label: 'Responsable Monotributo' },
  { value: 'IVA no Responsable', label: 'IVA no Responsable' }
]

export default function ConfiguracionFiscal() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const [form, setForm] = useState({
    cuit: '',
    razonSocial: '',
    condicionIva: 'IVA Responsable Inscripto',
    domicilioFiscal: '',
    iibb: '',
    inicioActividad: '',
    modoProduccion: false
  })

  const [certificadoConfig, setCertificadoConfig] = useState({
    configurado: false
  })

  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)

  // Estado para subir certificados
  const [certFiles, setCertFiles] = useState({
    certificado: '',
    clavePrivada: ''
  })
  const [uploadingCert, setUploadingCert] = useState(false)

  useEffect(() => {
    cargarConfiguracion()
  }, [])

  async function cargarConfiguracion() {
    setLoading(true)
    try {
      const response = await api.get('/admin/facturacion/config')
      const config = response?.data || response

      if (config) {
        setForm({
          cuit: config.cuit || '',
          razonSocial: config.razonSocial || '',
          condicionIva: config.condicionIva || 'IVA Responsable Inscripto',
          domicilioFiscal: config.domicilioFiscal || '',
          iibb: config.iibb || '',
          inicioActividad: config.inicioActividad ? config.inicioActividad.split('T')[0] : '',
          modoProduccion: config.modoProduccion || false
        })
        setCertificadoConfig({
          configurado: config.certificadoPath === '*** configurado ***'
        })
      }
    } catch (err) {
      console.error('Error cargando configuracion:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!form.cuit || !form.razonSocial || !form.condicionIva || !form.domicilioFiscal) {
      setError('CUIT, razon social, condicion IVA y domicilio fiscal son requeridos')
      return
    }

    // Validar formato CUIT (11 digitos)
    const cuitLimpio = form.cuit.replace(/\D/g, '')
    if (cuitLimpio.length !== 11) {
      setError('El CUIT debe tener 11 digitos')
      return
    }

    setSaving(true)
    try {
      await api.put('/admin/facturacion/config', {
        ...form,
        cuit: cuitLimpio
      })
      setSuccess('Configuracion fiscal guardada correctamente')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message || 'Error al guardar la configuracion')
    } finally {
      setSaving(false)
    }
  }

  async function handleUploadCertificado() {
    if (!certFiles.certificado || !certFiles.clavePrivada) {
      setError('Debe pegar el contenido del certificado y la clave privada')
      return
    }

    // Validar que el certificado tenga el formato correcto
    if (!certFiles.certificado.includes('-----BEGIN CERTIFICATE-----')) {
      setError('El certificado no tiene el formato correcto. Debe comenzar con -----BEGIN CERTIFICATE-----')
      return
    }

    if (!certFiles.clavePrivada.includes('-----BEGIN') || !certFiles.clavePrivada.includes('PRIVATE KEY-----')) {
      setError('La clave privada no tiene el formato correcto. Debe comenzar con -----BEGIN RSA PRIVATE KEY----- o -----BEGIN PRIVATE KEY-----')
      return
    }

    setUploadingCert(true)
    setError(null)
    try {
      console.log('Enviando certificado...', {
        certLength: certFiles.certificado.length,
        keyLength: certFiles.clavePrivada.length
      })

      const response = await api.postFull('/admin/facturacion/config/certificado', {
        certificado: certFiles.certificado,
        clavePrivada: certFiles.clavePrivada
      })

      console.log('Respuesta:', response)

      if (response.success) {
        setCertificadoConfig({ configurado: true })
        setCertFiles({ certificado: '', clavePrivada: '' })
        setSuccess('Certificado y clave privada guardados correctamente')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(response.error || response.message || 'Error desconocido')
      }
    } catch (err) {
      console.error('Error guardando certificado:', err)
      setError(err.message || 'Error al guardar el certificado')
    } finally {
      setUploadingCert(false)
    }
  }

  async function handleTestConexion() {
    setTesting(true)
    setTestResult(null)
    setError(null)

    try {
      const response = await api.postFull('/admin/facturacion/test-conexion')
      console.log('Test conexion response:', response)
      setTestResult(response)
    } catch (err) {
      console.error('Test conexion error:', err)
      setTestResult({
        success: false,
        error: err.message || 'Error al probar conexion',
        pasos: []
      })
    } finally {
      setTesting(false)
    }
  }

  function formatCuit(value) {
    const numbers = value.replace(/\D/g, '').slice(0, 11)
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 10) return `${numbers.slice(0, 2)}-${numbers.slice(2)}`
    return `${numbers.slice(0, 2)}-${numbers.slice(2, 10)}-${numbers.slice(10)}`
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Building2 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Configuracion Fiscal</h1>
          <p className="text-sm text-gray-500">Datos para facturacion electronica ARCA/AFIP</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <XCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          {success}
        </div>
      )}

      <div className="space-y-6">
        {/* Datos del Contribuyente */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos del Contribuyente</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CUIT *
                </label>
                <input
                  type="text"
                  name="cuit"
                  value={formatCuit(form.cuit)}
                  onChange={(e) => setForm(prev => ({ ...prev, cuit: e.target.value.replace(/\D/g, '') }))}
                  className="input-field w-full"
                  placeholder="XX-XXXXXXXX-X"
                  maxLength={13}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Condicion IVA *
                </label>
                <select
                  name="condicionIva"
                  value={form.condicionIva}
                  onChange={handleChange}
                  className="input-field w-full"
                  required
                >
                  {CONDICIONES_IVA.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Razon Social *
                </label>
                <input
                  type="text"
                  name="razonSocial"
                  value={form.razonSocial}
                  onChange={handleChange}
                  className="input-field w-full"
                  placeholder="Nombre o razon social"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Domicilio Fiscal *
                </label>
                <input
                  type="text"
                  name="domicilioFiscal"
                  value={form.domicilioFiscal}
                  onChange={handleChange}
                  className="input-field w-full"
                  placeholder="Direccion completa"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ingresos Brutos
                </label>
                <input
                  type="text"
                  name="iibb"
                  value={form.iibb}
                  onChange={handleChange}
                  className="input-field w-full"
                  placeholder="Numero de IIBB"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Inicio de Actividad
                </label>
                <input
                  type="date"
                  name="inicioActividad"
                  value={form.inicioActividad}
                  onChange={handleChange}
                  className="input-field w-full"
                />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <Button type="submit" loading={saving}>
                <Save className="w-4 h-4 mr-2" />
                Guardar Datos
              </Button>
            </div>
          </div>
        </form>

        {/* Ambiente */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Ambiente de Facturacion</h2>
              <p className="text-sm text-gray-500">
                Selecciona el ambiente de AFIP a utilizar
              </p>
            </div>
            <div className="flex items-center gap-4">
              <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-colors ${
                !form.modoProduccion
                  ? 'border-amber-500 bg-amber-50 text-amber-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="modoProduccion"
                  checked={!form.modoProduccion}
                  onChange={() => setForm(prev => ({ ...prev, modoProduccion: false }))}
                  className="sr-only"
                />
                <TestTube className="w-5 h-5" />
                <span className="font-medium">Homologacion</span>
              </label>
              <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-colors ${
                form.modoProduccion
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="modoProduccion"
                  checked={form.modoProduccion}
                  onChange={() => setForm(prev => ({ ...prev, modoProduccion: true }))}
                  className="sr-only"
                />
                <Server className="w-5 h-5" />
                <span className="font-medium">Produccion</span>
              </label>
            </div>
          </div>

          {!form.modoProduccion && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-700">
                <strong>Modo Homologacion:</strong> Las facturas emitidas NO tienen validez fiscal.
                Use este modo para pruebas antes de pasar a produccion.
              </div>
            </div>
          )}

          {form.modoProduccion && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-700">
                <strong>Modo Produccion:</strong> Las facturas emitidas tienen validez fiscal y se registran en AFIP.
              </div>
            </div>
          )}
        </div>

        {/* Certificado Digital */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileKey className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-800">Certificado Digital</h2>
            </div>
            {certificadoConfig.configurado && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
                <CheckCircle className="w-4 h-4" />
                Configurado
              </span>
            )}
          </div>

          {certificadoConfig.configurado ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-green-800 font-medium">Certificado y clave privada configurados</p>
                    <p className="text-sm text-green-700 mt-1">
                      Por seguridad, el contenido del certificado y la clave privada no se muestran.
                      Los archivos estan guardados de forma segura en el servidor.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-600 mb-3">
                  Si necesitas reemplazar el certificado (por ejemplo, si expiro o cambiaste de ambiente),
                  pega el nuevo contenido a continuacion:
                </p>
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-primary hover:text-primary/80">
                    Reemplazar certificado...
                  </summary>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nuevo Certificado (.crt)
                      </label>
                      <textarea
                        value={certFiles.certificado}
                        onChange={(e) => setCertFiles(prev => ({ ...prev, certificado: e.target.value }))}
                        className="input-field w-full font-mono text-xs"
                        rows={5}
                        placeholder="-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nueva Clave Privada (.key)
                      </label>
                      <textarea
                        value={certFiles.clavePrivada}
                        onChange={(e) => setCertFiles(prev => ({ ...prev, clavePrivada: e.target.value }))}
                        className="input-field w-full font-mono text-xs"
                        rows={5}
                        placeholder="-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----"
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        onClick={handleUploadCertificado}
                        loading={uploadingCert}
                        disabled={!certFiles.certificado || !certFiles.clavePrivada}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Reemplazar Certificado
                      </Button>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Pegue el contenido de los archivos de certificado (.crt) y clave privada (.key) generados desde AFIP.
                <br />
                <span className="text-gray-500">
                  Por seguridad, una vez guardados no se volvera a mostrar el contenido.
                </span>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Certificado (.crt)
                  </label>
                  <textarea
                    value={certFiles.certificado}
                    onChange={(e) => setCertFiles(prev => ({ ...prev, certificado: e.target.value }))}
                    className="input-field w-full font-mono text-xs"
                    rows={5}
                    placeholder="-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Clave Privada (.key)
                  </label>
                  <textarea
                    value={certFiles.clavePrivada}
                    onChange={(e) => setCertFiles(prev => ({ ...prev, clavePrivada: e.target.value }))}
                    className="input-field w-full font-mono text-xs"
                    rows={5}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleUploadCertificado}
                    loading={uploadingCert}
                    disabled={!certFiles.certificado || !certFiles.clavePrivada}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Guardar Certificado
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Test de Conexion */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-800">Probar Conexion</h2>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleTestConexion}
              loading={testing}
              disabled={!certificadoConfig.configurado}
            >
              <TestTube className="w-4 h-4 mr-2" />
              Probar Conexion
            </Button>
          </div>

          {!certificadoConfig.configurado && (
            <p className="text-sm text-gray-500">
              Configure el certificado digital para poder probar la conexion con AFIP.
            </p>
          )}

          {testResult && (
            <div className="mt-4 space-y-2">
              {testResult.pasos?.map((paso, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    paso.estado === 'ok' ? 'bg-green-50' :
                    paso.estado === 'error' ? 'bg-red-50' :
                    'bg-gray-50'
                  }`}
                >
                  {paso.estado === 'ok' && <CheckCircle className="w-5 h-5 text-green-600" />}
                  {paso.estado === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
                  {paso.estado === 'ejecutando' && <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />}

                  <div className="flex-1">
                    <div className="font-medium text-gray-800">{paso.paso}</div>
                    {paso.detalle && (
                      <div className="text-sm text-gray-600">{paso.detalle}</div>
                    )}
                    {paso.error && (
                      <div className="text-sm text-red-600">{paso.error}</div>
                    )}
                  </div>
                </div>
              ))}

              {testResult.success && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 font-medium text-center">
                  Conexion con AFIP verificada exitosamente
                </div>
              )}

              {testResult.error && !testResult.pasos && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {testResult.error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
