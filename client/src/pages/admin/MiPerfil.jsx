import { useState, useEffect } from 'react'
import { User, Lock, Eye, EyeOff, Check, AlertCircle } from 'lucide-react'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Alert } from '../../components/Alert'
import api from '../../services/api'
import { getUsuarioActual, getRolActual } from '../../services/permisos'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function MiPerfil() {
  const [usuario, setUsuario] = useState(null)
  const [rol, setRol] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState(null)

  // Estados para cambio de contraseña
  const [passwordActual, setPasswordActual] = useState('')
  const [passwordNueva, setPasswordNueva] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPasswords, setShowPasswords] = useState({
    actual: false,
    nueva: false,
    confirm: false
  })

  useEffect(() => {
    // Cargar datos del usuario desde localStorage y servicio de permisos
    const adminData = localStorage.getItem('adminData')
    if (adminData) {
      setUsuario(JSON.parse(adminData))
    }
    setRol(getRolActual())
  }, [])

  function toggleShowPassword(field) {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  function validarPassword() {
    if (!passwordActual) {
      setError('Debe ingresar la contraseña actual')
      return false
    }
    if (!passwordNueva) {
      setError('Debe ingresar la nueva contraseña')
      return false
    }
    if (passwordNueva.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres')
      return false
    }
    if (passwordNueva !== passwordConfirm) {
      setError('Las contraseñas no coinciden')
      return false
    }
    if (passwordActual === passwordNueva) {
      setError('La nueva contraseña debe ser diferente a la actual')
      return false
    }
    return true
  }

  async function handleCambiarPassword(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!validarPassword()) return

    setLoading(true)
    try {
      await api.post(`/admin/usuarios/${usuario.id}/cambiar-password`, {
        passwordActual,
        passwordNueva
      })
      setSuccess('Contraseña actualizada correctamente')
      setPasswordActual('')
      setPasswordNueva('')
      setPasswordConfirm('')
    } catch (err) {
      setError(err.message || 'Error al cambiar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  if (!usuario) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Mi Perfil</h1>

      {/* Información del usuario */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">{usuario.nombre}</h2>
            <p className="text-gray-500">{usuario.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Nombre</label>
            <p className="text-gray-800">{usuario.nombre}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Email</label>
            <p className="text-gray-800">{usuario.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Rol</label>
            <p className="text-gray-800">{rol?.nombre || usuario.rol?.nombre || 'Sin rol'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Estado</label>
            <p className={`${usuario.activo ? 'text-green-600' : 'text-red-600'}`}>
              {usuario.activo ? 'Activo' : 'Inactivo'}
            </p>
          </div>
        </div>
      </div>

      {/* Cambiar contraseña */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Lock className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-800">Cambiar Contraseña</h2>
        </div>

        {success && (
          <Alert type="success" className="mb-4">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              {success}
            </div>
          </Alert>
        )}

        {error && (
          <Alert type="error" className="mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          </Alert>
        )}

        <form onSubmit={handleCambiarPassword} className="space-y-4">
          <div className="relative">
            <Input
              label="Contraseña actual"
              type={showPasswords.actual ? 'text' : 'password'}
              value={passwordActual}
              onChange={(e) => setPasswordActual(e.target.value)}
              placeholder="Ingrese su contraseña actual"
            />
            <button
              type="button"
              onClick={() => toggleShowPassword('actual')}
              className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
            >
              {showPasswords.actual ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <div className="relative">
            <Input
              label="Nueva contraseña"
              type={showPasswords.nueva ? 'text' : 'password'}
              value={passwordNueva}
              onChange={(e) => setPasswordNueva(e.target.value)}
              placeholder="Ingrese la nueva contraseña"
            />
            <button
              type="button"
              onClick={() => toggleShowPassword('nueva')}
              className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
            >
              {showPasswords.nueva ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <div className="relative">
            <Input
              label="Confirmar nueva contraseña"
              type={showPasswords.confirm ? 'text' : 'password'}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="Confirme la nueva contraseña"
            />
            <button
              type="button"
              onClick={() => toggleShowPassword('confirm')}
              className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
            >
              {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <div className="text-sm text-gray-500">
            La contraseña debe tener al menos 6 caracteres.
          </div>

          <div className="pt-4">
            <Button type="submit" loading={loading}>
              Cambiar Contraseña
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
