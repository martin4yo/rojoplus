import { useState, useEffect } from 'react'
import { X, Check, Plus, Minus, AlertCircle, Square, CheckSquare } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'

/**
 * Modal para seleccionar opciones de un producto
 * Soporta:
 * - Selección única (radio): elegir 1 opción (ej: guarnición)
 * - Selección múltiple con cantidades (ej: docena de empanadas)
 * - Selección múltiple con checkboxes (ej: ingredientes ensalada/hamburguesa)
 * - Opciones preseleccionadas que se pueden quitar (ej: hamburguesa sin cebolla)
 *
 * @param {Object} props
 * @param {Object} props.producto - Producto con gruposOpciones
 * @param {Function} props.onConfirmar - Callback con { producto, opcionesSeleccionadas, opcionesRemovidas, cantidad, observaciones }
 * @param {Function} props.onCerrar - Callback para cerrar el modal
 */
export default function ModalOpcionesProducto({ producto, onConfirmar, onCerrar }) {
  const [cantidad, setCantidad] = useState(1)
  const [observaciones, setObservaciones] = useState('')
  const [selecciones, setSelecciones] = useState({})
  const [errores, setErrores] = useState({})

  const gruposOpciones = producto?.gruposOpciones || []

  // Determinar si un grupo usa cantidades (tipo docena) o checkboxes (tipo ingredientes)
  const grupoUsaCantidades = (grupo) => {
    // Usar cantidades si maxSelecciones > 1 y NO tiene opciones preseleccionadas
    return grupo.tipo === 'MULTIPLE' &&
           grupo.maxSelecciones > 1 &&
           !grupo.opciones.some(o => o.seleccionadoPorDefecto)
  }

  // Inicializar selecciones según los grupos
  useEffect(() => {
    if (producto?.gruposOpciones) {
      const inicial = {}
      producto.gruposOpciones.forEach(grupo => {
        if (grupo.tipo === 'MULTIPLE') {
          if (grupoUsaCantidades(grupo)) {
            // Modo cantidades (docena de empanadas)
            inicial[grupo.id] = {}
          } else {
            // Modo checkboxes - preseleccionar los que tienen seleccionadoPorDefecto
            const seleccionados = {}
            grupo.opciones.forEach(op => {
              if (op.seleccionadoPorDefecto) {
                seleccionados[op.id] = true
              }
            })
            inicial[grupo.id] = seleccionados
          }
        } else {
          // Selección única
          if (grupo.obligatorio && grupo.opciones.length > 0) {
            const defaultOp = grupo.opciones.find(o => o.seleccionadoPorDefecto) || grupo.opciones[0]
            inicial[grupo.id] = defaultOp.id
          } else {
            inicial[grupo.id] = null
          }
        }
      })
      setSelecciones(inicial)
    }
  }, [producto])

  if (!producto) return null

  // Manejar selección única
  const handleSeleccionUnica = (grupoId, opcionId) => {
    setSelecciones(prev => ({ ...prev, [grupoId]: opcionId }))
    setErrores(prev => ({ ...prev, [grupoId]: null }))
  }

  // Manejar toggle de checkbox
  const handleToggleCheckbox = (grupoId, opcionId) => {
    setSelecciones(prev => {
      const grupoSelecciones = { ...(prev[grupoId] || {}) }
      if (grupoSelecciones[opcionId]) {
        delete grupoSelecciones[opcionId]
      } else {
        grupoSelecciones[opcionId] = true
      }
      return { ...prev, [grupoId]: grupoSelecciones }
    })
    setErrores(prev => ({ ...prev, [grupoId]: null }))
  }

  // Manejar cambio de cantidad (para docena de empanadas)
  const handleCantidadMultiple = (grupoId, opcionId, delta) => {
    setSelecciones(prev => {
      const grupoSelecciones = { ...(prev[grupoId] || {}) }
      const cantidadActual = typeof grupoSelecciones[opcionId] === 'number' ? grupoSelecciones[opcionId] : 0
      const nuevaCantidad = Math.max(0, cantidadActual + delta)

      if (nuevaCantidad === 0) {
        delete grupoSelecciones[opcionId]
      } else {
        grupoSelecciones[opcionId] = nuevaCantidad
      }

      return { ...prev, [grupoId]: grupoSelecciones }
    })
    setErrores(prev => ({ ...prev, [grupoId]: null }))
  }

  // Calcular total seleccionado para un grupo MULTIPLE
  const getTotalGrupo = (grupoId, usaCantidades) => {
    const grupoSelecciones = selecciones[grupoId] || {}
    if (usaCantidades) {
      return Object.values(grupoSelecciones).reduce((sum, cant) => sum + (typeof cant === 'number' ? cant : 0), 0)
    } else {
      return Object.keys(grupoSelecciones).length
    }
  }

  // Validar selecciones
  const validar = () => {
    const nuevosErrores = {}
    let valido = true

    gruposOpciones.forEach(grupo => {
      if (grupo.obligatorio && grupo.tipo === 'MULTIPLE') {
        const usaCantidades = grupoUsaCantidades(grupo)
        const totalSeleccionado = getTotalGrupo(grupo.id, usaCantidades)

        if (totalSeleccionado < grupo.minSelecciones) {
          nuevosErrores[grupo.id] = `Selecciona al menos ${grupo.minSelecciones} (tenés ${totalSeleccionado})`
          valido = false
        } else if (totalSeleccionado > grupo.maxSelecciones) {
          nuevosErrores[grupo.id] = `Máximo ${grupo.maxSelecciones} (tenés ${totalSeleccionado})`
          valido = false
        }
      } else if (grupo.obligatorio && grupo.tipo === 'UNICA') {
        if (!selecciones[grupo.id]) {
          nuevosErrores[grupo.id] = 'Selecciona una opción'
          valido = false
        }
      }
    })

    setErrores(nuevosErrores)
    return valido
  }

  // Calcular precio adicional total
  const calcularPrecioAdicional = () => {
    let adicional = 0
    gruposOpciones.forEach(grupo => {
      const seleccion = selecciones[grupo.id]
      const usaCantidades = grupoUsaCantidades(grupo)

      if (grupo.tipo === 'MULTIPLE' && typeof seleccion === 'object') {
        Object.entries(seleccion).forEach(([opcionId, valor]) => {
          const opcion = grupo.opciones.find(o => o.id === parseInt(opcionId))
          if (opcion) {
            const cant = usaCantidades ? (typeof valor === 'number' ? valor : 0) : 1
            // Solo sumar precio si NO estaba seleccionado por defecto
            if (!opcion.seleccionadoPorDefecto) {
              adicional += (Number(opcion.precioAdicional) || 0) * cant
            }
          }
        })
      } else if (seleccion) {
        const opcion = grupo.opciones.find(o => o.id === seleccion)
        if (opcion && !opcion.seleccionadoPorDefecto) {
          adicional += Number(opcion.precioAdicional) || 0
        }
      }
    })
    return adicional
  }

  const precioBase = Number(producto.precio) || 0
  const precioAdicional = calcularPrecioAdicional()
  const precioTotal = (precioBase + precioAdicional) * cantidad

  // Confirmar selección
  const handleConfirmar = () => {
    if (!validar()) return

    const opcionesSeleccionadas = []
    const opcionesRemovidas = [] // Opciones que venían por defecto pero se quitaron

    gruposOpciones.forEach(grupo => {
      const seleccion = selecciones[grupo.id]
      const usaCantidades = grupoUsaCantidades(grupo)

      if (grupo.tipo === 'MULTIPLE' && typeof seleccion === 'object') {
        grupo.opciones.forEach(opcion => {
          const estaSeleccionado = seleccion[opcion.id]

          if (estaSeleccionado) {
            // Opción seleccionada
            const cant = usaCantidades ? (typeof estaSeleccionado === 'number' ? estaSeleccionado : 1) : 1
            opcionesSeleccionadas.push({
              opcionId: opcion.id,
              cantidad: cant,
              precioAdicional: opcion.seleccionadoPorDefecto ? 0 : Number(opcion.precioAdicional) || 0,
              nombre: opcion.productoRef?.nombre || opcion.nombre
            })
          } else if (opcion.seleccionadoPorDefecto) {
            // Venía por defecto pero se quitó
            opcionesRemovidas.push({
              opcionId: opcion.id,
              nombre: opcion.productoRef?.nombre || opcion.nombre
            })
          }
        })
      } else if (seleccion) {
        const opcion = grupo.opciones.find(o => o.id === seleccion)
        if (opcion) {
          opcionesSeleccionadas.push({
            opcionId: opcion.id,
            cantidad: 1,
            precioAdicional: opcion.seleccionadoPorDefecto ? 0 : Number(opcion.precioAdicional) || 0,
            nombre: opcion.productoRef?.nombre || opcion.nombre
          })
        }
      }
    })

    onConfirmar({
      producto,
      opcionesSeleccionadas,
      opcionesRemovidas,
      cantidad,
      observaciones: observaciones.trim() || null
    })
  }

  // Obtener nombre de la opción (usa productoRef si existe)
  const getNombreOpcion = (opcion) => {
    return opcion.productoRef?.nombre || opcion.nombre
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{producto.nombre}</h2>
            <p className="text-sm text-gray-500">Personaliza tu pedido</p>
          </div>
          <button
            onClick={onCerrar}
            className="p-2 rounded-full hover:bg-gray-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {gruposOpciones.map(grupo => {
            const esMultiple = grupo.tipo === 'MULTIPLE'
            const usaCantidades = grupoUsaCantidades(grupo)
            const tieneDefaults = grupo.opciones.some(o => o.seleccionadoPorDefecto)
            const totalGrupo = esMultiple ? getTotalGrupo(grupo.id, usaCantidades) : 0

            return (
              <div key={grupo.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">{grupo.nombre}</h3>
                    {grupo.descripcion && (
                      <p className={`text-xs ${tieneDefaults ? 'text-blue-600 font-bold' : 'text-gray-500'}`}>
                        {grupo.descripcion}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {esMultiple && usaCantidades && (
                      <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                        totalGrupo >= grupo.minSelecciones && totalGrupo <= grupo.maxSelecciones
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {totalGrupo}/{grupo.maxSelecciones}
                      </span>
                    )}
                    {grupo.obligatorio && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        Obligatorio
                      </span>
                    )}
                  </div>
                </div>

                {/* Opciones */}
                <div className="space-y-1">
                  {grupo.opciones.filter(o => o.disponible !== false).map(opcion => {
                    const nombreOpcion = getNombreOpcion(opcion)

                    if (esMultiple && usaCantidades) {
                      // Modo cantidades (docena de empanadas)
                      const cantidadOpcion = typeof selecciones[grupo.id]?.[opcion.id] === 'number'
                        ? selecciones[grupo.id][opcion.id]
                        : 0
                      const isSelected = cantidadOpcion > 0

                      return (
                        <div
                          key={opcion.id}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                            isSelected ? 'border-red-500 bg-red-50' : 'border-gray-200'
                          }`}
                        >
                          <span className="font-medium text-gray-800">{nombreOpcion}</span>
                          <div className="flex items-center gap-2">
                            {Number(opcion.precioAdicional) > 0 && (
                              <span className="text-sm text-green-600 font-semibold mr-2">
                                +{formatCurrency(opcion.precioAdicional, { showSymbol: false })}
                              </span>
                            )}
                            <button
                              onClick={() => handleCantidadMultiple(grupo.id, opcion.id, -1)}
                              className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 active:scale-95 disabled:opacity-50"
                              disabled={cantidadOpcion === 0}
                            >
                              <Minus size={16} />
                            </button>
                            <span className="w-6 text-center font-bold">{cantidadOpcion}</span>
                            <button
                              onClick={() => handleCantidadMultiple(grupo.id, opcion.id, 1)}
                              className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 active:scale-95"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </div>
                      )
                    } else if (esMultiple) {
                      // Modo checkboxes (ingredientes)
                      const isSelected = !!selecciones[grupo.id]?.[opcion.id]

                      return (
                        <button
                          key={opcion.id}
                          onClick={() => handleToggleCheckbox(grupo.id, opcion.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                            isSelected ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {isSelected ? (
                              <CheckSquare size={20} className="text-red-500" />
                            ) : (
                              <Square size={20} className="text-gray-400" />
                            )}
                            <span className={`font-medium ${isSelected ? 'text-gray-800' : 'text-gray-600'}`}>
                              {nombreOpcion}
                            </span>
                          </div>
                          {Number(opcion.precioAdicional) > 0 && !opcion.seleccionadoPorDefecto && (
                            <span className="text-sm text-green-600 font-semibold">
                              +{formatCurrency(opcion.precioAdicional, { showSymbol: false })}
                            </span>
                          )}
                        </button>
                      )
                    } else {
                      // Modo radio (selección única)
                      const isSelected = selecciones[grupo.id] === opcion.id

                      return (
                        <button
                          key={opcion.id}
                          onClick={() => handleSeleccionUnica(grupo.id, opcion.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                            isSelected ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? 'border-red-500 bg-red-500' : 'border-gray-300'
                            }`}>
                              {isSelected && <Check size={14} className="text-white" />}
                            </div>
                            <span className="font-medium text-gray-800">{nombreOpcion}</span>
                          </div>
                          {Number(opcion.precioAdicional) > 0 && (
                            <span className="text-sm text-green-600 font-semibold">
                              +{formatCurrency(opcion.precioAdicional, { showSymbol: false })}
                            </span>
                          )}
                        </button>
                      )
                    }
                  })}
                </div>

                {/* Error del grupo */}
                {errores[grupo.id] && (
                  <div className="flex items-center gap-1 text-red-600 text-sm">
                    <AlertCircle size={14} />
                    <span>{errores[grupo.id]}</span>
                  </div>
                )}
              </div>
            )
          })}

          {/* Observaciones */}
          <div className="space-y-2">
            <label className="font-semibold text-gray-800">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej: Bien cocido, sin sal, etc."
              className="w-full p-3 border rounded-xl resize-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              rows={2}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl space-y-3">
          {/* Cantidad */}
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-700">Cantidad</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 active:scale-95"
              >
                <Minus size={18} />
              </button>
              <span className="text-xl font-bold w-8 text-center">{cantidad}</span>
              <button
                onClick={() => setCantidad(cantidad + 1)}
                className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 active:scale-95"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* Botón confirmar */}
          <button
            onClick={handleConfirmar}
            className="w-full py-3 bg-red-600 text-white rounded-xl font-bold text-lg hover:bg-red-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span>Agregar</span>
            <span className="bg-white/20 px-2 py-0.5 rounded-lg">
              {formatCurrency(precioTotal, { showSymbol: false })}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
