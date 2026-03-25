INSERT INTO tenants (
  nombre, subdomain, slug, estado, activo, plan,
  fecha_aprobacion, descripcion, slogan, colores,
  timezone, moneda, updated_at
) VALUES (
  'Clubix Sport',
  'clubix-sport',
  'clubix-sport',
  'ACTIVE',
  true,
  'STANDARD',
  NOW(),
  'Plataforma de gestion deportiva moderna',
  'El futuro del deporte',
  '{
    "primario": "#3B9FF3",
    "primarioOscuro": "#0F1F3D",
    "primarioClaro": "#60B5F7",
    "secundario": "#00D4D4",
    "secundarioOscuro": "#0A9999",
    "secundarioClaro": "#33DDDD",
    "acento": "#22D3EE",
    "exito": "#10B981",
    "advertencia": "#F59E0B",
    "error": "#EF4444",
    "info": "#3B9FF3",
    "fondoPrincipal": "#F9FAFB",
    "fondoSecundario": "#F3F4F6",
    "textoPrincipal": "#111827",
    "textoSecundario": "#4B5563",
    "borde": "#E5E7EB"
  }',
  'America/Argentina/Buenos_Aires',
  'ARS',
  NOW()
)
ON CONFLICT (slug) DO NOTHING
RETURNING id, nombre, slug, activo;
