import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../services/api';

const NotificacionBuffetContext = createContext();

// Sonidos por tipo de notificación
const SONIDOS = {
  bell: '/sounds/bell.mp3',
  chime: '/sounds/chime.mp3',
  alert: '/sounds/alert.mp3',
  default: '/sounds/notification.mp3'
};

export function NotificacionBuffetProvider({ children }) {
  const location = useLocation();
  const [socket, setSocket] = useState(null);
  const [conectado, setConectado] = useState(false);
  const [notificaciones, setNotificaciones] = useState([]);
  const [sonidoHabilitado, setSonidoHabilitado] = useState(true);
  const audioRef = useRef(null);

  // Cargar notificaciones pendientes desde API
  const cargarNotificaciones = useCallback(async () => {
    try {
      const response = await api.get('/admin/buffet/notificaciones');
      const data = response?.data || response || [];
      setNotificaciones(data);
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    }
  }, []);

  // Reproducir sonido
  const reproducirSonido = useCallback((tipoSonido) => {
    if (!sonidoHabilitado) return;

    try {
      const url = SONIDOS[tipoSonido] || SONIDOS.default;
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().catch(() => {});
      }
    } catch (error) {
      console.error('Error reproduciendo sonido:', error);
    }
  }, [sonidoHabilitado]);

  // Conectar socket
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Verificar si estamos en una página del buffet
    const esBuffet = location.pathname.includes('/admin/buffet');
    if (!esBuffet) {
      // Si no estamos en buffet y hay socket, desconectar
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConectado(false);
      }
      return;
    }

    // Si ya hay socket conectado, no crear otro
    if (socket?.connected) return;

    // El socket se conecta al mismo puerto del backend (3000)
    const backendUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';
    const socketInstance = io(backendUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      console.log('[Socket] Conectado');
      setConectado(true);
      cargarNotificaciones();
    });

    socketInstance.on('disconnect', () => {
      console.log('[Socket] Desconectado');
      setConectado(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('[Socket] Error de conexión:', error.message);
      setConectado(false);
    });

    // Recibir notificación
    socketInstance.on('notificacion', (notificacion) => {
      console.log('[Socket] Nueva notificación:', notificacion);
      setNotificaciones(prev => [notificacion, ...prev]);
      reproducirSonido(notificacion.sonido);

      // Vibrar en móvil si está disponible
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [location.pathname, cargarNotificaciones, reproducirSonido]);

  // Marcar notificación como vista
  const marcarVista = useCallback(async (notificacionId) => {
    try {
      await api.post(`/admin/buffet/notificaciones/${notificacionId}/vista`);
      setNotificaciones(prev => prev.filter(n => n.id !== notificacionId));

      // También emitir por socket
      if (socket) {
        socket.emit('notificacion:vista', notificacionId);
      }
    } catch (error) {
      console.error('Error marcando notificación:', error);
    }
  }, [socket]);

  // Marcar todas como vistas
  const marcarTodasVistas = useCallback(async () => {
    try {
      await api.post('/admin/buffet/notificaciones/marcar-todas');
      setNotificaciones([]);
    } catch (error) {
      console.error('Error marcando notificaciones:', error);
    }
  }, []);

  // Toggle sonido
  const toggleSonido = useCallback(() => {
    setSonidoHabilitado(prev => !prev);
  }, []);

  const value = {
    socket,
    conectado,
    notificaciones,
    cantidadNoVistas: notificaciones.length,
    sonidoHabilitado,
    marcarVista,
    marcarTodasVistas,
    toggleSonido,
    cargarNotificaciones
  };

  return (
    <NotificacionBuffetContext.Provider value={value}>
      {children}
      <audio ref={audioRef} />
    </NotificacionBuffetContext.Provider>
  );
}

export function useNotificacionBuffet() {
  const context = useContext(NotificacionBuffetContext);
  if (!context) {
    throw new Error('useNotificacionBuffet debe usarse dentro de NotificacionBuffetProvider');
  }
  return context;
}

export default NotificacionBuffetContext;
