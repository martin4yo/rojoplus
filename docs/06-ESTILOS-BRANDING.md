# RojoPlus - Estilos y Branding

---

## 1. Identidad Visual

### 1.1 Nombre y Slogan
- **Nombre del sistema**: RojoPlus
- **Club**: Club Sportivo Pilar
- **Slogan**: "El Rojo de la Avenida"

### 1.2 Logo
- **Archivo**: `LogoAxiomaCloud.png`
- **Ubicacion**: `/public/images/logo.png`
- **Uso**: Header de todas las pantallas

---

## 2. Paleta de Colores

### 2.1 Colores Principales

```css
:root {
  /* Rojo principal - Color del club */
  --color-primary: #DC2626;        /* Rojo base */
  --color-primary-dark: #B91C1C;   /* Rojo oscuro (hover) */
  --color-primary-light: #FEE2E2; /* Rojo muy claro (backgrounds) */

  /* Grises */
  --color-gray-50: #F9FAFB;        /* Fondo principal */
  --color-gray-100: #F3F4F6;       /* Fondo secundario */
  --color-gray-200: #E5E7EB;       /* Bordes */
  --color-gray-300: #D1D5DB;       /* Bordes hover */
  --color-gray-400: #9CA3AF;       /* Texto placeholder */
  --color-gray-500: #6B7280;       /* Texto secundario */
  --color-gray-600: #4B5563;       /* Texto normal */
  --color-gray-700: #374151;       /* Texto enfasis */
  --color-gray-800: #1F2937;       /* Texto titulos */
  --color-gray-900: #111827;       /* Texto muy oscuro */

  /* Estados */
  --color-success: #10B981;        /* Verde - exito */
  --color-warning: #F59E0B;        /* Amarillo - advertencia */
  --color-error: #EF4444;          /* Rojo - error */
  --color-info: #3B82F6;           /* Azul - informacion */
}
```

### 2.2 Tailwind Config

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#DC2626',
          dark: '#B91C1C',
          light: '#FEE2E2',
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
        }
      }
    }
  }
}
```

---

## 3. Tipografia

### 3.1 Fuente Principal
- **Familia**: Inter (Google Fonts)
- **Fallback**: system-ui, sans-serif

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### 3.2 Tamanos

| Uso | Tamano | Peso | Clase Tailwind |
|-----|--------|------|----------------|
| Titulo principal | 24px | 700 | text-2xl font-bold |
| Titulo seccion | 20px | 600 | text-xl font-semibold |
| Subtitulo | 18px | 600 | text-lg font-semibold |
| Texto normal | 16px | 400 | text-base |
| Texto pequeno | 14px | 400 | text-sm |
| Etiquetas | 12px | 500 | text-xs font-medium |

---

## 4. Componentes

### 4.1 Botones

**Boton Primario (Rojo)**
```html
<button class="
  bg-primary
  text-white
  px-6 py-3
  rounded-lg
  font-semibold
  hover:bg-primary-dark
  transition-colors
  disabled:opacity-50
  disabled:cursor-not-allowed
">
  REGISTRAR VENTA
</button>
```

**Boton Secundario (Outline)**
```html
<button class="
  border-2 border-primary
  text-primary
  px-6 py-3
  rounded-lg
  font-semibold
  hover:bg-primary
  hover:text-white
  transition-colors
">
  CANCELAR
</button>
```

**Boton Texto**
```html
<button class="
  text-primary
  font-semibold
  hover:text-primary-dark
  hover:underline
">
  Ver mas
</button>
```

### 4.2 Inputs

```html
<div class="mb-4">
  <label class="block text-gray-700 text-sm font-semibold mb-2">
    Numero de socio o DNI
  </label>
  <input
    type="text"
    class="
      w-full
      px-4 py-3
      border border-gray-300
      rounded-lg
      text-gray-800
      placeholder-gray-400
      focus:outline-none
      focus:border-primary
      focus:ring-2
      focus:ring-primary-light
    "
    placeholder="Ingresa el numero..."
  />
</div>
```

### 4.3 Cards

**Card de Socio (Activo)**
```html
<div class="
  bg-green-50
  border border-green-200
  rounded-lg
  p-4
">
  <div class="flex items-center gap-2 mb-2">
    <span class="text-green-600 text-xl">✓</span>
    <span class="text-green-700 font-bold">SOCIO ACTIVO</span>
  </div>
  <p class="text-gray-800 font-semibold">Juan Carlos Perez</p>
  <p class="text-gray-500 text-sm">Socio #12345</p>
</div>
```

**Card de Socio (Inactivo)**
```html
<div class="
  bg-red-50
  border border-red-200
  rounded-lg
  p-4
">
  <div class="flex items-center gap-2 mb-2">
    <span class="text-red-600 text-xl">✗</span>
    <span class="text-red-700 font-bold">SOCIO INACTIVO</span>
  </div>
  <p class="text-gray-800 font-semibold">Juan Carlos Perez</p>
  <p class="text-gray-500 text-sm">Socio #12345</p>
  <p class="text-red-600 text-sm mt-2">No aplica descuento</p>
