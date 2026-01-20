import { Construction } from 'lucide-react'

export default function PlaceholderPage({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Construction className="w-16 h-16 text-gray-300 mb-4" />
      <h1 className="text-2xl font-bold text-gray-700 mb-2">{title || 'Pagina en construccion'}</h1>
      <p className="text-gray-500 text-center max-w-md">
        {description || 'Esta seccion esta siendo desarrollada y estara disponible proximamente.'}
      </p>
    </div>
  )
}
