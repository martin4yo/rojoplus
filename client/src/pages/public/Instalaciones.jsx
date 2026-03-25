import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, MapPin, Users, Clock } from 'lucide-react'
import BannerPublicitario from '../../components/public/BannerPublicitario'

const instalaciones = [
  {
    id: 1,
    nombre: 'Cancha Principal',
    descripcion: 'Nuestra cancha techada con capacidad para 800 espectadores. Sede de los partidos de Liga Federal y formativas.',
    caracteristicas: ['Piso flotante profesional', 'Iluminación LED', 'Tableros electrónicos', 'Vestuarios completos'],
    imagenes: [
      '/images/club/68f64b9d.jpeg',
      '/images/club/0fd3416c.jpeg',
    ],
    capacidad: '800 personas',
    horario: 'Lunes a Domingo 8:00 - 23:00',
  },
  {
    id: 2,
    nombre: 'Gimnasio de Musculación',
    descripcion: 'Espacio equipado con máquinas modernas para entrenamiento de fuerza y acondicionamiento físico.',
    caracteristicas: ['Máquinas de última generación', 'Peso libre', 'Zona de cardio', 'Instructores capacitados'],
    imagenes: [
      '/images/club/4874ca4a8ac815adf95e7c540ced359e6a736d059848c1f1656a0757d8ad9508c98157fed290419d407ae3cd546c441677e987dd9b4936f73fd145_1280.jpg',
    ],
    capacidad: '30 personas',
    horario: 'Lunes a Viernes 7:00 - 22:00',
  },
  {
    id: 3,
    nombre: 'Salón de Usos Múltiples',
    descripcion: 'Amplio salón para eventos, reuniones y actividades sociales del club. Disponible para alquiler.',
    caracteristicas: ['Capacidad flexible', 'Sistema de audio', 'Aire acondicionado', 'Cocina equipada'],
    imagenes: [
      '/images/club/4177dee1f84c3c767bad32efd0d41d885df4931c46126ea3b2acc298fe99ee3cd61de290a4edd84e73bdfc6bf9686d1e2148d8ac79f0ced8fbeeee_1280.jpg',
    ],
    capacidad: '200 personas',
    horario: 'Según disponibilidad',
  },
  {
    id: 4,
    nombre: 'Cancha Auxiliar',
    descripcion: 'Cancha de entrenamiento para formativas y actividades recreativas. Ideal para prácticas y torneos internos.',
    caracteristicas: ['Piso de cemento pulido', 'Iluminación nocturna', 'Arcos reglamentarios'],
    imagenes: [
      '/images/club/IMG_2915.JPG',
    ],
    capacidad: '100 personas',
    horario: 'Lunes a Sábado 9:00 - 21:00',
  },
  {
    id: 5,
    nombre: 'Buffet del Club',
    descripcion: 'Espacio gastronómico donde socios y visitantes pueden disfrutar de comidas y bebidas en un ambiente familiar.',
    caracteristicas: ['Menú variado', 'Pantallas para partidos', 'WiFi gratuito', 'Terraza exterior'],
    imagenes: [
      '/images/club/gf6127dd755feb3d69457e16a134e721500df191447b9681a6e921d8f92a648aef97dcca6db09cdf4f391cdbe339b3441_1280.jpg',
    ],
    capacidad: '60 personas',
    horario: 'Lunes a Domingo 10:00 - 00:00',
  },
  {
    id: 6,
    nombre: 'Vestuarios',
    descripcion: 'Vestuarios completos para locales y visitantes, con duchas, lockers y área de descanso.',
    caracteristicas: ['Duchas con agua caliente', 'Lockers individuales', 'Bancos y espejos', 'Accesibilidad'],
    imagenes: [
      '/images/club/8ad73f3c.jpeg',
    ],
    capacidad: '40 personas',
    horario: 'Según actividades',
  },
]

