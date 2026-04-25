import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, ExternalLink, Star, FolderOpen, FolderPlus,
  Check, X, GripVertical,
} from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import api from '../../services/api'
import { Button } from '../../components/Button'
import FavoritoModal from '../../components/FavoritoModal'
import { useModal } from '../../components/Modal'
import { LucideIcon } from '../../components/IconPicker'
import { FOLDER_PRESETS, getFolderPreset } from '../../components/favoritos/presets'
import toast from 'react-hot-toast'

// Ids especiales para zonas de drop
const ROOT_DROP_ID = '__root__'

export default function AccesosRapidos() {
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()
  const [favoritos, setFavoritos] = useState([])
  const [carpetas, setCarpetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editandoFavorito, setEditandoFavorito] = useState(null)
  const [carpetaIdDefault, setCarpetaIdDefault] = useState(null)

  // DnD state
  const [activeId, setActiveId] = useState(null)
  const [overFolderId, setOverFolderId] = useState(null)

  async function cargarFavoritos() {
    const data = await api.get('/admin/favoritos')
    setFavoritos(data || [])
  }

  async function cargarCarpetas() {
    const data = await api.get('/admin/favoritos-carpetas')
    setCarpetas(data || [])
  }

  async function cargarTodo() {
    setLoading(true)
    try {
      await Promise.all([cargarFavoritos(), cargarCarpetas()])
    } catch (err) {
      toast.error('Error al cargar atajos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarTodo() }, [])

  // Agrupar favoritos por carpeta (ordenados por orden)
  const { porCarpeta, raiz } = useMemo(() => {
    const map = new Map()
    for (const c of carpetas) map.set(c.id, [])
    const sinCarpeta = []
    for (const fav of favoritos) {
      if (fav.carpetaId && map.has(fav.carpetaId)) {
        map.get(fav.carpetaId).push(fav)
      } else {
        sinCarpeta.push(fav)
      }
    }
    // sort dentro de cada grupo por orden ascendente
    const sorter = (a, b) => (a.orden ?? 0) - (b.orden ?? 0)
    for (const arr of map.values()) arr.sort(sorter)
    sinCarpeta.sort(sorter)
    return { porCarpeta: map, raiz: sinCarpeta }
  }, [favoritos, carpetas])

  function handleNuevo(carpetaId = null) {
    setEditandoFavorito(null)
    setCarpetaIdDefault(carpetaId)
    setModalOpen(true)
  }

  function handleEditar(fav) {
    setEditandoFavorito(fav)
    setCarpetaIdDefault(null)
    setModalOpen(true)
  }

  function handleEliminar(fav) {
    showModal({
      type: 'warning',
      title: 'Eliminar atajo',
      message: `¿Eliminar "${fav.nombre}"?`,
      showCancel: true,
      onConfirm: async () => {
        try {
          await api.delete(`/admin/favoritos/${fav.id}`)
          toast.success('Atajo eliminado')
          cargarFavoritos()
        } catch (err) {
          toast.error('Error al eliminar')
        }
      },
    })
  }

  function handleAbrir(fav) {
    if (editMode) return
    if (fav.abreEnNuevaPestana) {
      window.open(fav.url, '_blank', 'noopener,noreferrer')
      return
    }
    if (fav.url.startsWith('http://') || fav.url.startsWith('https://')) {
      window.location.href = fav.url
    } else {
      navigate(fav.url)
    }
  }

  async function crearCarpeta() {
    showModal({
      type: 'info',
      title: 'Nueva carpeta',
      message: 'Nombre de la carpeta:',
      prompt: true,
      promptPlaceholder: 'Ej: Tesorería',
      onConfirm: async (nombre) => {
        if (!nombre?.trim()) return
        try {
          await api.post('/admin/favoritos-carpetas', { nombre: nombre.trim(), color: 'blue' })
          toast.success('Carpeta creada')
          cargarCarpetas()
        } catch (err) {
          toast.error('Error al crear carpeta')
        }
      },
    })
  }

  function handleEliminarCarpeta(carpeta) {
    const cantidad = porCarpeta.get(carpeta.id)?.length || 0
    showModal({
      type: 'warning',
      title: 'Eliminar carpeta',
      message: cantidad > 0
        ? `¿Eliminar "${carpeta.nombre}"? Sus ${cantidad} ítem(s) volverán a la raíz.`
        : `¿Eliminar "${carpeta.nombre}"?`,
      showCancel: true,
      onConfirm: async () => {
        try {
          await api.delete(`/admin/favoritos-carpetas/${carpeta.id}`)
          toast.success('Carpeta eliminada')
          cargarTodo()
        } catch (err) {
          toast.error('Error al eliminar carpeta')
        }
      },
    })
  }

  // ─── Drag & Drop ────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const collisionDetection = (args) => {
    const pw = pointerWithin(args)
    if (pw.length > 0) return pw
    return rectIntersection(args)
  }

  function findFavoritoById(id) {
    return favoritos.find(f => f.id === id)
  }
  function findCarpetaById(id) {
    return carpetas.find(c => c.id === id)
  }

  // Construye el "estado lógico" de favoritos a partir de carpetas y porCarpeta+raíz
  function flattenToFavoritos(nuevasCarpetas, nuevoMapa, nuevaRaiz) {
    const out = []
    for (const c of nuevasCarpetas) {
      const arr = nuevoMapa.get(c.id) || []
      arr.forEach((fav, idx) => out.push({ ...fav, carpetaId: c.id, orden: idx + 1 }))
    }
    nuevaRaiz.forEach((fav, idx) => out.push({ ...fav, carpetaId: null, orden: idx + 1 }))
    return out
  }

  async function persistirCambios(nuevasCarpetas, nuevosFavoritos) {
    try {
      await api.post('/admin/favoritos/reordenar', {
        carpetas: nuevasCarpetas.map((c, idx) => ({ id: c.id, orden: idx + 1 })),
        favoritos: nuevosFavoritos.map(f => ({
          id: f.id,
          carpetaId: f.carpetaId,
          orden: f.orden,
        })),
      })
    } catch (err) {
      toast.error('Error al guardar el orden')
      cargarTodo()
    }
  }

  function onDragStart(event) {
    setActiveId(event.active.id)
  }

  function onDragOver(event) {
    const { over } = event
    if (!over) { setOverFolderId(null); return }
    const overId = over.id
    // Si el over es una carpeta directamente, marcar
    if (typeof overId === 'string' && overId.startsWith('carpeta-')) {
      setOverFolderId(parseInt(overId.replace('carpeta-', '')))
      return
    }
    // Si es ítem dentro de una carpeta, marcar la carpeta
    if (typeof overId === 'number') {
      const fav = findFavoritoById(overId)
      if (fav && fav.carpetaId) {
        setOverFolderId(fav.carpetaId)
        return
      }
    }
    setOverFolderId(null)
  }

  function onDragEnd(event) {
    const { active, over } = event
    setActiveId(null)
    setOverFolderId(null)
    if (!over) return

    const activeId = active.id
    const overId = over.id
    if (activeId === overId) return

    // Reorder de carpetas: arrastrar id "carpeta-X" sobre otra "carpeta-Y"
    if (
      typeof activeId === 'string' && activeId.startsWith('carpeta-') &&
      typeof overId === 'string' && overId.startsWith('carpeta-')
    ) {
      const fromId = parseInt(activeId.replace('carpeta-', ''))
      const toId = parseInt(overId.replace('carpeta-', ''))
      const fromIdx = carpetas.findIndex(c => c.id === fromId)
      const toIdx = carpetas.findIndex(c => c.id === toId)
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return
      const nuevas = arrayMove(carpetas, fromIdx, toIdx)
      setCarpetas(nuevas)
      const flat = flattenToFavoritos(nuevas, porCarpeta, raiz)
      setFavoritos(flat)
      persistirCambios(nuevas, flat)
      return
    }

    // El active es un favorito (id numérico)
    if (typeof activeId !== 'number') return
    const fav = findFavoritoById(activeId)
    if (!fav) return

    let nuevoMapa = new Map()
    for (const [k, v] of porCarpeta.entries()) nuevoMapa.set(k, [...v])
    let nuevaRaiz = [...raiz]

    // Quitar de su origen
    if (fav.carpetaId) {
      nuevoMapa.set(
        fav.carpetaId,
        (nuevoMapa.get(fav.carpetaId) || []).filter(f => f.id !== fav.id)
      )
    } else {
      nuevaRaiz = nuevaRaiz.filter(f => f.id !== fav.id)
    }

    // Determinar destino
    let destinoCarpeta = null // null = raíz
    let insertIdx = -1

    if (typeof overId === 'string') {
      if (overId === ROOT_DROP_ID) {
        destinoCarpeta = null
        insertIdx = nuevaRaiz.length
      } else if (overId.startsWith('carpeta-')) {
        destinoCarpeta = parseInt(overId.replace('carpeta-', ''))
        insertIdx = (nuevoMapa.get(destinoCarpeta) || []).length
      } else if (overId.startsWith('drop-carpeta-')) {
        destinoCarpeta = parseInt(overId.replace('drop-carpeta-', ''))
        insertIdx = (nuevoMapa.get(destinoCarpeta) || []).length
      }
    } else if (typeof overId === 'number') {
      const overFav = findFavoritoById(overId)
      if (overFav) {
        destinoCarpeta = overFav.carpetaId ?? null
        if (destinoCarpeta) {
          const arr = nuevoMapa.get(destinoCarpeta) || []
          insertIdx = arr.findIndex(f => f.id === overId)
          if (insertIdx === -1) insertIdx = arr.length
        } else {
          insertIdx = nuevaRaiz.findIndex(f => f.id === overId)
          if (insertIdx === -1) insertIdx = nuevaRaiz.length
        }
      }
    }

    if (insertIdx === -1) return

    // Insertar en destino
    const movido = { ...fav, carpetaId: destinoCarpeta }
    if (destinoCarpeta) {
      const arr = nuevoMapa.get(destinoCarpeta) || []
      arr.splice(insertIdx, 0, movido)
      nuevoMapa.set(destinoCarpeta, arr)
    } else {
      nuevaRaiz.splice(insertIdx, 0, movido)
    }

    const flat = flattenToFavoritos(carpetas, nuevoMapa, nuevaRaiz)
    setFavoritos(flat)
    persistirCambios(carpetas, flat)
  }

  const activeFav = activeId && typeof activeId === 'number' ? findFavoritoById(activeId) : null
  const activeCarpeta = activeId && typeof activeId === 'string' && activeId.startsWith('carpeta-')
    ? findCarpetaById(parseInt(activeId.replace('carpeta-', '')))
    : null

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Star className="w-6 h-6 text-primary" />
            Atajos
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Tus atajos personales. Tocá <Star className="w-3.5 h-3.5 inline-block text-primary -mt-0.5" /> en la barra superior para guardar la página actual.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={crearCarpeta}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            Nueva carpeta
          </button>
          <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2">
            <span className="text-sm font-medium text-gray-700">Edición</span>
            <button
              type="button"
              role="switch"
              aria-checked={editMode}
              onClick={() => setEditMode(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                editMode ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  editMode ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </label>
          <Button onClick={() => handleNuevo(null)}>
            <Plus className="w-4 h-4 mr-1" />
            Nuevo
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Cargando...</div>
      ) : favoritos.length === 0 && carpetas.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No tenés atajos todavía</p>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Usá el ícono <Star className="w-4 h-4 inline-block text-primary mb-0.5" /> en la barra superior cuando estés en una página que querés guardar.
          </p>
          <Button onClick={() => handleNuevo(null)}>
            <Plus className="w-4 h-4 mr-1" />
            Crear el primero
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <RootZone>
            <SortableContext
              items={[
                ...carpetas.map(c => `carpeta-${c.id}`),
                ...raiz.map(f => f.id),
              ]}
              strategy={rectSortingStrategy}
            >
              {carpetas.map(carpeta => (
                <SortableCarpetaCard
                  key={carpeta.id}
                  carpeta={carpeta}
                  items={porCarpeta.get(carpeta.id) || []}
                  editMode={editMode}
                  isOver={overFolderId === carpeta.id}
                  onAddItem={() => handleNuevo(carpeta.id)}
                  onEditItem={handleEditar}
                  onDeleteItem={handleEliminar}
                  onOpenItem={handleAbrir}
                  onDeleteCarpeta={() => handleEliminarCarpeta(carpeta)}
                  onCarpetaUpdated={cargarCarpetas}
                />
              ))}
              {raiz.map(fav => (
                <SortableFavoritoCard
                  key={fav.id}
                  fav={fav}
                  editMode={editMode}
                  onOpen={() => handleAbrir(fav)}
                  onEdit={() => handleEditar(fav)}
                  onDelete={() => handleEliminar(fav)}
                />
              ))}
            </SortableContext>
          </RootZone>

          <DragOverlay dropAnimation={null}>
            {activeFav && <FavoritoCardPreview fav={activeFav} />}
            {activeCarpeta && <CarpetaCardPreview carpeta={activeCarpeta} />}
          </DragOverlay>
        </DndContext>
      )}

      <FavoritoModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        favorito={editandoFavorito}
        carpetas={carpetas}
        carpetaIdDefault={carpetaIdDefault}
        onSaved={cargarFavoritos}
        onCarpetasChange={cargarCarpetas}
      />
      {ModalComponent}
    </div>
  )
}

