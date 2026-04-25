/**
 * Presets de colores para Accesos Rápidos.
 * - SHORTCUT_COLORS: paleta para color de ícono de cada favorito.
 * - FOLDER_PRESETS: presets para color de carpeta (bg/border/icon).
 */

export const SHORTCUT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#10b981', // emerald
  '#f97316', // orange
  '#eab308', // yellow
  '#14b8a6', // teal
  '#ef4444', // red
  '#6366f1', // indigo
  '#ec4899', // pink
  '#84cc16', // lime
  '#06b6d4', // cyan
  '#6b7280', // gray
]

export const FOLDER_PRESETS = [
  { id: 'blue',   nombre: 'Azul',    bg: '#eff6ff', border: '#93c5fd', icon: '#2563eb' },
  { id: 'green',  nombre: 'Verde',   bg: '#f0fdf4', border: '#86efac', icon: '#16a34a' },
  { id: 'purple', nombre: 'Violeta', bg: '#faf5ff', border: '#d8b4fe', icon: '#9333ea' },
  { id: 'orange', nombre: 'Naranja', bg: '#fff7ed', border: '#fdba74', icon: '#ea580c' },
  { id: 'slate',  nombre: 'Gris',    bg: '#f8fafc', border: '#cbd5e1', icon: '#475569' },
]

export const getFolderPreset = (id) =>
  FOLDER_PRESETS.find(p => p.id === id) ?? FOLDER_PRESETS[0]
