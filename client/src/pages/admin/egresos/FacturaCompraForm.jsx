import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2, Search, FileText, Package, ClipboardList, Check, CreditCard, Wallet, Info } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'
import {
  CONDICIONES_IVA_OPTIONS,
  getTipoComprobanteCompra,
  debeDiscriminarIVA,
  calcularTotalesFactura,
  getColorComprobante
} from '../../../utils/fiscalHelper'

const MEDIOS_PAGO = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'CHEQUE', label: 'Cheque' }
]

const TIPOS_FACTURA = [
  { value: 'FACTURA_COMPRA', label: 'Factura' },
  { value: 'NOTA_CREDITO_PROVEEDOR', label: 'Nota de Credito' },
  { value: 'NOTA_DEBITO_PROVEEDOR', label: 'Nota de Debito' }
]

export default function FacturaCompraForm() {
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [proveedores, setProveedores] = useState([])
  const [productos, setProductos] = useState([])
  const [conceptos, setConceptos] = useState([])
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [mostrarBuscador, setMostrarBuscador] = useState(false)

  // Ordenes de Compra del proveedor
  const [ordenesCompra, setOrdenesCompra] = useState([])
  const [cargandoOC, setCargandoOC] = useState(false)
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null)
  const [mostrarItemsOC, setMostrarItemsOC] = useState(false)

  const [form, setForm] = useState({
    tipo: 'FACTURA_COMPRA',
    entidadId: '',
    ordenCompraId: '',
    fecha: new Date().toISOString().split('T')[0],
    fechaVencimiento: '',
    tipoComprobante: 'A',
    puntoVenta: '',
    numeroComprobante: '',
    conceptoId: '',
    observaciones: '',
    items: []
  })

  // Totales calculados
  const [totales, setTotales] = useState({
    subtotal: 0,
    iva21: 0,
    iva105: 0,
    otrosImpuestos: 0,
    montoTotal: 0
  })

  // Pago al momento
  const [pagarAlMomento, setPagarAlMomento] = useState(false)
  const [cajaId, setCajaId] = useState('')
  const [medioPago, setMedioPago] = useState('TRANSFERENCIA')
  const [nroOperacion, setNroOperacion] = useState('')
  const [cajas, setCajas] = useState([])

  // Configuración fiscal
  const [configFiscal, setConfigFiscal] = useState({
    condicionIva: 'INSCRIPTO', // Condición IVA del CLUB (receptor)
    cuit: '',
    razonSocial: ''
  })
  const [condicionIvaProveedor, setCondicionIvaProveedor] = useState('INSCRIPTO') // Condición IVA del PROVEEDOR (emisor)

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  useEffect(() => {
    calcularTotales()
  }, [form.items])

  // Cargar OC cuando cambia el proveedor
  useEffect(() => {
    if (form.entidadId) {
      cargarOrdenesCompra(form.entidadId)
    } else {
      setOrdenesCompra([])
      setOrdenSeleccionada(null)
      setForm(prev => ({ ...prev, ordenCompraId: '' }))
    }
  }, [form.entidadId])

  async function cargarDatosIniciales() {
    setLoading(true)
    try {
      const [provRes, prodRes, concRes, cajasRes, configCondIva, configCuit, configRazonSocial] = await Promise.all([
        api.getFull('/admin/entidades?tipo=PROVEEDOR&activo=true&limit=500'),
        api.getFull('/admin/productos?activo=true&limit=500'),
        api.getFull('/admin/conceptos-tesoreria?activo=true').catch(() => ({ data: [] })),
        api.getFull('/admin/cajas?activo=true'),
        api.get('/admin/sistema/configuracion/FISCAL_CONDICION_IVA').catch(() => null),
        api.get('/admin/sistema/configuracion/FISCAL_CUIT').catch(() => null),
        api.get('/admin/sistema/configuracion/FISCAL_RAZON_SOCIAL').catch(() => null)
      ])
      setProveedores(provRes.data || [])
      setProductos(prodRes.data || [])
      setConceptos(concRes.data || [])
      setCajas(cajasRes.data || [])

      // Configuración fiscal del club (receptor)
      setConfigFiscal({
        condicionIva: configCondIva?.valor || 'INSCRIPTO',
        cuit: configCuit?.valor || '',
        razonSocial: configRazonSocial?.valor || ''
      })

      // Preseleccionar primera caja si existe
      if (cajasRes.data?.length > 0) {
        setCajaId(cajasRes.data[0].id.toString())
      }
    } catch (err) {
      console.error('Error cargando datos:', err)
      showModal({ type: 'error', message: 'Error al cargar los datos' })
    } finally {
      setLoading(false)
    }
  }

  async function cargarOrdenesCompra(entidadId) {
    setCargandoOC(true)
    try {
      // Cargar OC del proveedor que no esten CANCELADAS
      const response = await api.getFull(`/admin/ordenes-compra?entidadId=${entidadId}&limit=100`)
      // Filtrar las que tengan items pendientes de facturar
      const ordenesConPendientes = (response.data || []).filter(oc => {
        if (oc.estado === 'CANCELADA') return false
        // Verificar si tiene items con cantidad pendiente de facturar
        return oc.items?.some(item => {
          const pendiente = parseFloat(item.cantidad) - parseFloat(item.cantidadFacturada || 0)
          return pendiente > 0
        })
      })
      setOrdenesCompra(ordenesConPendientes)
    } catch (err) {
      console.error('Error cargando OC:', err)
    } finally {
      setCargandoOC(false)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))

    // Si cambia el proveedor, actualizar su condición IVA
    if (name === 'entidadId' && value) {
      const proveedor = proveedores.find(p => p.id === parseInt(value))
      if (proveedor) {
        setCondicionIvaProveedor(proveedor.condicionIva || 'INSCRIPTO')
      }
    }
  }

  // Determinar tipo de comprobante automaticamente (lógica inversa: proveedor es el emisor)
  const tipoComprobanteCalculado = getTipoComprobanteCompra(condicionIvaProveedor, configFiscal.condicionIva)
  const discriminaIVA = debeDiscriminarIVA(condicionIvaProveedor) // El proveedor es el emisor

  function handleOrdenCompraChange(e) {
    const ocId = e.target.value
    setForm(prev => ({ ...prev, ordenCompraId: ocId }))

    if (ocId) {
      const oc = ordenesCompra.find(o => o.id === parseInt(ocId))
      setOrdenSeleccionada(oc)
      setMostrarItemsOC(true)
    } else {
      setOrdenSeleccionada(null)
      setMostrarItemsOC(false)
    }
  }

  function handleItemChange(index, field, value) {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  function agregarItemManual() {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, {
        productoVarianteId: '',
        itemOrdenCompraId: null,
        descripcion: '',
        cantidad: '1',
        precioUnitario: '',
        iva: '21',
        producto: null,
        variante: null,
        cantidadPendienteOC: null
      }]
    }))
  }

  function agregarProducto(producto, variante) {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, {
        productoVarianteId: variante.id.toString(),
        itemOrdenCompraId: null,
        descripcion: `${producto.nombre} - ${variante.talle}${variante.color ? ` ${variante.color}` : ''}`,
        cantidad: '1',
        precioUnitario: producto.precioCompra?.toString() || '',
        iva: '21',
        producto: producto,
        variante: variante,
        cantidadPendienteOC: null
      }]
    }))
    setMostrarBuscador(false)
    setBusquedaProducto('')
  }

  // Agregar item desde Orden de Compra
  function agregarItemDeOC(itemOC) {
    const cantidadPendiente = parseFloat(itemOC.cantidad) - parseFloat(itemOC.cantidadFacturada || 0)

    if (cantidadPendiente <= 0) {
      showModal({ type: 'warning', message: 'Este item ya fue completamente facturado' })
      return
    }

    // Verificar si el item ya fue agregado
    const yaAgregado = form.items.some(item => item.itemOrdenCompraId === itemOC.id)
    if (yaAgregado) {
      showModal({ type: 'warning', message: 'Este item ya fue agregado a la factura' })
      return
    }

    const descripcion = itemOC.descripcion ||
      (itemOC.productoVariante ?
        `${itemOC.productoVariante.producto?.nombre || ''} - ${itemOC.productoVariante.talle}${itemOC.productoVariante.color ? ` ${itemOC.productoVariante.color}` : ''}`
        : 'Sin descripcion')

    setForm(prev => ({
      ...prev,
      items: [...prev.items, {
        productoVarianteId: itemOC.productoVarianteId?.toString() || '',
        itemOrdenCompraId: itemOC.id,
        descripcion: descripcion,
        cantidad: cantidadPendiente.toString(),
        precioUnitario: itemOC.precioUnitario?.toString() || '',
        iva: '21',
        producto: itemOC.productoVariante?.producto || null,
        variante: itemOC.productoVariante || null,
        cantidadPendienteOC: cantidadPendiente
      }]
    }))
  }

  // Agregar todos los items pendientes de la OC
  function agregarTodosItemsOC() {
    if (!ordenSeleccionada) return

    const itemsAgregados = form.items.filter(i => i.itemOrdenCompraId).map(i => i.itemOrdenCompraId)
    const nuevosItems = []

    for (const itemOC of ordenSeleccionada.items) {
      const cantidadPendiente = parseFloat(itemOC.cantidad) - parseFloat(itemOC.cantidadFacturada || 0)

      if (cantidadPendiente <= 0 || itemsAgregados.includes(itemOC.id)) continue

      const descripcion = itemOC.descripcion ||
        (itemOC.productoVariante ?
          `${itemOC.productoVariante.producto?.nombre || ''} - ${itemOC.productoVariante.talle}${itemOC.productoVariante.color ? ` ${itemOC.productoVariante.color}` : ''}`
          : 'Sin descripcion')

      nuevosItems.push({
        productoVarianteId: itemOC.productoVarianteId?.toString() || '',
        itemOrdenCompraId: itemOC.id,
        descripcion: descripcion,
        cantidad: cantidadPendiente.toString(),
        precioUnitario: itemOC.precioUnitario?.toString() || '',
        iva: '21',
        producto: itemOC.productoVariante?.producto || null,
        variante: itemOC.productoVariante || null,
        cantidadPendienteOC: cantidadPendiente
      })
    }

    if (nuevosItems.length === 0) {
      showModal({ type: 'info', message: 'Todos los items de la OC ya fueron agregados o facturados' })
      return
    }

    setForm(prev => ({
      ...prev,
      items: [...prev.items, ...nuevosItems]
    }))
  }

  function eliminarItem(index) {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  function calcularTotales() {
    // Preparar items con IVA para el helper
    const itemsConIva = form.items.map(item => ({
      cantidad: parseFloat(item.cantidad) || 0,
      precioUnitario: parseFloat(item.precioUnitario) || 0,
      iva: parseFloat(item.iva) || 21
    }))

    const result = calcularTotalesFactura(itemsConIva, discriminaIVA)

    setTotales({
      subtotal: result.subtotal,
      iva21: result.iva21,
      iva105: result.iva105,
      otrosImpuestos: 0,
      montoTotal: result.total
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.entidadId) {
      showModal({ type: 'warning', message: 'Debe seleccionar un proveedor' })
      return
    }

    if (!form.puntoVenta || !form.numeroComprobante) {
      showModal({ type: 'warning', message: 'Debe ingresar el punto de venta y numero de comprobante' })
      return
    }

    if (form.items.length === 0) {
      showModal({ type: 'warning', message: 'Debe agregar al menos un item' })
      return
    }

    // Validar pago al momento
    if (pagarAlMomento && !cajaId) {
      showModal({ type: 'warning', message: 'Debe seleccionar una caja para el pago' })
      return
    }

    for (const item of form.items) {
      if (!item.descripcion && !item.productoVarianteId) {
        showModal({ type: 'warning', message: 'Cada item debe tener una descripcion o un producto seleccionado' })
        return
      }
      if (!item.cantidad || parseFloat(item.cantidad) <= 0) {
        showModal({ type: 'warning', message: 'La cantidad debe ser mayor a 0' })
        return
      }
      if (!item.precioUnitario || parseFloat(item.precioUnitario) <= 0) {
        showModal({ type: 'warning', message: 'El precio unitario debe ser mayor a 0' })
        return
      }
      // Validar que no se facture mas de lo pendiente si viene de OC
      if (item.cantidadPendienteOC !== null && parseFloat(item.cantidad) > item.cantidadPendienteOC) {
        showModal({
          type: 'warning',
          message: `La cantidad de "${item.descripcion}" no puede superar lo pendiente de la OC (${item.cantidadPendienteOC})`
        })
        return
      }
    }

    setSaving(true)
    try {
      const data = {
        tipo: form.tipo,
        entidadId: parseInt(form.entidadId),
        ordenCompraId: form.ordenCompraId ? parseInt(form.ordenCompraId) : null,
        fecha: form.fecha,
        fechaVencimiento: form.fechaVencimiento || null,
        tipoComprobante: tipoComprobanteCalculado,
        puntoVenta: form.puntoVenta.padStart(4, '0'),
        numeroComprobante: form.numeroComprobante.padStart(8, '0'),
        conceptoId: form.conceptoId ? parseInt(form.conceptoId) : null,
        observaciones: form.observaciones || null,
        subtotal: totales.subtotal,
        iva21: discriminaIVA ? totales.iva21 : 0,
        iva105: discriminaIVA ? totales.iva105 : 0,
        otrosImpuestos: totales.otrosImpuestos,
        montoTotal: totales.montoTotal,
        items: form.items.map(item => ({
          productoVarianteId: item.productoVarianteId ? parseInt(item.productoVarianteId) : null,
          itemOrdenCompraId: item.itemOrdenCompraId || null,
          descripcion: item.descripcion || null,
          cantidad: parseFloat(item.cantidad),
          precioUnitario: parseFloat(item.precioUnitario),
          iva: discriminaIVA ? (parseFloat(item.iva) || 21) : 0
        }))
      }

      const facturaResponse = await api.post('/admin/movimientos-contables', data)

      // Si se marco pagar al momento, crear la Orden de Pago
      if (pagarAlMomento) {
        const ordenPagoPayload = {
          entidadId: parseInt(form.entidadId),
          fecha: form.fecha,
          facturaIds: [facturaResponse.data.id],
          cajaId: parseInt(cajaId),
          medioPago: medioPago,
          nroOperacion: nroOperacion || null,
          montoTotal: totales.montoTotal,
          observaciones: `Pago al momento de factura ${form.tipoComprobante} ${form.puntoVenta.padStart(4, '0')}-${form.numeroComprobante.padStart(8, '0')}`
        }
        await api.post('/admin/ordenes-pago', ordenPagoPayload)
      }

      showModal({
        type: 'success',
        message: pagarAlMomento
          ? 'Factura registrada y pagada correctamente'
          : 'Factura registrada correctamente',
        onConfirm: () => navigate('/admin/egresos/facturas')
      })
    } catch (err) {
      showModal({ type: 'error', message: err.message || 'Error al guardar la factura' })
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

  function formatFecha(fecha) {
    return new Date(fecha).toLocaleDateString('es-AR')
  }

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
    p.codigo.toLowerCase().includes(busquedaProducto.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div>
      {ModalComponent}
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/egresos/facturas')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Nueva Factura de Compra</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos principales */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos del Comprobante</h2>

          {/* Info del tipo de comprobante calculado */}
          {form.entidadId && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Tipo de comprobante esperado:</span>
                  <span className={`px-2 py-1 rounded-full text-sm font-semibold ${getColorComprobante(tipoComprobanteCalculado)}`}>
                    Factura {tipoComprobanteCalculado}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {discriminaIVA ? 'Con IVA discriminado' : 'Precio final (no discrimina IVA)'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Proveedor: {CONDICIONES_IVA_OPTIONS.find(c => c.value === condicionIvaProveedor)?.label || condicionIvaProveedor}
                {' → '}
                Club: {configFiscal.condicionIva === 'INSCRIPTO' ? 'Resp. Inscripto' : configFiscal.condicionIva === 'MONOTRIBUTISTA' ? 'Monotributista' : 'Exento'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo *
              </label>
              <select
                name="tipo"
                value={form.tipo}
                onChange={handleChange}
                className="input-field w-full"
              >
                {TIPOS_FACTURA.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Proveedor *
              </label>
              <select
                name="entidadId"
                value={form.entidadId}
                onChange={handleChange}
                required
                className="input-field w-full"
              >
                <option value="">Seleccionar proveedor...</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.razonSocial} {p.nombreFantasia ? `(${p.nombreFantasia})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha *
              </label>
              <input
                type="date"
                name="fecha"
                value={form.fecha}
                onChange={handleChange}
                required
                className="input-field w-full"
              />
            </div>
          </div>

          {/* Selector de Orden de Compra */}
          {form.entidadId && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-800">Vincular a Orden de Compra (opcional)</span>
              </div>

              {cargandoOC ? (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                  Cargando ordenes...
                </div>
              ) : ordenesCompra.length === 0 ? (
                <p className="text-sm text-gray-600">
                  No hay ordenes de compra pendientes de facturar para este proveedor
                </p>
              ) : (
                <select
                  name="ordenCompraId"
                  value={form.ordenCompraId}
                  onChange={handleOrdenCompraChange}
                  className="input-field w-full md:w-1/2"
                >
                  <option value="">Sin vincular a OC</option>
                  {ordenesCompra.map((oc) => (
                    <option key={oc.id} value={oc.id}>
                      {oc.numero} - {formatFecha(oc.fecha)} ({oc.estado})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cond. IVA Proveedor
              </label>
              <select
                value={condicionIvaProveedor}
                onChange={(e) => setCondicionIvaProveedor(e.target.value)}
                className="input-field w-full"
              >
                {CONDICIONES_IVA_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Punto Venta *
              </label>
              <input
                type="text"
                name="puntoVenta"
                value={form.puntoVenta}
                onChange={handleChange}
                placeholder="0001"
                maxLength={4}
                required
                className="input-field w-full font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nro Comprobante *
              </label>
              <input
                type="text"
                name="numeroComprobante"
                value={form.numeroComprobante}
                onChange={handleChange}
                placeholder="00000001"
                maxLength={8}
                required
                className="input-field w-full font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Vencimiento
              </label>
              <input
                type="date"
                name="fechaVencimiento"
                value={form.fechaVencimiento}
                onChange={handleChange}
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Concepto
              </label>
              <select
                name="conceptoId"
                value={form.conceptoId}
                onChange={handleChange}
                className="input-field w-full"
              >
                <option value="">Sin concepto</option>
                {conceptos.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones
            </label>
            <input
              type="text"
              name="observaciones"
              value={form.observaciones}
              onChange={handleChange}
              placeholder="Notas adicionales..."
              className="input-field w-full"
            />
          </div>
        </div>

        {/* Items de la Orden de Compra */}
        {ordenSeleccionada && mostrarItemsOC && (
          <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-800">
                  Items de {ordenSeleccionada.numero}
                </h2>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={agregarTodosItemsOC}
              >
                <Check className="w-4 h-4 mr-2" />
                Agregar Todos los Pendientes
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Descripcion</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-600">Pedido</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-600">Facturado</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-600">Pendiente</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">Precio Unit.</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-600">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenSeleccionada.items?.map((itemOC) => {
                    const cantidadPendiente = parseFloat(itemOC.cantidad) - parseFloat(itemOC.cantidadFacturada || 0)
                    const yaAgregado = form.items.some(i => i.itemOrdenCompraId === itemOC.id)
                    const descripcion = itemOC.descripcion ||
                      (itemOC.productoVariante ?
                        `${itemOC.productoVariante.producto?.nombre || ''} - ${itemOC.productoVariante.talle}`
                        : 'Sin descripcion')

                    return (
                      <tr key={itemOC.id} className={`border-b border-gray-100 ${cantidadPendiente <= 0 ? 'bg-gray-50 text-gray-400' : ''}`}>
                        <td className="py-2 px-2">
                          {descripcion}
                        </td>
                        <td className="py-2 px-2 text-center">{itemOC.cantidad}</td>
                        <td className="py-2 px-2 text-center">{itemOC.cantidadFacturada || 0}</td>
                        <td className="py-2 px-2 text-center font-medium">
                          <span className={cantidadPendiente > 0 ? 'text-blue-600' : 'text-gray-400'}>
                            {cantidadPendiente}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right">{formatMonto(itemOC.precioUnitario)}</td>
                        <td className="py-2 px-2 text-center">
                          {cantidadPendiente > 0 && !yaAgregado ? (
                            <button
                              type="button"
                              onClick={() => agregarItemDeOC(itemOC)}
                              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition"
                            >
                              Agregar
                            </button>
                          ) : yaAgregado ? (
                            <span className="text-xs text-green-600">Agregado</span>
                          ) : (
                            <span className="text-xs text-gray-400">Completo</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Items de la Factura */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Items de la Factura</h2>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMostrarBuscador(!mostrarBuscador)}
              >
                <Package className="w-4 h-4 mr-2" />
                Agregar Producto
              </Button>
              <Button type="button" variant="secondary" onClick={agregarItemManual}>
                <Plus className="w-4 h-4 mr-2" />
                Item Manual
              </Button>
            </div>
          </div>

          {/* Buscador de productos */}
          {mostrarBuscador && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={busquedaProducto}
                  onChange={(e) => setBusquedaProducto(e.target.value)}
                  placeholder="Buscar producto por nombre o codigo..."
                  className="input-field w-full pl-10"
                  autoFocus
                />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {productosFiltrados.slice(0, 10).map((producto) => (
                  <div key={producto.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-mono text-xs text-gray-500">{producto.codigo}</span>
                        <p className="font-medium text-gray-800">{producto.nombre}</p>
                        {producto.precioCompra && (
                          <p className="text-sm text-gray-600">
                            Precio compra: {formatMonto(producto.precioCompra)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {producto.variantes?.map((variante) => (
                        <button
                          key={variante.id}
                          type="button"
                          onClick={() => agregarProducto(producto, variante)}
                          className="px-3 py-1 text-sm bg-gray-100 hover:bg-primary hover:text-white rounded-lg transition"
                        >
                          {variante.talle}{variante.color ? ` - ${variante.color}` : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {busquedaProducto && productosFiltrados.length === 0 && (
                  <p className="text-center text-gray-500 py-4">No se encontraron productos</p>
                )}
              </div>
            </div>
          )}

          {/* Lista de items */}
          {form.items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No hay items agregados</p>
              {ordenSeleccionada && (
                <p className="text-sm mt-2">Seleccione items de la Orden de Compra o agregue manualmente</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {form.items.map((item, index) => (
                <div
                  key={index}
                  className={`flex gap-4 items-start p-4 rounded-lg border ${
                    item.itemOrdenCompraId
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Descripcion
                        {item.itemOrdenCompraId && (
                          <span className="ml-2 text-blue-600">(de OC)</span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={item.descripcion}
                        onChange={(e) => handleItemChange(index, 'descripcion', e.target.value)}
                        placeholder="Descripcion del item..."
                        className="input-field w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Cantidad
                        {item.cantidadPendienteOC !== null && (
                          <span className="ml-1 text-blue-600">(max: {item.cantidadPendienteOC})</span>
                        )}
                      </label>
                      <input
                        type="number"
                        value={item.cantidad}
                        onChange={(e) => handleItemChange(index, 'cantidad', e.target.value)}
                        min="0.01"
                        max={item.cantidadPendienteOC || undefined}
                        step="0.01"
                        className="input-field w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Precio Unit.
                      </label>
                      <input
                        type="number"
                        value={item.precioUnitario}
                        onChange={(e) => handleItemChange(index, 'precioUnitario', e.target.value)}
                        min="0"
                        step="0.01"
                        className="input-field w-full"
                      />
                    </div>
                    {discriminaIVA && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          IVA
                        </label>
                        <select
                          value={item.iva}
                          onChange={(e) => handleItemChange(index, 'iva', e.target.value)}
                          className="input-field w-full"
                        >
                          <option value="21">21%</option>
                          <option value="10.5">10.5%</option>
                          <option value="0">0%</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="text-right pt-5">
                    <p className="text-sm font-semibold text-gray-800">
                      {formatMonto((parseFloat(item.cantidad) || 0) * (parseFloat(item.precioUnitario) || 0))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => eliminarItem(index)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg mt-5"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Totales */}
          {form.items.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex justify-end">
                <div className="w-72 space-y-2">
                  {/* Badge tipo comprobante */}
                  <div className="text-center mb-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getColorComprobante(tipoComprobanteCalculado)}`}>
                      Factura {tipoComprobanteCalculado}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{discriminaIVA ? 'Subtotal (Neto):' : 'Subtotal:'}</span>
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
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span className="text-primary">{formatMonto(totales.montoTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pagar al momento */}
        {form.items.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="pagarAlMomento"
                checked={pagarAlMomento}
                onChange={(e) => setPagarAlMomento(e.target.checked)}
                className="w-5 h-5 rounded text-primary focus:ring-primary"
              />
              <label htmlFor="pagarAlMomento" className="flex items-center gap-2 cursor-pointer">
                <CreditCard className="w-5 h-5 text-red-600" />
                <span className="font-semibold text-gray-800">Pagar al momento</span>
              </label>
              <span className="text-sm text-gray-500">
                (genera automaticamente la Orden de Pago)
              </span>
            </div>

            {pagarAlMomento && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Caja *
                  </label>
                  <div className="relative">
                    <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={cajaId}
                      onChange={(e) => setCajaId(e.target.value)}
                      required={pagarAlMomento}
                      className="input-field w-full pl-10"
                    >
                      <option value="">Seleccionar caja...</option>
                      {cajas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre} ({formatMonto(c.saldoActual)})
                        </option>
                      ))}
                    </select>
                  </div>
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
                    {MEDIOS_PAGO.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nro. Operacion
                  </label>
                  <input
                    type="text"
                    value={nroOperacion}
                    onChange={(e) => setNroOperacion(e.target.value)}
                    placeholder="Ref. transferencia, cheque..."
                    className="input-field w-full"
                  />
                </div>

                <div className="flex items-end">
                  <div className="w-full p-3 bg-white rounded-lg border border-red-300">
                    <p className="text-xs text-gray-500">Total a Pagar</p>
                    <p className="text-xl font-bold text-red-600">
                      {formatMonto(totales.montoTotal)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/admin/egresos/facturas')}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Registrar Factura
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
