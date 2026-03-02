import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, User, Building2, X, Check } from 'lucide-react';
import api from '../../services/api';

/**
 * Selector de cliente para facturación
 * Busca en Socios y Entidades tipo CLIENTE
 *
 * @param {Object} props
 * @param {Object} props.value - Cliente seleccionado { tipo: 'SOCIO'|'ENTIDAD', id, nombre, documento, ... }
 * @param {Function} props.onChange - Callback cuando se selecciona/deselecciona cliente
 * @param {boolean} props.disabled - Deshabilitar selector
 * @param {string} props.className - Clases adicionales
 */
export default function ClienteSelector({ value, onChange, disabled = false, className = '' }) {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Debounce para la búsqueda
  const buscarClientes = useCallback(async (texto) => {
    if (!texto || texto.length < 2) {
      setResultados([]);
      return;
    }

    setBuscando(true);
    try {
      const response = await api.get(`/admin/buffet/clientes/buscar?q=${encodeURIComponent(texto)}`);
      const data = response?.data || response || [];
      setResultados(data);
    } catch (error) {
      console.error('Error buscando clientes:', error);
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  }, []);

  // Efecto para buscar con debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (busqueda.length >= 2) {
        buscarClientes(busqueda);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [busqueda, buscarClientes]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setMostrarResultados(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Seleccionar cliente
  const seleccionarCliente = (cliente) => {
    onChange(cliente);
    setBusqueda('');
    setResultados([]);
    setMostrarResultados(false);
  };

  // Limpiar selección
  const limpiarSeleccion = () => {
    onChange(null);
    setBusqueda('');
    setResultados([]);
    inputRef.current?.focus();
  };

  // Obtener condición IVA legible
  const getCondicionIva = (codigo) => {
    const condiciones = {
      1: 'Resp. Inscripto',
      4: 'Exento',
      5: 'Cons. Final',
      6: 'Monotributo'
    };
    return condiciones[codigo] || 'Cons. Final';
  };

  // Obtener tipo documento legible
  const getTipoDoc = (codigo) => {
    const tipos = {
      80: 'CUIT',
      86: 'CUIL',
      96: 'DNI',
      99: 'Sin ID'
    };
    return tipos[codigo] || 'Doc';
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Cliente seleccionado */}
      {value ? (
        <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
          {value.tipo === 'SOCIO' ? (
            <User className="w-5 h-5 text-green-600" />
          ) : (
            <Building2 className="w-5 h-5 text-blue-600" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{value.nombre}</div>
            <div className="text-xs text-gray-500">
              {value.tipo === 'SOCIO' ? `Socio ${value.codigo}` : value.codigo}
              {value.documento && ` - ${getTipoDoc(value.tipoDoc)}: ${value.documento}`}
              {' - '}{getCondicionIva(value.condicionIva)}
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={limpiarSeleccion}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        /* Campo de búsqueda */
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setMostrarResultados(true);
            }}
            onFocus={() => setMostrarResultados(true)}
            placeholder="Buscar socio o cliente por nombre, CUIT, DNI..."
            disabled={disabled}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          {buscando && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Lista de resultados */}
      {mostrarResultados && resultados.length > 0 && !value && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {resultados.map((cliente, index) => (
            <button
              key={`${cliente.tipo}-${cliente.id}`}
              type="button"
              onClick={() => seleccionarCliente(cliente)}
              className="w-full flex items-center gap-2 p-2 text-left hover:bg-gray-50 border-b last:border-b-0"
            >
              {cliente.tipo === 'SOCIO' ? (
                <User className="w-5 h-5 text-green-600 flex-shrink-0" />
              ) : (
                <Building2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{cliente.nombre}</div>
                <div className="text-xs text-gray-500 truncate">
                  {cliente.tipo === 'SOCIO' ? `Socio ${cliente.codigo}` : cliente.codigo}
                  {cliente.documento && ` - ${getTipoDoc(cliente.tipoDoc)}: ${cliente.documento}`}
                  {' - '}{getCondicionIva(cliente.condicionIva)}
                </div>
              </div>
              <Check className="w-4 h-4 text-green-500 opacity-0 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}

      {/* Sin resultados */}
      {mostrarResultados && busqueda.length >= 2 && resultados.length === 0 && !buscando && !value && (
        <div className="absolute z-50 w-full mt-1 p-3 bg-white border border-gray-200 rounded-lg shadow-lg text-center text-sm text-gray-500">
          No se encontraron clientes
        </div>
      )}

      {/* Ayuda */}
      {mostrarResultados && busqueda.length > 0 && busqueda.length < 2 && !value && (
        <div className="absolute z-50 w-full mt-1 p-3 bg-white border border-gray-200 rounded-lg shadow-lg text-center text-sm text-gray-500">
          Escriba al menos 2 caracteres para buscar
        </div>
      )}
    </div>
  );
}
