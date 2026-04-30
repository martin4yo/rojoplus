import { Component } from 'react'
import ConnectionError from './ConnectionError'

const CHUNK_LOAD_RELOAD_KEY = 'chunk-reload-attempted-at'
const CHUNK_LOAD_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Loading chunk \d+ failed/i,
  /Importing a module script failed/i,
]

function isChunkLoadError(error) {
  const msg = error?.message || String(error || '')
  return CHUNK_LOAD_PATTERNS.some(re => re.test(msg))
}

// Reload una sola vez por sesión para evitar loops si el chunk realmente no existe
function reloadOnceForChunkError() {
  const last = Number(sessionStorage.getItem(CHUNK_LOAD_RELOAD_KEY) || 0)
  if (Date.now() - last < 30_000) return false
  sessionStorage.setItem(CHUNK_LOAD_RELOAD_KEY, String(Date.now()))
  window.location.reload()
  return true
}

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) reloadOnceForChunkError()
  })
  window.addEventListener('error', (event) => {
    if (isChunkLoadError(event.error || event.message)) reloadOnceForChunkError()
  })
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error) {
    if (isChunkLoadError(error)) {
      reloadOnceForChunkError()
      return { hasError: false }
    }
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    if (isChunkLoadError(error)) return
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <ConnectionError
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