// ─── RootZone (drop zone para volver favoritos a raíz) ────────────────────────

function RootZone({ children }) {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT_DROP_ID })
  return (
    <div
      ref={setNodeRef}
      className={`grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 items-start grid-flow-row-dense rounded-xl transition-colors ${
        isOver ? 'bg-blue-50/40 ring-2 ring-blue-200 ring-inset p-2' : 'p-0'
      }`}
    >
      {children}
    </div>
  )
}

// ─── SortableFavoritoCard ─────────────────────────────────────────────────────

function SortableFavoritoCard({ fav, editMode, onOpen, onEdit, onDelete, compact = false }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: fav.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <FavoritoCardInner
        fav={fav}
        editMode={editMode}
        compact={compact}
        onOpen={onOpen}
        onEdit={onEdit}
        onDelete={onDelete}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </div>
  )
}

// ─── FavoritoCardInner ───────────────────────────────────────────────────────

function FavoritoCardInner({ fav, editMode, onOpen, onEdit, onDelete, dragAttributes, dragListeners, compact = false }) {
  const color = fav.iconoColor || '#6b7280'
  const iconBoxSize = compact ? 'w-9 h-9' : 'w-10 h-10'
  const iconSize = compact ? 'w-4 h-4' : 'w-5 h-5'
  const nameSize = compact ? 'text-[11px]' : 'text-xs'

  return (
    <div
      onClick={editMode ? undefined : onOpen}
      title={fav.descripcion || fav.nombre}
      className={`relative group rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden ${
        editMode ? '' : 'cursor-pointer'
      }`}
    >
      {/* Barra de color superior */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: color }} />

      {/* Indicador "abre en nueva pestaña" */}
      {fav.abreEnNuevaPestana && !editMode && (
        <ExternalLink className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 text-blue-400 opacity-60" />
      )}

      {/* Acciones — sólo en modo edición */}
      {editMode && (
        <>
          {/* Drag handle (esquina superior izquierda) */}
          <button
            {...dragAttributes}
            {...dragListeners}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-1 left-1 z-10 p-0.5 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
            title="Arrastrar"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          {/* Editar + Eliminar (esquina superior derecha) */}
          <div className="absolute top-1 right-1 z-10 flex items-center gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              className="p-1 rounded bg-white/90 text-gray-500 hover:bg-white hover:text-primary transition-colors shadow-sm"
              title="Editar"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="p-1 rounded bg-white/90 text-gray-500 hover:bg-white hover:text-red-600 transition-colors shadow-sm"
              title="Eliminar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}

      {/* Contenido: ícono centrado + nombre */}
      <div className="pt-4 pb-3 px-2 flex flex-col items-center gap-1.5 text-center">
        <div
          className={`${iconBoxSize} rounded-lg flex items-center justify-center`}
          style={{ backgroundColor: color + '20' }}
        >
          <LucideIcon name={fav.icono} className={iconSize} style={{ color }} />
        </div>
        <span className={`${nameSize} font-medium text-gray-700 leading-tight line-clamp-2`}>
          {fav.nombre}
        </span>
      </div>
    </div>
  )
}

function FavoritoCardPreview({ fav }) {
  const color = fav.iconoColor || '#6b7280'
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-xl w-28 opacity-90 overflow-hidden">
      <div className="h-1" style={{ backgroundColor: color }} />
      <div className="pt-3 pb-2 px-2 flex flex-col items-center gap-1.5 text-center">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
          <LucideIcon name={fav.icono} className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-[11px] font-medium text-gray-700 leading-tight line-clamp-2">{fav.nombre}</span>
      </div>
    </div>
  )
}

