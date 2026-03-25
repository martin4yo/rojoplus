-- ============================================================
-- Migración Multi-Tenant: Crear tenant sportivopilar
-- y asignar tenant_id a todas las tablas existentes
-- ============================================================

BEGIN;

-- 1. Crear tabla tenants si no existe
CREATE TABLE IF NOT EXISTS tenants (
  id                  SERIAL PRIMARY KEY,
  nombre              VARCHAR NOT NULL,
  subdomain           VARCHAR NOT NULL UNIQUE,
  slug                VARCHAR NOT NULL UNIQUE,
  email               VARCHAR,
  telefono            VARCHAR,
  direccion           VARCHAR,
  ciudad              VARCHAR,
  provincia           VARCHAR,
  codigo_postal       VARCHAR,
  logo_url            VARCHAR,
  favicon_url         VARCHAR,
  colores             JSONB NOT NULL DEFAULT '{}',
  descripcion         TEXT,
  slogan              VARCHAR,
  horarios            TEXT,
  redes_sociales      JSONB NOT NULL DEFAULT '{}',
  timezone            VARCHAR NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  moneda              VARCHAR NOT NULL DEFAULT 'ARS',
  plan                VARCHAR NOT NULL DEFAULT 'STANDARD',
  max_socios          INT,
  max_admins          INT,
  max_storage_mb      INT,
  estado              VARCHAR NOT NULL DEFAULT 'ACTIVE',
  activo              BOOLEAN NOT NULL DEFAULT true,
  fecha_aprobacion    TIMESTAMP,
  fecha_suspension    TIMESTAMP,
  motivo_suspension   TEXT,
  razon_social        VARCHAR,
  cuit                VARCHAR,
  condicion_iva       VARCHAR,
  creado_por          INT,
  aprobado_por        INT,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tenants_subdomain_idx ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS tenants_estado_idx ON tenants(estado);
CREATE INDEX IF NOT EXISTS tenants_activo_idx ON tenants(activo);

-- 2. Crear tabla tenant_usuarios si no existe
CREATE TABLE IF NOT EXISTS tenant_usuarios (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  admin_id    INT NOT NULL,
  rol         VARCHAR NOT NULL DEFAULT 'ADMIN',
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, admin_id)
);

CREATE INDEX IF NOT EXISTS tenant_usuarios_tenant_id_idx ON tenant_usuarios(tenant_id);
CREATE INDEX IF NOT EXISTS tenant_usuarios_admin_id_idx ON tenant_usuarios(admin_id);

-- 3. Crear tabla tenant_configuracion si no existe
CREATE TABLE IF NOT EXISTS tenant_configuracion (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  clave       VARCHAR NOT NULL,
  valor       TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, clave)
);

CREATE INDEX IF NOT EXISTS tenant_configuracion_tenant_id_idx ON tenant_configuracion(tenant_id);

-- 4. Insertar el tenant principal (sportivopilar)
INSERT INTO tenants (nombre, subdomain, slug, estado, activo, plan, fecha_aprobacion)
VALUES ('Club Sportivo Pilar', 'sportivopilar', 'sportivopilar', 'ACTIVE', true, 'STANDARD', NOW())
ON CONFLICT (slug) DO NOTHING;

-- 5. Agregar tenant_id a todas las tablas (con check de existencia de tabla y columna)
DO $$
DECLARE
  v_tenant_id INT;
  t TEXT;
  tables TEXT[] := ARRAY[
    'acciones_cobranza','acciones_recupero','aceptaciones_reglamento','actividades',
    'adjuntos_comprobantes','aplicaciones_saldo','archivos_debito','articulos_reglamento',
    'asiento_lineas','asientos','asistencias','audit_log','autoridades','autorizaciones_menores',
    'banners','cajas','campanas_recupero','cargos','cargos_personal','categorias_actividad',
    'categorias_entrada','categorias_menu','categorias_producto','categorias_socio',
    'centros_costo','cierres_caja','cobradores','comandas','comercios',
    'comprobantes_electronicos','conceptos_liquidacion','conceptos_tesoreria','conciliaciones',
    'configuracion','configuracion_debito','configuracion_fiscal','configuracion_recargos',
    'conversaciones','convocatorias','cuentas_bancarias','cuentas_contables',
    'descuentos_disponibles','destinos_impresion','detalles_cobranza','detalles_debito',
    'dispositivos_acceso','documentos_socio','echeqs','email_templates','encuestas_baja',
    'entidades','entradas','entrenadores','entrenadores_categorias','entrenamientos',
    'envios_campana','espacios_deportivos','estadisticas_partidos','estados_socio','eventos',
    'extractos_bancarios','familiares_solicitud','formatos_extracto','gestiones_cobranza',
    'grupos_opcion_producto','habilitaciones_temporales','horarios_disponibilidad',
    'horarios_recurrentes','importaciones_cobranza','impresoras_termicas','ingresos_entradas',
    'inscripciones','intentos_acceso_denegado','items_comanda','items_liquidacion',
    'items_movimiento','items_orden_compra','items_pedido','items_pedido_takeaway',
    'lineas_presupuesto','links_pago','liquidaciones_sueldo','medios_pago','mensajes',
    'mensajes_entrenador','mesas','movimientos_caja','movimientos_contables',
    'movimientos_extracto','movimientos_stock','noticias','noticias_deportivas',
    'notificaciones_buffet','notificaciones_log','notificaciones_vistas',
    'opciones_item_comanda','opciones_item_takeaway','opciones_producto','ordenes_compra',
    'pagos','pagos_informados','partidos','pdf_templates','pedidos','pedidos_takeaway',
    'periodos','presupuestos','producto_fotos','producto_variantes','productos',
    'productos_buffet','push_subscriptions','registros_acceso','saldos_favor',
    'sectores_buffet','socios','solicitudes_socio','sponsors','staff_tecnico',
    'tipos_espacio','tipos_socio','transferencias_caja','ventas'
  ];
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'sportivopilar';
  RAISE NOTICE 'Usando tenant_id = %', v_tenant_id;

  FOREACH t IN ARRAY tables LOOP
    -- Verificar que la tabla exista
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      -- Agregar columna si no existe
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'tenant_id') THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN tenant_id INT', t);
        RAISE NOTICE 'Columna tenant_id agregada a %', t;
      END IF;
      -- Poblar filas sin tenant_id
      EXECUTE format('UPDATE %I SET tenant_id = $1 WHERE tenant_id IS NULL', t) USING v_tenant_id;
      -- Hacer NOT NULL si aún es nullable
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'tenant_id' AND is_nullable = 'YES') THEN
        EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id SET NOT NULL', t);
        RAISE NOTICE 'NOT NULL aplicado en %.tenant_id', t;
      END IF;
    ELSE
      RAISE NOTICE 'Tabla % no existe, omitida', t;
    END IF;
  END LOOP;

  RAISE NOTICE 'Migración completada con tenant_id = %', v_tenant_id;
END $$;

COMMIT;

SELECT 'Migración completada exitosamente' AS resultado,
       id, nombre, slug, subdomain, activo
FROM tenants WHERE slug = 'sportivopilar';
