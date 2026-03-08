/**
 * Componente de cabecera reutilizable para páginas
 *
 * @param {Object} props
 * @param {React.ComponentType} props.icon - Componente de icono de Lucide
 * @param {string} props.title - Título de la página
 * @param {string} [props.subtitle] - Subtítulo/descripción opcional
 * @param {React.ReactNode} [props.children] - Acciones/botones del lado derecho
 */
export default function PageHeader({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
          {subtitle && <p className="text-gray-500 text-sm">{subtitle}</p>}
        </div>
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">
          {children}
        </div>
      )}
    </div>
  )
}
