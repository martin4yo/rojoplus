import { useState, useEffect } from 'react'
import { DollarSign, Search, Filter, Percent, Save, X, Check, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'

export default function BuffetPrecios() {
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [tipoVentaFiltro, setTipoVentaFiltro] = useState('')

  // Edición masiva
  const [seleccionados, setSeleccionados] = useState([])
  const [mostrarAjusteMasivo, setMostrarAjusteMasivo] = useState(false)
  const [ajusteTipo, setAjusteTipo] = useState('porcentaje') // porcentaje, fijo
  const [ajusteValor, setAjusteValor] = useState('')
  const [ajusteOperacion, setAjusteOperacion] = useState('aumentar') // aumentar, disminuir, establecer

  // Cambios pendientes
  const [cambiosPendientes, setCambiosPendientes] = useState({})

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    try {
      const [prodRes, catRes] = await Promise.all([
        api.get('/admin/buffet/productos?activo=true'),
        api.get('/admin/buffet/categorias?activo=true')
      ])

      setProductos(prodRes.data || prodRes || [])
      setCategorias(catRes.data || catRes || [])
    } catch (err) {
      console.error('Error cargando datos:', err)
      toast.error('Error cargando productos')
    } finally {
      setLoading(false)
    }
  }

  // Filtrar productos
  const productosFiltrados = productos.filter(p => {
    if (busqueda && !p.nombre.toLowerCase().includes(busqueda.toLowerCase())) {
      return false
    }
    if (categoriaFiltro && p.categoriaMenuId !== parseInt(categoriaFiltro)) {
      return false
    }
    if (tipoVentaFiltro && !p.tiposVenta.includes(tipoVentaFiltro)) {
      return false
    }
    return true
  })

  // Cambiar precio individual
  function cambiarPrecio(productoId, nuevoPrecio) {
    setCambiosPendientes(prev => ({
      ...prev,
      [productoId]: parseFloat(nuevoPrecio) || 0
    }))
  }

  // Seleccionar/deseleccionar producto
  function toggleSeleccion(productoId) {
    setSeleccionados(prev =>
      prev.includes(productoId)
        ? prev.filter(id => id !== productoId)
        : [...prev, productoId]
    )
  }

  // Seleccionar todos los filtrados
  function seleccionarTodos() {
    if (seleccionados.length === productosFiltrados.length) {
      setSeleccionados([])
    } else {
      setSeleccionados(productosFiltrados.map(p => p.id))
    }
  }

  // Aplicar ajuste masivo
  function aplicarAjusteMasivo() {
    if (!ajusteValor || seleccionados.length === 0) {
      toast.error('Selecciona productos e ingresa un valor')
      return
    }

    const valor = parseFloat(ajusteValor)
    const nuevosCambios = { ...cambiosPendientes }

    seleccionados.forEach(prodId => {
      const producto = productos.find(p => p.id === prodId)
      if (!producto) return

      const precioActual = cambiosPendientes[prodId] !== undefined
        ? cambiosPendientes[prodId]
        : parseFloat(producto.precio)

      let nuevoPrecio = precioActual

      if (ajusteTipo === 'porcentaje') {
        if (ajusteOperacion === 'aumentar') {
          nuevoPrecio = precioActual * (1 + valor / 100)
        } else if (ajusteOperacion === 'disminuir') {
          nuevoPrecio = precioActual * (1 - valor / 100)
        }
      } else if (ajusteTipo === 'fijo') {
        if (ajusteOperacion === 'aumentar') {
          nuevoPrecio = precioActual + valor
        } else if (ajusteOperacion === 'disminuir') {
          nuevoPrecio = precioActual - valor
        } else if (ajusteOperacion === 'establecer') {
          nuevoPrecio = valor
        }
      }

      nuevosCambios[prodId] = Math.max(0, nuevoPrecio)
    })

    setCambiosPendientes(nuevosCambios)
    setMostrarAjusteMasivo(false)
    setAjusteValor('')
    toast.success(`Ajuste aplicado a ${seleccionados.length} productos`)
  }

  // Guardar cambios
  async function guardarCambios() {
    const cambios = Object.entries(cambiosPendientes)
    if (cambios.length === 0) {
      toast.error('No hay cambios pendientes')
      return
    }

    setGuardando(true)
    try {
      const actualizaciones = cambios.map(([id, precio]) => ({
        id: parseInt(id),
        precio
      }))

      await api.put('/admin/buffet/productos/precios', { productos: actualizaciones })

      // Actualizar lista local
      setProductos(prev => prev.map(p => {
        if (cambiosPendientes[p.id] !== undefined) {
          return { ...p, precio: cambiosPendientes[p.id] }
        }
        return p
      }))

      setCambiosPendientes({})
      setSeleccionados([])
      toast.success(`${cambios.length} precios actualizados`)
    } catch (err) {
      console.error('Error guardando precios:', err)
      toast.error(err.response?.data?.error || 'Error al guardar precios')
    } finally {
      setGuardando(false)
    }
  }

  // Cancelar cambios
  function cancelarCambios() {
    setCambiosPendientes({})
    setSeleccionados([])
    toast.info('Cambios descartados')
  }

  const haySeleccionados = seleccionados.length > 0
  const hayCambios = Object.keys(cambiosPendientes).length > 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="text-green-600" size={28} />
            Gestión de Precios
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Actualiza precios individualmente o en forma masiva
          </p>
        </div>

        {hayCambios && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {Object.keys(cambiosPendientes).length} cambios pendientes
            </span>
            <button
              onClick={cancelarCambios}
              disabled={guardando}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50 flex items-center gap-2"
            >
              <X size={18} />
              Cancelar
            </button>
            <button
              onClick={guardarCambios}
              disabled={guardando}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {guardando ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Filter className="text-gray-400" size={20} />
          <h3 className="font-semibold text-gray-700">Filtros</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar producto..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Categoría */}
          <select
            value={categoriaFiltro}
            onChange={e => setCategoriaFiltro(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none"
          >
            <option value="">Todas las categorías</option>
            {categorias.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.nombre}</option>
            ))}
          </select>

          {/* Tipo de Venta */}
          <select
            value={tipoVentaFiltro}
            onChange={e => setTipoVentaFiltro(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none"
          >
            <option value="">Todos los tipos</option>
            <option value="BUFFET">Buffet</option>
            <option value="KIOSCO">Kiosco</option>
            <option value="TAKEAWAY">Take Away</option>
          </select>

          {/* Botón Seleccionar Todos */}
          <button
            onClick={seleccionarTodos}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Check size={18} />
            {seleccionados.length === productosFiltrados.length ? 'Deseleccionar' : 'Seleccionar'} Todos
          </button>
        </div>

        {/* Estadísticas */}
        <div className="mt-4 flex items-center gap-6 text-sm text-gray-600">
          <span>Mostrando: <strong>{productosFiltrados.length}</strong> productos</span>
          {haySeleccionados && (
            <span className="text-blue-600 font-medium">
              Seleccionados: <strong>{seleccionados.length}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Ajuste Masivo */}
      {haySeleccionados && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Percent className="text-blue-600" size={20} />
              <span className="font-semibold text-blue-900">
                {seleccionados.length} productos seleccionados
              </span>
            </div>

            <button
              onClick={() => setMostrarAjusteMasivo(!mostrarAjusteMasivo)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Percent size={18} />
              Ajuste Masivo
            </button>
          </div>

          {mostrarAjusteMasivo && (
            <div className="mt-4 pt-4 border-t border-blue-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Operación */}
                <select
                  value={ajusteOperacion}
                  onChange={e => setAjusteOperacion(e.target.value)}
                  className="px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-300 outline-none"
                >
                  <option value="aumentar">Aumentar</option>
                  <option value="disminuir">Disminuir</option>
                  <option value="establecer">Establecer precio</option>
                </select>

                {/* Tipo */}
                <select
                  value={ajusteTipo}
                  onChange={e => setAjusteTipo(e.target.value)}
                  className="px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-300 outline-none"
                  disabled={ajusteOperacion === 'establecer'}
                >
                  <option value="porcentaje">Por porcentaje (%)</option>
                  <option value="fijo">Monto fijo ($)</option>
                </select>

                {/* Valor */}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={ajusteValor}
                  onChange={e => setAjusteValor(e.target.value)}
                  placeholder={ajusteTipo === 'porcentaje' ? 'Ej: 10' : 'Ej: 100'}
                  className="px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-300 outline-none"
                />

                {/* Aplicar */}
                <button
                  onClick={aplicarAjusteMasivo}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <Check size={18} />
                  Aplicar
                </button>
              </div>

              {/* Preview */}
              {ajusteValor && (
                <div className="mt-3 text-sm text-blue-700">
                  <AlertCircle size={16} className="inline mr-1" />
                  {ajusteOperacion === 'aumentar' && ajusteTipo === 'porcentaje' && `Aumentará precios en ${ajusteValor}%`}
                  {ajusteOperacion === 'disminuir' && ajusteTipo === 'porcentaje' && `Disminuirá precios en ${ajusteValor}%`}
                  {ajusteOperacion === 'aumentar' && ajusteTipo === 'fijo' && `Sumará $${ajusteValor} a cada precio`}
                  {ajusteOperacion === 'disminuir' && ajusteTipo === 'fijo' && `Restará $${ajusteValor} a cada precio`}
                  {ajusteOperacion === 'establecer' && `Establecerá todos los precios en $${ajusteValor}`}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tabla de Productos */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={seleccionados.length === productosFiltrados.length && productosFiltrados.length > 0}
                    onChange={seleccionarTodos}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-200"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Producto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Categoría</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tipo Venta</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Precio Actual</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Nuevo Precio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {productosFiltrados.map(producto => {
                const precioActual = parseFloat(producto.precio)
                const precioNuevo = cambiosPendientes[producto.id]
                const tieneCambio = precioNuevo !== undefined

                return (
                  <tr key={producto.id} className={`hover:bg-gray-50 ${tieneCambio ? 'bg-yellow-50' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={seleccionados.includes(producto.id)}
                        onChange={() => toggleSeleccion(producto.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-200"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{producto.nombre}</div>
                      {producto.codigoBarras && (
                        <div className="text-xs text-gray-500">{producto.codigoBarras}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {producto.categoriaMenu?.nombre}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {producto.tiposVenta.map(tipo => (
                          <span
                            key={tipo}
                            className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700"
                          >
                            {tipo}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${tieneCambio ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        ${precioActual.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={tieneCambio ? precioNuevo : precioActual}
                        onChange={e => cambiarPrecio(producto.id, e.target.value)}
                        className={`w-32 px-3 py-1.5 text-right border rounded-lg focus:ring-2 focus:outline-none ${
                          tieneCambio
                            ? 'border-yellow-500 bg-yellow-50 text-yellow-900 font-bold focus:ring-yellow-300'
                            : 'border-gray-300 focus:ring-blue-200'
                        }`}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {productosFiltrados.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <DollarSign size={48} className="mx-auto mb-3 opacity-50" />
              <p>No se encontraron productos con los filtros aplicados</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
