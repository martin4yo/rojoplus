import { useState, useRef, useEffect } from 'react'
import { X, Printer, Image } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import api from '../../services/api'

/**
 * Componente para previsualizar tickets de impresión
 * Soporta tickets fiscales (con CAE y QR) y no fiscales
 * Simula el formato de impresora térmica de 80mm
 *
 * @param {Object} ticket - Datos del ticket
 * @param {Function} onClose - Callback al cerrar
 * @param {Function} onPrint - Callback al imprimir (opcional)
 * @param {Function} onPrintAsImage - Callback para imprimir como imagen (recibe base64, impresoraId)
 */
export default function TicketPreview({ ticket, onClose, onPrint, onPrintAsImage }) {
  const ticketRef = useRef(null)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [impresoras, setImpresoras] = useState([])
  const [impresoraSeleccionada, setImpresoraSeleccionada] = useState(null)
  const [cargandoImpresoras, setCargandoImpresoras] = useState(false)

  // Cargar impresoras disponibles cuando se muestra el componente
  useEffect(() => {
    if (onPrintAsImage) {
      cargarImpresoras()
    }
  }, [onPrintAsImage])

  const cargarImpresoras = async () => {
    setCargandoImpresoras(true)
    try {
      const res = await api.get('/admin/buffet/impresoras-tickets')
      // La respuesta puede ser { success, data } o directamente el array
      const lista = res?.data || res || []
      console.log('[TicketPreview] Impresoras cargadas:', lista)
      setImpresoras(lista)
      // Seleccionar la primera por defecto
      if (lista.length > 0) {
        setImpresoraSeleccionada(lista[0].id)
      }
    } catch (err) {
      console.error('Error cargando impresoras:', err)
    } finally {
      setCargandoImpresoras(false)
    }
  }

  if (!ticket) return null

  // Imprimir como imagen usando html2canvas
  const handlePrintAsImage = async () => {
    console.log('[TicketPreview] handlePrintAsImage llamado')
    console.log('[TicketPreview] ticketRef.current:', !!ticketRef.current)
    console.log('[TicketPreview] onPrintAsImage:', !!onPrintAsImage)
    console.log('[TicketPreview] impresoraSeleccionada:', impresoraSeleccionada)

    if (!ticketRef.current || !onPrintAsImage) {
      console.log('[TicketPreview] Return temprano - falta ticketRef o onPrintAsImage')
      return
    }
    if (!impresoraSeleccionada) {
      alert('Selecciona una impresora')
      return
    }

    setImprimiendo(true)
    try {
      // Importar html2canvas dinámicamente
      console.log('[TicketPreview] Importando html2canvas...')
      const html2canvas = (await import('html2canvas')).default

      // Esperar un momento para que el QR se renderice completamente
      await new Promise(resolve => setTimeout(resolve, 100))

      // Capturar el ticket como imagen
      console.log('[TicketPreview] Capturando imagen...')
      const canvas = await html2canvas(ticketRef.current, {
        scale: 3, // Mayor resolución para mejor calidad del QR
        backgroundColor: '#ffffff',
        logging: true, // Activar logs para debug
        useCORS: true,
        allowTaint: true,
        imageTimeout: 0,
        removeContainer: false
      })

      // Convertir a base64
      const imageBase64 = canvas.toDataURL('image/png')
      console.log('[TicketPreview] Imagen capturada, tamaño:', imageBase64.length)

      // DEBUG: Abrir imagen en nueva pestaña para verificar qué se capturó
      window.open(imageBase64, '_blank')

      // Llamar callback con la imagen y la impresora seleccionada
      console.log('[TicketPreview] Llamando onPrintAsImage...')
      await onPrintAsImage(imageBase64, impresoraSeleccionada)
      console.log('[TicketPreview] onPrintAsImage completado')
    } catch (error) {
      console.error('Error capturando ticket como imagen:', error)
    } finally {
      setImprimiendo(false)
    }
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=300,height=600')
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ticket</title>
        <style>
          @page { margin: 0; size: 80mm auto; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            width: 80mm;
            margin: 0;
            padding: 5mm;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .line { border-top: 1px dashed #000; margin: 5px 0; }
          .item { display: flex; justify-content: space-between; }
          .big { font-size: 16px; }
          .small { font-size: 10px; }
          .qr-container { text-align: center; margin: 10px 0; }
          .qr-container img { width: 100px; height: 100px; }
        </style>
      </head>
      <body>
        ${document.getElementById('ticket-content')?.innerHTML || ''}
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  // Formatear número de comprobante: 0001-00000001
  const formatNumeroComprobante = (puntoVenta, numero) => {
    const pv = String(puntoVenta || 1).padStart(4, '0')
    const num = String(numero || 0).padStart(8, '0')
    return `${pv}-${num}`
  }

  // Formatear fecha
  const formatFecha = (fecha) => {
    const d = new Date(fecha)
    return d.toLocaleDateString('es-AR')
  }

  // Formatear fecha y hora
  const formatFechaHora = (fecha) => {
    const d = new Date(fecha)
    return d.toLocaleString('es-AR')
  }

  // Formatear precio
  const formatPrecio = (monto) => {
    return `$${Number(monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Renderizar ticket FISCAL
  const renderTicketFiscal = () => {
    const { empresa, comprobante, cliente, items, discriminaIva, medioPago, montoPagado, vuelto } = ticket

    return (
      <>
        {/* ===== ENCABEZADO EMPRESA ===== */}
        <div className="text-center mb-2">
          <div className="font-bold text-lg">{empresa?.razonSocial || 'CLUB SPORTIVO PILAR'}</div>
          {empresa?.domicilio && <div className="text-xs">{empresa.domicilio}</div>}
          {empresa?.cuit && <div className="text-xs">CUIT: {empresa.cuit}</div>}
          {empresa?.condicionIva && <div className="text-xs">{empresa.condicionIva}</div>}
          {empresa?.iibb && <div className="text-xs">IIBB: {empresa.iibb}</div>}
          {empresa?.inicioActividades && <div className="text-xs">Inicio Act.: {empresa.inicioActividades}</div>}
        </div>

        <div className="border-t-2 border-dashed border-gray-600 my-2"></div>

        {/* ===== TIPO DE COMPROBANTE ===== */}
        <div className="text-center mb-2">
          <div className="font-bold text-xl">{comprobante?.tipo || 'FACTURA C'}</div>
          <div className="text-sm">
            Nº {formatNumeroComprobante(comprobante?.puntoVenta, comprobante?.numero)}
          </div>
          <div className="text-xs">
            Fecha: {formatFechaHora(comprobante?.fecha || new Date())}
          </div>
        </div>

        <div className="border-t border-dashed border-gray-400 my-2"></div>

        {/* ===== DATOS CLIENTE ===== */}
        <div className="text-xs mb-2">
          <div><span className="font-bold">Cliente:</span> {cliente?.nombre || 'Consumidor Final'}</div>
          {cliente?.documento && cliente?.tipoDoc !== 99 && (
            <div>
              <span className="font-bold">{cliente?.tipoDoc === 80 ? 'CUIT' : 'DNI'}:</span> {cliente.documento}
            </div>
          )}
          {cliente?.condicionIva && cliente.condicionIva !== 'Consumidor Final' && (
            <div><span className="font-bold">IVA:</span> {cliente.condicionIva}</div>
          )}
        </div>

        <div className="border-t border-dashed border-gray-400 my-2"></div>

        {/* ===== ITEMS ===== */}
        <div className="mb-2">
          <div className="text-xs font-bold border-b border-gray-300 pb-1 mb-1">
            DETALLE
          </div>
          {items && items.map((item, idx) => (
            <div key={idx} className="mb-1">
              <div className="text-xs font-semibold">{item.nombre}</div>
              <div className="flex justify-end text-xs text-gray-600">
                <span className="w-8 text-right">{item.cantidad}</span>
                <span className="mx-1">x</span>
                <span className="w-20 text-right">{formatPrecio(item.precio)}</span>
                <span className="mx-1">=</span>
                <span className="w-20 text-right font-semibold">{formatPrecio(item.subtotal)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t-2 border-dashed border-gray-600 my-2"></div>

        {/* ===== TOTALES ===== */}
        <div className="mb-2">
          {discriminaIva && ticket.subtotal > 0 && (
            <>
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{formatPrecio(ticket.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>IVA 21%:</span>
                <span>{formatPrecio(ticket.iva)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-bold text-lg mt-1">
            <span>TOTAL:</span>
            <span>{formatPrecio(ticket.total)}</span>
          </div>
        </div>

        {/* ===== FORMA DE PAGO ===== */}
        <div className="border-t border-dashed border-gray-400 my-2"></div>
        <div className="text-center text-sm mb-2">
          <div>Forma de pago: {medioPago?.toUpperCase() || 'EFECTIVO'}</div>
          {montoPagado && montoPagado > ticket.total && (
            <>
              <div className="text-xs">Pagó: {formatPrecio(montoPagado)}</div>
              <div className="text-xs font-bold">Vuelto: {formatPrecio(vuelto)}</div>
            </>
          )}
        </div>

        {/* ===== CAE ===== */}
        <div className="border-t-2 border-dashed border-gray-600 my-2"></div>
        <div className="text-center">
          <div className="font-bold text-xs">Comprobante Autorizado</div>
          <div className="text-sm font-bold mt-1">CAE: {comprobante?.cae || '-'}</div>
          <div className="text-xs">
            Vto CAE: {comprobante?.fechaVtoCae ? formatFecha(comprobante.fechaVtoCae) : '-'}
          </div>
        </div>

        {/* ===== QR CODE ===== */}
        {ticket.qrUrl && (
          <div className="text-center my-3">
            <div className="inline-block bg-white p-1">
              <QRCodeCanvas
                value={ticket.qrUrl}
                size={120}
                level="M"
                includeMargin={true}
                style={{ display: 'block' }}
              />
            </div>
            <div className="text-xs text-gray-600 mt-1">
              Escanear para verificar
            </div>
          </div>
        )}

        {/* ===== PIE ===== */}
        <div className="border-t border-dashed border-gray-400 my-2"></div>
        <div className="text-center text-xs">
          <div className="font-bold">Comprobante Autorizado</div>
          <div className="mt-1">Gracias por su visita</div>
          <div>www.clubsportivopilar.com.ar</div>
        </div>
      </>
    )
  }

  // Renderizar ticket NO FISCAL
  const renderTicketNoFiscal = () => {
    return (
      <>
        {/* Logo/Header */}
        <div className="text-center mb-2">
          <div className="font-bold text-lg">{ticket.negocio || 'CLUB SPORTIVO PILAR'}</div>
          <div className="text-xs">Buffet - Restaurant</div>
          <div className="border-t border-dashed border-gray-400 my-2"></div>
        </div>

        {/* Info del ticket */}
        {ticket.tipo && (
          <div className="text-center font-bold text-base mb-2">
            {ticket.tipo === 'COMANDA' ? 'COMANDA' :
             ticket.tipo === 'CUENTA' ? 'CUENTA' :
             ticket.tipo === 'COCINA' ? 'PEDIDO COCINA' :
             ticket.tipo === 'TAKEAWAY' ? 'TAKE AWAY' :
             ticket.tipo === 'KIOSCO' ? 'TICKET' : ticket.tipo}
          </div>
        )}

        {ticket.numero && (
          <div className="text-center font-bold text-xl mb-2">#{ticket.numero}</div>
        )}

        {ticket.mesa && (
          <div className="text-center font-bold mb-2">MESA {ticket.mesa}</div>
        )}

        {ticket.cliente && (
          <div className="text-center mb-2">{ticket.cliente}</div>
        )}

        <div className="text-xs text-center mb-2">
          {new Date(ticket.fecha || Date.now()).toLocaleString('es-AR')}
        </div>

        <div className="border-t border-dashed border-gray-400 my-2"></div>

        {/* Items */}
        {ticket.items && ticket.items.length > 0 && (
          <div className="mb-2">
            {ticket.items.map((item, idx) => (
              <div key={idx} className="mb-1">
                <div className="flex justify-between">
                  <span className="font-bold">{item.cantidad}x {item.nombre}</span>
                  {item.precio !== undefined && (
                    <span>${Number(item.precio * item.cantidad).toLocaleString()}</span>
                  )}
                </div>
                {item.observaciones && (
                  <div className="text-xs pl-4 italic">* {item.observaciones}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Totales */}
        {ticket.subtotal !== undefined && (
          <>
            <div className="border-t border-dashed border-gray-400 my-2"></div>
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${Number(ticket.subtotal).toLocaleString()}</span>
            </div>
          </>
        )}

        {ticket.descuento > 0 && (
          <div className="flex justify-between text-green-700">
            <span>Descuento ({ticket.descuentoPorcentaje}%):</span>
            <span>-${Number(ticket.descuento).toLocaleString()}</span>
          </div>
        )}

        {ticket.total !== undefined && (
          <div className="flex justify-between font-bold text-lg mt-1">
            <span>TOTAL:</span>
            <span>${Number(ticket.total).toLocaleString()}</span>
          </div>
        )}

        {/* Medio de pago */}
        {ticket.medioPago && (
          <>
            <div className="border-t border-dashed border-gray-400 my-2"></div>
            <div className="text-center">
              Pago: {ticket.medioPago}
            </div>
            {ticket.montoPagado && ticket.montoPagado > ticket.total && (
              <div className="text-center text-xs">
                <div>Pagó: ${Number(ticket.montoPagado).toLocaleString()}</div>
                <div className="font-bold">Vuelto: ${Number(ticket.vuelto).toLocaleString()}</div>
              </div>
            )}
          </>
        )}

        {/* Mensaje para cocina */}
        {ticket.tipo === 'COCINA' && (
          <>
            <div className="border-t border-dashed border-gray-400 my-2"></div>
            <div className="text-center font-bold">
              {ticket.sector || 'COCINA'}
            </div>
          </>
        )}

        {/* Aviso no fiscal */}
        <div className="border-t border-dashed border-gray-400 my-2"></div>
        <div className="text-center">
          <div className="font-bold text-xs text-red-600">
            ** DOCUMENTO NO VÁLIDO COMO FACTURA **
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-dashed border-gray-400 my-2"></div>
        <div className="text-center text-xs">
          <div>Gracias por su visita</div>
          <div className="mt-1">www.clubsportivopilar.com.ar</div>
        </div>
      </>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-lg">
            {ticket.tipo === 'FISCAL' ? 'Preview de Factura' : 'Preview de Ticket'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Ticket Preview */}
        <div className="flex-1 overflow-auto p-4 bg-gray-100">
          <div
            ref={ticketRef}
            id="ticket-content"
            className="bg-white mx-auto shadow-lg"
            style={{
              width: '80mm',
              minHeight: '100mm',
              fontFamily: "'Courier New', monospace",
              fontSize: '12px',
              padding: '10px'
            }}
          >
            {ticket.tipo === 'FISCAL' ? renderTicketFiscal() : renderTicketNoFiscal()}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t space-y-3">
          {/* Selector de impresora (solo si hay onPrintAsImage) */}
          {onPrintAsImage && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">Impresora:</label>
              {cargandoImpresoras ? (
                <div className="flex-1 text-sm text-gray-500">Cargando...</div>
              ) : impresoras.length === 0 ? (
                <div className="flex-1 text-sm text-red-500">No hay impresoras configuradas</div>
              ) : (
                <select
                  value={impresoraSeleccionada || ''}
                  onChange={e => setImpresoraSeleccionada(parseInt(e.target.value))}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                >
                  {impresoras.map(imp => (
                    <option key={imp.id} value={imp.id}>
                      {imp.nombre} {imp.etiqueta ? `(${imp.etiqueta})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cerrar
            </button>
            {onPrintAsImage && (
              <button
                onClick={handlePrintAsImage}
                disabled={imprimiendo || !impresoraSeleccionada}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {imprimiendo ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Image size={18} />
                )}
                {imprimiendo ? 'Enviando...' : 'Térmica'}
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Printer size={18} />
              Navegador
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook para manejar el estado del preview
 */
export function useTicketPreview() {
  const [ticketPreview, setTicketPreview] = useState(null)

  const mostrarPreview = (ticket) => {
    setTicketPreview(ticket)
  }

  const cerrarPreview = () => {
    setTicketPreview(null)
  }

  return { ticketPreview, mostrarPreview, cerrarPreview }
}
