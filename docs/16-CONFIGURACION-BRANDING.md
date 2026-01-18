# Configuración y Branding

## Descripción

El sistema permite personalizar completamente la apariencia y datos del club desde el panel de administración.

---

## Elementos Configurables

### Identidad del Club

| Clave | Tipo | Descripción |
|-------|------|-------------|
| CLUB_NOMBRE | STRING | Nombre completo del club |
| CLUB_NOMBRE_CORTO | STRING | Nombre corto/siglas |
| CLUB_SLOGAN | STRING | Lema o slogan |
| CLUB_FUNDACION | STRING | Año de fundación |
| CLUB_CUIT | STRING | CUIT del club |

### Logo e Imágenes

| Clave | Tipo | Descripción |
|-------|------|-------------|
| CLUB_LOGO_URL | IMAGE | Logo principal (PNG/SVG) |
| CLUB_LOGO_BLANCO_URL | IMAGE | Logo versión blanca |
| CLUB_FAVICON_URL | IMAGE | Favicon para navegador |
| CLUB_FONDO_LOGIN_URL | IMAGE | Fondo para pantalla de login |

### Colores

| Clave | Tipo | Descripción |
|-------|------|-------------|
| COLOR_PRIMARIO | STRING | Color principal (#DC2626) |
| COLOR_PRIMARIO_HOVER | STRING | Color al hover (#B91C1C) |
| COLOR_SECUNDARIO | STRING | Color secundario |
| COLOR_ACENTO | STRING | Color de acento |
| COLOR_FONDO | STRING | Color de fondo (#F9FAFB) |
| COLOR_TEXTO | STRING | Color de texto principal |

### Contacto

| Clave | Tipo | Descripción |
|-------|------|-------------|
| CLUB_DIRECCION | STRING | Dirección física |
| CLUB_TELEFONO | STRING | Teléfono principal |
| CLUB_EMAIL | STRING | Email de contacto |
| CLUB_WHATSAPP | STRING | WhatsApp para consultas |
| CLUB_WEB | STRING | Sitio web oficial |

### Redes Sociales

| Clave | Tipo | Descripción |
|-------|------|-------------|
| SOCIAL_FACEBOOK | STRING | URL de Facebook |
| SOCIAL_INSTAGRAM | STRING | URL de Instagram |
| SOCIAL_TWITTER | STRING | URL de Twitter/X |
| SOCIAL_YOUTUBE | STRING | URL de YouTube |

---

## Estructura de Configuracion

El modelo `Configuracion` en la base de datos:

```prisma
model Configuracion {
  clave       String   @id
  valor       String   @db.Text
  tipo        String   @default("STRING") // STRING, NUMBER, BOOLEAN, JSON, IMAGE
  descripcion String?
  modulo      String?  // GENERAL, BRANDING, CUOTAS, CAJA, PORTAL, DEBITO
  editable    Boolean  @default(true)
  updatedAt   DateTime @updatedAt
}
```

### Tipos de Valor

- **STRING**: Texto simple
- **NUMBER**: Número (se parsea a int/float)
- **BOOLEAN**: true/false
- **JSON**: Objeto JSON (se parsea)
- **IMAGE**: URL de imagen (con upload handler)

---

## Interfaz de Administración

### Pantalla de Configuración

```
┌────────────────────────────────────────────────────────┐
│  CONFIGURACIÓN DEL SISTEMA                            │
├────────────────────────────────────────────────────────┤
│                                                        │
│  📌 IDENTIDAD DEL CLUB                                │
│  ┌────────────────────────────────────────────────┐   │
│  │ Nombre del Club: [Club Sportivo Pilar        ]│   │
│  │ Nombre Corto:    [CSP                         ]│   │
│  │ Slogan:          [El Rojo de la Avenida      ]│   │
│  │ Año Fundación:   [1920                        ]│   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  🎨 BRANDING                                          │
│  ┌────────────────────────────────────────────────┐   │
│  │ Logo Principal:  [📤 Subir]  [Preview]        │   │
│  │ Logo Blanco:     [📤 Subir]  [Preview]        │   │
│  │ Favicon:         [📤 Subir]  [Preview]        │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  🎨 COLORES                                           │
│  ┌────────────────────────────────────────────────┐   │
│  │ Primario:        [█ #DC2626] ← Color picker   │   │
│  │ Primario Hover:  [█ #B91C1C]                  │   │
│  │ Secundario:      [█ #1F2937]                  │   │
│  │ Fondo:           [█ #F9FAFB]                  │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  📞 CONTACTO                                          │
│  ┌────────────────────────────────────────────────┐   │
│  │ Dirección:       [Av. Principal 1234, Pilar  ]│   │
│  │ Teléfono:        [0230-4123456               ]│   │
│  │ Email:           [info@clubsportivo.com      ]│   │
│  │ WhatsApp:        [+5491112345678             ]│   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│                              [Cancelar] [💾 Guardar]  │
└────────────────────────────────────────────────────────┘
```

---

## Implementación de Colores

### CSS Variables

```css
:root {
  --color-primary: #DC2626;
  --color-primary-hover: #B91C1C;
  --color-secondary: #1F2937;
  --color-accent: #F59E0B;
  --color-background: #F9FAFB;
  --color-text: #111827;
}
```

### Tailwind Config Dinámico

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
      }
    }
  }
}
```

### Aplicación en React

```jsx
// ConfigProvider.jsx
const ConfigContext = createContext();

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState({});

  useEffect(() => {
    // Cargar configuración del backend
    fetchConfig().then(data => {
      setConfig(data);
      // Aplicar colores como CSS variables
      document.documentElement.style.setProperty('--color-primary', data.COLOR_PRIMARIO);
      // ... más colores
    });
  }, []);

  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
}
```

---

## Upload de Imágenes

### Endpoint de Upload

```javascript
// POST /api/admin/config/upload
// Content-Type: multipart/form-data

