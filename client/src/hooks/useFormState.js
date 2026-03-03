import { useState, useCallback, useRef } from 'react'

/**
 * Hook para manejar el estado de formularios
 *
 * @param {Object} initialData - Datos iniciales del formulario
 * @param {Object} options - Opciones de configuración
 * @param {function} options.validate - Función de validación
 * @param {function} options.onSubmit - Función a ejecutar al enviar
 *
 * @returns {Object} Estado y funciones del formulario
 *
 * @example
 * const {
 *   data,
 *   handleChange,
 *   setField,
 *   loading,
 *   saving,
 *   error,
 *   submit
 * } = useFormState({ nombre: '', email: '' })
 *
 * <input name="nombre" value={data.nombre} onChange={handleChange} />
 */
export function useFormState(initialData = {}, options = {}) {
  const { validate, onSubmit } = options

  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [errors, setErrors] = useState({}) // Errores por campo
  const [success, setSuccess] = useState(false)
  const [touched, setTouched] = useState({})
  const [isDirty, setIsDirty] = useState(false)

  // Ref para datos iniciales (para reset)
  const initialDataRef = useRef(initialData)

  // Manejar cambio en inputs
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target
    const newValue = type === 'checkbox' ? checked : value

    setData(prev => ({ ...prev, [name]: newValue }))
    setIsDirty(true)
    setError(null)

    // Limpiar error del campo si existe
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }, [errors])

  // Marcar campo como tocado (para validación on blur)
  const handleBlur = useCallback((e) => {
    const { name } = e.target
    setTouched(prev => ({ ...prev, [name]: true }))
  }, [])

  // Establecer un campo específico
  const setField = useCallback((name, value) => {
    setData(prev => ({ ...prev, [name]: value }))
    setIsDirty(true)
  }, [])

  // Establecer múltiples campos
  const setFields = useCallback((fields) => {
    setData(prev => ({ ...prev, ...fields }))
    setIsDirty(true)
  }, [])

  // Resetear formulario
  const reset = useCallback((newData = null) => {
    setData(newData || initialDataRef.current)
    setError(null)
    setErrors({})
    setSuccess(false)
    setTouched({})
    setIsDirty(false)
  }, [])

  // Actualizar datos iniciales (útil para edición)
  const setInitialData = useCallback((newInitialData) => {
    initialDataRef.current = newInitialData
    setData(newInitialData)
    setIsDirty(false)
  }, [])

  // Validar formulario
  const validateForm = useCallback(() => {
    if (!validate) return { isValid: true, errors: {} }

    const validationErrors = validate(data)
    const hasErrors = Object.keys(validationErrors).length > 0

    setErrors(validationErrors)
    return { isValid: !hasErrors, errors: validationErrors }
  }, [data, validate])

  // Enviar formulario
  const submit = useCallback(async (submitFn = onSubmit) => {
    if (!submitFn) {
      console.warn('useFormState: No submit function provided')
      return { success: false }
    }

    // Validar si hay función de validación
    if (validate) {
      const { isValid, errors: validationErrors } = validateForm()
      if (!isValid) {
        setError('Por favor, corrija los errores del formulario')
        return { success: false, errors: validationErrors }
      }
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const result = await submitFn(data)
      setSuccess(true)
      setIsDirty(false)
      return { success: true, data: result }
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Error al guardar'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setSaving(false)
    }
  }, [data, onSubmit, validate, validateForm])

  // Verificar si un campo tiene error y fue tocado
  const hasError = useCallback((name) => {
    return touched[name] && errors[name]
  }, [touched, errors])

  // Obtener mensaje de error de un campo
  const getError = useCallback((name) => {
    return touched[name] ? errors[name] : null
  }, [touched, errors])

  return {
    // Estado
    data,
    setData,
    loading,
    setLoading,
    saving,
    setSaving,
    error,
    setError,
    errors,
    setErrors,
    success,
    setSuccess,
    touched,
    isDirty,

    // Handlers
    handleChange,
    handleBlur,
    setField,
    setFields,

    // Acciones
    reset,
    setInitialData,
    validateForm,
    submit,

    // Helpers
    hasError,
    getError
  }
}

/**
 * Hook simplificado para formularios de carga de datos
 * Incluye estado de carga inicial
 */
export function useFormWithLoad(loadFn, initialData = {}, options = {}) {
  const form = useFormState(initialData, options)
  const [initialLoading, setInitialLoading] = useState(true)

  const load = useCallback(async () => {
    setInitialLoading(true)
    form.setError(null)

    try {
      const data = await loadFn()
      form.setInitialData(data)
      return data
    } catch (err) {
      form.setError(err.message || 'Error al cargar datos')
      return null
    } finally {
      setInitialLoading(false)
    }
  }, [loadFn, form])

  return {
    ...form,
    initialLoading,
    load
  }
}

export default useFormState
