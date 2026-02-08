import { createContext, useContext, useState, useCallback } from 'react'
import TicketPreview from '../components/buffet/TicketPreview'

const TicketContext = createContext()

export function TicketProvider({ children }) {
  const [ticketActual, setTicketActual] = useState(null)
  const [modoPreview, setModoPreview] = useState(true) // Por defecto en modo preview

  /**
   * Genera un ticket para comanda/cuenta
   */
  const generarTicketComanda = useCallback((comanda, tipo = 'CUENTA') => {
    return {
      tipo,
      numero: comanda.numero,
      mesa: comanda.mesa?.numero,
      cliente: comanda.socio?.apellidoNombre || comanda.nombreGrupo || null,
      fecha: new Date(),
      items: comanda.items?.map(item => ({
        cantidad: item.cantidad,
        nombre: item.productoBuffet?.nombre || item.nombre,
        precio: Number(item.precioUnitario),
        observaciones: item.observaciones
      })) || [],
      subtotal: Number(comanda.subtotal || 0),
      descuento: Number(comanda.descuento || 0),
      descuentoPorcentaje: comanda.porcentajeDescuento || 0,
      total: Number(comanda.total || 0),
      medioPago: comanda.medioPago?.nombre || null
    }
  }, [])

  /**
   * Genera un ticket para cocina (solo items, sin precios)
   */
  const generarTicketCocina = useCallback((comanda, sector, items) => {
    return {
      tipo: 'COCINA',
      numero: comanda.numero,
      mesa: comanda.mesa?.numero,
      cliente: comanda.socio?.apellidoNombre || comanda.nombreGrupo || null,
      sector: sector?.toUpperCase() || 'COCINA',
      fecha: new Date(),
      items: items.map(item => ({
        cantidad: item.cantidad,
        nombre: item.productoBuffet?.nombre || item.nombre,
        observaciones: item.observaciones
      }))
    }
  }, [])

  /**
   * Genera un ticket para take away
   */
  const generarTicketTakeAway = useCallback((pedido, tipo = 'TAKEAWAY') => {
    return {
      tipo,
      numero: pedido.numero,
      cliente: pedido.nombreCliente,
      telefono: pedido.telefono,
      fecha: new Date(),
      items: pedido.items?.map(item => ({
        cantidad: item.cantidad,
        nombre: item.productoBuffet?.nombre || item.nombre,
        precio: Number(item.precioUnitario),
        observaciones: item.observaciones
      })) || [],
      subtotal: Number(pedido.subtotal || 0),
      descuento: Number(pedido.descuento || 0),
      descuentoPorcentaje: pedido.porcentajeDescuento || 0,
      total: Number(pedido.total || 0),
      medioPago: pedido.medioPago?.nombre || null
    }
  }, [])

  /**
   * Genera un ticket para kiosco
   */
  const generarTicketKiosco = useCallback((venta) => {
    return {
      tipo: 'KIOSCO',
      numero: venta.numero,
      cliente: venta.socio?.apellidoNombre || null,
      fecha: new Date(),
      items: venta.items?.map(item => ({
        cantidad: item.cantidad,
        nombre: item.nombre,
        precio: Number(item.precio)
      })) || [],
      subtotal: Number(venta.subtotal || 0),
      descuento: Number(venta.descuento || 0),
      descuentoPorcentaje: venta.porcentajeDescuento || 0,
      total: Number(venta.total || 0),
      medioPago: venta.medioPago?.nombre || venta.medioPagoNombre || null
    }
  }, [])

  /**
   * Imprime o muestra preview de un ticket
   */
  const imprimirTicket = useCallback(async (ticket, impresoraId = null) => {
    if (modoPreview) {
      // Modo preview: mostrar en pantalla
      setTicketActual(ticket)
      return { success: true, preview: true }
    } else {
      // Modo real: enviar a impresora
      // TODO: Implementar envío real a impresora ESC/POS
      console.log('Enviando a impresora:', impresoraId, ticket)
      return { success: true, preview: false }
    }
  }, [modoPreview])

  /**
   * Cierra el preview
   */
  const cerrarPreview = useCallback(() => {
    setTicketActual(null)
  }, [])

  /**
   * Toggle modo preview
   */
  const toggleModoPreview = useCallback(() => {
    setModoPreview(prev => !prev)
  }, [])

  return (
    <TicketContext.Provider value={{
      modoPreview,
      setModoPreview,
      toggleModoPreview,
      generarTicketComanda,
      generarTicketCocina,
      generarTicketTakeAway,
      generarTicketKiosco,
      imprimirTicket,
      cerrarPreview
    }}>
      {children}

      {/* Modal de preview global */}
      {ticketActual && (
        <TicketPreview
          ticket={ticketActual}
          onClose={cerrarPreview}
          onPrint={() => {
            // Aquí podría enviar a impresora real después del preview
            cerrarPreview()
          }}
        />
      )}
    </TicketContext.Provider>
  )
}

export function useTicket() {
  const context = useContext(TicketContext)
  if (!context) {
    throw new Error('useTicket debe usarse dentro de TicketProvider')
  }
  return context
}
