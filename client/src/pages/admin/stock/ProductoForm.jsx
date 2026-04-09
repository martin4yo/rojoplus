import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save, Package, Plus, Trash2, Star, Image } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { MultiImageUpload } from '../../../components/ImageUpload'
import api from '../../../services/api'
import { useConfirm } from '../../../hooks/useConfirm'
import LoadingSpinner from '../../../components/LoadingSpinner'

const TALLES_DEFAULT = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'UNICO']

export default function ProductoForm() {
  const { confirm, ConfirmDialog } = useConfirm()
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isEditing = id && id !== 'nuevo'
  const startInEditMode = searchParams.get('editar') === 'true'

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [editMode, setEditMode] = useState(!isEditing || startInEditMode)

  // Data para selects
  const [categorias, setCategorias] = useState([])
  const [conceptos, setConceptos] = useState([])

  // Form data
  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    categoriaId: '',
    precioCompra: '',
    precioVenta: '',
    conceptoCompraId: '',
    conceptoVentaId: '',
    activo: true,
    aparecerEnCompras: true
  })

  // Variantes (talles)
  const [variantes, setVariantes] = useState([])
  const [nuevaVariante, setNuevaVariante] = useState({ talle: '', color: '', stockActual: 0, stockMinimo: 0 })

  // Fotos
  const [fotos, setFotos] = useState([])
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [fotosUrls, setFotosUrls] = useState([])

  useEffect(() => {
    cargarDatosAuxiliares()
    if (isEditing) {
      cargarProducto()
    }
  }, [id])

  async function cargarDatosAuxiliares() {
    try {
      const [catRes, concRes] = await Promise.all([
        api.getFull('/admin/categorias-producto?activo=true'),
        api.getFull('/admin/conceptos-tesoreria?activo=true')
      ])
      setCategorias(catRes.data || [])
      setConceptos(concRes.data || [])
    } catch (err) {
      console.error('Error cargando datos auxiliares:', err)
    }
  }

  async function cargarProducto() {
    setLoading(true)
    try {
      const res = await api.getFull(`/admin/productos/${id}`)
      const producto = res.data
      setForm({
        codigo: producto.codigo || '',
        nombre: producto.nombre || '',
        descripcion: producto.descripcion || '',
        categoriaId: producto.categoriaId ? String(producto.categoriaId) : '',
        precioCompra: producto.precioCompra || '',
        precioVenta: producto.precioVenta || '',
        conceptoCompraId: producto.conceptoCompraId ? String(producto.conceptoCompraId) : '',
        conceptoVentaId: producto.conceptoVentaId ? String(producto.conceptoVentaId) : '',
        activo: producto.activo !== false,
        aparecerEnCompras: producto.aparecerEnCompras !== false
      })
      setVariantes(producto.variantes || [])
      setFotos(producto.fotos || [])
      setFotosUrls((producto.fotos || []).map(f => f.url))
    } catch (err) {
      setError('Error al cargar producto')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.codigo || !form.nombre) {
      setError('Codigo y nombre son requeridos')
      return
    }

    if (!form.conceptoCompraId || !form.conceptoVentaId) {
      setError('Los conceptos de compra y venta son obligatorios')
      return
    }

    setSaving(true)
    try {
      const datos = {
        codigo: form.codigo,
        nombre: form.nombre,
        descripcion: form.descripcion || null,
        categoriaId: form.categoriaId ? parseInt(form.categoriaId) : null,
        precioCompra: form.precioCompra ? parseFloat(form.precioCompra) : null,
        precioVenta: form.precioVenta ? parseFloat(form.precioVenta) : null,
        conceptoCompraId: form.conceptoCompraId ? parseInt(form.conceptoCompraId) : null,
        conceptoVentaId: form.conceptoVentaId ? parseInt(form.conceptoVentaId) : null,
        activo: form.activo,
        aparecerEnCompras: form.aparecerEnCompras
      }

      // Si es nuevo, incluir variantes iniciales
      if (!isEditing && variantes.length > 0) {
        datos.variantes = variantes.map(v => ({
          talle: v.talle,
          color: v.color || null,
          stockActual: parseFloat(v.stockActual) || 0,
          stockMinimo: parseFloat(v.stockMinimo) || 0
        }))
      }

      if (isEditing) {
        await api.put(`/admin/productos/${id}`, datos)
        setSuccess('Producto actualizado correctamente')
        setEditMode(false)
      } else {
        const res = await api.post('/admin/productos', datos)
        setSuccess('Producto creado correctamente')
        navigate(`/admin/stock/productos/${res.data.id}`)
      }
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // Variantes
  async function agregarVariante() {
    if (!nuevaVariante.talle) {
      setError('Seleccione un talle')
      return
    }

    // Verificar duplicado
    const existe = variantes.find(v =>
      v.talle === nuevaVariante.talle && (v.color || '') === (nuevaVariante.color || '')
    )
    if (existe) {
      setError('Ya existe una variante con ese talle y color')
      return
    }

    if (isEditing) {
      // Guardar en servidor
      try {
        const variante = await api.post(`/admin/productos/${id}/variantes`, nuevaVariante)
        setVariantes([...variantes, variante])
        setNuevaVariante({ talle: '', color: '', stockActual: 0, stockMinimo: 0 })
        setSuccess('Variante agregada')
      } catch (err) {
        setError(err.message || 'Error al agregar variante')
      }
    } else {
      // Solo agregar localmente
      setVariantes([...variantes, { ...nuevaVariante, id: Date.now() }])
      setNuevaVariante({ talle: '', color: '', stockActual: 0, stockMinimo: 0 })
    }
  }

  async function eliminarVariante(variante) {
    if (isEditing) {
      const confirmed = await confirm('Eliminar esta variante?', 'Esta accion no se puede deshacer.')
      if (!confirmed) return
      try {
        await api.delete(`/admin/producto-variantes/${variante.id}`)
        setVariantes(variantes.filter(v => v.id !== variante.id))
        setSuccess('Variante eliminada')
      } catch (err) {
        setError(err.message || 'Error al eliminar variante')
      }
    } else {
      setVariantes(variantes.filter(v => v.id !== variante.id))
    }
  }

  // Fotos - Handlers para MultiImageUpload
  async function handleFotosChange(newUrls) {
    if (!isEditing) {
      setError('Guarde el producto primero para subir fotos')
      return
    }

    // Detectar si se agregó una nueva imagen
    if (newUrls.length > fotosUrls.length) {
      const newUrl = newUrls[newUrls.length - 1]

      // Convertir base64/file a FormData y subir
      setUploadingFoto(true)
      try {
        // Si es un archivo (File object) o base64
        let file
        if (newUrl instanceof File) {
          file = newUrl
        } else if (typeof newUrl === 'string' && newUrl.startsWith('data:')) {
          // Convertir base64 a File
          const response = await fetch(newUrl)
          const blob = await response.blob()
          file = new File([blob], 'imagen.jpg', { type: 'image/jpeg' })
        }

        if (file) {
          const formData = new FormData()
          formData.append('foto', file)
          const res = await api.postFormData(`/admin/productos/${id}/fotos`, formData)
          setFotos([...fotos, res.data])
          setFotosUrls([...fotosUrls, res.data.url])
          setSuccess('Foto subida correctamente')
        }
      } catch (err) {
        setError(err.message || 'Error al subir foto')
        // Revertir el cambio en la UI
        setFotosUrls(fotosUrls)
      } finally {
        setUploadingFoto(false)
      }
    }
    // Detectar si se eliminó una imagen
    else if (newUrls.length < fotosUrls.length) {
      const removedUrl = fotosUrls.find(url => !newUrls.includes(url))
      const fotoToDelete = fotos.find(f => f.url === removedUrl)

      if (fotoToDelete) {
        try {
          await api.delete(`/admin/producto-fotos/${fotoToDelete.id}`)
          setFotos(fotos.filter(f => f.id !== fotoToDelete.id))
          setFotosUrls(newUrls)
          setSuccess('Foto eliminada')
        } catch (err) {
          setError(err.message || 'Error al eliminar foto')
          // Revertir el cambio en la UI
          setFotosUrls(fotosUrls)
        }
      }
    }
  }

  async function handleMainImageChange(index) {
    const fotoToMarkMain = fotos[index]
    if (!fotoToMarkMain) return

    try {
      await api.put(`/admin/producto-fotos/${fotoToMarkMain.id}/principal`)
      setFotos(fotos.map(f => ({ ...f, esPrincipal: f.id === fotoToMarkMain.id })))
      setSuccess('Foto marcada como principal')
    } catch (err) {
      setError(err.message || 'Error al marcar foto')
    }
  }

  // Agregar talles rapidos
  function agregarTallesRapido() {
    const nuevos = TALLES_DEFAULT.filter(t => !variantes.find(v => v.talle === t))
      .map(talle => ({
        id: Date.now() + Math.random(),
        talle,
        color: '',
        stockActual: 0,
        stockMinimo: 0
      }))
    setVariantes([...variantes, ...nuevos])
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  const conceptosCompra = conceptos.filter(c => c.tipo === 'EGRESO' || c.tipo === 'AMBOS')
  const conceptosVenta = conceptos.filter(c => c.tipo === 'INGRESO' || c.tipo === 'AMBOS')

  return (
    <div>
      <ConfirmDialog />
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/stock/productos')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 rounded-lg bg-primary/10">
            <Package className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {isEditing ? (editMode ? 'Editar Producto' : form.nombre) : 'Nuevo Producto'}
            </h1>
            {isEditing && <p className="text-gray-500 text-sm">{form.codigo}</p>}
          </div>
        </div>
        {isEditing && !editMode && (
          <Button onClick={() => setEditMode(true)}>Editar</Button>
        )}
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success" className="mb-4" onClose={() => setSuccess(null)}>{success}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda - Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos basicos */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Datos del Producto</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Codigo *</label>
                  <input
                    type="text"
                    value={form.codigo}
                    onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                    className="input-field w-full font-mono"
                    placeholder="Ej: REM-001"
                    disabled={!editMode}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={e => setForm({ ...form, nombre: e.target.value })}
                    className="input-field w-full"
                    placeholder="Ej: Remera Oficial 2026"
                    disabled={!editMode}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                <textarea
                  value={form.descripcion}
                  onChange={e => setForm({ ...form, descripcion: e.target.value })}
                  className="input-field w-full"
                  rows={2}
                  placeholder="Descripcion opcional del producto..."
                  disabled={!editMode}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select
                    value={form.categoriaId}
                    onChange={e => setForm({ ...form, categoriaId: e.target.value })}
                    className="input-field w-full"
                    disabled={!editMode}
                  >
                    <option value="">Sin categoria</option>
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-4">
                  {isEditing && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.activo}
                        onChange={e => setForm({ ...form, activo: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-primary"
                        disabled={!editMode}
                      />
                      <span className="text-sm text-gray-700">Producto activo</span>
                    </label>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.aparecerEnCompras}
                      onChange={e => setForm({ ...form, aparecerEnCompras: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-primary"
                      disabled={isEditing && !editMode}
                    />
                    <span className="text-sm text-gray-700">Aparece en Compras</span>
                  </label>
                </div>
              </div>

              {/* Precios */}
              <div className="pt-4 border-t">
                <h3 className="font-medium text-gray-700 mb-3">Precios</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Precio Compra</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={form.precioCompra}
                        onChange={e => setForm({ ...form, precioCompra: e.target.value })}
                        className="input-field w-full pl-7"
                        placeholder="0.00"
                        disabled={!editMode}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Precio Venta</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={form.precioVenta}
                        onChange={e => setForm({ ...form, precioVenta: e.target.value })}
                        className="input-field w-full pl-7"
                        placeholder="0.00"
                        disabled={!editMode}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Conceptos Contables */}
              <div className="pt-4 border-t">
                <h3 className="font-medium text-gray-700 mb-3">Conceptos Contables</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Concepto Compra <span className="text-red-500">*</span></label>
                    <select
                      value={form.conceptoCompraId}
                      onChange={e => setForm({ ...form, conceptoCompraId: e.target.value })}
                      className={`input-field w-full ${editMode && !form.conceptoCompraId ? 'border-red-300' : ''}`}
                      disabled={!editMode}
                      required
                    >
                      <option value="">Seleccionar concepto...</option>
                      {conceptosCompra.map(c => (
                        <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Para facturas de compra</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Concepto Venta <span className="text-red-500">*</span></label>
                    <select
                      value={form.conceptoVentaId}
                      onChange={e => setForm({ ...form, conceptoVentaId: e.target.value })}
                      className={`input-field w-full ${editMode && !form.conceptoVentaId ? 'border-red-300' : ''}`}
                      disabled={!editMode}
                      required
                    >
                      <option value="">Seleccionar concepto...</option>
                      {conceptosVenta.map(c => (
                        <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Para facturas de venta</p>
                  </div>
                </div>
              </div>

              {/* Botones */}
              {editMode && (
                <div className="flex gap-3 pt-4 border-t">
                  <Button type="submit" loading={saving}>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar
                  </Button>
                  {isEditing && (
                    <Button type="button" variant="secondary" onClick={() => {
                      setEditMode(false)
                      cargarProducto()
                    }}>
                      Cancelar
                    </Button>
                  )}
                </div>
              )}
            </form>
          </div>

          {/* Variantes / Talles */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Variantes / Talles</h2>
              {editMode && !isEditing && (
                <Button variant="secondary" size="sm" onClick={agregarTallesRapido}>
                  Agregar talles estandar
                </Button>
              )}
            </div>

            {/* Lista de variantes */}
            {variantes.length > 0 ? (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Talle</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Color</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Stock</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Minimo</th>
                      {editMode && <th className="px-3 py-2"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {variantes.map((v, i) => (
                      <tr key={v.id || i} className={v.stockActual <= v.stockMinimo ? 'bg-orange-50' : ''}>
                        <td className="px-3 py-2 font-medium">{v.talle}</td>
                        <td className="px-3 py-2 text-gray-600">{v.color || '-'}</td>
                        <td className="px-3 py-2 text-right font-medium">{v.stockActual}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{v.stockMinimo}</td>
                        {editMode && (
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => eliminarVariante(v)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-sm mb-4">No hay variantes definidas</p>
            )}

            {/* Agregar variante */}
            {editMode && (
              <div className="border-t pt-4">
                <p className="text-sm text-gray-600 mb-2">Agregar variante:</p>
                <div className="flex flex-wrap gap-2 items-end">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Talle *</label>
                    <select
                      value={nuevaVariante.talle}
                      onChange={e => setNuevaVariante({ ...nuevaVariante, talle: e.target.value })}
                      className="input-field"
                    >
                      <option value="">Seleccionar</option>
                      {TALLES_DEFAULT.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                      <option value="OTRO">Otro...</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Color</label>
                    <input
                      type="text"
                      value={nuevaVariante.color}
                      onChange={e => setNuevaVariante({ ...nuevaVariante, color: e.target.value })}
                      className="input-field w-24"
                      placeholder="Opcional"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Stock</label>
                    <input
                      type="number"
                      value={nuevaVariante.stockActual}
                      onChange={e => setNuevaVariante({ ...nuevaVariante, stockActual: e.target.value })}
                      className="input-field w-20"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Minimo</label>
                    <input
                      type="number"
                      value={nuevaVariante.stockMinimo}
                      onChange={e => setNuevaVariante({ ...nuevaVariante, stockMinimo: e.target.value })}
                      className="input-field w-20"
                      min="0"
                    />
                  </div>
                  <Button type="button" size="sm" onClick={agregarVariante}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha - Fotos */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Fotos</h2>

            {isEditing && editMode ? (
              <MultiImageUpload
                images={fotosUrls}
                onChange={handleFotosChange}
                maxImages={10}
                mainImageIndex={fotos.findIndex(f => f.esPrincipal)}
                onMainChange={handleMainImageChange}
                maxSize={5 * 1024 * 1024}
                accept="image/jpeg,image/png,image/webp"
              />
            ) : fotos.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {fotos.map(foto => (
                  <div key={foto.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={foto.url}
                      alt="Producto"
                      className="w-full h-full object-cover"
                    />
                    {foto.esPrincipal && (
                      <div className="absolute top-1 left-1 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Star className="w-3 h-3" /> Principal
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="aspect-square bg-gray-100 rounded-lg flex flex-col items-center justify-center">
                <Image className="w-16 h-16 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500 text-center">
                  {isEditing ? 'No hay fotos del producto' : 'Guarde el producto para agregar fotos'}
                </p>
              </div>
            )}
          </div>

          {/* Resumen de stock */}
          {isEditing && variantes.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Resumen de Stock</h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Stock Total:</span>
                  <span className="font-bold">{variantes.reduce((s, v) => s + Number(v.stockActual), 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Variantes:</span>
                  <span className="font-medium">{variantes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Bajo minimo:</span>
                  <span className={`font-medium ${variantes.filter(v => v.stockActual <= v.stockMinimo).length > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {variantes.filter(v => v.stockActual <= v.stockMinimo).length}
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => navigate(`/admin/stock/movimientos?productoId=${id}`)}
                >
                  Ver Movimientos
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
