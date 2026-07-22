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
    "primario": "#7C5CA6",
    "primarioOscuro": "#241141",
    "primarioClaro": "#A78BC9",
    "secundario": "#241141",
    "secundarioOscuro": "#0F0A1E",
    "secundarioClaro": "#3A2260",
    "acento": "#F8D820",
    "exito": "#10B981",
    "advertencia": "#F59E0B",
    "error": "#EF4444",
    "info": "#3B9FF3",
    "fondoPrincipal": "#F7F5FB",
    "fondoSecundario": "#EFEAF6",
    "textoPrincipal": "#241436",
    "textoSecundario": "#574A66",
    "borde": "#E3DCF0",
    "fondoSitio": "#0F0A1E",
    "textoSitio": "#FFFFFF"
  }',
  'America/Argentina/Buenos_Aires',
  'ARS',
  NOW()
)
ON CONFLICT (slug) DO NOTHING
RETURNING id, nombre, slug, activo;
