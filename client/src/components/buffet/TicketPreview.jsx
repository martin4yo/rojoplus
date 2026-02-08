import { useState } from 'react'
import { X, Printer } from 'lucide-react'

/**
 * Componente para previsualizar tickets de impresión
 * Simula el formato de impresora térmica de 80mm
 */
export default function TicketPreview({ ticket, onClose, onPrint }) {
  if (!ticket) return null

  const handlePrint = () => {
    // Abrir ventana de impresión del navegador
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
        </style>
      </head>
      <body>
        ${ticket.html}
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-lg">Preview de Ticket</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Ticket Preview */}
        <div className="flex-1 overflow-auto p-4 bg-gray-100">
          <div
            className="bg-white mx-auto shadow-lg"
            style={{
              width: '80mm',
              minHeight: '100mm',
              fontFamily: "'Courier New', monospace",
              fontSize: '12px',
              padding: '10px'
            }}
          >
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

            {/* Footer */}
            <div className="border-t border-dashed border-gray-400 my-2"></div>
            <div className="text-center text-xs">
              <div>Gracias por su visita</div>
              <div className="mt-1">www.clubsportivopilar.com.ar</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cerrar
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Printer size={18} />
            Imprimir
          </button>
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
