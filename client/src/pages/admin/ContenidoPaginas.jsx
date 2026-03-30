import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'

const TABS = [
  { id: 'intro',      label: 'Introducción' },
  { id: 'hitos',      label: 'Timeline' },
  { id: 'palmares',   label: 'Palmarés' },
  { id: 'formativas', label: 'Formativas' },
  { id: 'valores',    label: 'Valores' },
  { id: 'cta',        label: 'CTA' },
]

const DEFAULT = {
  intro: {
    titulo: '',
    tituloSeccion: '',
    parrafos: [''],
    imagen: '',
    badge: '',
    badgeTexto: '',
  },
  hitos: [],
  palmares: [],
  formativas: [],
  valores: [],
  cta: {
    titulo: '',
    descripcion: '',
    textoBoton: 'Quiero ser Socio',
    linkBoton: '/inscripcion-socio',
  },
}

function hitoVacio() {
  return { anio: '', titulo: '', descripcion: '' }
}
function palmarVacio() {
  return { titulo: '', anios: '' }
}
function formativaVacia() {
  return { categoria: '', descripcion: '' }
}
function valorVacio() {
  return { titulo: '', descripcion: '' }
}

// ─── Helpers de array ────────────────────────────────────────────────────────

function moverArriba(arr, i) {
  if (i === 0) return arr
  const n = [...arr]
  ;[n[i - 1], n[i]] = [n[i], n[i - 1]]
  return n
}
function moverAbajo(arr, i) {
  if (i === arr.length - 1) return arr
  const n = [...arr]
  ;[n[i], n[i + 1]] = [n[i + 1], n[i]]
  return n
}
function eliminar(arr, i) {
  return arr.filter((_, idx) => idx !== i)
}

// ─── Sub-componentes de cada tab ─────────────────────────────────────────────