const formData = new FormData();
formData.append('file', logoFile);
formData.append('clave', 'CLUB_LOGO_URL');

const response = await fetch('/api/admin/config/upload', {
  method: 'POST',
  body: formData
});

// Response: { url: '/uploads/logos/club-logo-2026.png' }
```

### Almacenamiento

- **Desarrollo**: `/public/uploads/`
- **Producción**: AWS S3 o similar (configurable)

---

## Seeds Iniciales

```javascript
// prisma/seed.js
const configuracionInicial = [
  // Identidad
  { clave: 'CLUB_NOMBRE', valor: 'Club Sportivo Pilar', tipo: 'STRING', modulo: 'GENERAL' },
  { clave: 'CLUB_NOMBRE_CORTO', valor: 'CSP', tipo: 'STRING', modulo: 'GENERAL' },
  { clave: 'CLUB_SLOGAN', valor: 'El Rojo de la Avenida', tipo: 'STRING', modulo: 'GENERAL' },

  // Colores
  { clave: 'COLOR_PRIMARIO', valor: '#DC2626', tipo: 'STRING', modulo: 'BRANDING' },
  { clave: 'COLOR_PRIMARIO_HOVER', valor: '#B91C1C', tipo: 'STRING', modulo: 'BRANDING' },
  { clave: 'COLOR_FONDO', valor: '#F9FAFB', tipo: 'STRING', modulo: 'BRANDING' },

  // Logos (inicialmente vacíos o con defaults)
  { clave: 'CLUB_LOGO_URL', valor: '/images/logo-default.png', tipo: 'IMAGE', modulo: 'BRANDING' },

  // Contacto
  { clave: 'CLUB_DIRECCION', valor: '', tipo: 'STRING', modulo: 'GENERAL' },
  { clave: 'CLUB_TELEFONO', valor: '', tipo: 'STRING', modulo: 'GENERAL' },
  { clave: 'CLUB_EMAIL', valor: '', tipo: 'STRING', modulo: 'GENERAL' },
];
```

---

## API Endpoints

### Obtener Configuración Pública

```
GET /api/config/public

Response:
{
  "CLUB_NOMBRE": "Club Sportivo Pilar",
  "CLUB_LOGO_URL": "/uploads/logos/logo.png",
  "COLOR_PRIMARIO": "#DC2626",
  ...
}
```

### Obtener Toda la Configuración (Admin)

```
GET /api/admin/config

Response: [
  { clave: "CLUB_NOMBRE", valor: "...", tipo: "STRING", modulo: "GENERAL" },
  ...
]
```

### Actualizar Configuración

```
PUT /api/admin/config/:clave

Body: { valor: "nuevo valor" }
```

### Actualizar Múltiples

```
PUT /api/admin/config/batch

Body: [
  { clave: "CLUB_NOMBRE", valor: "..." },
  { clave: "COLOR_PRIMARIO", valor: "#..." }
]
```
