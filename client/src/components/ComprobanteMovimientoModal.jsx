import { useState, useEffect } from 'react'
import { CheckCircle, Download, Mail, MessageCircle, Loader2, FileText } from 'lucide-react'
import Modal from './Modal'
import { Button } from './Button'
import api from '../services/api'

/**
 * Modal de acciones del comprobante de un movimiento de caja:
 * descargar PDF, enviar por email, enviar por WhatsApp.
 *
 * Los campos email/telefono vienen precargados del socio/entidad si los hay,
 * y son editables (se pueden ingresar manualmente).
 *
 * Props:
 *   isOpen, onClose
 *   movimiento     — objeto del movimiento (incluye id, numero, tipo, socio, entidad)
 *   variante       — 'success' (recién registrado, header verde) | 'simple' (default)
 */
export default function ComprobanteMovimientoModal({ isOpen, onClose, movimiento, variante = 'simple' }) {
  const [enviando, setEnviando] = useState({})
  const [resultado, setResultado] = useState({})
  const [descargando, setDescargando] = useState(false)
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')

  // Pre-cargar email/telefono cuando abre. Si el objeto no trae los campos
  // (los listados solo incluyen id/nroSocio/apellidoNombre), pide el detalle completo.
  useEffect(() => {
    if (!isOpen) {
      setEnviando({})
      setResultado({})
      setDescargando(false)
      setEmail('')
      setTelefono('')
      return
    }

    const socio = movimiento?.socio
    const entidad = movimiento?.entidad
    setEmail(socio?.email || entidad?.email || '')
    setTelefono(
      socio?.celular || socio?.celularSecundario || socio?.telefonoFijo
      || entidad?.telefono || ''
    )

    // Si no tiene email ni teléfono pero hay socioId/entidadId, intentar el detalle completo
    const faltaContacto = !socio?.email && !entidad?.email
      && !socio?.celular && !socio?.celularSecundario && !socio?.telefonoFijo
      && !entidad?.telefono
    const tieneAsociado = movimiento?.socioId || movimiento?.entidadId
    if (faltaContacto && tieneAsociado && movimiento?.id) {
      api.get(`/admin/movimientos-caja/${movimiento.id}`)
        .then(detalle => {
          const s = detalle?.socio
          const e = detalle?.entidad
          setEmail(s?.email || e?.email || '')
          setTelefono(s?.celular || s?.celularSecundario || s?.telefonoFijo || e?.telefono || '')
        })
        .catch(() => { /* sin contacto, el operador lo tipea */ })
    }
  }, [isOpen, movimiento])

  if (!movimiento) return null

  const movimientoId = movimiento.id
  const numero = movimiento.numero
  const tipoLabel = movimiento.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'

  async function descargarPDF() {
    if (descargando) return
    setDescargando(true)
    try {
      const token = localStorage.getItem('adminToken')
      const apiUrl = import.meta.env.VITE_API_URL || '/api'
      const tenantSlug = window.location.hostname.match(/^([^.]+)\.localhost/)?.[1] || null
      const headers = {}
      if (token) headers.Authorization = `Bearer ${token}`
      if (tenantSlug) headers['X-Tenant-Slug'] = tenantSlug

      const response = await fetch(`${apiUrl}/admin/movimientos-caja/${movimientoId}/comprobante-pdf`, { headers })
      if (!response.ok) throw new Error('Error al generar PDF')
      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match ? match[1] : `comprobante-${numero || movimientoId}.pdf`
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error descargando PDF:', err)
    } finally {
      setDescargando(false)
    }
  }

  async function enviarPorCanal(canal) {
    setEnviando(prev => ({ ...prev, [canal]: true }))
    try {
      const body = { canales: [canal] }
      if (canal === 'email') body.email = email.trim()
      if (canal === 'whatsapp') body.telefono = telefono.trim()
      const res = await api.postFull(`/admin/movimientos-caja/${movimientoId}/enviar-comprobante`, body)
      const r = res?.data?.[canal]
      setResultado(prev => ({ ...prev, [canal]: r }))
    } catch (err) {
      setResultado(prev => ({ ...prev, [canal]: { ok: false, mensaje: err?.message || 'Error al enviar' } }))
    } finally {
      setEnviando(prev => ({ ...prev, [canal]: false }))
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg">
      {variante === 'success' ? (
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">¡{tipoLabel} Registrado!</h2>
          <p className="text-gray-600 mb-4">El movimiento se registró correctamente</p>
          {numero && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 mb-1">Número de Comprobante</p>
              <p className="text-3xl font-bold text-primary">#{numero}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-3">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-1">Comprobante de {tipoLabel}</h2>
          {numero && <p className="text-sm text-gray-500">Nº {numero}</p>}
        </div>
      )}

      <div className={`${variante === 'success' ? 'border-t pt-4 mt-4' : 'mt-4'} space-y-3`}>
        {variante === 'success' && (
          <p className="text-sm text-gray-500 text-center mb-2">Acciones del comprobante</p>
        )}

        <button
          onClick={descargarPDF}
          disabled={descargando}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium disabled:opacity-60"
        >
          {descargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Descargar PDF
        </button>

        {/* Email */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Email destino</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@ejemplo.com"
              className="input-field flex-1 text-sm"
            />
            <button
              onClick={() => enviarPorCanal('email')}
              disabled={!!enviando.email || resultado.email?.ok || !email.trim()}
              className="flex items-center gap-2 px-3 border border-blue-300 rounded-lg text-blue-700 hover:bg-blue-50 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {enviando.email ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {resultado.email?.ok ? 'Enviado ✓' : 'Email'}
            </button>
          </div>
          {resultado.email && !resultado.email.ok && (
            <p className="text-xs text-red-500 mt-1">{resultado.email.mensaje}</p>
          )}
          {resultado.email?.ok && resultado.email.mensaje && (
            <p className="text-xs text-green-600 mt-1">{resultado.email.mensaje}</p>
          )}
        </div>

        {/* WhatsApp */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Teléfono destino (WhatsApp)</label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="11 1234 5678"
              className="input-field flex-1 text-sm"
            />
            <button
              onClick={() => enviarPorCanal('whatsapp')}
              disabled={!!enviando.whatsapp || resultado.whatsapp?.ok || !telefono.trim()}
              className="flex items-center gap-2 px-3 border border-green-300 rounded-lg text-green-700 hover:bg-green-50 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {enviando.whatsapp ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
              {resultado.whatsapp?.ok ? 'Enviado ✓' : 'WhatsApp'}
            </button>
          </div>
          {resultado.whatsapp && !resultado.whatsapp.ok && (
            <p className="text-xs text-red-500 mt-1">{resultado.whatsapp.mensaje}</p>
          )}
          {resultado.whatsapp?.ok && resultado.whatsapp.mensaje && (
            <p className="text-xs text-green-600 mt-1">{resultado.whatsapp.mensaje}</p>
          )}
        </div>
      </div>

      <Button onClick={onClose} className="w-full flex items-center justify-center gap-2 mt-4">
        {variante === 'success' ? 'Continuar' : 'Cerrar'}
      </Button>
    </Modal>
  )
}
