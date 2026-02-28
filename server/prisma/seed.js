import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ============================================================================
// DATOS DE SEEDS
// ============================================================================

const rubros = [
  { nombre: 'Gastronomía', orden: 1 },
  { nombre: 'Indumentaria', orden: 2 },
  { nombre: 'Farmacia', orden: 3 },
  { nombre: 'Librería', orden: 4 },
  { nombre: 'Supermercado/Almacén', orden: 5 },
  { nombre: 'Ferretería', orden: 6 },
  { nombre: 'Electrónica', orden: 7 },
  { nombre: 'Servicios Profesionales', orden: 8 },
  { nombre: 'Belleza y Estética', orden: 9 },
  { nombre: 'Deportes', orden: 10 },
  { nombre: 'Automotor', orden: 11 },
  { nombre: 'Hogar y Decoración', orden: 12 },
  { nombre: 'Salud', orden: 13 },
  { nombre: 'Educación', orden: 14 },
  { nombre: 'Otros', orden: 99 },
];

const descuentosDisponibles = [
  { nombre: '5% - Descuento Básico', porcentaje: 5, descripcion: 'Descuento inicial para comercios adheridos', orden: 1 },
  { nombre: '10% - Descuento Estándar', porcentaje: 10, descripcion: 'Descuento estándar más utilizado', orden: 2 },
  { nombre: '15% - Descuento Plus', porcentaje: 15, descripcion: 'Descuento intermedio atractivo', orden: 3 },
  { nombre: '20% - Descuento Premium', porcentaje: 20, descripcion: 'Descuento destacado para socios', orden: 4 },
  { nombre: '25% - Descuento Especial', porcentaje: 25, descripcion: 'Descuento promocional excepcional', orden: 5 },
  { nombre: '30% - Descuento VIP', porcentaje: 30, descripcion: 'Máximo descuento disponible', orden: 6 },
];

const tiposCuota = [
  { codigo: 'SOCIAL', nombre: 'Cuota Social', descripcion: 'Cuota de membresía del club' },
  { codigo: 'DEPORTIVA', nombre: 'Cuota Deportiva', descripcion: 'Cuota por actividad deportiva' },
];

const mediosPago = [
  { codigo: 'EFECTIVO', nombre: 'Efectivo', tipo: 'EFECTIVO', orden: 1 },
  { codigo: 'TRANSFERENCIA', nombre: 'Transferencia Bancaria', tipo: 'BANCO', requiereDatosBanco: true, orden: 2 },
  { codigo: 'DEBITO', nombre: 'Tarjeta de Débito', tipo: 'TARJETA', orden: 3 },
  { codigo: 'CREDITO', nombre: 'Tarjeta de Crédito', tipo: 'TARJETA', orden: 4 },
  { codigo: 'MERCADOPAGO', nombre: 'MercadoPago', tipo: 'VIRTUAL', orden: 5 },
  { codigo: 'MODO', nombre: 'MODO', tipo: 'VIRTUAL', orden: 6 },
  { codigo: 'DEBITO_AUTO', nombre: 'Débito Automático', tipo: 'BANCO', orden: 7 },
  { codigo: 'COBRADOR', nombre: 'Cobrador', tipo: 'COBRADOR', orden: 8 },
];

const deportes = [
  { codigo: 'FUT', nombre: 'Fútbol', orden: 1 },
  { codigo: 'BAS', nombre: 'Básquet', orden: 2 },
  { codigo: 'VOL', nombre: 'Vóley', orden: 3 },
  { codigo: 'NAT', nombre: 'Natación', orden: 4 },
  { codigo: 'HOC', nombre: 'Hockey', orden: 5 },
  { codigo: 'TEN', nombre: 'Tenis', orden: 6 },
  { codigo: 'PAD', nombre: 'Paddle', orden: 7 },
  { codigo: 'GIM', nombre: 'Gimnasia', orden: 8 },
];

const roles = [
  { codigo: 'SUPER_ADMIN', nombre: 'Super Administrador', descripcion: 'Acceso total al sistema', esSuperAdmin: true },
  { codigo: 'ADMIN', nombre: 'Administrador', descripcion: 'Administración general' },
  { codigo: 'TESORERO', nombre: 'Tesorero', descripcion: 'Gestión de caja y pagos' },
  { codigo: 'SECRETARIO', nombre: 'Secretario', descripcion: 'Gestión de socios y actividades' },
  { codigo: 'CONSULTA', nombre: 'Consulta', descripcion: 'Solo lectura' },
];

