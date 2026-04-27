import { useState, useEffect } from 'react'
import { CheckCircle, Download, Mail, MessageCircle, Loader2, Receipt } from 'lucide-react'
import Modal from './Modal'
import { Button } from './Button'
import AdjuntosComprobante from './AdjuntosComprobante'
import api from '../services/api'

/**
 * Modal de acciones del recibo: descargar PDF, enviar por email, enviar por WhatsApp.
 * Reutilizable desde el flujo de cobranza (recién creado) o desde la cuenta corriente
 * (recibo histórico).
 *
 * Props:
 *   isOpen          — controla visibilidad
 *   onClose         — callback al cerrar
 *   pagoId          — ID del pago para descargar/enviar
 *   numeroRecibo    — número a mostrar en el header (opcional)
 *   variante        — 'success' (recién cobrado, header verde) | 'simple' (default)
 *   tituloSimple    — título cuando variante='simple' (default: 'Acciones del recibo')
 */
export default function ReciboAccionesModal({
  isOpen,
  onClose,
  pagoId,
  numeroRecibo,
  variante = 'simple',
  tituloSimple = 'Acciones del recibo',
}) {
  const [enviando, setEnviando] = useState({})
  const [resultado, setResultado] = useState({})
  const [descargando, setDescargando] = useState(false)

  // Reset al abrir/cerrar
  useEffect(() => {
    if (!isOpen) {
      setEnviando({})
      setResultado({})
      setDescargando(false)
    }
  }, [isOpen])

  async function descargarPDF() {
    if (!pagoId || descargando) return
    setDescargando(true)
    try {
      const token = localStorage.getItem('adminToken')
      const apiUrl = import.meta.env.VITE_API_URL || '/api'
      const tenantSlug = window.location.hostname.match(/^([^.]+)\.localhost/)?.[1] || null
      const headers = {}
      if (token) headers.Authorization = `Bearer ${token}`
      if (tenantSlug) headers['X-Tenant-Slug'] = tenantSlug

      const response = await fetch(`${apiUrl}/admin/pagos/${pagoId}/recibo-pdf`, { headers })
      if (!response.ok) throw new Error('Error al generar PDF')
      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match ? match[1] : `recibo-${numeroRecibo || pagoId}.pdf`
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
    if (!pagoId) return
    setEnviando(prev => ({ ...prev, [canal]: true }))
    try {
      const res = await api.postFull(`/admin/pagos/${pagoId}/enviar-recibo`, { canales: [canal] })
      const r = res?.data?.[canal]
      setResultado(prev => ({ ...prev, [canal]: r }))
    } catch (err) {
      setResultado(prev => ({ ...prev, [canal]: { ok: false, mensaje: err?.message || 'Error al enviar' } }))
    } finally {
      setEnviando(prev => ({ ...prev, [canal]: false }))
    }
  }

  if (!pagoId) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg">
      {variante === 'success' ? (
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Cobranza Registrada!</h2>
          <p className="text-gray-600 mb-4">El pago se registró correctamente</p>
          {numeroRecibo && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 mb-1">Número de Recibo</p>
              <p className="text-3xl font-bold text-primary">#{numeroRecibo}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-3">
            <Receipt className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-1">{tituloSimple}</h2>
          {numeroRecibo && (
            <p className="text-sm text-gray-500">Recibo #{numeroRecibo}</p>
          )}
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

        <div>
          <button
            onClick={() => enviarPorCanal('email')}
            disabled={!!enviando.email || resultado.email?.ok}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-blue-300 rounded-lg text-blue-700 hover:bg-blue-50 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {enviando.email ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {resultado.email?.ok ? 'Email enviado ✓' : 'Enviar por Email'}
          </button>
          {resultado.email && !resultado.email.ok && (
            <p className="text-xs text-red-500 mt-1 text-center">{resultado.email.mensaje}</p>
          )}
          {resultado.email?.ok && resultado.email.mensaje && (
            <p className="text-xs text-green-600 mt-1 text-center">{resultado.email.mensaje}</p>
          )}
        </div>

        <div>
          <button
            onClick={() => enviarPorCanal('whatsapp')}
            disabled={!!enviando.whatsapp || resultado.whatsapp?.ok}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-green-300 rounded-lg text-green-700 hover:bg-green-50 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {enviando.whatsapp ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            {resultado.whatsapp?.ok ? 'WhatsApp enviado ✓' : 'Enviar por WhatsApp'}
          </button>
          {resultado.whatsapp && !resultado.whatsapp.ok && (
            <p className="text-xs text-red-500 mt-1 text-center">{resultado.whatsapp.mensaje}</p>
          )}
          {resultado.whatsapp?.ok && resultado.whatsapp.mensaje && (
            <p className="text-xs text-green-600 mt-1 text-center">{resultado.whatsapp.mensaje}</p>
          )}
        </div>

        <div className="border-t pt-3">
          <AdjuntosComprobante tipo="pago" comprobanteId={pagoId} />
        </div>
      </div>

      <Button onClick={onClose} className="w-full flex items-center justify-center gap-2 mt-4">
        {variante === 'success' ? 'Continuar' : 'Cerrar'}
      </Button>
    </Modal>
  )
}