export default function Instalaciones() {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedInstalacion, setSelectedInstalacion] = useState(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const openModal = (instalacion) => {
    setSelectedInstalacion(instalacion)
    setCurrentImageIndex(0)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setSelectedInstalacion(null)
  }

  const nextImage = () => {
    if (selectedInstalacion) {
      setCurrentImageIndex((prev) =>
        prev === selectedInstalacion.imagenes.length - 1 ? 0 : prev + 1
      )
    }
  }

  const prevImage = () => {
    if (selectedInstalacion) {
      setCurrentImageIndex((prev) =>
        prev === 0 ? selectedInstalacion.imagenes.length - 1 : prev - 1
      )
    }
  }

  return (
    <div className="bg-gray-300 min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary to-primary-dark py-6 md:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Nuestras Instalaciones
          </h1>
          <p className="text-base text-primary-100 max-w-2xl mx-auto">
            Conocé los espacios donde entrenamos, competimos y compartimos como familia
          </p>
        </div>
      </section>

      {/* Banner Header */}
      <BannerPublicitario tipo="HEADER" ubicacion="INSTALACIONES" />

      {/* Grid de instalaciones */}
      <section className="py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {instalaciones.map((inst) => (
              <article
                key={inst.id}
                className="bg-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group cursor-pointer"
                onClick={() => openModal(inst)}
              >
                {/* Imagen */}
                <div className="h-56 bg-gray-300 relative overflow-hidden">
                  <img
                    src={inst.imagenes[0]}
                    alt={inst.nombre}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-4 left-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-sm font-medium">Click para ver más</span>
                  </div>
                </div>

                {/* Contenido */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors">
                    {inst.nombre}
                  </h3>
                  <p className="text-gray-600 text-sm line-clamp-2 mb-4">
                    {inst.descripcion}
                  </p>

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{inst.capacidad}</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Info adicional */}
      <section className="py-12 bg-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-200 rounded-2xl p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Alquiler de Instalaciones
                </h2>
                <p className="text-gray-600 mb-6">
                  Nuestras instalaciones están disponibles para eventos, cumpleaños, torneos y actividades especiales.
                  Consultá disponibilidad y tarifas.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-gray-700">Av. Tomás Márquez 1125, Pilar</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-gray-700">Consultas: Lunes a Viernes 9:00 - 18:00</span>
                  </div>
                </div>
              </div>
              <div className="text-center md:text-right">
                <a
                  href="/contacto"
                  className="inline-flex items-center px-8 py-4 bg-primary text-white rounded-xl text-lg font-semibold hover:bg-primary-dark transition-colors shadow-lg"
                >
                  Consultar Disponibilidad
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Banner Footer */}
      <BannerPublicitario tipo="FOOTER" ubicacion="INSTALACIONES" />

      {/* Modal de detalle */}
      {modalOpen && selectedInstalacion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Galería de imágenes */}
            <div className="relative h-72 md:h-96 bg-gray-900">
              <img
                src={selectedInstalacion.imagenes[currentImageIndex]}
                alt={selectedInstalacion.nombre}
                className="w-full h-full object-cover"
              />

              {/* Controles de navegación */}
              {selectedInstalacion.imagenes.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6 text-gray-700" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                  >
                    <ChevronRight className="w-6 h-6 text-gray-700" />
                  </button>

                  {/* Indicadores */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {selectedInstalacion.imagenes.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          idx === currentImageIndex ? 'bg-white' : 'bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Botón cerrar */}
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6 md:p-8 overflow-y-auto max-h-[calc(90vh-24rem)]">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                {selectedInstalacion.nombre}
              </h2>

              <p className="text-gray-600 text-lg mb-6">
                {selectedInstalacion.descripcion}
              </p>

              {/* Info */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-100 rounded-xl p-4 flex items-center gap-3">
                  <Users className="w-6 h-6 text-primary" />
                  <div>
                    <p className="text-sm text-gray-500">Capacidad</p>
                    <p className="font-semibold text-gray-900">{selectedInstalacion.capacidad}</p>
                  </div>
                </div>
                <div className="bg-gray-100 rounded-xl p-4 flex items-center gap-3">
                  <Clock className="w-6 h-6 text-primary" />
                  <div>
                    <p className="text-sm text-gray-500">Horario</p>
                    <p className="font-semibold text-gray-900">{selectedInstalacion.horario}</p>
                  </div>
                </div>
              </div>

              {/* Características */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Características</h3>
                <div className="grid grid-cols-2 gap-2">
                  {selectedInstalacion.caracteristicas.map((car, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full" />
                      <span className="text-gray-600">{car}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t flex justify-end">
                <button
                  onClick={closeModal}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
