import { ChevronUp, ChevronDown } from 'lucide-react'
import { useState } from 'react'

/**
 * Table - Componente de tabla reutilizable con sorting y responsive design
 *
 * @param {array} columns - Array de definiciones de columnas
 * @param {array} data - Array de datos a mostrar
 * @param {string} keyField - Campo para usar como key (default: 'id')
 * @param {boolean} sortable - Habilitar sorting (default: false)
 * @param {function} onRowClick - Función al hacer click en una fila
 * @param {string} emptyMessage - Mensaje cuando no hay datos
 * @param {boolean} striped - Alternar colores de fila (default: false)
 * @param {boolean} hoverable - Efecto hover en filas (default: true)
 * @param {string} className - Clases adicionales
 *
 * @example
 * // Tabla básica
 * const columns = [
 *   { key: 'nombre', label: 'Nombre', sortable: true },
 *   { key: 'email', label: 'Email' },
 *   { key: 'rol', label: 'Rol', render: (row) => <Badge>{row.rol}</Badge> }
 * ]
 *
 * <Table columns={columns} data={usuarios} />
 *
 * @example
 * // Tabla con sorting y click
 * <Table
 *   columns={columns}
 *   data={data}
 *   sortable
 *   onRowClick={(row) => navigate(`/detalle/${row.id}`)}
 *   emptyMessage="No se encontraron registros"
 * />
 */
export default function Table({
  columns,
  data = [],
  keyField = 'id',
  sortable = false,
  onRowClick,
  emptyMessage = 'No hay datos para mostrar',
  striped = false,
  hoverable = true,
  className = ''
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  const handleSort = (columnKey) => {
    if (!sortable) return

    const column = columns.find(col => col.key === columnKey)
    if (column && column.sortable === false) return

    let direction = 'asc'
    if (sortConfig.key === columnKey && sortConfig.direction === 'asc') {
      direction = 'desc'
    }

    setSortConfig({ key: columnKey, direction })
  }

  const getSortedData = () => {
    if (!sortConfig.key) return data

    const sorted = [...data].sort((a, b) => {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]

      // Handle null/undefined
      if (aValue == null) return 1
      if (bValue == null) return -1

      // Handle numbers
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
      }

      // Handle strings
      const aString = String(aValue).toLowerCase()
      const bString = String(bValue).toLowerCase()

      if (sortConfig.direction === 'asc') {
        return aString.localeCompare(bString)
      } else {
        return bString.localeCompare(aString)
      }
    })

    return sorted
  }

  const sortedData = getSortedData()

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <ChevronDown className="w-4 h-4 text-gray-300" />
    }

    return sortConfig.direction === 'asc'
      ? <ChevronUp className="w-4 h-4 text-blue-600" />
      : <ChevronDown className="w-4 h-4 text-blue-600" />
  }

  const getCellValue = (row, column) => {
    if (column.render) {
      return column.render(row)
    }

    const value = row[column.key]

    // Handle null/undefined
    if (value == null) return '-'

    return value
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                onClick={() => sortable && handleSort(column.key)}
                className={`
                  px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider
                  ${sortable && column.sortable !== false ? 'cursor-pointer select-none hover:bg-gray-100' : ''}
                  ${column.className || ''}
                `}
              >
                <div className="flex items-center gap-1">
                  {column.label}
                  {sortable && column.sortable !== false && getSortIcon(column.key)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={`bg-white divide-y divide-gray-200 ${striped ? 'divide-y-0' : ''}`}>
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-8 text-center text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((row, index) => (
              <tr
                key={row[keyField] || index}
                onClick={() => onRowClick && onRowClick(row)}
                className={`
                  ${striped && index % 2 === 1 ? 'bg-gray-50' : ''}
                  ${hoverable ? 'hover:bg-gray-100' : ''}
                  ${onRowClick ? 'cursor-pointer' : ''}
                  transition-colors
                `}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${column.cellClassName || ''}`}
                  >
                    {getCellValue(row, column)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

/**
 * SimpleTable - Tabla sin funcionalidades avanzadas (más ligera)
 *
 * @example
 * <SimpleTable
 *   headers={['Nombre', 'Email', 'Rol']}
 *   rows={[
 *     ['Juan Pérez', 'juan@mail.com', 'Admin'],
 *     ['María García', 'maria@mail.com', 'Usuario']
 *   ]}
 * />
 */
export function SimpleTable({
  headers,
  rows = [],
  className = ''
}) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-6 py-8 text-center text-gray-500">
                No hay datos para mostrar
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
