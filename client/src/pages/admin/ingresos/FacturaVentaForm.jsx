import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FileText, Plus, Trash2, Search, User, Building2, ShoppingCart, Package, CreditCard, Wallet, Info } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'
import { SearchInputWithDropdown } from '../../../components/SearchInput'
import SelectCentroCosto from '../../../components/SelectCentroCosto'
import LoadingSpinner from '../../../components/LoadingSpinner'
import {
  CONDICIONES_IVA_OPTIONS,
  getTipoComprobanteVenta,
  debeDiscriminarIVA,
  calcularTotalesFactura,
  getColorComprobante
} from '../../../utils/fiscalHelper'

const MEDIOS_PAGO = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'TARJETA', label: 'Tarjeta' },
  { value: 'CHEQUE', label: 'Cheque' }
]

const TIPOS_MOVIMIENTO = [
  { value: 'FACTURA_VENTA', label: 'Factura' },
  { value: 'NOTA_CREDITO_CLIENTE', label: 'Nota de Crédito' },
  { value: 'NOTA_DEBITO_CLIENTE', label: 'Nota de Débito' }
]

const TIPO_LABELS = {
  FACTURA_VENTA: { titulo: 'Nueva Factura de Venta', accion: 'Crear Factura', tipoLabel: 'Factura', color: 'green' },
  NOTA_CREDITO_CLIENTE: { titulo: 'Nueva Nota de Crédito', accion: 'Crear Nota de Crédito', tipoLabel: 'NC', color: 'orange' },
  NOTA_DEBITO_CLIENTE: { titulo: 'Nueva Nota de Débito', accion: 'Crear Nota de Débito', tipoLabel: 'ND', color: 'red' }
}

