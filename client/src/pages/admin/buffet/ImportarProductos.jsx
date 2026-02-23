import { useState } from 'react'
import { ArrowLeft, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, XCircle, Info, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { Button } from '../../../components/Button'
import Modal from '../../../components/Modal'

export default function ImportarProductos() {
  const navigate = useNavigate()
  const [archivo, setArchivo] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [sobreescribir, setSobreescribir] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [mostrarModalResultado, setMostrarModalResultado] = useState(false)
  const [categorias, setCategorias] = useState([])
  const [mostrarCategorias, setMostrarCategorias] = useState(false)

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (file) {
      // Validar tamaño (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('El archivo no debe superar los 5MB')
        return
      }

      // Validar extensión
      const ext = file.name.toLowerCase()
      if (!ext.endsWith('.csv') && !ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
        toast.error('Solo se permiten archivos CSV o Excel (.xlsx, .xls)')
        return
      }

      setArchivo(file)
    }
  }

  async function handleImportar() {
    if (!archivo) {
      toast.error('Seleccione un archivo')
      return
    }

    setCargando(true)

    try {
      const formData = new FormData()
      formData.append('archivo', archivo)
      formData.append('sobreescribir', sobreescribir)

      const res = await api.post('/importacion/productos', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      setResultado(res.data?.resultado || res.resultado)
      setMostrarModalResultado(true)
      setArchivo(null)

      // Reset input file
      const fileInput = document.getElementById('archivo-input')
      if (fileInput) fileInput.value = ''

      toast.success('Importación completada')
    } catch (err) {
      console.error('Error en importación:', err)
      toast.error(err.response?.data?.error || 'Error al importar productos')
    } finally {
      setCargando(false)
    }
  }

  async function descargarPlantilla(formato = 'xlsx') {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/importacion/plantilla?formato=${formato}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (!response.ok) {
        throw new Error('Error al descargar plantilla')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `plantilla_importacion_productos.${formato}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Plantilla descargada')
    } catch (err) {
      console.error('Error descargando plantilla:', err)
      toast.error('Error al descargar la plantilla')
    }
  }

  async function cargarCategorias() {
    try {
      const data = await api.get('/importacion/categorias-menu')
      setCategorias(data || [])
      setMostrarCategorias(true)
    } catch (err) {
      console.error('Error cargando categorías:', err)
      toast.error('Error al cargar categorías')
    }
  }

  function cerrarModalResultado() {
    setMostrarModalResultado(false)
    setResultado(null)
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/buffet/productos')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <Upload className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Importar Productos</h1>
            <p className="text-gray-500 text-sm">Carga masiva de productos desde archivo CSV o Excel</p>
          </div>
        </div>
      </div>

      {/* Instrucciones */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-2">Cómo importar productos:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Descarga la plantilla en formato Excel o CSV</li>
              <li>Completa los datos de los productos siguiendo el formato</li>
              <li>Guarda el archivo y súbelo usando el formulario</li>
              <li>Revisa el reporte de importación y corrige errores si los hay</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Plantillas */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">1. Descargar Plantilla</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => descargarPlantilla('xlsx')}
            className="flex items-center justify-center gap-3 p-4 border-2 border-green-300 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <FileSpreadsheet className="w-6 h-6 text-green-600" />
            <div className="text-left">
              <p className="font-bold text-green-900">Excel (.xlsx)</p>
              <p className="text-xs text-green-700">Recomendado - Con ejemplos</p>
            </div>
          </button>

          <button
            onClick={() => descargarPlantilla('csv')}
            className="flex items-center justify-center gap-3 p-4 border-2 border-gray-300 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <FileText className="w-6 h-6 text-gray-600" />
            <div className="text-left">
              <p className="font-bold text-gray-900">CSV (.csv)</p>
              <p className="text-xs text-gray-600">Texto plano separado por comas</p>
            </div>
          </button>
        </div>

        <div className="mt-4">
          <button
            onClick={cargarCategorias}
            className="text-sm text-blue-600 hover:underline"
          >
            Ver categorías de menú disponibles →
          </button>
        </div>
      </div>

      {/* Formulario de carga */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">2. Cargar Archivo</h2>

        <div className="space-y-4">
          {/* Input archivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar archivo:
            </label>
            <div className="flex items-center gap-3">
              <input
                id="archivo-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {archivo && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  {archivo.name}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Formatos permitidos: CSV, Excel (.xlsx, .xls) - Tamaño máximo: 5MB
            </p>
          </div>

          {/* Opción sobreescribir */}
          <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <input
              type="checkbox"
              id="sobreescribir"
              checked={sobreescribir}
              onChange={(e) => setSobreescribir(e.target.checked)}
              className="mt-0.5 rounded text-yellow-600 focus:ring-yellow-500"
            />
            <label htmlFor="sobreescribir" className="text-sm cursor-pointer">
              <span className="font-medium text-gray-900">Sobreescribir productos existentes</span>
              <p className="text-gray-600 mt-1">
                Si está marcado, los productos que ya existan (mismo código) serán actualizados con los nuevos datos.
                Si no está marcado, los productos existentes serán omitidos.
              </p>
            </label>
          </div>

          {/* Botón importar */}
          <Button
            onClick={handleImportar}
            disabled={!archivo || cargando}
            className="w-full flex items-center justify-center gap-2"
            size="lg"
          >
            {cargando ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Importando...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Importar Productos
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Formato de la plantilla */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Campos de la Plantilla</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Campo</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Requerido</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Descripción</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Ejemplo</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-2 text-sm font-mono text-gray-900">codigo</td>
                <td className="px-4 py-2 text-sm"><span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">SI</span></td>
                <td className="px-4 py-2 text-sm text-gray-600">Código único del producto</td>
                <td className="px-4 py-2 text-sm font-mono text-gray-500">CAFE001</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-mono text-gray-900">nombre</td>
                <td className="px-4 py-2 text-sm"><span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">SI</span></td>
                <td className="px-4 py-2 text-sm text-gray-600">Nombre del producto</td>
                <td className="px-4 py-2 text-sm text-gray-500">Café Espresso</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-mono text-gray-900">descripcion</td>
                <td className="px-4 py-2 text-sm"><span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">NO</span></td>
                <td className="px-4 py-2 text-sm text-gray-600">Descripción detallada</td>
                <td className="px-4 py-2 text-sm text-gray-500">Café espresso tradicional</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-mono text-gray-900">categoria_menu</td>
                <td className="px-4 py-2 text-sm"><span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">SI</span></td>
                <td className="px-4 py-2 text-sm text-gray-600">Código de categoría del menú</td>
                <td className="px-4 py-2 text-sm font-mono text-gray-500">BEBIDAS_CALIENTES</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-mono text-gray-900">precio</td>
                <td className="px-4 py-2 text-sm"><span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">SI</span></td>
                <td className="px-4 py-2 text-sm text-gray-600">Precio de venta (decimal)</td>
                <td className="px-4 py-2 text-sm font-mono text-gray-500">150.00</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-mono text-gray-900">codigo_barras</td>
                <td className="px-4 py-2 text-sm"><span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">NO</span></td>
                <td className="px-4 py-2 text-sm text-gray-600">Código de barras EAN</td>
                <td className="px-4 py-2 text-sm font-mono text-gray-500">7790001001234</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-mono text-gray-900">activo</td>
                <td className="px-4 py-2 text-sm"><span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">NO</span></td>
                <td className="px-4 py-2 text-sm text-gray-600">Producto activo (SI/NO)</td>
                <td className="px-4 py-2 text-sm font-mono text-gray-500">SI</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-mono text-gray-900">disponible</td>
                <td className="px-4 py-2 text-sm"><span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">NO</span></td>
                <td className="px-4 py-2 text-sm text-gray-600">Disponible para venta (SI/NO)</td>
                <td className="px-4 py-2 text-sm font-mono text-gray-500">SI</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-mono text-gray-900">destacado</td>
                <td className="px-4 py-2 text-sm"><span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">NO</span></td>
                <td className="px-4 py-2 text-sm text-gray-600">Mostrar destacado (SI/NO)</td>
                <td className="px-4 py-2 text-sm font-mono text-gray-500">NO</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-mono text-gray-900">venta_buffet</td>
                <td className="px-4 py-2 text-sm"><span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">NO</span></td>
                <td className="px-4 py-2 text-sm text-gray-600">Se vende en Buffet (SI/NO, defecto SI)</td>
                <td className="px-4 py-2 text-sm font-mono text-gray-500">SI</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-mono text-gray-900">venta_kiosco</td>
                <td className="px-4 py-2 text-sm"><span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">NO</span></td>
                <td className="px-4 py-2 text-sm text-gray-600">Se vende en Kiosco (SI/NO, defecto SI)</td>
                <td className="px-4 py-2 text-sm font-mono text-gray-500">SI</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-mono text-gray-900">venta_takeaway</td>
                <td className="px-4 py-2 text-sm"><span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">NO</span></td>
                <td className="px-4 py-2 text-sm text-gray-600">Se vende en Pedidos (SI/NO, defecto SI)</td>
                <td className="px-4 py-2 text-sm font-mono text-gray-500">NO</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-mono text-gray-900">orden</td>
                <td className="px-4 py-2 text-sm"><span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">NO</span></td>
                <td className="px-4 py-2 text-sm text-gray-600">Orden de visualización</td>
                <td className="px-4 py-2 text-sm font-mono text-gray-500">1</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Resultado */}
      {mostrarModalResultado && resultado && (
        <Modal
          title="Resultado de la Importación"
          isOpen={mostrarModalResultado}
          onClose={cerrarModalResultado}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6">
            {/* Resumen */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{resultado.total}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-sm text-green-600">Exitosos</p>
                <p className="text-2xl font-bold text-green-700">{resultado.exitosos}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <p className="text-sm text-red-600">Errores</p>
                <p className="text-2xl font-bold text-red-700">{resultado.errores}</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <p className="text-sm text-yellow-600">Advertencias</p>
                <p className="text-2xl font-bold text-yellow-700">{resultado.advertencias}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <p className="text-sm text-blue-600">Omitidos</p>
                <p className="text-2xl font-bold text-blue-700">{resultado.omitidos}</p>
              </div>
            </div>

            {/* Detalles */}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {/* Exitosos */}
              {resultado.detalleExitosos?.length > 0 && (
                <div>
                  <h3 className="font-bold text-green-700 flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5" />
                    Productos Importados ({resultado.exitosos})
                  </h3>
                  <div className="space-y-1">
                    {resultado.detalleExitosos.map((item, idx) => (
                      <div key={idx} className="text-sm p-2 bg-green-50 rounded flex justify-between">
                        <span>
                          <span className="font-mono text-green-700">{item.codigo}</span> - {item.nombre}
                        </span>
                        <span className="text-xs text-green-600 uppercase">{item.accion}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Errores */}
              {resultado.detalleErrores?.length > 0 && (
                <div>
                  <h3 className="font-bold text-red-700 flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5" />
                    Errores ({resultado.errores})
                  </h3>
                  <div className="space-y-1">
                    {resultado.detalleErrores.map((item, idx) => (
                      <div key={idx} className="text-sm p-2 bg-red-50 rounded">
                        <p>
                          <span className="font-medium">Fila {item.fila}:</span>{' '}
                          {item.codigo && <span className="font-mono">{item.codigo} - </span>}
                          {item.campo && <span className="text-red-600">Campo "{item.campo}": </span>}
                          {item.error}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Advertencias */}
              {resultado.detalleAdvertencias?.length > 0 && (
                <div>
                  <h3 className="font-bold text-yellow-700 flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5" />
                    Advertencias ({resultado.advertencias})
                  </h3>
                  <div className="space-y-1">
                    {resultado.detalleAdvertencias.map((item, idx) => (
                      <div key={idx} className="text-sm p-2 bg-yellow-50 rounded">
                        <p>
                          <span className="font-medium">Fila {item.fila}:</span>{' '}
                          {item.campo && <span className="text-yellow-600">Campo "{item.campo}": </span>}
                          {item.advertencia}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Omitidos */}
              {resultado.detalleOmitidos?.length > 0 && (
                <div>
                  <h3 className="font-bold text-blue-700 flex items-center gap-2 mb-2">
                    <Info className="w-5 h-5" />
                    Productos Omitidos ({resultado.omitidos})
                  </h3>
                  <div className="space-y-1">
                    {resultado.detalleOmitidos.map((item, idx) => (
                      <div key={idx} className="text-sm p-2 bg-blue-50 rounded">
                        <p>
                          <span className="font-medium">Fila {item.fila}:</span>{' '}
                          <span className="font-mono">{item.codigo}</span> - {item.nombre}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">{item.motivo}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button onClick={cerrarModalResultado}>
                Cerrar
              </Button>
              {resultado.exitosos > 0 && (
                <Button
                  onClick={() => {
                    cerrarModalResultado()
                    navigate('/admin/buffet/productos')
                  }}
                  variant="primary"
                >
                  Ir a Productos
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Categorías */}
      {mostrarCategorias && (
        <Modal
          title="Categorías de Menú Disponibles"
          isOpen={mostrarCategorias}
          onClose={() => setMostrarCategorias(false)}
        >
          <div className="space-y-2">
            {categorias.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Cargando categorías...</p>
            ) : (
              <div className="divide-y">
                {categorias.map(cat => (
                  <div key={cat.codigo} className="py-2">
                    <p className="font-mono text-sm font-bold text-gray-900">{cat.codigo}</p>
                    <p className="text-sm text-gray-600">{cat.nombre}</p>
                    {cat.descripcion && (
                      <p className="text-xs text-gray-500">{cat.descripcion}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