// ─── SortableCarpetaCard ──────────────────────────────────────────────────────

function SortableCarpetaCard({ carpeta, items, editMode, isOver, onAddItem, onEditItem, onDeleteItem, onOpenItem, onDeleteCarpeta, onCarpetaUpdated }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `carpeta-${carpeta.id}`,
  })
  const { setNodeRef: setDropRef, isOver: isOverDrop } = useDroppable({
    id: `drop-carpeta-${carpeta.id}`,
  })
  const preset = getFolderPreset(carpeta.color)
  const [editandoNombre, setEditandoNombre] = useState(false)
  const [nombreDraft, setNombreDraft] = useState(carpeta.nombre)

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const highlight = isOver || isOverDrop

  async function guardarNombre() {
    const nombre = nombreDraft.trim()
    if (!nombre) {
      setNombreDraft(carpeta.nombre)
      setEditandoNombre(false)
      return
    }
    if (nombre === carpeta.nombre) {
      setEditandoNombre(false)
      return
    }
    try {
      await api.put(`/admin/favoritos-carpetas/${carpeta.id}`, { nombre })
      toast.success('Carpeta actualizada')
      setEditandoNombre(false)
      onCarpetaUpdated?.()
    } catch (err) {
      toast.error('Error al renombrar')
    }
  }

  async function cambiarColor(colorId) {
    if (colorId === carpeta.color) return
    try {
      await api.put(`/admin/favoritos-carpetas/${carpeta.id}`, { color: colorId })
      onCarpetaUpdated?.()
    } catch (err) {
      toast.error('Error al cambiar color')
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...sortableStyle,
        backgroundColor: preset.bg,
        borderColor: highlight ? '#60a5fa' : preset.border,
      }}
      className={`col-span-2 rounded-xl border-2 overflow-hidden transition-colors ${highlight ? 'scale-[1.005]' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        {editMode && (
          <button
            {...attributes}
            {...listeners}
            className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
            title="Arrastrar carpeta"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <FolderOpen className="w-5 h-5 flex-shrink-0" style={{ color: preset.icon }} />
        {editandoNombre ? (
          <>
            <input
              autoFocus
              value={nombreDraft}
              onChange={(e) => setNombreDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') guardarNombre()
                if (e.key === 'Escape') { setNombreDraft(carpeta.nombre); setEditandoNombre(false) }
              }}
              className="flex-1 bg-white/60 border border-white/80 rounded px-2 py-0.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            <button onClick={guardarNombre} className="p-1 rounded hover:bg-white/60" title="Guardar">
              <Check className="w-4 h-4 text-gray-700" />
            </button>
          </>
        ) : (
          <>
            <h3 className="flex-1 text-sm font-semibold text-gray-800 truncate">{carpeta.nombre}</h3>
            <span className="text-xs text-gray-500">{items.length}</span>
            {editMode && (
              <button
                onClick={() => { setNombreDraft(carpeta.nombre); setEditandoNombre(true) }}
                className="p-1 rounded hover:bg-white/60 text-gray-500"
                title="Renombrar"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}
        {editMode && (
          <button
            onClick={onAddItem}
            className="p-1 rounded hover:bg-white/60 text-gray-500"
            title="Agregar acceso a esta carpeta"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
        {editMode && (
          <button
            onClick={onDeleteCarpeta}
            className="p-1 rounded hover:bg-red-100 text-red-500"
            title="Eliminar carpeta"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Swatches de color (siempre visibles en modo edición) */}
      {editMode && (
        <div className="flex items-center gap-1.5 px-4 pb-2">
          {FOLDER_PRESETS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => cambiarColor(p.id)}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                carpeta.color === p.id ? 'border-gray-600 scale-125' : 'border-transparent'
              }`}
              style={{ backgroundColor: p.icon }}
              title={p.nombre}
            />
          ))}
        </div>
      )}

      {/* Items (zona droppable) */}
      <div ref={setDropRef} className="px-4 pb-4">
        <SortableContext items={items.map(f => f.id)} strategy={rectSortingStrategy}>
          {items.length === 0 ? (
            <div className={`py-6 text-center text-xs rounded-lg border-2 border-dashed transition-colors ${
              highlight ? 'border-blue-400 text-blue-500 bg-blue-50/50' : 'border-white/80 text-gray-500'
            }`}>
              {highlight ? 'Soltá aquí' : (
                <>Carpeta vacía. Tocá <Plus className="w-3 h-3 inline-block -mt-0.5" /> para agregar un acceso.</>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 items-start">
              {items.map(fav => (
                <SortableFavoritoCard
                  key={fav.id}
                  fav={fav}
                  editMode={editMode}
                  onOpen={() => onOpenItem(fav)}
                  onEdit={() => onEditItem(fav)}
                  onDelete={() => onDeleteItem(fav)}
                />
              ))}
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  )
}

function CarpetaCardPreview({ carpeta }) {
  const preset = getFolderPreset(carpeta.color)
  return (
    <div
      className="rounded-xl border-2 px-4 py-3 shadow-xl opacity-90 min-w-64"
      style={{ backgroundColor: preset.bg, borderColor: preset.border }}
    >
      <div className="flex items-center gap-2">
        <FolderOpen className="w-5 h-5" style={{ color: preset.icon }} />
        <span className="text-sm font-semibold text-gray-800">{carpeta.nombre}</span>
      </div>
    </div>
  )
}