const permisos = [
  // Socios
  { codigo: 'SOCIOS_VER', nombre: 'Ver Socios', modulo: 'SOCIOS' },
  { codigo: 'SOCIOS_CREAR', nombre: 'Crear Socios', modulo: 'SOCIOS' },
  { codigo: 'SOCIOS_EDITAR', nombre: 'Editar Socios', modulo: 'SOCIOS' },
  { codigo: 'SOCIOS_ELIMINAR', nombre: 'Eliminar Socios', modulo: 'SOCIOS' },
  // Inscripciones
  { codigo: 'INSCRIPCIONES_VER', nombre: 'Ver Inscripciones', modulo: 'INSCRIPCIONES' },
  { codigo: 'INSCRIPCIONES_GESTIONAR', nombre: 'Gestionar Inscripciones', modulo: 'INSCRIPCIONES' },
  // Actividades
  { codigo: 'ACTIVIDADES_VER', nombre: 'Ver Actividades', modulo: 'ACTIVIDADES' },
  { codigo: 'ACTIVIDADES_GESTIONAR', nombre: 'Gestionar Actividades', modulo: 'ACTIVIDADES' },
  // Deportes
  { codigo: 'DEPORTES_VER', nombre: 'Ver Deportes', modulo: 'DEPORTES' },
  { codigo: 'DEPORTES_PARTIDOS', nombre: 'Gestionar Partidos', modulo: 'DEPORTES' },
  { codigo: 'DEPORTES_ENTRENAMIENTOS', nombre: 'Gestionar Entrenamientos', modulo: 'DEPORTES' },
  { codigo: 'DEPORTES_PASAJE', nombre: 'Ejecutar Pasaje Categoría', modulo: 'DEPORTES' },
  // Buffet
  { codigo: 'BUFFET_VER', nombre: 'Ver Buffet', modulo: 'BUFFET' },
  { codigo: 'BUFFET_MESAS', nombre: 'Gestionar Mesas', modulo: 'BUFFET' },
  { codigo: 'BUFFET_COBRAR', nombre: 'Cobrar Buffet', modulo: 'BUFFET' },
  { codigo: 'BUFFET_COCINA', nombre: 'Pantalla Cocina', modulo: 'BUFFET' },
  { codigo: 'BUFFET_KIOSCO', nombre: 'Kiosco/Venta Rápida', modulo: 'BUFFET' },
  { codigo: 'BUFFET_CONFIG', nombre: 'Configurar Buffet', modulo: 'BUFFET' },
  // Cuotas
  { codigo: 'CUOTAS_VER', nombre: 'Ver Cuotas', modulo: 'CUOTAS' },
  { codigo: 'CUOTAS_GENERAR', nombre: 'Generar Cuotas', modulo: 'CUOTAS' },
  { codigo: 'CUOTAS_BONIFICAR', nombre: 'Bonificar Cuotas', modulo: 'CUOTAS' },
  { codigo: 'DEBITO_AUTOMATICO', nombre: 'Débito Automático', modulo: 'CUOTAS' },
  // Caja / Tesorería
  { codigo: 'CAJA_VER', nombre: 'Ver Caja', modulo: 'TESORERIA' },
  { codigo: 'CAJA_COBRAR', nombre: 'Registrar Cobros', modulo: 'TESORERIA' },
  { codigo: 'CAJA_MOVIMIENTOS', nombre: 'Registrar Movimientos', modulo: 'TESORERIA' },
  { codigo: 'CAJA_ANULAR', nombre: 'Anular Movimientos', modulo: 'TESORERIA' },
  { codigo: 'CAJA_CIERRE', nombre: 'Cierre de Caja', modulo: 'TESORERIA' },
  // Contabilidad
  { codigo: 'CONTABILIDAD_VER', nombre: 'Ver Contabilidad', modulo: 'CONTABILIDAD' },
  { codigo: 'CONTABILIDAD_ASIENTOS', nombre: 'Registrar Asientos', modulo: 'CONTABILIDAD' },
  { codigo: 'CONTABILIDAD_PRESUPUESTO', nombre: 'Gestionar Presupuesto', modulo: 'CONTABILIDAD' },
  // Stock
  { codigo: 'STOCK_VER', nombre: 'Ver Stock', modulo: 'STOCK' },
  { codigo: 'STOCK_GESTIONAR', nombre: 'Gestionar Stock', modulo: 'STOCK' },
  // Ingresos
  { codigo: 'INGRESOS_VER', nombre: 'Ver Ingresos', modulo: 'INGRESOS' },
  { codigo: 'INGRESOS_GESTIONAR', nombre: 'Gestionar Ingresos', modulo: 'INGRESOS' },
  // Egresos
  { codigo: 'EGRESOS_VER', nombre: 'Ver Egresos', modulo: 'EGRESOS' },
  { codigo: 'EGRESOS_GESTIONAR', nombre: 'Gestionar Egresos', modulo: 'EGRESOS' },
  // Sueldos
  { codigo: 'SUELDOS_VER', nombre: 'Ver Sueldos', modulo: 'SUELDOS' },
  { codigo: 'SUELDOS_GESTIONAR', nombre: 'Gestionar Sueldos', modulo: 'SUELDOS' },
  // Reportes
  { codigo: 'REPORTES_VER', nombre: 'Ver Reportes', modulo: 'REPORTES' },
  { codigo: 'REPORTES_EXPORTAR', nombre: 'Exportar Reportes', modulo: 'REPORTES' },
  // Contenido (Noticias, Publicidad)
  { codigo: 'CONTENIDO_VER', nombre: 'Ver Contenido', modulo: 'CONTENIDO' },
  { codigo: 'CONTENIDO_GESTIONAR', nombre: 'Gestionar Contenido', modulo: 'CONTENIDO' },
  // Configuración
  { codigo: 'CONFIG_VER', nombre: 'Ver Configuración', modulo: 'CONFIG' },
  { codigo: 'CONFIG_EDITAR', nombre: 'Editar Configuración', modulo: 'CONFIG' },
  // Sistema
  { codigo: 'USUARIOS_GESTIONAR', nombre: 'Gestionar Usuarios', modulo: 'SISTEMA' },
  { codigo: 'COMERCIOS_GESTIONAR', nombre: 'Gestionar Comercios', modulo: 'SISTEMA' },
  // Control de Accesos
  { codigo: 'ACCESOS_VER', nombre: 'Ver Control de Accesos', modulo: 'ACCESOS' },
  { codigo: 'ACCESOS_GESTIONAR', nombre: 'Gestionar Control de Accesos', modulo: 'ACCESOS' },
  // Eventos
  { codigo: 'EVENTOS_VER', nombre: 'Ver Eventos', modulo: 'EVENTOS' },
  { codigo: 'EVENTOS_GESTIONAR', nombre: 'Gestionar Eventos', modulo: 'EVENTOS' },
  { codigo: 'EVENTOS_VENDER', nombre: 'Vender Entradas', modulo: 'EVENTOS' },
  { codigo: 'EVENTOS_VALIDAR', nombre: 'Validar Entradas', modulo: 'EVENTOS' },
  // Facturación Electrónica
  { codigo: 'FACTURACION_EMITIR', nombre: 'Emitir Facturas', modulo: 'FACTURACION', descripcion: 'Permite emitir facturas electrónicas con CAE' },
  { codigo: 'FACTURACION_ANULAR', nombre: 'Anular Facturas', modulo: 'FACTURACION', descripcion: 'Permite anular comprobantes mediante notas de crédito' },
  { codigo: 'FACTURACION_CONFIG', nombre: 'Configurar Facturación', modulo: 'FACTURACION', descripcion: 'Configurar certificados AFIP y datos fiscales' },
];