</div>
```

### 4.4 Card de Descuento

```html
<div class="bg-gray-50 rounded-lg p-4 mt-4">
  <div class="flex justify-between text-gray-600 mb-2">
    <span>Descuento (10%):</span>
    <span>$ 1.000</span>
  </div>
  <div class="border-t border-gray-300 pt-2">
    <div class="flex justify-between text-gray-800 font-bold text-lg">
      <span>TOTAL A COBRAR:</span>
      <span>$ 9.000</span>
    </div>
  </div>
</div>
```

### 4.5 Header

```html
<header class="bg-white shadow-sm border-b border-gray-200">
  <div class="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
    <img src="/images/logo.png" alt="Logo" class="h-10" />
    <span class="text-gray-600 font-medium text-sm">Panaderia Don Juan</span>
  </div>
</header>
```

---

## 5. Layout

### 5.1 Pantalla Comerciante (Mobile-first)

```html
<div class="min-h-screen bg-gray-50">
  <!-- Header -->
  <header class="bg-white shadow-sm border-b border-gray-200">
    ...
  </header>

  <!-- Contenido -->
  <main class="max-w-md mx-auto px-4 py-6">
    <!-- Busqueda -->
    <section class="mb-6">
      ...
    </section>

    <!-- Resultado -->
    <section class="mb-6">
      ...
    </section>

    <!-- Importe y Descuento -->
    <section class="mb-6">
      ...
    </section>

    <!-- Boton -->
    <button class="w-full ...">
      REGISTRAR VENTA
    </button>
  </main>
</div>
```

### 5.2 Panel Admin (Desktop)

```html
<div class="min-h-screen bg-gray-100 flex">
  <!-- Sidebar -->
  <aside class="w-64 bg-white shadow-lg">
    <div class="p-4 border-b">
      <img src="/images/logo.png" alt="Logo" class="h-12" />
    </div>
    <nav class="p-4">
      <!-- Menu items -->
    </nav>
  </aside>

  <!-- Main -->
  <div class="flex-1">
    <!-- Top bar -->
    <header class="bg-white shadow-sm h-16 flex items-center px-6">
      ...
    </header>

    <!-- Content -->
    <main class="p-6">
      ...
    </main>
  </div>
</div>
```

---

## 6. Estados de Interaccion

### 6.1 Hover en Botones

```css
/* Boton primario */
.btn-primary {
  background-color: #DC2626;
  transition: background-color 0.2s ease;
}
.btn-primary:hover {
  background-color: #B91C1C; /* Rojo mas oscuro */
}

/* Boton outline */
.btn-outline {
  border-color: #DC2626;
  color: #DC2626;
  transition: all 0.2s ease;
}
.btn-outline:hover {
  background-color: #DC2626;
  color: white;
}
```

### 6.2 Focus en Inputs

```css
input:focus {
  outline: none;
  border-color: #DC2626;
  box-shadow: 0 0 0 3px #FEE2E2; /* Sombra roja clara */
}
```

### 6.3 Feedback Visual

```html
<!-- Cargando -->
<button disabled class="opacity-50 cursor-not-allowed">
  <span class="animate-spin">↻</span> Procesando...
</button>

<!-- Exito -->
<div class="bg-green-100 text-green-800 p-4 rounded-lg">
  ✓ Venta registrada correctamente
</div>

<!-- Error -->
<div class="bg-red-100 text-red-800 p-4 rounded-lg">
  ✗ Error al procesar la venta
</div>
```

---

## 7. Iconos

Usar **Lucide Icons** (React) o emojis simples para mantener simplicidad:

| Concepto | Icono/Emoji |
|----------|-------------|
| Activo/Exito | ✓ |
| Inactivo/Error | ✗ |
| Advertencia | ⚠ |
| Buscar | 🔍 |
| Usuario/Socio | 👤 |
| Comercio | 🏪 |
| Dinero | 💰 |
| Estrella (promo) | ★ |

---

## 8. Responsive Breakpoints

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    screens: {
      'sm': '640px',   // Celulares grandes
      'md': '768px',   // Tablets
      'lg': '1024px',  // Desktop
      'xl': '1280px',  // Desktop grande
    }
  }
}
```

**Comerciante**: Optimizado para `sm` (celular)
**Admin**: Optimizado para `lg` (desktop)

---

## 9. Flyer "Comercio Adherido"

### Especificaciones
- **Tamano**: 1080x1080px (cuadrado para redes)
- **Formato**: PNG
- **Elementos**:
  - Logo del club
  - Texto "COMERCIO ADHERIDO"
  - Logo RojoPlus
  - Colores: Rojo y gris

```
┌────────────────────────────────┐
│                                │
│         [LOGO CLUB]            │
│                                │
│     ━━━━━━━━━━━━━━━━━━━       │
│                                │
│        COMERCIO                │
│        ADHERIDO                │
│                                │
│     ━━━━━━━━━━━━━━━━━━━       │
│                                │
│    Descuentos exclusivos       │
│    para socios del club        │
│                                │
│         [ROJOPLUS]             │
│                                │
└────────────────────────────────┘
```

---

*Documento creado: Enero 2026*
*Version: 1.0*
