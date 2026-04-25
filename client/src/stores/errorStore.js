/**
 * Store simple de error de conexión (sin dependencias externas).
 * Notifica a los suscriptores cuando cambia el flag de connection error.
 */

let _hasConnectionError = false
let _lastDetail = null
const _listeners = new Set()

function notify() {
  for (const fn of _listeners) {
    try { fn(_hasConnectionError, _lastDetail) } catch (err) { /* noop */ }
  }
}

export const errorStore = {
  get: () => ({ hasConnectionError: _hasConnectionError, detail: _lastDetail }),
  setConnectionError(value, detail = null) {
    if (_hasConnectionError === value && _lastDetail === detail) return
    _hasConnectionError = value
    _lastDetail = detail
    notify()
  },
  subscribe(fn) {
    _listeners.add(fn)
    return () => _listeners.delete(fn)
  },
}

import { useEffect, useState } from 'react'

export function useConnectionError() {
  const [state, setState] = useState(errorStore.get())
  useEffect(() => errorStore.subscribe((hasErr, detail) => setState({ hasConnectionError: hasErr, detail })), [])
  return state
}