const conceptosTesoreria = [
  // Ingresos
  { codigo: 'COB-CUO', nombre: 'Cobranza de Cuotas', descripcion: 'Cobro de cuotas sociales y deportivas', tipo: 'INGRESO', orden: 1 },
  { codigo: 'COB-ACT', nombre: 'Cobranza Actividades', descripcion: 'Cobro de actividades y eventos especiales', tipo: 'INGRESO', orden: 2 },
  { codigo: 'ING-MORA', nombre: 'Ingresos por Mora', descripcion: 'Recargos e intereses por mora en cuotas', tipo: 'INGRESO', orden: 3 },
  { codigo: 'DON', nombre: 'Donaciones', descripcion: 'Donaciones recibidas', tipo: 'INGRESO', orden: 4 },
  { codigo: 'OTR-ING', nombre: 'Otros Ingresos', descripcion: 'Otros ingresos varios', tipo: 'INGRESO', orden: 5 },

  // Egresos
  { codigo: 'SUE', nombre: 'Sueldos y Jornales', descripcion: 'Pago de sueldos al personal', tipo: 'EGRESO', orden: 6 },
  { codigo: 'SERV', nombre: 'Servicios', descripcion: 'Pago de servicios (luz, agua, gas, internet)', tipo: 'EGRESO', orden: 7 },
  { codigo: 'MAN', nombre: 'Mantenimiento', descripcion: 'Gastos de mantenimiento e infraestructura', tipo: 'EGRESO', orden: 8 },
  { codigo: 'COM', nombre: 'Compras', descripcion: 'Compra de insumos y materiales', tipo: 'EGRESO', orden: 9 },
  { codigo: 'OTR-EGR', nombre: 'Otros Egresos', descripcion: 'Otros egresos varios', tipo: 'EGRESO', orden: 10 },
];

const tiposSocio = [
  { codigo: 'ACTIVO', nombre: 'Socio Activo', descripcion: 'Socio activo mayor de edad', cuotaMensual: 15000, color: '#10B981', orden: 1 },
  { codigo: 'CADETE', nombre: 'Socio Cadete', descripcion: 'Socio menor de 18 años', cuotaMensual: 8000, color: '#3B82F6', orden: 2 },
  { codigo: 'VITALICIO', nombre: 'Socio Vitalicio', descripcion: 'Socio con cuota vitalicia (sin cuota mensual)', cuotaMensual: 0, color: '#F59E0B', orden: 3 },
  { codigo: 'ADHERENTE', nombre: 'Socio Adherente', descripcion: 'Socio adherente sin actividades', cuotaMensual: 5000, color: '#6B7280', orden: 4 },
];

const categoriasSocio = [
  { codigo: 'A', nombre: 'Categoría A', descripcion: 'Socio fundador o histórico', porcentajeDescuento: 20, color: '#EF4444', orden: 1 },
  { codigo: 'B', nombre: 'Categoría B', descripcion: 'Socio estándar', porcentajeDescuento: 10, color: '#3B82F6', orden: 2 },
  { codigo: 'C', nombre: 'Categoría C', descripcion: 'Socio nuevo', porcentajeDescuento: 0, color: '#6B7280', orden: 3 },
];

const estadosSocio = [
  { codigo: 'ACTIVO', nombre: 'ACTIVO', descripcion: 'Socio activo con todos los beneficios', color: '#10B981', permiteDescuentos: true, orden: 1 },
  { codigo: 'VIGENTE', nombre: 'VIGENTE', descripcion: 'Socio con cuota al día', color: '#10B981', permiteDescuentos: true, orden: 2 },
  { codigo: 'SUSPENDIDO', nombre: 'SUSPENDIDO', descripcion: 'Socio suspendido temporalmente', color: '#F59E0B', permiteDescuentos: false, orden: 3 },
  { codigo: 'MOROSO', nombre: 'MOROSO', descripcion: 'Socio con cuotas adeudadas', color: '#EF4444', permiteDescuentos: false, orden: 4 },
  { codigo: 'BAJA', nombre: 'BAJA', descripcion: 'Socio dado de baja', color: '#6B7280', permiteDescuentos: false, orden: 5 },
  { codigo: 'INACTIVO', nombre: 'INACTIVO', descripcion: 'Socio inactivo', color: '#9CA3AF', permiteDescuentos: false, orden: 6 },
];

const centrosCosto = [
  // Centros Operativos (por actividad/deporte)
  { codigo: 'FUT', nombre: 'Fútbol', descripcion: 'Centro de costos de actividades de fútbol', tipo: 'OPERATIVO', orden: 1 },
  { codigo: 'BAS', nombre: 'Básquet', descripcion: 'Centro de costos de actividades de básquet', tipo: 'OPERATIVO', orden: 2 },
  { codigo: 'VOL', nombre: 'Vóley', descripcion: 'Centro de costos de actividades de vóley', tipo: 'OPERATIVO', orden: 3 },
  { codigo: 'NAT', nombre: 'Natación', descripcion: 'Centro de costos de actividades de natación', tipo: 'OPERATIVO', orden: 4 },
  { codigo: 'HOC', nombre: 'Hockey', descripcion: 'Centro de costos de actividades de hockey', tipo: 'OPERATIVO', orden: 5 },
  { codigo: 'TEN', nombre: 'Tenis', descripcion: 'Centro de costos de actividades de tenis', tipo: 'OPERATIVO', orden: 6 },
  { codigo: 'PAD', nombre: 'Paddle', descripcion: 'Centro de costos de actividades de paddle', tipo: 'OPERATIVO', orden: 7 },
  { codigo: 'GIM', nombre: 'Gimnasia', descripcion: 'Centro de costos de actividades de gimnasia', tipo: 'OPERATIVO', orden: 8 },

  // Centros Administrativos
  { codigo: 'ADM', nombre: 'Administración', descripcion: 'Gastos administrativos generales del club', tipo: 'ADMINISTRATIVO', orden: 10 },
  { codigo: 'BAR', nombre: 'Bar', descripcion: 'Ingresos y egresos del bar del club', tipo: 'OPERATIVO', orden: 11 },
  { codigo: 'BUFFET', nombre: 'Buffet', descripcion: 'Ingresos y egresos del buffet/restaurant', tipo: 'OPERATIVO', orden: 12 },
  { codigo: 'EVE', nombre: 'Eventos', descripcion: 'Eventos sociales y recreativos', tipo: 'OPERATIVO', orden: 13 },
  { codigo: 'MER', nombre: 'Merchandising', descripcion: 'Venta de productos y merchandising', tipo: 'OPERATIVO', orden: 13 },
  { codigo: 'MAN', nombre: 'Mantenimiento', descripcion: 'Mantenimiento de instalaciones', tipo: 'ADMINISTRATIVO', orden: 14 },
];

