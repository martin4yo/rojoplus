# Clubix - Sitio Web de Marketing

Sitio web moderno y atractivo para promocionar Clubix, el sistema de gestión integral para clubes deportivos.

## 🎨 Características del Diseño

### Efectos Visuales Modernos
- **Parallax Scrolling**: Las imágenes de fondo se mueven a diferente velocidad que el contenido
- **Animaciones al Scroll**: Los elementos aparecen con animaciones suaves al hacer scroll
- **Gradientes Dinámicos**: Uso de gradientes modernos en botones y fondos
- **Efectos Hover**: Tarjetas y elementos interactivos con transformaciones 3D
- **Ripple Effect**: Efecto de onda en botones al hacer click
- **Navegación Sticky**: Barra de navegación fija con efecto blur

### Secciones Incluidas

1. **Hero Section**
   - Título impactante con gradiente
   - Call-to-actions destacados
   - Estadísticas animadas
   - Vista previa del dashboard con efecto 3D

2. **Características**
   - Grid de 6 tarjetas principales
   - Iconos SVG personalizados
   - Animaciones de entrada escalonadas

3. **Módulos**
   - Detalle de los 3 nuevos módulos (Cobranzas, Recupero, Comunicaciones)
   - Características específicas de cada módulo
   - Badges "Nuevo" destacados
   - 6 módulos adicionales del sistema

4. **Xavi IA**
   - Sección especial para el asistente inteligente
   - Animación de círculos concéntricos
   - Lista de capacidades con checkmarks

5. **Beneficios**
   - 4 razones principales para elegir Clubix
   - Números grandes con gradiente

6. **Precios**
   - 3 planes (Básico, Profesional, Enterprise)
   - Card destacada para el plan más popular
   - Botones CTA diferenciados

7. **Contacto**
   - Formulario completo de contacto
   - Información de contacto con iconos
   - Validación y feedback visual

## 🚀 Cómo Usar

### Opción 1: Abrir directamente
Simplemente abre el archivo `index.html` en tu navegador favorito.

### Opción 2: Servidor local
```bash
# Si tienes Python 3 instalado
cd web
python -m http.server 8000

# Luego abre en el navegador
http://localhost:8000
```

### Opción 3: Live Server (VS Code)
1. Instala la extensión "Live Server" en VS Code
2. Click derecho en `index.html`
3. Selecciona "Open with Live Server"

## 📁 Estructura de Archivos

```
web/
├── index.html          # Página principal
├── styles.css          # Estilos y animaciones
├── script.js           # Interacciones y efectos
├── README.md           # Este archivo
└── assets/
    └── images/         # Carpeta para imágenes locales (opcional)
```

## 🎯 Tecnologías Utilizadas

- **HTML5**: Estructura semántica
- **CSS3**:
  - Flexbox y Grid para layouts
  - Custom Properties (variables CSS)
  - Animaciones y transiciones
  - Gradientes y efectos modernos
  - Media queries para responsive
- **JavaScript Vanilla**:
  - Intersection Observer API
  - Event listeners
  - Animaciones procedurales
  - Lazy loading de imágenes

## 🖼️ Imágenes

El sitio usa imágenes de Unsplash mediante URLs directas. Para usar imágenes propias:

1. Coloca las imágenes en `assets/images/`
2. Reemplaza las URLs de Unsplash en `index.html`:
   - Hero: `.dashboard-preview img src`
   - Parallax: `.parallax-image background-image`

Imágenes recomendadas:
- Dashboard preview: 1200x800px
- Parallax background: 1920x1080px

## 🎨 Personalización

### Colores
Los colores principales se definen en `:root` en `styles.css`:

```css
:root {
    --primary: #DC2626;        /* Rojo principal */
    --primary-dark: #991B1B;   /* Rojo oscuro */
    --secondary: #7C3AED;      /* Púrpura (IA) */
    /* ... más variables */
}
```

### Fuentes
El sitio usa Inter de Google Fonts. Para cambiar:

```html
<link href="https://fonts.googleapis.com/css2?family=TU_FUENTE&display=swap" rel="stylesheet">
```

### Contenido
Todo el contenido está en `index.html` y es fácilmente editable:
- Títulos y descripciones
- Características de cada módulo
- Precios (actualmente "Consultar")
- Información de contacto

## 📱 Responsive

El sitio es 100% responsive con breakpoints en:
- Desktop: > 768px
- Tablet: 768px
- Mobile: < 768px

## ✨ Efectos Especiales

### Parallax
El efecto parallax funciona automáticamente en:
- Fondo del hero
- Imagen intermedia entre secciones

### Animaciones al Scroll
Los elementos con `data-aos` se animan al entrar en viewport:
- `fade-up`: Aparece desde abajo
- `fade-left`: Aparece desde la derecha
- `fade-right`: Aparece desde la izquierda
- `zoom-in`: Aparece con zoom

### Contador Animado
Los números en las estadísticas del hero se animan automáticamente al hacer scroll.

## 🔧 Mejoras Futuras Sugeridas

- [ ] Integrar con backend real para el formulario de contacto
- [ ] Añadir galería de screenshots del sistema
- [ ] Video demo embebido
- [ ] Testimonios de clientes
- [ ] Blog/Noticias
- [ ] Chat en vivo
- [ ] Calculadora de precios interactiva
- [ ] Comparativa de planes más detallada

## 📞 Soporte

Para personalización o ayuda:
- Email: info@clubix.com
- Teléfono: +54 9 11 XXXX-XXXX

---

**© 2024 Clubix - Sistema de Gestión Integral para Clubes Deportivos**