export default function FacturaVentaForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const pedidoIdParam = searchParams.get('pedidoId')

  const { showModal, ModalComponent } = useModal()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Tipo de movimiento (Factura / NC / ND)
  const [tipoMovimiento, setTipoMovimiento] = useState('FACTURA_VENTA')
  const [movimientoPadreId, setMovimientoPadreId] = useState('')
  const [facturasCliente, setFacturasCliente] = useState([])

  // Punto de venta
  const [puntosVenta, setPuntosVenta] = useState([])
  const [puntoVentaIdSel, setPuntoVentaIdSel] = useState('')

  // Datos del formulario
  const [tipoCliente, setTipoCliente] = useState('SOCIO')
  const [socioId, setSocioId] = useState('')
  const [entidadId, setEntidadId] = useState('')
  const [pedidoId, setPedidoId] = useState(pedidoIdParam || '')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [tipoComprobante, setTipoComprobante] = useState('')
  const [puntoVenta, setPuntoVenta] = useState('')
  const [numeroComprobante, setNumeroComprobante] = useState('')
  const [conceptoId, setConceptoId] = useState('')
  const [centroCostoId, setCentroCostoId] = useState(null)
  const [observaciones, setObservaciones] = useState('')
  const [items, setItems] = useState([])

  const esFactura = tipoMovimiento === 'FACTURA_VENTA'
  const esNC = tipoMovimiento === 'NOTA_CREDITO_CLIENTE'
  const labelInfo = TIPO_LABELS[tipoMovimiento]

  // Cobro al momento
  const [cobrarAlMomento, setCobrarAlMomento] = useState(false)
  const [cajaId, setCajaId] = useState('')
  const [medioPago, setMedioPago] = useState('EFECTIVO')
  const [nroOperacion, setNroOperacion] = useState('')
  const [cajas, setCajas] = useState([])

  // Configuración fiscal
  const [configFiscal, setConfigFiscal] = useState({
    condicionIva: 'INSCRIPTO',
    cuit: '',
    razonSocial: ''
  })
  const [condicionIvaCliente, setCondicionIvaCliente] = useState('CONSUMIDOR_FINAL')

  // Datos para selects y busquedas
  const [clientes, setClientes] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null)
  const [productos, setProductos] = useState([])
  const [conceptos, setConceptos] = useState([])
  const [busquedaSocio, setBusquedaSocio] = useState('')
  const [resultadosSocio, setResultadosSocio] = useState([])
  const [buscandoSocio, setBuscandoSocio] = useState(false)
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [resultadosCliente, setResultadosCliente] = useState([])
  const [buscandoCliente, setBuscandoCliente] = useState(false)

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  useEffect(() => {
    if (pedidoIdParam) {
      cargarPedido(pedidoIdParam)
    }
  }, [pedidoIdParam])

  useEffect(() => {
    if (!esFactura) {
      setPedidos([])
      return
    }
    if (tipoCliente === 'CLIENTE' && entidadId) {
      cargarPedidosCliente(entidadId)
    } else if (tipoCliente === 'SOCIO' && socioId) {
      cargarPedidosSocio(socioId)
    } else {
      setPedidos([])
    }
  }, [tipoCliente, entidadId, socioId, esFactura])

  useEffect(() => {
    if (!esNC) {
      setFacturasCliente([])
      setMovimientoPadreId('')
      return
    }
    if (tipoCliente === 'CLIENTE' && entidadId) {
      cargarFacturasCliente({ entidadId })
    } else if (tipoCliente === 'SOCIO' && socioId) {
      cargarFacturasCliente({ socioId })
    } else {
      setFacturasCliente([])
    }
  }, [esNC, tipoCliente, entidadId, socioId])

  useEffect(() => {
    setMovimientoPadreId('')
  }, [tipoMovimiento])

  async function cargarFacturasCliente({ entidadId, socioId }) {
    try {
      const params = new URLSearchParams()
      if (entidadId) params.append('entidadId', entidadId)
      if (socioId) params.append('socioId', socioId)
      const response = await api.getFull(`/admin/facturas-venta?${params}&limit=100`)
      const facturas = (response.data || []).filter(f =>
        f.tipo === 'FACTURA_VENTA' && f.estado !== 'ANULADO' && f.estado !== 'COMPENSADO'
      )
      setFacturasCliente(facturas)
    } catch (err) {
      console.error('Error cargando facturas del cliente:', err)
      setFacturasCliente([])
    }
  }

  async function cargarDatosIniciales() {
    setLoading(true)
    try {
      const [clientesRes, productosRes, conceptosRes, cajasRes, configCondIva, configCuit, configRazonSocial, pvRes] = await Promise.all([
        api.getFull('/admin/entidades?tipo=CLIENTE&limit=1000'),
        api.getFull('/admin/productos?activo=true'),
        api.getFull('/admin/conceptos?tipo=INGRESO'),
        api.getFull('/admin/cajas?activo=true'),
        api.get('/admin/sistema/configuracion/FISCAL_CONDICION_IVA').catch(() => null),
        api.get('/admin/sistema/configuracion/FISCAL_CUIT').catch(() => null),
        api.get('/admin/sistema/configuracion/FISCAL_RAZON_SOCIAL').catch(() => null),
        api.getFull('/admin/puntos-venta?activo=true').catch(() => ({ data: [] }))
      ])

      setClientes(clientesRes.data || [])
      setProductos(productosRes.data || [])
      setConceptos(conceptosRes.data || [])
      setCajas(cajasRes.data || [])

      const pvs = pvRes.data || []
      setPuntosVenta(pvs)
      // Preseleccionar default o el primero
      const pvDefault = pvs.find(p => p.esDefault) || pvs[0]
      if (pvDefault) setPuntoVentaIdSel(pvDefault.id)

      // Configuración fiscal del emisor
      setConfigFiscal({
        condicionIva: configCondIva?.valor || 'INSCRIPTO',
        cuit: configCuit?.valor || '',
        razonSocial: configRazonSocial?.valor || ''
      })

      // Seleccionar primera caja por defecto
      if (cajasRes.data?.length > 0) {
        setCajaId(cajasRes.data[0].id)
      }
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  async function buscarSocios(query) {
    if (!query || query.length < 2) {
      setResultadosSocio([])
      return
    }

    setBuscandoSocio(true)
    try {
      const response = await api.getFull(`/admin/socios?q=${encodeURIComponent(query)}&limit=10`)
      setResultadosSocio(response.data?.socios || [])
    } catch (err) {
      console.error('Error buscando socios:', err)
      setResultadosSocio([])
    } finally {
      setBuscandoSocio(false)
    }
  }

  async function cargarPedidosCliente(clienteId) {
    try {
      const response = await api.getFull(`/admin/pedidos?entidadId=${clienteId}&estado=PENDIENTE,PARCIAL`)
      setPedidos(response.data || [])
    } catch (err) {
      console.error('Error cargando pedidos:', err)
    }
  }

  async function cargarPedidosSocio(socId) {
    try {
      const response = await api.getFull(`/admin/pedidos?socioId=${socId}&estado=PENDIENTE,PARCIAL`)
      setPedidos(response.data || [])
    } catch (err) {
      console.error('Error cargando pedidos:', err)
    }
  }

  async function cargarPedido(id) {
    try {
      const response = await api.getFull(`/admin/pedidos/${id}`)
      const pedido = response.data

      setPedidoSeleccionado(pedido)
      setPedidoId(id)

      if (pedido.socio) {
        setTipoCliente('SOCIO')
        setSocioId(pedido.socio.id)
        setBusquedaSocio(`#${pedido.socio.nroSocio} - ${pedido.socio.apellidoNombre}`)
      } else if (pedido.entidad) {
        setTipoCliente('CLIENTE')
        setEntidadId(pedido.entidad.id)
      }

      // Cargar items pendientes del pedido
      const itemsPendientes = pedido.items
        .filter(i => Number(i.cantidad) > Number(i.cantidadFacturada))
        .map(i => ({
          itemPedidoId: i.id,
          productoVarianteId: i.productoVarianteId,
          descripcion: i.descripcion ||
            (i.productoVariante ?
              `${i.productoVariante.producto?.nombre || ''} - ${i.productoVariante.talle}`
              : ''),
          cantidad: Number(i.cantidad) - Number(i.cantidadFacturada),
          cantidadMaxima: Number(i.cantidad) - Number(i.cantidadFacturada),
          precioUnitario: Number(i.precioUnitario),
          iva: i.iva || 21,
          producto: i.productoVariante?.producto
        }))

      setItems(itemsPendientes)
    } catch (err) {
      console.error('Error cargando pedido:', err)
      showModal({ type: 'error', message: 'Error al cargar el pedido' })
    }
  }

  function handleSelectSocio(socio) {
    setSocioId(socio.id)
    setBusquedaSocio(`#${socio.nroSocio} - ${socio.apellidoNombre}`)
    setResultadosSocio([])
    setPedidoId('')
    setPedidoSeleccionado(null)
    setItems([])
    // Autocompletar la condición IVA con la del socio (default Consumidor Final)
    if (socio.condicionIva) {
      setCondicionIvaCliente(socio.condicionIva)
    } else {
      setCondicionIvaCliente('CONSUMIDOR_FINAL')
    }
  }

  async function buscarClientes(query) {
    if (!query || query.length < 2) {
      setResultadosCliente([])
      return
    }
    setBuscandoCliente(true)
    try {
      const response = await api.getFull(`/admin/entidades?tipo=CLIENTE&activo=true&busqueda=${encodeURIComponent(query)}&limit=10`)
      setResultadosCliente(response?.data || [])
    } catch (err) {
      console.error('Error buscando clientes:', err)
      setResultadosCliente([])
    } finally {
      setBuscandoCliente(false)
    }
  }

  function handleSelectCliente(cliente) {
    setEntidadId(cliente.id)
    setBusquedaCliente(`${cliente.codigo} - ${cliente.razonSocial}`)
    setResultadosCliente([])
    setPedidoId('')
    setPedidoSeleccionado(null)
    setItems([])
    // Autocompletar la condición IVA con la del cliente (default Consumidor Final)
    if (cliente.condicionIva) {
      setCondicionIvaCliente(cliente.condicionIva)
    } else {
      setCondicionIvaCliente('CONSUMIDOR_FINAL')
    }
  }

  function handleSelectPedido(e) {
    const id = e.target.value
    setPedidoId(id)
    if (id) {
      cargarPedido(id)
    } else {
      setPedidoSeleccionado(null)
      setItems([])
    }
  }

  function agregarItem() {
    setItems([...items, {
      productoVarianteId: '',
      descripcion: '',
      cantidad: 1,
      precioUnitario: 0,
      iva: 21,
      producto: null
    }])
  }

  function eliminarItem(index) {
    setItems(items.filter((_, i) => i !== index))
  }

  function actualizarItem(index, campo, valor) {
    const nuevosItems = [...items]
    nuevosItems[index][campo] = valor

    // Si cambia el producto, actualizar precio
    if (campo === 'productoVarianteId' && valor) {
      const producto = productos.find(p =>
        p.variantes?.some(v => v.id === parseInt(valor))
      )
      if (producto) {
        nuevosItems[index].precioUnitario = Number(producto.precioVenta) || 0
        const variante = producto.variantes.find(v => v.id === parseInt(valor))
        nuevosItems[index].descripcion = `${producto.nombre} - ${variante?.talle || ''}`
        nuevosItems[index].producto = producto
      }
    }

    setItems(nuevosItems)
  }

  function calcularSubtotal(item) {
    return (Number(item.cantidad) || 0) * (Number(item.precioUnitario) || 0)
  }

  // Determinar tipo de comprobante automaticamente
  const tipoComprobanteCalculado = getTipoComprobanteVenta(configFiscal.condicionIva, condicionIvaCliente)
  const discriminaIVA = debeDiscriminarIVA(configFiscal.condicionIva)

  function calcularTotales() {
    // Preparar items con IVA para el helper
    const itemsConIva = items.map(item => ({
      cantidad: Number(item.cantidad) || 0,
      precioUnitario: Number(item.precioUnitario) || 0,
      iva: item.iva || 21 // Por defecto 21%
    }))
    return calcularTotalesFactura(itemsConIva, discriminaIVA)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    // Validaciones
    if (tipoCliente === 'SOCIO' && !socioId) {
      showModal({ type: 'error', message: 'Debe seleccionar un socio' })
      return
    }
    if (tipoCliente === 'CLIENTE' && !entidadId) {
      showModal({ type: 'error', message: 'Debe seleccionar un cliente' })
      return
    }
    if (items.length === 0) {
      showModal({ type: 'error', message: 'Debe agregar al menos un item' })
      return
    }

    // Validar items
    for (const item of items) {
      if (!item.descripcion && !item.productoVarianteId) {
        showModal({ type: 'error', message: 'Cada item debe tener una descripcion o producto' })
        return
      }
      if (!item.cantidad || item.cantidad <= 0) {
        showModal({ type: 'error', message: 'La cantidad debe ser mayor a 0' })
        return
      }
      // Validar cantidad maxima si viene de pedido
      if (item.cantidadMaxima && item.cantidad > item.cantidadMaxima) {
        showModal({ type: 'error', message: `La cantidad no puede superar ${item.cantidadMaxima}` })
        return
      }
    }

    // Validar cobro al momento (solo factura)
    if (esFactura && cobrarAlMomento && !cajaId) {
      showModal({ type: 'error', message: 'Debe seleccionar una caja para el cobro' })
      return
    }

    if (!centroCostoId) {
      showModal({ type: 'error', message: 'Debe seleccionar un Centro de Costo' })
      return
    }

    // Validar PV (excepto NC asociada que hereda del padre)
    const ncAsociada = esNC && movimientoPadreId
    if (!ncAsociada && !puntoVentaIdSel) {
      showModal({ type: 'error', message: 'Debe seleccionar un Punto de Venta. Configure uno en Tablas Auxiliares.' })
      return
    }

    setSaving(true)
    try {
      const totales = calcularTotales()

      const payload = {
        tipo: tipoMovimiento,
        socioId: tipoCliente === 'SOCIO' ? parseInt(socioId) : null,
        entidadId: tipoCliente === 'CLIENTE' ? parseInt(entidadId) : null,
        pedidoId: esFactura && pedidoId ? parseInt(pedidoId) : null,
        movimientoPadreId: esNC && movimientoPadreId ? parseInt(movimientoPadreId) : null,
        puntoVentaId: puntoVentaIdSel ? parseInt(puntoVentaIdSel) : null,
        condicionIvaCliente,
        fecha,
        fechaVencimiento: fechaVencimiento || null,
        tipoComprobante: tipoComprobanteCalculado || null,
        puntoVenta: null,  // lo setea el backend desde AFIP
        numeroComprobante: null,
        conceptoId: conceptoId ? parseInt(conceptoId) : null,
        centroCostoId: centroCostoId ? parseInt(centroCostoId) : null,
        observaciones: observaciones || null,
        subtotal: totales.subtotal,
        iva21: discriminaIVA ? totales.iva21 : 0,
        iva105: discriminaIVA ? totales.iva105 : 0,
        montoTotal: totales.total,
        items: items.map(item => ({
          productoVarianteId: item.productoVarianteId ? parseInt(item.productoVarianteId) : null,
          itemPedidoId: esFactura && item.itemPedidoId ? parseInt(item.itemPedidoId) : null,
          descripcion: item.descripcion,
          cantidad: parseFloat(item.cantidad),
          precioUnitario: parseFloat(item.precioUnitario),
          iva: discriminaIVA ? (item.iva || 21) : 0
        }))
      }

      // Crear movimiento
      const facturaResponse = await api.post('/admin/movimientos-contables', payload)

      // Si cobra al momento (solo factura), crear recibo de cobro
      if (esFactura && cobrarAlMomento) {
        const reciboPayload = {
          socioId: tipoCliente === 'SOCIO' ? parseInt(socioId) : null,
          entidadId: tipoCliente === 'CLIENTE' ? parseInt(entidadId) : null,
          fecha,
          cajaId: parseInt(cajaId),
          medioPago,
          nroOperacion: nroOperacion || null,
          conceptoId: conceptoId ? parseInt(conceptoId) : null,
          observaciones: `Cobro al momento - Factura ${facturaResponse.data.numero}`,
          montoTotal: totales.total,
          facturasCobradas: [{
            movimientoContableId: facturaResponse.data.id,
            montoCobrado: totales.total
          }]
        }
        await api.post('/admin/recibos-cobro', reciboPayload)
      }

      showModal({
        type: 'success',
        message: esFactura
          ? (cobrarAlMomento ? 'Factura creada y cobrada correctamente' : 'Factura creada correctamente')
          : `${labelInfo.tipoLabel === 'NC' ? 'Nota de Crédito' : 'Nota de Débito'} creada correctamente`,
        onConfirm: () => navigate('/admin/ingresos/facturas')
      })
    } catch (err) {
      showModal({ type: 'error', message: err.message || 'Error al crear el movimiento' })
    } finally {
      setSaving(false)
    }
  }

  function formatMonto(monto) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto || 0)
  }

  const totales = calcularTotales()

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <div>
      {ModalComponent}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/ingresos/facturas')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-${labelInfo.color}-100`}>
              <FileText className={`w-6 h-6 text-${labelInfo.color}-600`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{labelInfo.titulo}</h1>
              <p className="text-sm text-gray-500">
                {esFactura
                  ? (pedidoSeleccionado ? `Desde pedido ${pedidoSeleccionado.numero}` : 'Factura directa')
                  : (esNC ? 'Reduce deuda o crea saldo a favor del cliente' : 'Aumenta deuda del cliente')}
              </p>
            </div>
          </div>
        </div>
        {/* Selector tipo */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de movimiento</label>
          <select
            value={tipoMovimiento}
            onChange={(e) => setTipoMovimiento(e.target.value)}
            className="input-field"
          >
            {TIPOS_MOVIMIENTO.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Datos principales */}
          <div className="lg:col-span-2 space-y-6">
            {/* Cliente o Socio */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Cliente / Socio</h2>

              <div className="space-y-4">
                {/* Tipo de cliente */}
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoCliente"
                      value="SOCIO"
                      checked={tipoCliente === 'SOCIO'}
                      onChange={(e) => {
                        setTipoCliente(e.target.value)
                        setEntidadId('')
                        setBusquedaCliente('')
                        setResultadosCliente([])
                        setPedidoId('')
                        setPedidoSeleccionado(null)
                        setItems([])
                      }}
                      className="text-primary focus:ring-primary"
                    />
                    <User className="w-4 h-4 text-gray-500" />
                    <span>Socio</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoCliente"
                      value="CLIENTE"
                      checked={tipoCliente === 'CLIENTE'}
                      onChange={(e) => {
                        setTipoCliente(e.target.value)
                        setSocioId('')
                        setBusquedaSocio('')
                        setPedidoId('')
                        setPedidoSeleccionado(null)
                        setItems([])
                      }}
                      className="text-primary focus:ring-primary"
                    />
                    <Building2 className="w-4 h-4 text-gray-500" />
                    <span>Cliente</span>
                  </label>
                </div>

                {/* Selector segun tipo */}
                {tipoCliente === 'SOCIO' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Buscar Socio *
                    </label>
                    <SearchInputWithDropdown
                      value={busquedaSocio}
                      onChange={(value) => {
                        setBusquedaSocio(value)
                        buscarSocios(value)
                      }}
                      results={resultadosSocio}
                      loading={buscandoSocio}
                      onSelectResult={handleSelectSocio}
                      renderResult={(socio) => (
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span>#{socio.nroSocio} - {socio.apellidoNombre}</span>
                        </div>
                      )}
                      placeholder="Buscar por nombre, DNI o nro de socio..."
                      minChars={2}
                      debounceMs={300}
                      emptyMessage="No se encontraron socios"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Buscar Cliente *
                    </label>
                    <SearchInputWithDropdown
                      value={busquedaCliente}
                      onChange={(value) => {
                        setBusquedaCliente(value)
                        buscarClientes(value)
                      }}
                      results={resultadosCliente}
                      loading={buscandoCliente}
                      onSelectResult={handleSelectCliente}
                      renderResult={(cliente) => (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <div>
                            <span className="font-medium">{cliente.razonSocial}</span>
                            {cliente.documento && (
                              <span className="text-xs text-gray-500 ml-2">
                                {cliente.tipoDocumento || 'CUIT'}: {cliente.documento}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      placeholder="Buscar por nombre, razón social, CUIT..."
                      minChars={2}
                      debounceMs={300}
                      emptyMessage="No se encontraron clientes"
                    />
                  </div>
                )}

                {/* Selector de pedido (solo factura) */}
                {esFactura && pedidos.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <ShoppingCart className="inline w-4 h-4 mr-1" />
                      Vincular a Pedido (opcional)
                    </label>
                    <select
                      value={pedidoId}
                      onChange={handleSelectPedido}
                      className="input-field w-full"
                    >
                      <option value="">Sin pedido (factura directa)</option>
                      {pedidos.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.numero} - {formatMonto(p.total)} ({p.estado})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Selector de factura asociada (solo NC) */}
                {esNC && (socioId || entidadId) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <FileText className="inline w-4 h-4 mr-1" />
                      Factura asociada (opcional)
                    </label>
                    <select
                      value={movimientoPadreId}
                      onChange={(e) => setMovimientoPadreId(e.target.value)}
                      className="input-field w-full"
                    >
                      <option value="">NC suelta (genera saldo a favor)</option>
                      {facturasCliente.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.numero}
                          {f.tipoComprobante && f.puntoVenta && f.numeroComprobante
                            ? ` (${f.tipoComprobante} ${String(f.puntoVenta).padStart(4, '0')}-${String(f.numeroComprobante).padStart(8, '0')})`
                            : ''}
                          {' - '}{formatMonto(f.montoTotal)} | Saldo: {formatMonto(f.saldoPendiente)}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Si elige una factura, la NC se asocia fiscalmente y descuenta su saldo. Sino, queda como saldo a favor del cliente.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Datos del comprobante */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos del Comprobante</h2>

              {/* Info del tipo de comprobante calculado */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Tipo de comprobante:</span>
                    <span className={`px-2 py-1 rounded-full text-sm font-semibold ${getColorComprobante(tipoComprobanteCalculado)}`}>
                      {labelInfo.tipoLabel} {tipoComprobanteCalculado}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {discriminaIVA ? 'Discrimina IVA' : 'Precio final (no discrimina IVA)'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Emisor: {configFiscal.condicionIva === 'INSCRIPTO' ? 'Resp. Inscripto' : configFiscal.condicionIva === 'MONOTRIBUTISTA' ? 'Monotributista' : 'Exento'}
                  {' → '}
                  Cliente: {CONDICIONES_IVA_OPTIONS.find(c => c.value === condicionIvaCliente)?.label || condicionIvaCliente}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="input-field w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vencimiento
                  </label>
                  <input
                    type="date"
                    value={fechaVencimiento}
                    onChange={(e) => setFechaVencimiento(e.target.value)}
                    className="input-field w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cond. IVA Cliente *
                  </label>
                  <select
                    value={condicionIvaCliente}
                    onChange={(e) => setCondicionIvaCliente(e.target.value)}
                    className="input-field w-full"
                  >
                    {CONDICIONES_IVA_OPTIONS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Concepto
                  </label>
                  <select
                    value={conceptoId}
                    onChange={(e) => setConceptoId(e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="">Sin concepto</option>
                    {conceptos.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Centro de Costo *
                  </label>
                  <SelectCentroCosto
                    value={centroCostoId}
                    onChange={setCentroCostoId}
                    required
                    emptyLabel="-- Seleccionar --"
                    className="w-full"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Punto de Venta {esNC && movimientoPadreId ? <span className="text-xs text-gray-500">(hereda del padre)</span> : '*'}
                  </label>
                  <select
                    value={puntoVentaIdSel}
                    onChange={(e) => setPuntoVentaIdSel(e.target.value)}
                    className="input-field w-full"
                    disabled={esNC && !!movimientoPadreId}
                    required={!(esNC && movimientoPadreId)}
                  >
                    <option value="">Seleccionar punto de venta...</option>
                    {puntosVenta.map(pv => (
                      <option key={pv.id} value={pv.id}>
                        {String(pv.numero).padStart(4, '0')} — {pv.nombre}
                        {pv.afipConnection?.environment === 'TESTING' ? ' (TEST)' : ''}
                      </option>
                    ))}
                  </select>
                  {puntosVenta.length === 0 && (
                    <p className="text-xs text-red-600 mt-1">No hay puntos de venta. Configure uno en Tablas Auxiliares.</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    El número de comprobante lo asigna AFIP al pedir CAE.
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={2}
                  className="input-field w-full"
                  placeholder="Observaciones adicionales..."
                />
              </div>
            </div>

            {/* Cobro al momento (solo factura) */}
            {esFactura && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-gray-600" />
                  Cobro
                </h2>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cobrarAlMomento}
                    onChange={(e) => setCobrarAlMomento(e.target.checked)}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-gray-700">Cobrar al momento</span>
                </label>
              </div>

              {cobrarAlMomento ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Caja *
                    </label>
                    <select
                      value={cajaId}
                      onChange={(e) => setCajaId(e.target.value)}
                      className="input-field w-full"
                      required={cobrarAlMomento}
                    >
                      <option value="">Seleccionar caja...</option>
                      {cajas.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nombre} ({formatMonto(c.saldoActual)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Medio de Pago *
                    </label>
                    <select
                      value={medioPago}
                      onChange={(e) => setMedioPago(e.target.value)}
                      className="input-field w-full"
                    >
                      {MEDIOS_PAGO.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  {medioPago !== 'EFECTIVO' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nro. Operacion
                      </label>
                      <input
                        type="text"
                        value={nroOperacion}
                        onChange={(e) => setNroOperacion(e.target.value)}
                        placeholder="Numero de operacion"
                        className="input-field w-full"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  <Wallet className="inline w-4 h-4 mr-1" />
                  La factura quedara pendiente de cobro en cuenta corriente.
                </p>
              )}
            </div>
            )}

            {/* Items */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Package className="w-5 h-5 text-gray-600" />
                  Items de la Factura
                </h2>
                {!pedidoSeleccionado && (
                  <Button type="button" variant="secondary" size="sm" onClick={agregarItem}>
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar Item
                  </Button>
                )}
              </div>

              {items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No hay items. {pedidoSeleccionado ? 'El pedido no tiene items pendientes.' : 'Agregue items a la factura.'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="p-4 border border-gray-200 rounded-lg">
                      <div className="grid grid-cols-12 gap-3 items-end">
                        {/* Producto o descripcion */}
                        <div className="col-span-12 md:col-span-5">
                          {item.itemPedidoId ? (
                            // Item de pedido (solo lectura)
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Producto/Descripcion
                              </label>
                              <input
                                type="text"
                                value={item.descripcion}
                                readOnly
                                className="input-field w-full bg-gray-50"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Max: {item.cantidadMaxima} unidades pendientes
                              </p>
                            </div>
                          ) : (
                            // Item manual
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Producto
                              </label>
                              <select
                                value={item.productoVarianteId || ''}
                                onChange={(e) => actualizarItem(index, 'productoVarianteId', e.target.value)}
                                className="input-field w-full"
                              >
                                <option value="">Seleccionar producto...</option>
                                {productos.map(p => (
                                  <optgroup key={p.id} label={p.nombre}>
                                    {p.variantes?.filter(v => v.activo).map(v => (
                                      <option key={v.id} value={v.id}>
                                        {p.nombre} - {v.talle} (Stock: {v.stockActual})
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                              {!item.productoVarianteId && (
                                <input
                                  type="text"
                                  value={item.descripcion}
                                  onChange={(e) => actualizarItem(index, 'descripcion', e.target.value)}
                                  placeholder="O escriba una descripcion manual..."
                                  className="input-field w-full mt-2"
                                />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Cantidad */}
                        <div className="col-span-4 md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Cantidad
                          </label>
                          <input
                            type="number"
                            value={item.cantidad}
                            onChange={(e) => actualizarItem(index, 'cantidad', parseFloat(e.target.value) || 0)}
                            min="0.01"
                            max={item.cantidadMaxima || undefined}
                            step="0.01"
                            className="input-field w-full"
                          />
                        </div>

                        {/* Precio unitario */}
                        <div className={discriminaIVA ? "col-span-3 md:col-span-1" : "col-span-4 md:col-span-2"}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Precio Unit.
                          </label>
                          <input
                            type="number"
                            value={item.precioUnitario}
                            onChange={(e) => actualizarItem(index, 'precioUnitario', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                            className="input-field w-full"
                          />
                        </div>

                        {/* IVA - solo si discrimina */}
                        {discriminaIVA && (
                          <div className="col-span-3 md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              IVA
                            </label>
                            <select
                              value={item.iva || 21}
                              onChange={(e) => actualizarItem(index, 'iva', parseFloat(e.target.value))}
                              className="input-field w-full"
                            >
                              <option value={21}>21%</option>
                              <option value={10.5}>10.5%</option>
                              <option value={0}>0%</option>
                            </select>
                          </div>
                        )}

                        {/* Subtotal */}
                        <div className={discriminaIVA ? "col-span-3 md:col-span-1" : "col-span-3 md:col-span-2"}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Subtotal
                          </label>
                          <div className="input-field bg-gray-50 text-right font-medium">
                            {formatMonto(calcularSubtotal(item))}
                          </div>
                        </div>

                        {/* Eliminar (solo items manuales) */}
                        <div className="col-span-1">
                          {!item.itemPedidoId && (
                            <button
                              type="button"
                              onClick={() => eliminarItem(index)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Totales */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Resumen</h2>

              {/* Badge tipo comprobante */}
              <div className="mb-4 text-center">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getColorComprobante(tipoComprobanteCalculado)}`}>
                  Factura {tipoComprobanteCalculado}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{discriminaIVA ? 'Subtotal Neto:' : 'Subtotal:'}</span>
                  <span className="font-medium">{formatMonto(totales.subtotal)}</span>
                </div>
                {discriminaIVA && totales.iva21 > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">IVA 21%:</span>
                    <span className="font-medium">{formatMonto(totales.iva21)}</span>
                  </div>
                )}
                {discriminaIVA && totales.iva105 > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">IVA 10.5%:</span>
                    <span className="font-medium">{formatMonto(totales.iva105)}</span>
                  </div>
                )}
                {!discriminaIVA && (
                  <div className="text-xs text-gray-500 text-center py-1">
                    Precio final (IVA incluido o no aplica)
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold border-t pt-3">
                  <span>Total:</span>
                  <span className="text-green-600">{formatMonto(totales.total)}</span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={saving || items.length === 0}
                >
                  {saving ? 'Guardando...' : labelInfo.accion}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => navigate('/admin/ingresos/facturas')}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