const cuentasContables = [
  // ============================================================================
  // ACTIVO
  // ============================================================================
  { codigo: '1', nombre: 'ACTIVO', tipo: 'ACTIVO', nivel: 1, esImputable: false },

  // 1.1 Activo Corriente
  { codigo: '1.1', nombre: 'Activo Corriente', tipo: 'ACTIVO', nivel: 2, esImputable: false, padreCodigo: '1' },

  // 1.1.1 Caja y Bancos
  { codigo: '1.1.1', nombre: 'Caja y Bancos', tipo: 'ACTIVO', nivel: 3, esImputable: false, padreCodigo: '1.1' },
  { codigo: '1.1.1.01', nombre: 'Caja Efectivo', tipo: 'ACTIVO', nivel: 4, esImputable: true, padreCodigo: '1.1.1' },
  { codigo: '1.1.1.02', nombre: 'Banco Cuenta Corriente', tipo: 'ACTIVO', nivel: 4, esImputable: true, padreCodigo: '1.1.1' },
  { codigo: '1.1.1.03', nombre: 'Banco Caja de Ahorro', tipo: 'ACTIVO', nivel: 4, esImputable: true, padreCodigo: '1.1.1' },

  // 1.1.2 Créditos
  { codigo: '1.1.2', nombre: 'Créditos', tipo: 'ACTIVO', nivel: 3, esImputable: false, padreCodigo: '1.1' },
  { codigo: '1.1.2.01', nombre: 'Clientes/Deudores', tipo: 'ACTIVO', nivel: 4, esImputable: true, padreCodigo: '1.1.2' },
  { codigo: '1.1.2.02', nombre: 'Deudores por Cuotas', tipo: 'ACTIVO', nivel: 4, esImputable: true, padreCodigo: '1.1.2' },
  { codigo: '1.1.2.03', nombre: 'Cheques a Depositar', tipo: 'ACTIVO', nivel: 4, esImputable: true, padreCodigo: '1.1.2' },
  { codigo: '1.1.2.04', nombre: 'Tarjetas Pendientes Conciliación', tipo: 'ACTIVO', nivel: 4, esImputable: true, padreCodigo: '1.1.2' },

  // 1.1.3 Créditos Fiscales
  { codigo: '1.1.3', nombre: 'Créditos Fiscales', tipo: 'ACTIVO', nivel: 3, esImputable: false, padreCodigo: '1.1' },
  { codigo: '1.1.3.01', nombre: 'IVA Crédito Fiscal 21%', tipo: 'ACTIVO', nivel: 4, esImputable: true, padreCodigo: '1.1.3' },
  { codigo: '1.1.3.02', nombre: 'IVA Crédito Fiscal 10.5%', tipo: 'ACTIVO', nivel: 4, esImputable: true, padreCodigo: '1.1.3' },
  { codigo: '1.1.3.03', nombre: 'IVA Crédito Fiscal 27%', tipo: 'ACTIVO', nivel: 4, esImputable: true, padreCodigo: '1.1.3' },

  // 1.1.4 Bienes de Cambio
  { codigo: '1.1.4', nombre: 'Bienes de Cambio', tipo: 'ACTIVO', nivel: 3, esImputable: false, padreCodigo: '1.1' },
  { codigo: '1.1.4.01', nombre: 'Mercaderías', tipo: 'ACTIVO', nivel: 4, esImputable: true, padreCodigo: '1.1.4' },

  // 1.2 Activo No Corriente
  { codigo: '1.2', nombre: 'Activo No Corriente', tipo: 'ACTIVO', nivel: 2, esImputable: false, padreCodigo: '1' },
  { codigo: '1.2.1', nombre: 'Bienes de Uso', tipo: 'ACTIVO', nivel: 3, esImputable: false, padreCodigo: '1.2' },
  { codigo: '1.2.1.01', nombre: 'Muebles y Útiles', tipo: 'ACTIVO', nivel: 4, esImputable: true, padreCodigo: '1.2.1' },
  { codigo: '1.2.1.02', nombre: 'Equipos de Computación', tipo: 'ACTIVO', nivel: 4, esImputable: true, padreCodigo: '1.2.1' },
  { codigo: '1.2.1.03', nombre: 'Instalaciones', tipo: 'ACTIVO', nivel: 4, esImputable: true, padreCodigo: '1.2.1' },

  // ============================================================================
  // PASIVO
  // ============================================================================
  { codigo: '2', nombre: 'PASIVO', tipo: 'PASIVO', nivel: 1, esImputable: false },

  // 2.1 Pasivo Corriente
  { codigo: '2.1', nombre: 'Pasivo Corriente', tipo: 'PASIVO', nivel: 2, esImputable: false, padreCodigo: '2' },

  // 2.1.1 Deudas Comerciales
  { codigo: '2.1.1', nombre: 'Deudas Comerciales', tipo: 'PASIVO', nivel: 3, esImputable: false, padreCodigo: '2.1' },
  { codigo: '2.1.1.01', nombre: 'Proveedores', tipo: 'PASIVO', nivel: 4, esImputable: true, padreCodigo: '2.1.1' },
  { codigo: '2.1.1.02', nombre: 'Cheques Diferidos a Pagar', tipo: 'PASIVO', nivel: 4, esImputable: true, padreCodigo: '2.1.1' },

  // 2.1.2 Deudas Fiscales
  { codigo: '2.1.2', nombre: 'Deudas Fiscales', tipo: 'PASIVO', nivel: 3, esImputable: false, padreCodigo: '2.1' },
  { codigo: '2.1.2.01', nombre: 'IVA Débito Fiscal 21%', tipo: 'PASIVO', nivel: 4, esImputable: true, padreCodigo: '2.1.2' },
  { codigo: '2.1.2.02', nombre: 'IVA Débito Fiscal 10.5%', tipo: 'PASIVO', nivel: 4, esImputable: true, padreCodigo: '2.1.2' },
  { codigo: '2.1.2.03', nombre: 'IVA Débito Fiscal 27%', tipo: 'PASIVO', nivel: 4, esImputable: true, padreCodigo: '2.1.2' },
  { codigo: '2.1.2.04', nombre: 'Retenciones a Depositar', tipo: 'PASIVO', nivel: 4, esImputable: true, padreCodigo: '2.1.2' },

  // 2.1.3 Deudas Sociales
  { codigo: '2.1.3', nombre: 'Deudas Sociales', tipo: 'PASIVO', nivel: 3, esImputable: false, padreCodigo: '2.1' },
  { codigo: '2.1.3.01', nombre: 'Sueldos a Pagar', tipo: 'PASIVO', nivel: 4, esImputable: true, padreCodigo: '2.1.3' },
  { codigo: '2.1.3.02', nombre: 'Cargas Sociales a Pagar', tipo: 'PASIVO', nivel: 4, esImputable: true, padreCodigo: '2.1.3' },

  // ============================================================================
  // PATRIMONIO NETO
  // ============================================================================
  { codigo: '3', nombre: 'PATRIMONIO NETO', tipo: 'PATRIMONIO', nivel: 1, esImputable: false },
  { codigo: '3.1', nombre: 'Capital', tipo: 'PATRIMONIO', nivel: 2, esImputable: false, padreCodigo: '3' },
  { codigo: '3.1.01', nombre: 'Capital Social', tipo: 'PATRIMONIO', nivel: 3, esImputable: true, padreCodigo: '3.1' },
  { codigo: '3.2', nombre: 'Resultados', tipo: 'PATRIMONIO', nivel: 2, esImputable: false, padreCodigo: '3' },
  { codigo: '3.2.01', nombre: 'Resultados Acumulados', tipo: 'PATRIMONIO', nivel: 3, esImputable: true, padreCodigo: '3.2' },
  { codigo: '3.2.02', nombre: 'Resultado del Ejercicio', tipo: 'PATRIMONIO', nivel: 3, esImputable: true, padreCodigo: '3.2' },

  // ============================================================================
  // INGRESOS (Resultados Positivos)
  // ============================================================================
  { codigo: '4', nombre: 'INGRESOS', tipo: 'INGRESO', nivel: 1, esImputable: false },

  { codigo: '4.1', nombre: 'Ingresos por Cuotas', tipo: 'INGRESO', nivel: 2, esImputable: false, padreCodigo: '4' },
  { codigo: '4.1.01', nombre: 'Cuota Social', tipo: 'INGRESO', nivel: 3, esImputable: true, padreCodigo: '4.1' },
  { codigo: '4.1.02', nombre: 'Cuota Deportiva', tipo: 'INGRESO', nivel: 3, esImputable: true, padreCodigo: '4.1' },

  { codigo: '4.2', nombre: 'Ingresos por Ventas', tipo: 'INGRESO', nivel: 2, esImputable: false, padreCodigo: '4' },
  { codigo: '4.2.01', nombre: 'Ventas de Mercadería', tipo: 'INGRESO', nivel: 3, esImputable: true, padreCodigo: '4.2' },
  { codigo: '4.2.02', nombre: 'Ventas de Indumentaria', tipo: 'INGRESO', nivel: 3, esImputable: true, padreCodigo: '4.2' },

  { codigo: '4.3', nombre: 'Otros Ingresos', tipo: 'INGRESO', nivel: 2, esImputable: false, padreCodigo: '4' },
  { codigo: '4.3.01', nombre: 'Eventos', tipo: 'INGRESO', nivel: 3, esImputable: true, padreCodigo: '4.3' },
  { codigo: '4.3.02', nombre: 'Alquiler Instalaciones', tipo: 'INGRESO', nivel: 3, esImputable: true, padreCodigo: '4.3' },
  { codigo: '4.3.99', nombre: 'Otros Ingresos', tipo: 'INGRESO', nivel: 3, esImputable: true, padreCodigo: '4.3' },

  // ============================================================================
  // EGRESOS (Resultados Negativos)
  // ============================================================================
  { codigo: '5', nombre: 'EGRESOS', tipo: 'EGRESO', nivel: 1, esImputable: false },

  { codigo: '5.1', nombre: 'Costo de Mercadería Vendida', tipo: 'EGRESO', nivel: 2, esImputable: false, padreCodigo: '5' },
  { codigo: '5.1.01', nombre: 'CMV Mercadería', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.1' },
  { codigo: '5.1.02', nombre: 'CMV Indumentaria', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.1' },

  { codigo: '5.2', nombre: 'Gastos de Personal', tipo: 'EGRESO', nivel: 2, esImputable: false, padreCodigo: '5' },
  { codigo: '5.2.01', nombre: 'Sueldos', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.2' },
  { codigo: '5.2.02', nombre: 'Cargas Sociales', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.2' },
  { codigo: '5.2.03', nombre: 'Honorarios', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.2' },

  { codigo: '5.3', nombre: 'Gastos Operativos', tipo: 'EGRESO', nivel: 2, esImputable: false, padreCodigo: '5' },
  { codigo: '5.3.01', nombre: 'Servicios (Luz, Gas, Agua)', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.3' },
  { codigo: '5.3.02', nombre: 'Mantenimiento', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.3' },
  { codigo: '5.3.03', nombre: 'Limpieza', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.3' },
  { codigo: '5.3.04', nombre: 'Seguros', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.3' },
  { codigo: '5.3.05', nombre: 'Impuestos y Tasas', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.3' },

  { codigo: '5.4', nombre: 'Gastos Deportivos', tipo: 'EGRESO', nivel: 2, esImputable: false, padreCodigo: '5' },
  { codigo: '5.4.01', nombre: 'Equipamiento', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.4' },
  { codigo: '5.4.02', nombre: 'Indumentaria Deportiva', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.4' },
  { codigo: '5.4.03', nombre: 'Traslados', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.4' },
  { codigo: '5.4.04', nombre: 'Arbitrajes', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.4' },

  { codigo: '5.5', nombre: 'Gastos Administrativos', tipo: 'EGRESO', nivel: 2, esImputable: false, padreCodigo: '5' },
  { codigo: '5.5.01', nombre: 'Papelería y Útiles', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.5' },
  { codigo: '5.5.02', nombre: 'Gastos Bancarios', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.5' },
  { codigo: '5.5.03', nombre: 'Comisiones Tarjetas', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.5' },

  { codigo: '5.9', nombre: 'Otros Egresos', tipo: 'EGRESO', nivel: 2, esImputable: false, padreCodigo: '5' },
  { codigo: '5.9.99', nombre: 'Gastos Varios', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.9' },
];

const configuracionDebito = [
  {
    codigo: 'PRISMA',
    nombre: 'Prisma Medios de Pago',
    tipo: 'PROCESADOR',
    plataforma: 'PRISMA',
    formatoArchivo: 'TXT',
  },
  {
    codigo: 'PAYWAY',
    nombre: 'Payway',
    tipo: 'PROCESADOR',
    plataforma: 'PAYWAY',
    formatoArchivo: 'CSV',
  },
];

const configuracion = [
  // General
  { clave: 'CLUB_NOMBRE', valor: 'Club Sportivo Pilar', tipo: 'STRING', modulo: 'GENERAL', descripcion: 'Nombre del club' },
  { clave: 'CLUB_NOMBRE_CORTO', valor: 'CSP', tipo: 'STRING', modulo: 'GENERAL', descripcion: 'Siglas del club' },
  { clave: 'CLUB_SLOGAN', valor: 'El Rojo de la Avenida', tipo: 'STRING', modulo: 'GENERAL', descripcion: 'Slogan del club' },
  { clave: 'CLUB_CUIT', valor: '', tipo: 'STRING', modulo: 'GENERAL', descripcion: 'CUIT del club' },
  { clave: 'CLUB_DIRECCION', valor: '', tipo: 'STRING', modulo: 'GENERAL', descripcion: 'Dirección física' },
  { clave: 'CLUB_TELEFONO', valor: '', tipo: 'STRING', modulo: 'GENERAL', descripcion: 'Teléfono de contacto' },
  { clave: 'CLUB_EMAIL', valor: 'info@clubsportivopilar.com', tipo: 'STRING', modulo: 'GENERAL', descripcion: 'Email de contacto' },
  { clave: 'CLUB_WHATSAPP', valor: '', tipo: 'STRING', modulo: 'GENERAL', descripcion: 'WhatsApp' },

  // Branding
  { clave: 'COLOR_PRIMARIO', valor: '#DC2626', tipo: 'STRING', modulo: 'BRANDING', descripcion: 'Color primario' },
  { clave: 'COLOR_PRIMARIO_HOVER', valor: '#B91C1C', tipo: 'STRING', modulo: 'BRANDING', descripcion: 'Color primario hover' },
  { clave: 'COLOR_SECUNDARIO', valor: '#1F2937', tipo: 'STRING', modulo: 'BRANDING', descripcion: 'Color secundario' },
  { clave: 'COLOR_FONDO', valor: '#F9FAFB', tipo: 'STRING', modulo: 'BRANDING', descripcion: 'Color de fondo' },
  { clave: 'CLUB_LOGO_URL', valor: '/images/logo.png', tipo: 'IMAGE', modulo: 'BRANDING', descripcion: 'Logo principal' },

  // Redes Sociales
  { clave: 'SOCIAL_FACEBOOK', valor: '', tipo: 'STRING', modulo: 'BRANDING', descripcion: 'URL de Facebook' },
  { clave: 'SOCIAL_INSTAGRAM', valor: '', tipo: 'STRING', modulo: 'BRANDING', descripcion: 'URL de Instagram' },
  { clave: 'SOCIAL_TWITTER', valor: '', tipo: 'STRING', modulo: 'BRANDING', descripcion: 'URL de Twitter/X' },

  // Cuotas
  { clave: 'CUOTA_SOCIAL_INDIVIDUAL', valor: '15000', tipo: 'NUMBER', modulo: 'CUOTAS', descripcion: 'Monto cuota social individual' },
  { clave: 'CUOTA_SOCIAL_FAMILIAR', valor: '20000', tipo: 'NUMBER', modulo: 'CUOTAS', descripcion: 'Monto cuota social familiar' },
  { clave: 'CUOTA_DIA_VENCIMIENTO', valor: '10', tipo: 'NUMBER', modulo: 'CUOTAS', descripcion: 'Día de vencimiento de cuotas' },
  { clave: 'CUOTA_VENCE_MISMO_MES', valor: 'false', tipo: 'BOOLEAN', modulo: 'CUOTAS', descripcion: 'Si las cuotas vencen en el mismo mes del periodo (true) o en el siguiente (false)' },

  // Tesorería
  { clave: 'CONCEPTO_COBRANZA_CUOTAS', valor: '', tipo: 'NUMBER', modulo: 'TESORERIA', descripcion: 'ID del concepto de tesorería para cobranza de cuotas' },
  { clave: 'CONCEPTO_MORA', valor: '', tipo: 'NUMBER', modulo: 'TESORERIA', descripcion: 'ID del concepto de tesorería para ingresos por mora' },

  // Pagos Online
  { clave: 'PAGOS_MP_HABILITADO', valor: 'false', tipo: 'BOOLEAN', modulo: 'PORTAL', descripcion: 'MercadoPago habilitado' },
  { clave: 'PAGOS_MODO_HABILITADO', valor: 'false', tipo: 'BOOLEAN', modulo: 'PORTAL', descripcion: 'MODO habilitado' },

  // RojoPlus (comercios)
  { clave: 'DESCUENTO_DEFAULT', valor: '10', tipo: 'NUMBER', modulo: 'COMERCIOS', descripcion: 'Descuento sugerido para nuevos comercios' },
  { clave: 'SLOGAN_APP', valor: 'Rojo Plus convierte la pasión en consumo', tipo: 'STRING', modulo: 'COMERCIOS', descripcion: 'Slogan de RojoPlus' },

  // Buffet
  { clave: 'BUFFET_DESCUENTO_SOCIO', valor: '10', tipo: 'NUMBER', modulo: 'BUFFET', descripcion: 'Porcentaje de descuento para socios al día en el buffet' },

  // Modo Demo
  { clave: 'MODO_DEMO', valor: 'false', tipo: 'BOOLEAN', modulo: 'SISTEMA', descripcion: 'Modo demo activo' },
  { clave: 'EMAIL_DEMO', valor: '', tipo: 'STRING', modulo: 'SISTEMA', descripcion: 'Email para recibir notificaciones en modo demo' },
];

const formatosExtracto = [
  {
    nombre: 'OFX Estándar',
    banco: null,
    tipoArchivo: 'OFX',
    descripcion: 'Formato OFX/QFX estándar bancario. Soportado por la mayoría de los bancos.',
    configuracion: { version: '2.0' }
  },
  {
    nombre: 'Banco Galicia CSV',
    banco: 'Banco Galicia',
    tipoArchivo: 'CSV',
    descripcion: 'Formato CSV exportado desde homebanking Galicia',
    configuracion: {
      delimitador: ';',
      primeraFila: 1,
      formatoFecha: 'DD/MM/YYYY',
      columnas: { fecha: 0, concepto: 1, referencia: 2, debito: 3, credito: 4, saldo: 5 }
    }
  },
  {
    nombre: 'Banco Santander CSV',
    banco: 'Banco Santander',
    tipoArchivo: 'CSV',
    descripcion: 'Formato CSV exportado desde homebanking Santander',
    configuracion: {
      delimitador: ';',
      primeraFila: 1,
      formatoFecha: 'DD/MM/YYYY',
      columnas: { fecha: 0, descripcion: 1, concepto: 2, importe: 3, saldo: 4 }
    }
  },
  {
    nombre: 'Banco Nación CSV',
    banco: 'Banco Nación',
    tipoArchivo: 'CSV',
    descripcion: 'Formato CSV exportado desde homebanking BNA',
    configuracion: {
      delimitador: ',',
      primeraFila: 1,
      formatoFecha: 'DD/MM/YYYY',
      columnas: { fecha: 0, concepto: 1, debito: 2, credito: 3, saldo: 4 }
    }
  },
  {
    nombre: 'Genérico CSV',
    banco: null,
    tipoArchivo: 'CSV',
    descripcion: 'Formato CSV genérico configurable. Ajuste las columnas según su archivo.',
    configuracion: {
      delimitador: ';',
      primeraFila: 1,
      formatoFecha: 'DD/MM/YYYY',
      columnas: { fecha: 0, concepto: 1, importe: 2, saldo: 3 }
    }
  }
];

// ============================================================================
// FUNCIONES DE SEED
// ============================================================================

async function main() {
  console.log('🌱 Iniciando seed...\n');

  // Rubros
  console.log('📁 Creando rubros...');
  for (const rubro of rubros) {
    await prisma.rubro.upsert({
      where: { id: rubro.orden },
      update: rubro,
      create: rubro,
    });
  }
  console.log(`   ✓ ${rubros.length} rubros creados`);

  // Descuentos Disponibles
  console.log('💰 Creando descuentos disponibles...');
  for (const descuento of descuentosDisponibles) {
    await prisma.descuentoDisponible.upsert({
      where: { id: descuento.orden },
      update: descuento,
      create: descuento,
    });
  }
  console.log(`   ✓ ${descuentosDisponibles.length} descuentos disponibles creados`);

  // Tipos de Cuota (comentado - modelo no existe aún)
  // console.log('💰 Creando tipos de cuota...');
  // for (const tipo of tiposCuota) {
  //   await prisma.tipoCuota.upsert({
  //     where: { codigo: tipo.codigo },
  //     update: tipo,
  //     create: tipo,
  //   });
  // }
  // console.log(`   ✓ ${tiposCuota.length} tipos de cuota creados`);

  // Medios de Pago
  console.log('💳 Creando medios de pago...');
  for (const medio of mediosPago) {
    await prisma.medioPago.upsert({
      where: { codigo: medio.codigo },
      update: medio,
      create: medio,
    });
  }
  console.log(`   ✓ ${mediosPago.length} medios de pago creados`);

  // Deportes (comentado - ahora se llama Actividad)
  // console.log('⚽ Creando deportes...');
  // for (const deporte of deportes) {
  //   await prisma.deporte.upsert({
  //     where: { codigo: deporte.codigo },
  //     update: deporte,
  //     create: deporte,
  //   });
  // }
  // console.log(`   ✓ ${deportes.length} deportes creados`);

  // Conceptos de Tesorería
  console.log('💰 Creando conceptos de tesorería...');
  for (const concepto of conceptosTesoreria) {
    await prisma.conceptoTesoreria.upsert({
      where: { codigo: concepto.codigo },
      update: concepto,
      create: concepto,
    });
  }
  console.log(`   ✓ ${conceptosTesoreria.length} conceptos de tesorería creados`);

  // Obtener el ID del concepto de cobranza de cuotas para guardarlo en configuración
  const conceptoCobranzaCuotas = await prisma.conceptoTesoreria.findUnique({
    where: { codigo: 'COB-CUO' }
  });

  if (conceptoCobranzaCuotas) {
    // Actualizar la configuración con el ID del concepto
    const configIndex = configuracion.findIndex(c => c.clave === 'CONCEPTO_COBRANZA_CUOTAS');
    if (configIndex !== -1) {
      configuracion[configIndex].valor = String(conceptoCobranzaCuotas.id);
    }
  }

  // Obtener el ID del concepto de mora para guardarlo en configuración
  const conceptoMora = await prisma.conceptoTesoreria.findUnique({
    where: { codigo: 'ING-MORA' }
  });

  if (conceptoMora) {
    // Actualizar la configuración con el ID del concepto
    const configIndex = configuracion.findIndex(c => c.clave === 'CONCEPTO_MORA');
    if (configIndex !== -1) {
      configuracion[configIndex].valor = String(conceptoMora.id);
    }
  }

  // Tipos de Socio
  console.log('👤 Creando tipos de socio...');
  for (const tipo of tiposSocio) {
    await prisma.tipoSocio.upsert({
      where: { codigo: tipo.codigo },
      update: {
        ...tipo,
        conceptoTesoreriaId: conceptoCobranzaCuotas?.id,
        conceptoMoraId: conceptoMora?.id
      },
      create: {
        ...tipo,
        conceptoTesoreriaId: conceptoCobranzaCuotas?.id,
        conceptoMoraId: conceptoMora?.id
      },
    });
  }
  console.log(`   ✓ ${tiposSocio.length} tipos de socio creados`);

  // Categorías de Socio
  console.log('🏷️  Creando categorías de socio...');
  for (const categoria of categoriasSocio) {
    await prisma.categoriaSocio.upsert({
      where: { codigo: categoria.codigo },
      update: categoria,
      create: categoria,
    });
  }
  console.log(`   ✓ ${categoriasSocio.length} categorías de socio creadas`);

  // Estados de Socio
  console.log('📊 Creando estados de socio...');
  for (const estado of estadosSocio) {
    await prisma.estadoSocio.upsert({
      where: { codigo: estado.codigo },
      update: estado,
      create: estado,
    });
  }
  console.log(`   ✓ ${estadosSocio.length} estados de socio creados`);

  // Roles
  console.log('👥 Creando roles...');
  for (const rol of roles) {
    await prisma.rol.upsert({
      where: { codigo: rol.codigo },
      update: rol,
      create: rol,
    });
  }
  console.log(`   ✓ ${roles.length} roles creados`);

  // Permisos
  console.log('🔐 Creando permisos...');
  for (const permiso of permisos) {
    await prisma.permiso.upsert({
      where: { codigo: permiso.codigo },
      update: permiso,
      create: permiso,
    });
  }
  console.log(`   ✓ ${permisos.length} permisos creados`);

  // Asignar todos los permisos al rol SUPER_ADMIN
  console.log('🔗 Asignando permisos a Super Admin...');
  const superAdminRol = await prisma.rol.findUnique({ where: { codigo: 'SUPER_ADMIN' } });
  const todosPermisos = await prisma.permiso.findMany();
  for (const permiso of todosPermisos) {
    await prisma.permisoRol.upsert({
      where: { rolId_permisoId: { rolId: superAdminRol.id, permisoId: permiso.id } },
      update: {},
      create: { rolId: superAdminRol.id, permisoId: permiso.id },
    });
  }
  console.log(`   ✓ ${todosPermisos.length} permisos asignados a Super Admin`);

  // Cuentas Contables
  console.log('📊 Creando plan de cuentas...');
  // Primero las cuentas raíz (sin padre)
  for (const cuenta of cuentasContables.filter(c => !c.padreCodigo)) {
    await prisma.cuentaContable.upsert({
      where: { codigo: cuenta.codigo },
      update: { nombre: cuenta.nombre, tipo: cuenta.tipo, nivel: cuenta.nivel, esImputable: cuenta.esImputable },
      create: { codigo: cuenta.codigo, nombre: cuenta.nombre, tipo: cuenta.tipo, nivel: cuenta.nivel, esImputable: cuenta.esImputable },
    });
  }
  // Luego las que tienen padre
  for (const cuenta of cuentasContables.filter(c => c.padreCodigo)) {
    const padre = await prisma.cuentaContable.findUnique({ where: { codigo: cuenta.padreCodigo } });
    await prisma.cuentaContable.upsert({
      where: { codigo: cuenta.codigo },
      update: { nombre: cuenta.nombre, tipo: cuenta.tipo, nivel: cuenta.nivel, esImputable: cuenta.esImputable, padreId: padre?.id },
      create: { codigo: cuenta.codigo, nombre: cuenta.nombre, tipo: cuenta.tipo, nivel: cuenta.nivel, esImputable: cuenta.esImputable, padreId: padre?.id },
    });
  }
  console.log(`   ✓ ${cuentasContables.length} cuentas contables creadas`);

  // Centros de Costo
  console.log('🎯 Creando centros de costo...');
  for (const centro of centrosCosto) {
    await prisma.centroCosto.upsert({
      where: { codigo: centro.codigo },
      update: centro,
      create: centro,
    });
  }
  console.log(`   ✓ ${centrosCosto.length} centros de costo creados`);

  // Configuración de Débito
  console.log('🏦 Creando configuración de débito...');
  for (const config of configuracionDebito) {
    await prisma.configuracionDebito.upsert({
      where: { codigo: config.codigo },
      update: config,
      create: config,
    });
  }
  console.log(`   ✓ ${configuracionDebito.length} configuraciones de débito creadas`);

  // Configuración General
  console.log('⚙️  Creando configuración general...');
  for (const config of configuracion) {
    await prisma.configuracion.upsert({
      where: { clave: config.clave },
      update: { valor: config.valor, tipo: config.tipo, descripcion: config.descripcion, modulo: config.modulo },
      create: config,
    });
  }
  console.log(`   ✓ ${configuracion.length} configuraciones creadas`);

  // Admin inicial con rol Super Admin
  console.log('👤 Creando admin inicial...');
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.admin.upsert({
    where: { email: 'admin@rojoplus.com' },
    update: { rolId: superAdminRol.id },
    create: {
      email: 'admin@rojoplus.com',
      passwordHash: passwordHash,
      nombre: 'Administrador',
      apellido: 'Sistema',
      activo: true,
      rolId: superAdminRol.id,
    },
  });
  console.log('   ✓ Admin creado: admin@rojoplus.com / admin123');

  // Caja principal
  console.log('💵 Creando caja principal...');
  await prisma.caja.upsert({
    where: { codigo: 'CAJA-PRINCIPAL' },
    update: {},
    create: {
      codigo: 'CAJA-PRINCIPAL',
      nombre: 'Caja Principal',
      tipo: 'EFECTIVO',
      descripcion: 'Caja de efectivo principal del club',
      saldoInicial: 0,
      saldoActual: 0,
    },
  });
  console.log('   ✓ Caja principal creada');

  // Formatos de extracto bancario
  console.log('\n📄 Creando formatos de extracto...');
  for (const formato of formatosExtracto) {
    await prisma.formatoExtracto.upsert({
      where: { nombre: formato.nombre },
      update: formato,
      create: formato,
    });
  }
  console.log(`   ✓ ${formatosExtracto.length} formatos de extracto creados`);

  console.log('\n✅ Seed completado exitosamente!');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