function TabIntro({ data, onChange }) {
  const set = (key, val) => onChange({ ...data, [key]: val })
  const setParrafo = (i, val) => {
    const p = [...data.parrafos]
    p[i] = val
    set('parrafos', p)
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Título de la sección (ej: "Nuestra Historia")</label>
          <input
            className="input-field w-full"
            value={data.titulo}
            onChange={e => set('titulo', e.target.value)}
            placeholder="Nuestra Historia"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo de la sección (ej: "La Caldera")</label>
          <input
            className="input-field w-full"
            value={data.tituloSeccion}
            onChange={e => set('tituloSeccion', e.target.value)}
            placeholder="El Nombre del Club"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Párrafos de presentación</label>
        <div className="space-y-3">
          {data.parrafos.map((p, i) => (
            <div key={i} className="flex gap-2">
              <textarea
                className="input-field flex-1 min-h-[80px] resize-none"
                value={p}
                onChange={e => setParrafo(i, e.target.value)}
                placeholder={`Párrafo ${i + 1}`}
              />
              {data.parrafos.length > 1 && (
                <button
                  type="button"
                  onClick={() => set('parrafos', eliminar(data.parrafos, i))}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg self-start"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => set('parrafos', [...data.parrafos, ''])}
          className="mt-2 flex items-center gap-1 text-sm text-primary hover:text-primary-dark"
        >
          <PlusIcon className="w-4 h-4" /> Agregar párrafo
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">URL de imagen</label>
          <input
            className="input-field w-full"
            value={data.imagen}
            onChange={e => set('imagen', e.target.value)}
            placeholder="/images/club/foto-historia.jpg"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Badge (ej: "+90")</label>
            <input
              className="input-field w-full"
              value={data.badge}
              onChange={e => set('badge', e.target.value)}
              placeholder="+90"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Texto badge</label>
            <input
              className="input-field w-full"
              value={data.badgeTexto}
              onChange={e => set('badgeTexto', e.target.value)}
              placeholder="años de historia"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function TabHitos({ items, onChange }) {
  const set = (i, key, val) => {
    const n = [...items]
    n[i] = { ...n[i], [key]: val }
    onChange(n)
  }

  return (
    <div className="space-y-4">
      {items.map((h, i) => (
        <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Hito #{i + 1}</span>
            <div className="flex gap-1">
              <button type="button" onClick={() => onChange(moverArriba(items, i))} className="p-1 hover:bg-gray-200 rounded" title="Subir">
                <ArrowUpIcon className="w-4 h-4 text-gray-500" />
              </button>
              <button type="button" onClick={() => onChange(moverAbajo(items, i))} className="p-1 hover:bg-gray-200 rounded" title="Bajar">
                <ArrowDownIcon className="w-4 h-4 text-gray-500" />
              </button>
              <button type="button" onClick={() => onChange(eliminar(items, i))} className="p-1 hover:bg-red-100 rounded" title="Eliminar">
                <TrashIcon className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Año / Período</label>
              <input className="input-field w-full" value={h.anio} onChange={e => set(i, 'anio', e.target.value)} placeholder="1932" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Título</label>
              <input className="input-field w-full" value={h.titulo} onChange={e => set(i, 'titulo', e.target.value)} placeholder="Fundación del Club" />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
            <textarea
              className="input-field w-full min-h-[70px] resize-none"
              value={h.descripcion}
              onChange={e => set(i, 'descripcion', e.target.value)}
              placeholder="Descripción de este hito histórico..."
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, hitoVacio()])}
        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
      >
        <PlusIcon className="w-5 h-5" /> Agregar hito
      </button>
    </div>
  )
}

function TabListaSimple({ items, onChange, campos, placeholder, nuevo }) {
  const set = (i, key, val) => {
    const n = [...items]
    n[i] = { ...n[i], [key]: val }
    onChange(n)
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex gap-3 items-start bg-gray-50 border border-gray-200 rounded-xl p-3">
          <div className="flex-1 grid gap-3" style={{ gridTemplateColumns: campos.map(c => c.flex || '1fr').join(' ') }}>
            {campos.map(campo => (
              <div key={campo.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{campo.label}</label>
                {campo.textarea ? (
                  <textarea
                    className="input-field w-full min-h-[60px] resize-none"
                    value={item[campo.key]}
                    onChange={e => set(i, campo.key, e.target.value)}
                    placeholder={campo.placeholder}
                  />
                ) : (
                  <input
                    className="input-field w-full"
                    value={item[campo.key]}
                    onChange={e => set(i, campo.key, e.target.value)}
                    placeholder={campo.placeholder}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1 pt-5">
            <button type="button" onClick={() => onChange(moverArriba(items, i))} className="p-1 hover:bg-gray-200 rounded">
              <ArrowUpIcon className="w-4 h-4 text-gray-400" />
            </button>
            <button type="button" onClick={() => onChange(moverAbajo(items, i))} className="p-1 hover:bg-gray-200 rounded">
              <ArrowDownIcon className="w-4 h-4 text-gray-400" />
            </button>
            <button type="button" onClick={() => onChange(eliminar(items, i))} className="p-1 hover:bg-red-100 rounded">
              <TrashIcon className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, nuevo()])}
        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
      >
        <PlusIcon className="w-5 h-5" /> {placeholder}
      </button>
    </div>
  )
}

function TabCTA({ data, onChange }) {
  const set = (key, val) => onChange({ ...data, [key]: val })
  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
        <input className="input-field w-full" value={data.titulo} onChange={e => set('titulo', e.target.value)} placeholder="¡Sumate al Club!" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <textarea className="input-field w-full min-h-[80px] resize-none" value={data.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Texto de invitación..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Texto del botón</label>
          <input className="input-field w-full" value={data.textoBoton} onChange={e => set('textoBoton', e.target.value)} placeholder="Quiero ser Socio" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Link del botón</label>
          <input className="input-field w-full" value={data.linkBoton} onChange={e => set('linkBoton', e.target.value)} placeholder="/inscripcion-socio" />
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ContenidoPaginas() {
  const { slug = 'historia' } = useParams()
  const navigate = useNavigate()
  const [tabActivo, setTabActivo] = useState('intro')
  const [contenido, setContenido] = useState(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    fetchContenido()
  }, [slug])

  async function fetchContenido() {
    try {
      setLoading(true)
      const res = await api.getFull(`/admin/paginas/${slug}`)
      if (res?.data) {
        // Merge con defaults para asegurar todas las keys
        setContenido({
          intro:      { ...DEFAULT.intro,      ...(res.data.intro      || {}) },
          hitos:      res.data.hitos      || [],
          palmares:   res.data.palmares   || [],
          formativas: res.data.formativas || [],
          valores:    res.data.valores    || [],
          cta:        { ...DEFAULT.cta,        ...(res.data.cta        || {}) },
        })
      }
    } catch (err) {
      console.error('Error cargando contenido:', err)
    } finally {
      setLoading(false)
    }
  }

  async function guardar() {
    try {
      setGuardando(true)
      await api.put(`/admin/paginas/${slug}`, { contenido })
      toast.success('Página guardada correctamente')
    } catch (err) {
      toast.error(err.message || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const tituloPagina = slug === 'historia' ? 'Historia y Valores' : slug

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contenido del Sitio</h1>
            <p className="text-gray-500 text-sm capitalize">{tituloPagina}</p>
          </div>
        </div>
        <button
          onClick={guardar}
          disabled={guardando}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 font-medium"
        >
          <CheckIcon className="w-4 h-4" />
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setTabActivo(tab.id)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tabActivo === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tabActivo === 'intro' && (
            <TabIntro
              data={contenido.intro}
              onChange={val => setContenido(c => ({ ...c, intro: val }))}
            />
          )}

          {tabActivo === 'hitos' && (
            <TabHitos
              items={contenido.hitos}
              onChange={val => setContenido(c => ({ ...c, hitos: val }))}
            />
          )}

          {tabActivo === 'palmares' && (
            <TabListaSimple
              items={contenido.palmares}
              onChange={val => setContenido(c => ({ ...c, palmares: val }))}
              nuevo={palmarVacio}
              placeholder="Agregar logro deportivo"
              campos={[
                { key: 'titulo', label: 'Título del logro', placeholder: 'Campeón Provincial', flex: '2fr' },
                { key: 'anios', label: 'Año(s)', placeholder: '1991, 2002', flex: '1fr' },
              ]}
            />
          )}

          {tabActivo === 'formativas' && (
            <TabListaSimple
              items={contenido.formativas}
              onChange={val => setContenido(c => ({ ...c, formativas: val }))}
              nuevo={formativaVacia}
              placeholder="Agregar categoría formativa"
              campos={[
                { key: 'categoria', label: 'Categoría', placeholder: 'Cat. 2012', flex: '1fr' },
                { key: 'descripcion', label: 'Descripción', placeholder: 'Tricampeón', flex: '2fr' },
              ]}
            />
          )}

          {tabActivo === 'valores' && (
            <TabListaSimple
              items={contenido.valores}
              onChange={val => setContenido(c => ({ ...c, valores: val }))}
              nuevo={valorVacio}
              placeholder="Agregar valor institucional"
              campos={[
                { key: 'titulo', label: 'Título', placeholder: 'Trabajo en Equipo', flex: '1fr' },
                { key: 'descripcion', label: 'Descripción', placeholder: 'Los valores que nos definen...', textarea: true, flex: '2fr' },
              ]}
            />
          )}

          {tabActivo === 'cta' && (
            <TabCTA
              data={contenido.cta}
              onChange={val => setContenido(c => ({ ...c, cta: val }))}
            />
          )}
        </div>
      </div>

      {/* Tip */}
      <p className="text-center text-xs text-gray-400 mt-4">
        Los cambios se aplican al sitio público al guardar. Podés ver la página en{' '}
        <a href={`/${slug}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">/{slug}</a>
      </p>
    </div>
  )
}
