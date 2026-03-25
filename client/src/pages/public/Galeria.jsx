import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Camera, X, ChevronLeft, ChevronRight, Calendar, Tag } from 'lucide-react'
import api from '../../services/api'
import BannerPublicitario from '../../components/public/BannerPublicitario'

export default function Galeria() {
  const [albumes, setAlbumes] = useState([])
  const [fotos, setFotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [albumActivo, setAlbumActivo] = useState(null)
  const [fotoAbierta, setFotoAbierta] = useState(null)
  const [indiceActual, setIndiceActual] = useState(0)

  useEffect(() => {
    cargarGaleria()
  }, [])

  async function cargarGaleria() {
    try {
      setLoading(true)
      const data = await api.get('/public/galeria')
      if (data.albumes) {
        setAlbumes(data.albumes)
      }
      if (data.fotos) {
        setFotos(data.fotos)
      }
    } catch (err) {
      console.error('Error cargando galería:', err)
      // Datos de ejemplo si no hay API
      setAlbumes([])
      setFotos([])
    } finally {
      setLoading(false)
    }
  }

  async function cargarFotosAlbum(albumId) {
    try {
      setLoading(true)
      const data = await api.get(`/public/galeria/album/${albumId}`)
      setFotos(Array.isArray(data) ? data : data.fotos || [])
      setAlbumActivo(albumes.find(a => a.id === albumId))
    } catch (err) {
      console.error('Error cargando fotos del álbum:', err)
    } finally {
      setLoading(false)
    }
  }

  function volverAAlbumes() {
    setAlbumActivo(null)
    cargarGaleria()
  }

  function abrirFoto(foto, indice) {
    setFotoAbierta(foto)
    setIndiceActual(indice)
    document.body.style.overflow = 'hidden'
  }

  function cerrarFoto() {
    setFotoAbierta(null)
    document.body.style.overflow = ''
  }

  function fotoAnterior() {
    const nuevoIndice = indiceActual > 0 ? indiceActual - 1 : fotos.length - 1
    setIndiceActual(nuevoIndice)
    setFotoAbierta(fotos[nuevoIndice])
  }

  function fotoSiguiente() {
    const nuevoIndice = indiceActual < fotos.length - 1 ? indiceActual + 1 : 0
    setIndiceActual(nuevoIndice)
    setFotoAbierta(fotos[nuevoIndice])
  }

  // Manejar teclas para navegación
  useEffect(() => {
    function handleKeyDown(e) {
      if (!fotoAbierta) return
      if (e.key === 'Escape') cerrarFoto()
      if (e.key === 'ArrowLeft') fotoAnterior()
      if (e.key === 'ArrowRight') fotoSiguiente()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fotoAbierta, indiceActual])

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Hero */}
      <div className="bg-primary text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Camera className="w-12 h-12" />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Galería de Fotos</h1>
              <p className="text-primary-100 mt-1">Los mejores momentos del club</p>
            </div>
          </div>
        </div>
      </div>

      <BannerPublicitario tipo="HEADER" ubicacion="GALERIA" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb si hay álbum activo */}
        {albumActivo && (
          <div className="mb-6">
            <button
              onClick={volverAAlbumes}
              className="flex items-center gap-2 text-primary hover:text-primary-dark font-medium"
            >
              <ChevronLeft className="w-5 h-5" />
              Volver a álbumes
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mt-2">{albumActivo.nombre}</h2>
            {albumActivo.descripcion && (
              <p className="text-gray-600 mt-1">{albumActivo.descripcion}</p>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : !albumActivo && albumes.length > 0 ? (
          /* Vista de álbumes */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {albumes.map(album => (
              <button
                key={album.id}
                onClick={() => cargarFotosAlbum(album.id)}
                className="group bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow text-left"
              >
                <div className="aspect-video relative overflow-hidden">
                  <img
                    src={album.portada || '/images/club/default-album.jpg'}
                    alt={album.nombre}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="font-bold text-white text-lg">{album.nombre}</h3>
                    <p className="text-white/80 text-sm">{album.cantidadFotos || 0} fotos</p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {album.fecha && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(album.fecha).toLocaleDateString('es-AR')}
                      </span>
                    )}
                    {album.categoria && (
                      <span className="flex items-center gap-1">
                        <Tag className="w-4 h-4" />
                        {album.categoria}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : fotos.length > 0 ? (
          /* Grid de fotos */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {fotos.map((foto, idx) => (
              <button
                key={foto.id || idx}
                onClick={() => abrirFoto(foto, idx)}
                className="aspect-square relative overflow-hidden rounded-lg group"
              >
                <img
                  src={foto.url || foto.imagen}
                  alt={foto.titulo || `Foto ${idx + 1}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Camera className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay fotos disponibles</h3>
            <p className="text-gray-500">Pronto subiremos fotos de los eventos del club</p>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {fotoAbierta && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={cerrarFoto}
        >
          {/* Botón cerrar */}
          <button
            onClick={cerrarFoto}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white z-10"
          >
            <X className="w-8 h-8" />
          </button>

          {/* Navegación */}
          {fotos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); fotoAnterior() }}
                className="absolute left-4 p-2 text-white/80 hover:text-white z-10"
              >
                <ChevronLeft className="w-10 h-10" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); fotoSiguiente() }}
                className="absolute right-4 p-2 text-white/80 hover:text-white z-10"
              >
                <ChevronRight className="w-10 h-10" />
              </button>
            </>
          )}

          {/* Imagen */}
          <div
            className="max-w-[90vw] max-h-[90vh] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={fotoAbierta.url || fotoAbierta.imagen}
              alt={fotoAbierta.titulo || 'Foto'}
              className="max-w-full max-h-[85vh] object-contain"
            />
            {(fotoAbierta.titulo || fotoAbierta.descripcion) && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
                {fotoAbierta.titulo && <h3 className="font-bold">{fotoAbierta.titulo}</h3>}
                {fotoAbierta.descripcion && <p className="text-sm text-white/80">{fotoAbierta.descripcion}</p>}
              </div>
            )}
          </div>

          {/* Contador */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            {indiceActual + 1} / {fotos.length}
          </div>
        </div>
      )}

      <BannerPublicitario tipo="FOOTER" ubicacion="GALERIA" />
    </div>
  )
}
