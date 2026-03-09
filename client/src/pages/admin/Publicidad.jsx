import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { tienePermiso, PERMISOS } from '../../services/permisos'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  PhotoIcon,
  BuildingStorefrontIcon,
  ChartBarIcon,
  GlobeAltIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import { BANNER_SIZES } from '../../components/public/BannerPublicitario'
import Modal from '../../components/Modal'
import ImageUpload from '../../components/ImageUpload'
import { useConfirm } from '../../hooks/useConfirm'

export default function Publicidad() {
  const { confirm, ConfirmDialog } = useConfirm()
  const [tab, setTab] = useState('banners') // 'banners' | 'sponsors' | 'estadisticas'
  const [banners, setBanners] = useState([])
  const [sponsors, setSponsors] = useState([])
  const [estadisticas, setEstadisticas] = useState(null)
  const [loading, setLoading] = useState(true)

  // Modales
  const [modalBanner, setModalBanner] = useState({ open: false, data: null })
  const [modalSponsor, setModalSponsor] = useState({ open: false, data: null })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [bannersData, sponsorsData, statsData] = await Promise.all([
        api.get('/admin/banners'),
        api.get('/admin/sponsors'),
        api.get('/admin/banners/estadisticas')
      ])
      setBanners(bannersData || [])
      setSponsors(sponsorsData || [])
      setEstadisticas(statsData || {})
    } catch (err) {
      console.error('Error cargando datos:', err)
      toast.error('Error cargando datos')
    } finally {
      setLoading(false)
    }
  }

  // ========== BANNERS ==========
  const handleSaveBanner = async (formData) => {
    try {
      if (formData.id) {
        await api.put(`/admin/banners/${formData.id}`, formData)
        toast.success('Banner actualizado')
      } else {
        await api.post('/admin/banners', formData)
        toast.success('Banner creado')
      }
      setModalBanner({ open: false, data: null })
      fetchData()
    } catch (err) {
      toast.error(err.message || 'Error guardando banner')
    }
  }

  const handleDeleteBanner = async (id) => {
    const confirmed = await confirm('Eliminar banner', '¿Eliminar este banner?')
    if (!confirmed) return
    try {
      await api.delete(`/admin/banners/${id}`)
      toast.success('Banner eliminado')
      fetchData()
    } catch (err) {
      toast.error(err.message)
    }
  }

  // ========== SPONSORS ==========
  const handleSaveSponsor = async (formData) => {
    try {
      if (formData.id) {
        await api.put(`/admin/sponsors/${formData.id}`, formData)
        toast.success('Sponsor actualizado')
      } else {
        await api.post('/admin/sponsors', formData)
        toast.success('Sponsor creado')
      }
      setModalSponsor({ open: false, data: null })
      fetchData()
    } catch (err) {
      toast.error(err.message || 'Error guardando sponsor')
    }
  }

  const handleDeleteSponsor = async (id) => {
    const confirmed = await confirm('Eliminar sponsor', '¿Eliminar este sponsor?')
    if (!confirmed) return
    try {
      await api.delete(`/admin/sponsors/${id}`)
      toast.success('Sponsor eliminado')
      fetchData()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Publicidad</h1>
          <p className="text-gray-500">Gestiona banners y sponsors del sitio</p>
        </div>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Banners activos</p>
          <p className="text-2xl font-bold text-gray-900">{estadisticas?.totalActivos || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Sponsors</p>
          <p className="text-2xl font-bold text-gray-900">{sponsors.filter(s => s.activo).length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Impresiones</p>
          <p className="text-2xl font-bold text-blue-600">{estadisticas?.totalImpresiones?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Clics (CTR)</p>
          <p className="text-2xl font-bold text-green-600">
            {estadisticas?.totalClics?.toLocaleString() || 0}
            <span className="text-sm font-normal text-gray-500 ml-1">({estadisticas?.ctr || 0}%)</span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setTab('banners')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                tab === 'banners'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <PhotoIcon className="w-5 h-5 inline mr-2" />
              Banners
            </button>
            <button
              onClick={() => setTab('sponsors')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                tab === 'sponsors'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <BuildingStorefrontIcon className="w-5 h-5 inline mr-2" />
              Sponsors
            </button>
            <button
              onClick={() => setTab('estadisticas')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                tab === 'estadisticas'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ChartBarIcon className="w-5 h-5 inline mr-2" />
              Estadísticas
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Tab: Banners */}
          {tab === 'banners' && (
            <div className="space-y-4">
              {tienePermiso(PERMISOS.CONTENIDO_GESTIONAR) && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setModalBanner({ open: true, data: null })}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <PlusIcon className="w-5 h-5" />
                    Nuevo Banner
                  </button>
                </div>
              )}

              {banners.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <PhotoIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No hay banners creados</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {banners.map(banner => (
                    <div key={banner.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      {/* Preview */}
                      <div className="w-32 h-20 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                        {banner.imagenDesktop ? (
                          <img
                            src={banner.imagenDesktop}
                            alt={banner.titulo}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <PhotoIcon className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 truncate">{banner.titulo}</h3>
                          {banner.activo ? (
                            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Activo</span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">Inactivo</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {BANNER_SIZES[banner.tipo]?.label || banner.tipo} • {
                            banner.ubicaciones?.length > 0
                              ? banner.ubicaciones.join(', ')
                              : 'Todas las páginas'
                          }
                          {banner.sponsor && ` • ${banner.sponsor.nombre}`}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {banner.impresiones.toLocaleString()} impresiones • {banner.clics.toLocaleString()} clics
                        </p>
                      </div>

                      {/* Pago */}
                      {banner.montoMensual && (
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            ${Number(banner.montoMensual).toLocaleString()}
                          </p>
                          {banner.pagado ? (
                            <span className="text-xs text-green-600">Pagado</span>
                          ) : (
                            <span className="text-xs text-orange-600">Pendiente</span>
                          )}
                        </div>
                      )}

                      {/* Acciones */}
                      {tienePermiso(PERMISOS.CONTENIDO_GESTIONAR) && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setModalBanner({ open: true, data: banner })}
                            className="p-2 text-gray-400 hover:text-blue-600"
                            title="Editar"
                          >
                            <PencilSquareIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteBanner(banner.id)}
                            className="p-2 text-gray-400 hover:text-red-600"
                            title="Eliminar"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Sponsors */}
          {tab === 'sponsors' && (
            <div className="space-y-4">
              {tienePermiso(PERMISOS.CONTENIDO_GESTIONAR) && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setModalSponsor({ open: true, data: null })}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <PlusIcon className="w-5 h-5" />
                    Nuevo Sponsor
                  </button>
                </div>
              )}

              {sponsors.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <BuildingStorefrontIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No hay sponsors registrados</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {sponsors.map(sponsor => (
                    <div key={sponsor.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      {/* Logo */}
                      <div className="w-16 h-16 bg-white rounded-lg border flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {sponsor.logo ? (
                          <img
                            src={sponsor.logo}
                            alt={sponsor.nombre}
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          <BuildingStorefrontIcon className="w-8 h-8 text-gray-300" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{sponsor.nombre}</h3>
                          {sponsor.activo ? (
                            <CheckCircleIcon className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircleIcon className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        {sponsor.contactoNombre && (
                          <p className="text-sm text-gray-500">{sponsor.contactoNombre}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {sponsor._count?.banners || 0} banners
                        </p>
                      </div>

                      {/* Acciones */}
                      <div className="flex gap-2">
                        {sponsor.sitioWeb && (
                          <a
                            href={sponsor.sitioWeb}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-blue-600"
                            title="Ver sitio web"
                          >
                            <GlobeAltIcon className="w-5 h-5" />
                          </a>
                        )}
                        {tienePermiso(PERMISOS.CONTENIDO_GESTIONAR) && (
                          <button
                            onClick={() => setModalSponsor({ open: true, data: sponsor })}
                            className="p-2 text-gray-400 hover:text-blue-600"
                            title="Editar"
                          >
                            <PencilSquareIcon className="w-5 h-5" />
                          </button>
                        )}
                        {tienePermiso(PERMISOS.CONTENIDO_GESTIONAR) && (
                          <button
                            onClick={() => handleDeleteSponsor(sponsor.id)}
                            className="p-2 text-gray-400 hover:text-red-600"
                            title="Eliminar"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Estadísticas */}
          {tab === 'estadisticas' && estadisticas && (
            <div className="space-y-6">
              {/* Resumen */}
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-4">Rendimiento General</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Impresiones</span>
                      <span className="font-medium">{estadisticas.totalImpresiones?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Clics</span>
                      <span className="font-medium">{estadisticas.totalClics?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">CTR Promedio</span>
                      <span className="font-medium text-green-600">{estadisticas.ctr}%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-4">Estado de Banners</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Activos</span>
                      <span className="font-medium text-green-600">{estadisticas.totalActivos}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Por vencer (7 días)</span>
                      <span className="font-medium text-orange-600">{estadisticas.porVencer}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-4">Ingresos del Mes</h3>
                  <p className="text-3xl font-bold text-green-600">
                    ${Number(estadisticas.ingresosMes || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Top Banners */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-4">Top 5 Banners por Clics</h3>
                {estadisticas.topBanners?.length > 0 ? (
                  <div className="space-y-3">
                    {estadisticas.topBanners.map((banner, idx) => (
                      <div key={banner.id} className="flex items-center gap-4">
                        <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium">
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{banner.titulo}</p>
                          {banner.sponsor && (
                            <p className="text-xs text-gray-500">{banner.sponsor.nombre}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{banner.clics.toLocaleString()} clics</p>
                          <p className="text-xs text-gray-500">{banner.impresiones.toLocaleString()} imp.</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Sin datos</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Banner */}
      <Modal
        isOpen={modalBanner.open}
        onClose={() => setModalBanner({ open: false, data: null })}
        title={modalBanner.data ? 'Editar Banner' : 'Nuevo Banner'}
        maxWidth="max-w-2xl"
      >
        <ModalBannerContent
          data={modalBanner.data}
          sponsors={sponsors}
          onClose={() => setModalBanner({ open: false, data: null })}
          onSave={handleSaveBanner}
        />
      </Modal>

      {/* Modal Sponsor */}
      <Modal
        isOpen={modalSponsor.open}
        onClose={() => setModalSponsor({ open: false, data: null })}
        title={modalSponsor.data ? 'Editar Sponsor' : 'Nuevo Sponsor'}
        maxWidth="max-w-xl"
      >
        <ModalSponsorContent
          data={modalSponsor.data}
          onClose={() => setModalSponsor({ open: false, data: null })}
          onSave={handleSaveSponsor}
        />
      </Modal>

      {/* ConfirmDialog */}
      <ConfirmDialog />
    </div>
  )
}

// ============ MODAL BANNER CONTENT ============
const UBICACIONES_DISPONIBLES = [
  { value: 'HOME', label: 'Home' },
  { value: 'ACTIVIDADES', label: 'Actividades' },
  { value: 'NOTICIAS', label: 'Noticias' },
  { value: 'HISTORIA', label: 'Historia' },
  { value: 'CONTACTO', label: 'Contacto' },
  { value: 'AUTORIDADES', label: 'Autoridades' },
  { value: 'COMERCIOS', label: 'Comercios' },
]

function ModalBannerContent({ data, sponsors, onClose, onSave }) {
  const [form, setForm] = useState({
    id: data?.id || null,
    titulo: data?.titulo || '',
    sponsorId: data?.sponsorId || '',
    tipo: data?.tipo || 'FOOTER',
    ubicaciones: data?.ubicaciones || [],
    imagenDesktop: data?.imagenDesktop || '',
    imagenMobile: data?.imagenMobile || '',
    linkDestino: data?.linkDestino || '',
    textoAlt: data?.textoAlt || '',
    orden: data?.orden || 0,
    activo: data?.activo ?? true,
    fechaInicio: data?.fechaInicio ? data.fechaInicio.substring(0, 10) : '',
    fechaFin: data?.fechaFin ? data.fechaFin.substring(0, 10) : '',
    montoMensual: data?.montoMensual || '',
    mesContratado: data?.mesContratado || '',
    pagado: data?.pagado || false
  })

  const handleUbicacionToggle = (ubicacion) => {
    setForm(prev => {
      const ubicaciones = prev.ubicaciones || []
      if (ubicaciones.includes(ubicacion)) {
        return { ...prev, ubicaciones: ubicaciones.filter(u => u !== ubicacion) }
      } else {
        return { ...prev, ubicaciones: [...ubicaciones, ubicacion] }
      }
    })
  }
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState({ desktop: false, mobile: false })

  const handleUpload = async (file, tipo) => {
    if (!file) return

    setUploading(prev => ({ ...prev, [tipo]: true }))

    const formData = new FormData()
    formData.append('imagen', file)

    try {
      const response = await fetch('/api/admin/banners/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        if (tipo === 'desktop') {
          setForm(prev => ({ ...prev, imagenDesktop: result.url }))
        } else {
          setForm(prev => ({ ...prev, imagenMobile: result.url }))
        }
        toast.success('Imagen subida correctamente')
      } else {
        toast.error(result.error || 'Error al subir imagen')
      }
    } catch (err) {
      toast.error('Error al subir imagen')
    } finally {
      setUploading(prev => ({ ...prev, [tipo]: false }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validar que se haya subido una imagen desktop
    if (!form.imagenDesktop) {
      toast.error('Debes subir una imagen para el banner')
      return
    }

    // Limpiar datos antes de enviar (convertir strings vacíos a null)
    const cleanData = {
      ...form,
      sponsorId: form.sponsorId || null,
      montoMensual: form.montoMensual ? parseFloat(form.montoMensual) : null,
      mesContratado: form.mesContratado || null,
      fechaInicio: form.fechaInicio || null,
      fechaFin: form.fechaFin || null,
      linkDestino: form.linkDestino || null,
      textoAlt: form.textoAlt || null,
      imagenMobile: form.imagenMobile || null,
    }

    setSaving(true)
    await onSave(cleanData)
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título (interno) *
                </label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={e => setForm({ ...form, titulo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sponsor
                </label>
                <select
                  value={form.sponsorId}
                  onChange={e => setForm({ ...form, sponsorId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Sin sponsor</option>
                  {sponsors.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Posición
                </label>
                <select
                  value={form.tipo}
                  onChange={e => setForm({ ...form, tipo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                >
                  <option value="HERO">Hero - {BANNER_SIZES.HERO.label}</option>
                  <option value="HEADER">Header - {BANNER_SIZES.HEADER.label}</option>
                  <option value="MEDIO">Medio - {BANNER_SIZES.MEDIO.label}</option>
                  <option value="FOOTER">Footer - {BANNER_SIZES.FOOTER.label}</option>
                </select>
                {/* Info de tamaño recomendado */}
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-700">
                      <p className="font-medium">Tamaño recomendado: {BANNER_SIZES[form.tipo]?.width}×{BANNER_SIZES[form.tipo]?.height} px</p>
                      <p className="text-blue-600 mt-1">
                        Ratio {BANNER_SIZES[form.tipo]?.ratio}. La imagen se recortará automáticamente para ajustarse.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ubicaciones (páginas donde se muestra)
                </label>
                <div className="bg-gray-50 rounded-lg p-3 border">
                  <p className="text-xs text-gray-500 mb-2">
                    Si no seleccionas ninguna, se mostrará en todas las páginas.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {UBICACIONES_DISPONIBLES.map(ub => (
                      <label key={ub.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(form.ubicaciones || []).includes(ub.value)}
                          onChange={() => handleUbicacionToggle(ub.value)}
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-sm text-gray-700">{ub.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Orden
                </label>
                <input
                  type="number"
                  value={form.orden}
                  onChange={e => setForm({ ...form, orden: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Imagen Desktop *
                </label>
                {uploading.desktop ? (
                  <div className="flex items-center justify-center gap-2 p-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <div className="animate-spin h-5 w-5 border-2 border-red-500 border-t-transparent rounded-full"></div>
                    <span className="text-gray-500">Subiendo imagen...</span>
                  </div>
                ) : (
                  <>
                    <ImageUpload
                      value={form.imagenDesktop}
                      onChange={(file) => handleUpload(file, 'desktop')}
                      accept="image/*"
                      maxSize={5 * 1024 * 1024}
                      placeholder="Haz click o arrastra la imagen desktop aquí"
                      showPreview={false}
                      onError={(error) => toast.error(error)}
                    />
                    {form.imagenDesktop && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-2">Preview (así se verá el banner):</p>
                        <div
                          className="relative bg-gray-100 rounded-lg overflow-hidden border-2 border-dashed border-gray-300"
                          style={{
                            aspectRatio: `${BANNER_SIZES[form.tipo]?.width} / ${BANNER_SIZES[form.tipo]?.height}`,
                            maxWidth: form.tipo === 'HERO' ? '100%' : `${Math.min(BANNER_SIZES[form.tipo]?.width, 400)}px`
                          }}
                        >
                          <img
                            src={form.imagenDesktop}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <p className="mt-1 text-xs text-green-600 truncate">{form.imagenDesktop}</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Imagen Mobile (opcional)
                </label>
                {uploading.mobile ? (
                  <div className="flex items-center justify-center gap-2 p-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <div className="animate-spin h-5 w-5 border-2 border-red-500 border-t-transparent rounded-full"></div>
                    <span className="text-gray-500">Subiendo imagen...</span>
                  </div>
                ) : (
                  <>
                    <ImageUpload
                      value={form.imagenMobile}
                      onChange={(file) => handleUpload(file, 'mobile')}
                      accept="image/*"
                      maxSize={5 * 1024 * 1024}
                      placeholder="Haz click o arrastra la imagen mobile aquí"
                      showPreview={false}
                      onError={(error) => toast.error(error)}
                    />
                    {form.imagenMobile && (
                      <p className="mt-1 text-xs text-green-600 truncate">
                        {form.imagenMobile}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link destino (al hacer clic)
                </label>
                <input
                  type="url"
                  value={form.linkDestino}
                  onChange={e => setForm({ ...form, linkDestino: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="https://..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Texto alternativo (accesibilidad)
                </label>
                <input
                  type="text"
                  value={form.textoAlt}
                  onChange={e => setForm({ ...form, textoAlt: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Programación */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha inicio
                </label>
                <input
                  type="date"
                  value={form.fechaInicio}
                  onChange={e => setForm({ ...form, fechaInicio: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha fin
                </label>
                <input
                  type="date"
                  value={form.fechaFin}
                  onChange={e => setForm({ ...form, fechaFin: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Facturación */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto mensual
                </label>
                <input
                  type="number"
                  value={form.montoMensual}
                  onChange={e => setForm({ ...form, montoMensual: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mes contratado
                </label>
                <input
                  type="month"
                  value={form.mesContratado}
                  onChange={e => setForm({ ...form, mesContratado: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.activo}
                    onChange={e => setForm({ ...form, activo: e.target.checked })}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700">Activo</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.pagado}
                    onChange={e => setForm({ ...form, pagado: e.target.checked })}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">Pagado</span>
                </label>
              </div>
            </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
    </form>
  )
}

// ============ MODAL SPONSOR CONTENT ============
function ModalSponsorContent({ data, onClose, onSave }) {
  const [form, setForm] = useState({
    id: data?.id || null,
    nombre: data?.nombre || '',
    razonSocial: data?.razonSocial || '',
    cuit: data?.cuit || '',
    contactoNombre: data?.contactoNombre || '',
    contactoEmail: data?.contactoEmail || '',
    contactoTelefono: data?.contactoTelefono || '',
    direccion: data?.direccion || '',
    logo: data?.logo || '',
    sitioWeb: data?.sitioWeb || '',
    observaciones: data?.observaciones || '',
    activo: data?.activo ?? true
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleUploadLogo = async (file) => {
    if (!file) return

    setUploading(true)

    const formData = new FormData()
    formData.append('imagen', file)

    try {
      const response = await fetch('/api/admin/sponsors/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        setForm(prev => ({ ...prev, logo: result.url }))
        toast.success('Logo subido correctamente')
      } else {
        toast.error(result.error || 'Error al subir logo')
      }
    } catch (err) {
      toast.error('Error al subir logo')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Razón Social
                </label>
                <input
                  type="text"
                  value={form.razonSocial}
                  onChange={e => setForm({ ...form, razonSocial: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CUIT
                </label>
                <input
                  type="text"
                  value={form.cuit}
                  onChange={e => setForm({ ...form, cuit: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="XX-XXXXXXXX-X"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contacto
                </label>
                <input
                  type="text"
                  value={form.contactoNombre}
                  onChange={e => setForm({ ...form, contactoNombre: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={form.contactoTelefono}
                  onChange={e => setForm({ ...form, contactoTelefono: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={form.contactoEmail}
                  onChange={e => setForm({ ...form, contactoEmail: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  value={form.direccion}
                  onChange={e => setForm({ ...form, direccion: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo
                </label>
                {uploading ? (
                  <div className="flex items-center justify-center gap-2 p-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <div className="animate-spin h-5 w-5 border-2 border-red-500 border-t-transparent rounded-full"></div>
                    <span className="text-gray-500">Subiendo logo...</span>
                  </div>
                ) : (
                  <>
                    <ImageUpload
                      value={form.logo}
                      onChange={handleUploadLogo}
                      accept="image/*"
                      maxSize={2 * 1024 * 1024}
                      placeholder="Haz click o arrastra el logo aquí"
                      showPreview={true}
                      previewSize="sm"
                      onError={(error) => toast.error(error)}
                    />
                    {form.logo && (
                      <p className="mt-1 text-xs text-green-600 truncate">{form.logo}</p>
                    )}
                  </>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sitio Web
                </label>
                <input
                  type="url"
                  value={form.sitioWeb}
                  onChange={e => setForm({ ...form, sitioWeb: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="https://..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={form.observaciones}
                  onChange={e => setForm({ ...form, observaciones: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  rows={3}
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.activo}
                    onChange={e => setForm({ ...form, activo: e.target.checked })}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700">Activo</span>
                </label>
              </div>
            </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
    </form>
  )
}
