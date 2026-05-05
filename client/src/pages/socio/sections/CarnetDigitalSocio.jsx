import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ShieldCheckIcon, ExclamationTriangleIcon, IdentificationIcon } from '@heroicons/react/24/solid'
import api from '../../../services/api'

export default function CarnetDigitalSocio({ socio, tokenPortal, branding }) {
  const [estadoCuenta, setEstadoCuenta] = useState({ alDia: true, cuotasPendientes: 0, montoPendiente: 0, loading: true })

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      try {
        const data = await api.get(`/socio/${tokenPortal}/cuotas/pendientes`).catch(() => [])
        const lista = Array.isArray(data) ? data : []
        const ahora = new Date()
        const vencidas = lista.filter(c => c.fechaVencimiento && new Date(c.fechaVencimiento) < ahora)
        const monto = vencidas.reduce((s, c) => s + (Number(c.montoTotal) || 0), 0)
        if (!cancelado) {
          setEstadoCuenta({
            alDia: vencidas.length === 0,
            cuotasPendientes: vencidas.length,
            montoPendiente: monto,
            loading: false,
          })
        }
      } catch {
        if (!cancelado) setEstadoCuenta(prev => ({ ...prev, loading: false }))
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [tokenPortal])

  // El QR contiene la URL completa. El backend del molinete extrae el token automáticamente
  // (ver server/src/routes/accesos.js — busca patrón /(s|portal-socio)/<token>).
  const qrUrl = `${window.location.origin}/portal-socio/${tokenPortal}`
  const colorPrimario = branding?.colores?.primario || '#dc2626'
  const colorSecundario = branding?.colores?.secundario || colorPrimario

  const fechaHoy = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div className="space-y-6 max-w-md mx-auto">
      {/* Header athletic */}
      <div className="text-center">
        <div className="pub-eyebrow inline-flex mb-3" style={{ color: 'var(--text-dim)' }}>
          Identificación
        </div>
        <h1 className="font-display-sport" style={{ fontSize: 'clamp(26px, 4vw, 38px)', lineHeight: 0.96, color: 'var(--text)' }}>
          Carnet <span style={{ color: 'var(--color-primary)' }}>digital</span>
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-dim)' }}>Mostrá este código al ingresar al club.</p>
      </div>

      {/* Tarjeta principal del carnet */}
      <div
        className="rounded-2xl shadow-2xl overflow-hidden border-4 border-white"
        style={{ background: `linear-gradient(135deg, ${colorPrimario}, ${colorSecundario})` }}
      >
        {/* Cabecera con logo del club */}
        <div className="px-5 py-3 flex items-center justify-between bg-black/10">
          <div className="flex items-center gap-2">
            {branding?.logoUrl && (
              <img src={branding.logoUrl} alt="" className="h-8 w-auto bg-white rounded p-1" />
            )}
            <div className="text-white">
              <p className="text-[10px] uppercase tracking-wider opacity-90">Carnet de socio</p>
              <p className="text-xs font-semibold leading-tight">{branding?.nombre || 'Club'}</p>
            </div>
          </div>
          {estadoCuenta.loading ? (
            <span className="text-[10px] text-white/80">...</span>
          ) : estadoCuenta.alDia ? (
            <span className="inline-flex items-center gap-1 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">
              <ShieldCheckIcon className="h-3 w-3" /> AL DÍA
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-1 rounded-full">
              <ExclamationTriangleIcon className="h-3 w-3" /> {estadoCuenta.cuotasPendientes} CUOTA{estadoCuenta.cuotasPendientes !== 1 ? 'S' : ''}
            </span>
          )}
        </div>

        {/* Cuerpo: foto + datos + QR */}
        <div className="bg-white p-5">
          <div className="flex gap-4 items-start mb-4">
            {/* Foto */}
            <div className="w-20 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
              {socio.fotoUrl ? (
                <img src={socio.fotoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl font-bold">
                  {(socio.apellidoNombre || '?').charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Datos */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Nombre y apellido</p>
              <p className="text-base font-bold text-gray-900 leading-tight break-words">{socio.apellidoNombre}</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">N° Socio</p>
                  <p className="text-sm font-bold" style={{ color: colorPrimario }}>{socio.nroSocio}</p>
                </div>
                {socio.documento && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">DNI</p>
                    <p className="text-sm font-mono text-gray-800">{socio.documento}</p>
                  </div>
                )}
                {socio.categoria && (
                  <div className="col-span-2">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Categoría</p>
                    <p className="text-xs text-gray-700">{socio.categoria}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* QR grande */}
          <div className="flex flex-col items-center pt-4 border-t border-gray-100">
            <div className="bg-white p-3 rounded-lg" style={{ border: `2px solid ${colorPrimario}33` }}>
              <QRCodeSVG
                value={qrUrl}
                size={200}
                level="M"
                fgColor="#111111"
                bgColor="#ffffff"
                includeMargin={false}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-2 font-mono">{fechaHoy}</p>
          </div>
        </div>

        {/* Pie */}
        <div className="px-5 py-2 bg-black/10 text-center">
          <p className="text-[9px] text-white/80 uppercase tracking-wider">
            Documento personal e intransferible
          </p>
        </div>
      </div>

      {/* Aviso si está moroso */}
      {!estadoCuenta.loading && !estadoCuenta.alDia && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-sm">
          <p className="font-semibold text-yellow-900 flex items-center gap-1">
            <ExclamationTriangleIcon className="h-4 w-4" /> Tenés cuotas vencidas
          </p>
          <p className="text-yellow-800 text-xs mt-1">
            {estadoCuenta.cuotasPendientes} cuota{estadoCuenta.cuotasPendientes !== 1 ? 's' : ''} pendiente{estadoCuenta.cuotasPendientes !== 1 ? 's' : ''}
            {estadoCuenta.montoPendiente > 0 && <> · ${estadoCuenta.montoPendiente.toLocaleString('es-AR')}</>}.
            Es posible que el ingreso al club sea denegado.
          </p>
        </div>
      )}

      <p className="text-xs text-center text-gray-500 px-4">
        Mantené el brillo de pantalla al máximo para que el lector pueda leer el código.
      </p>
    </div>
  )
}
