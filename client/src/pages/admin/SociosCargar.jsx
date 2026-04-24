import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { useModal } from '../../components/Modal'
import api from '../../services/api'

export default function AdminSociosCargar() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState(null)
  const { showModal, ModalComponent } = useModal()

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return

    setUploading(true)
    setError(null)
    setPreview(null)

    try {
      const data = await api.upload('/admin/socios/upload', file)
      setPreview(data)
    } catch (err) {
      setError(err.message || 'Error al procesar el archivo')
    } finally {
      setUploading(false)
    }
  }

  async function handleConfirmar() {
    if (!preview?.uploadId) return

    setConfirming(true)
    setError(null)

    try {
      await api.post(`/admin/socios/upload/${preview.uploadId}/confirmar`)
      showModal({
        type: 'success',
        title: 'Carga exitosa',
        message: 'Los socios han sido cargados correctamente.',
        onConfirm: () => navigate('/admin/socios'),
      })
    } catch (err) {
      setError(err.message || 'Error al confirmar la carga')
    } finally {
      setConfirming(false)
    }
  }

  function resetForm() {
    setFile(null)
    setPreview(null)
    setError(null)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Cargar Socios</h1>
        <button
          onClick={() => navigate('/admin/socios')}
          className="text-gray-500 hover:text-gray-700"
        >
          ← Volver
        </button>
      </div>

      {error && <Alert type="error" className="mb-6">{error}</Alert>}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl">
        {!preview ? (
          <>
            <p className="text-gray-600 mb-6">
              Seleccioná el archivo Excel con los datos de los socios.
              El sistema detectará automáticamente los socios nuevos y los que necesitan actualizarse.
            </p>

            <form onSubmit={handleUpload}>
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-semibold mb-2">
                  Archivo Excel (.xlsx)
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                />
              </div>

              <Button type="submit" className="w-full" loading={uploading} disabled={!file}>
                Procesar archivo
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                <strong>Columnas requeridas:</strong> Nro.Socio, ApellidoNombre, Estado
              </p>
              <p className="text-sm text-gray-500 mt-1">
                <strong>Columnas opcionales:</strong> Documento, Email, Celular, Categoria, etc.
              </p>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Vista previa de la carga
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{preview.nuevos}</p>
                <p className="text-green-700">Socios nuevos</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">{preview.actualizar}</p>
                <p className="text-blue-700">A actualizar</p>
              </div>
            </div>

            {preview.avisosPin && preview.avisosPin.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <p className="text-sm font-semibold text-amber-800 mb-2">
                  ⚠️ Avisos sobre PIN/RFID ({preview.avisosPin.length})
                </p>
                <ul className="text-xs text-amber-700 space-y-1 max-h-32 overflow-y-auto">
                  {preview.avisosPin.map((aviso, i) => <li key={i}>• {aviso}</li>)}
                </ul>
              </div>
            )}

            <div className="flex gap-4">
              <Button
                onClick={handleConfirmar}
                loading={confirming}
                className="flex-1"
              >
                Confirmar carga
              </Button>
              <Button
                variant="secondary"
                onClick={resetForm}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </>
        )}
      </div>

      {ModalComponent}
    </div>
  )
}
