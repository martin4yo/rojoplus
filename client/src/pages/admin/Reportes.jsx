import { useNavigate } from 'react-router-dom'
import { Store, Dumbbell, Receipt, Users, BarChart3, PieChart, AlertTriangle, Pencil, Play } from 'lucide-react'

export default function AdminReportes() {
  const navigate = useNavigate()

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <BarChart3 className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Reportes</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center gap-4 cursor-pointer hover:shadow-md transition min-h-[160px]"
          onClick={() => navigate('/admin/reportes/ejecutar')}
        >
          <div className="p-4 rounded-full bg-primary/10">
            <Play className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-800 text-lg">Ejecutar Reportes</p>
            <p className="text-sm text-gray-500">Reportes personalizados con PDF</p>
          </div>
        </div>

        <div
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center gap-4 cursor-pointer hover:shadow-md transition min-h-[160px]"
          onClick={() => navigate('/admin/reportes/designer')}
        >
          <div className="p-4 rounded-full bg-primary/10">
            <Pencil className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-800 text-lg">Diseñador</p>
            <p className="text-sm text-gray-500">Creá reportes con HTML + PDF</p>
          </div>
        </div>
        <div
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center gap-4 cursor-pointer hover:shadow-md transition min-h-[160px]"
          onClick={() => navigate('/admin/reportes/cuotas')}
        >
          <div className="p-4 rounded-full bg-green-100">
            <Receipt className="w-8 h-8 text-green-600" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-800 text-lg">Cuotas</p>
            <p className="text-sm text-gray-500">Cobranza, mora y recaudación</p>
          </div>
        </div>

        <div
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center gap-4 cursor-pointer hover:shadow-md transition min-h-[160px]"
          onClick={() => navigate('/admin/reportes/actividades')}
        >
          <div className="p-4 rounded-full bg-orange-100">
            <Dumbbell className="w-8 h-8 text-orange-600" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-800 text-lg">Actividades</p>
            <p className="text-sm text-gray-500">Inscriptos por actividad</p>
          </div>
        </div>

        <div
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center gap-4 cursor-pointer hover:shadow-md transition min-h-[160px]"
          onClick={() => navigate('/admin/reportes/socios')}
        >
          <div className="p-4 rounded-full bg-blue-100">
            <Users className="w-8 h-8 text-blue-600" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-800 text-lg">Socios</p>
            <p className="text-sm text-gray-500">Estadísticas de membresía</p>
          </div>
        </div>

        <div
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center gap-4 cursor-pointer hover:shadow-md transition min-h-[160px]"
          onClick={() => navigate('/admin/reportes/comercios')}
        >
          <div className="p-4 rounded-full bg-purple-100">
            <Store className="w-8 h-8 text-purple-600" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-800 text-lg">Comercios</p>
            <p className="text-sm text-gray-500">Ventas y descuentos otorgados</p>
          </div>
        </div>

        <div
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center gap-4 cursor-pointer hover:shadow-md transition min-h-[160px]"
          onClick={() => navigate('/admin/contabilidad/presupuestos/vigente')}
        >
          <div className="p-4 rounded-full bg-red-100">
            <PieChart className="w-8 h-8 text-red-600" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-800 text-lg">Presupuesto</p>
            <p className="text-sm text-gray-500">Ejecución presupuestaria</p>
          </div>
        </div>

        <div
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center gap-4 cursor-pointer hover:shadow-md transition min-h-[160px]"
          onClick={() => navigate('/admin/reportes/morosidad')}
        >
          <div className="p-4 rounded-full bg-amber-100">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-800 text-lg">Morosidad</p>
            <p className="text-sm text-gray-500">Análisis avanzado de deudas</p>
          </div>
        </div>
      </div>
    </div>
  )
}
