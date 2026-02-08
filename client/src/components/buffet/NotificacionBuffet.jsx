import { useState, useRef, useEffect } from 'react';
import { Bell, BellOff, Check, CheckCheck, Volume2, VolumeX, X, ChefHat, Coffee, DollarSign, Utensils } from 'lucide-react';
import { useNotificacionBuffet } from '../../contexts/NotificacionBuffetContext';

// Función simple para formatear tiempo relativo
function formatearTiempoRelativo(fecha) {
  const ahora = new Date();
  const diferencia = ahora - new Date(fecha);
  const segundos = Math.floor(diferencia / 1000);
  const minutos = Math.floor(segundos / 60);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);

  if (segundos < 60) return 'hace un momento';
  if (minutos < 60) return `hace ${minutos} min`;
  if (horas < 24) return `hace ${horas}h`;
  if (dias === 1) return 'ayer';
  return `hace ${dias} días`;
}

// Iconos por tipo de notificación
const ICONOS_TIPO = {
  NUEVA_COMANDA: ChefHat,
  ITEM_LISTO: Utensils,
  CUENTA_PEDIDA: DollarSign,
  MESA_COBRADA: Check
};

// Colores por tipo
const COLORES_TIPO = {
  NUEVA_COMANDA: 'bg-blue-100 text-blue-600',
  ITEM_LISTO: 'bg-green-100 text-green-600',
  CUENTA_PEDIDA: 'bg-yellow-100 text-yellow-600',
  MESA_COBRADA: 'bg-gray-100 text-gray-600'
};

export default function NotificacionBuffet() {
  const [abierto, setAbierto] = useState(false);
  const panelRef = useRef(null);
  const {
    conectado,
    notificaciones,
    cantidadNoVistas,
    sonidoHabilitado,
    marcarVista,
    marcarTodasVistas,
    toggleSonido
  } = useNotificacionBuffet();

  // Cerrar panel al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setAbierto(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatearTiempo = (fecha) => {
    try {
      return formatearTiempoRelativo(fecha);
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Badge con campana */}
      <button
        onClick={() => setAbierto(!abierto)}
        className={`relative p-2 rounded-lg transition-colors ${
          abierto ? 'bg-gray-200' : 'hover:bg-gray-100'
        }`}
      >
        {conectado ? (
          <Bell className={`w-6 h-6 ${cantidadNoVistas > 0 ? 'text-red-600 animate-pulse' : 'text-gray-600'}`} />
        ) : (
          <BellOff className="w-6 h-6 text-gray-400" />
        )}

        {/* Contador */}
        {cantidadNoVistas > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
            {cantidadNoVistas > 99 ? '99+' : cantidadNoVistas}
          </span>
        )}
      </button>

      {/* Panel de notificaciones */}
      {abierto && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border z-50 max-h-[80vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="font-semibold text-gray-800">Notificaciones</span>
              {cantidadNoVistas > 0 && (
                <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {cantidadNoVistas}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Toggle sonido */}
              <button
                onClick={toggleSonido}
                className="p-1.5 hover:bg-gray-200 rounded"
                title={sonidoHabilitado ? 'Silenciar' : 'Activar sonido'}
              >
                {sonidoHabilitado ? (
                  <Volume2 className="w-4 h-4 text-gray-600" />
                ) : (
                  <VolumeX className="w-4 h-4 text-gray-400" />
                )}
              </button>
              {/* Marcar todas como vistas */}
              {cantidadNoVistas > 0 && (
                <button
                  onClick={marcarTodasVistas}
                  className="p-1.5 hover:bg-gray-200 rounded"
                  title="Marcar todas como vistas"
                >
                  <CheckCheck className="w-4 h-4 text-gray-600" />
                </button>
              )}
              {/* Cerrar */}
              <button
                onClick={() => setAbierto(false)}
                className="p-1.5 hover:bg-gray-200 rounded"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Lista de notificaciones */}
          <div className="overflow-y-auto flex-1">
            {notificaciones.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay notificaciones pendientes</p>
              </div>
            ) : (
              <div className="divide-y">
                {notificaciones.map((notif) => {
                  const Icono = ICONOS_TIPO[notif.tipo] || Bell;
                  const colorClase = COLORES_TIPO[notif.tipo] || 'bg-gray-100 text-gray-600';

                  return (
                    <div
                      key={notif.id}
                      className="p-3 hover:bg-gray-50 flex gap-3 cursor-pointer"
                      onClick={() => marcarVista(notif.id)}
                    >
                      {/* Icono */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorClase}`}>
                        <Icono className="w-5 h-5" />
                      </div>

                      {/* Contenido */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm">
                          {notif.titulo}
                        </p>
                        <p className="text-gray-600 text-sm truncate">
                          {notif.mensaje}
                        </p>
                        <p className="text-gray-400 text-xs mt-1">
                          {formatearTiempo(notif.createdAt)}
                        </p>
                      </div>

                      {/* Botón marcar vista */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          marcarVista(notif.id);
                        }}
                        className="p-1 hover:bg-gray-200 rounded self-start"
                        title="Marcar como vista"
                      >
                        <Check className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer con estado de conexión */}
          <div className="p-2 border-t bg-gray-50 flex items-center justify-center gap-2 text-xs text-gray-500">
            <span className={`w-2 h-2 rounded-full ${conectado ? 'bg-green-500' : 'bg-red-500'}`} />
            {conectado ? 'Conectado' : 'Desconectado'}
          </div>
        </div>
      )}
    </div>
  );
}
