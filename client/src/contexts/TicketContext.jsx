import { createContext, useContext, useState, useCallback } from 'react'
import TicketPreview from '../components/buffet/TicketPreview'
import api from '../services/api'
import toast from 'react-hot-toast'

const TicketContext = createContext()

export function TicketProvider({ children }) {
  const [ticketActual, setTicketActual] = useState(null)
  const [modoPreview, setModoPreview] = useState(false) // Por defecto impresión directa

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
   * Genera un ticket FISCAL con CAE y QR de ARCA
   * @param {Object} params - Datos del ticket fiscal
   * @param {Object} params.comprobante - Datos del comprobante fiscal (CAE, tipo, numero, etc)
   * @param {Array} params.items - Items de la venta
   * @param {string} params.qrUrl - URL del QR de ARCA
   * @param {Object} params.empresa - Datos de la empresa emisora
   */
  const generarTicketFiscal = useCallback((params) => {
    const { comprobante, items, qrUrl, empresa, medioPago, montoPagado, vuelto } = params

    // Mapear tipo de comprobante AFIP a nombre
    const tiposNombre = {
      1: 'FACTURA A',
      6: 'FACTURA B',
      11: 'FACTURA C'
    }

    // Mapear condición IVA del cliente
    const condicionesIva = {
      1: 'IVA Responsable Inscripto',
      4: 'IVA Exento',
      5: 'Consumidor Final',
      6: 'Responsable Monotributo'
    }

    return {
      tipo: 'FISCAL',
      // Datos de la empresa emisora
      empresa: {
        razonSocial: empresa?.razonSocial || 'CLUB SPORTIVO PILAR',
        domicilio: empresa?.domicilio || empresa?.domicilioFiscal || '',
        cuit: empresa?.cuit || '',
        condicionIva: empresa?.condicionIva || 'IVA Responsable Inscripto',
        iibb: empresa?.iibb || 'EXENTO',
        inicioActividades: empresa?.inicioActividades || ''
      },
      // Datos del comprobante
      comprobante: {
        tipo: tiposNombre[comprobante?.tipoAfip] || comprobante?.tipo || 'FACTURA C',
        tipoAfip: comprobante?.tipoAfip || 11,
        puntoVenta: comprobante?.puntoVenta || 1,
        numero: comprobante?.numero || 0,
        fecha: comprobante?.fecha ? new Date(comprobante.fecha) : new Date(),
        cae: comprobante?.cae || '',
        fechaVtoCae: comprobante?.fechaVtoCae ? new Date(comprobante.fechaVtoCae) : null
      },
      // Datos del cliente
      cliente: {
        nombre: comprobante?.nombreReceptor || 'Consumidor Final',
        documento: comprobante?.cuitReceptor || '',
        tipoDoc: comprobante?.tipoDocCliente || 99,
        condicionIva: condicionesIva[comprobante?.condicionIvaReceptor] || 'Consumidor Final'
      },
      // Items
      items: items?.map(item => ({
        cantidad: item.cantidad || 1,
        nombre: item.nombre || item.descripcion || 'Producto',
        precio: Number(item.precioUnitario || item.precio || 0),
        subtotal: Number(item.subtotal || (item.cantidad * (item.precioUnitario || item.precio || 0)))
      })) || [],
      // Totales
      subtotal: Number(comprobante?.neto || comprobante?.subtotal || 0),
      iva: Number(comprobante?.iva || 0),
      total: Number(comprobante?.total || 0),
      // Discrimina IVA solo para Factura A
      discriminaIva: comprobante?.tipoAfip === 1,
      // Medio de pago
      medioPago: medioPago || 'EFECTIVO',
      montoPagado: montoPagado || null,
      vuelto: vuelto || null,
      // QR de ARCA
      qrUrl: qrUrl || null
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
      // Modo impresión directa: enviar a impresora térmica
      try {
        // Usar postFull para obtener la respuesta completa con success, impresora, etc.
        const data = await api.postFull('/admin/buffet/imprimir-ticket', {
          ticket,
          impresoraId
        })

        if (data?.success) {
          toast.success(`Ticket enviado a ${data.impresora || 'impresora'}`)
          return { success: true, preview: false }
        } else {
          toast.error(data?.error || 'Error al imprimir')
          return { success: false, preview: false, error: data?.error }
        }
      } catch (error) {
        console.error('Error enviando ticket a impresora:', error)
        const errorMsg = error.message || 'Error de conexión con impresora'
        toast.error(errorMsg)
        return { success: false, preview: false, error: errorMsg }
      }
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
      generarTicketFiscal,
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
