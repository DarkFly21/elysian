# Elysian Aromas — Astro + WordPress Headless

Sitio de lujo construido con **Astro** como frontend y **WordPress** como CMS (headless).

---

## 🏗️ Estructura del proyecto

```
elysian/
├── src/
│   ├── components/        # Bloques de UI reutilizables
│   │   ├── Nav.astro      # Navegación (transparente → sólida al scroll)
│   │   ├── Hero.astro     # Sección principal con frasco flotante
│   │   ├── Marquee.astro  # Ticker de texto dorado
│   │   ├── CollectionSection.astro  # Grid de productos
│   │   ├── ProductCard.astro        # Card individual de producto
│   │   ├── AboutSection.astro       # Sección "nuestra historia"
│   │   ├── IngredientsSection.astro # Ingredientes con parallax
│   │   └── Footer.astro             # Pie de página + newsletter
│   │
│   ├── layouts/
│   │   └── Layout.astro   # HTML base: <head>, cursor, meta tags
│   │
│   ├── lib/
│   │   └── wordpress.js   # 🔑 PUENTE con WordPress REST API
│   │
│   ├── pages/
│   │   ├── index.astro           # / (Home)
│   │   └── coleccion/
│   │       ├── index.astro       # /coleccion (catálogo completo)
│   │       └── [slug].astro      # /coleccion/nombre-producto (detalle)
│   │
│   └── styles/
│       └── global.css     # Variables CSS, tipografía, animaciones
│
├── public/
│   └── favicon.svg
│
├── .env.example           # Plantilla de variables de entorno
├── astro.config.mjs       # Configuración de Astro
└── package.json
```

---

## 🚀 Cómo arrancar el proyecto

```bash
# Instalar dependencias
npm install

# Desarrollo (localhost:4321)
npm run dev

# Build para producción
npm run build

# Preview del build
npm run preview
```

---

## 🔌 Conectar con WordPress

### Paso 1: Preparar WordPress

Tu WordPress necesita estos plugins:
- **Advanced Custom Fields (ACF)** — para campos personalizados (precio, notas aromáticas, etc.)
- **ACF to REST API** — expone los campos ACF en la API
- Opcional: **WP REST API Menus** — si quieres gestionar los menús de nav desde WP

### Paso 2: Crear el Custom Post Type "elysian_products"

Añade esto en `functions.php` de tu tema o en un plugin:

```php
function elysian_register_products() {
  register_post_type('elysian_products', [
    'labels' => [
      'name'          => 'Products',
      'singular_name' => 'Product',
    ],
    'public'       => true,
    'show_in_rest' => true,   // ← CRÍTICO: activa la REST API
    'supports'     => ['title', 'editor', 'excerpt', 'thumbnail'],
    'rewrite'      => ['slug' => 'products'],
  ]);
}
add_action('init', 'elysian_register_products');
```

### Paso 3: Crear campos ACF

En WordPress Admin → ACF → Añadir grupo de campos:
- `price` (Text) — Precio del perfume (ej: "€195")
- `notes` (Repeater → Text) — Notas aromáticas
- `size` (Text) — Tamaño (ej: "50ml")
- `featured` (True/False) — Si aparece destacado

Asignar el grupo a: Post Type = `elysian_products`

### Paso 4: Configurar la URL en .env

```bash
# Copia el archivo de ejemplo
cp .env.example .env

# Edita .env y pon tu WordPress
WP_URL=https://tu-dominio.com
```

### Paso 5: Verificar que funciona

Abre en el navegador:
```
https://tu-dominio.com/wp-json/wp/v2/elysian_products
```

Deberías ver un JSON con tus productos. Si funciona, Astro los leerá automáticamente.

---

## 🔄 Flujo de datos completo

```
WordPress Admin
    ↓ (publicas un producto)
WordPress REST API
    ↓ /wp-json/wp/v2/elysian_products
src/lib/wordpress.js
    ↓ getProducts() normaliza los datos
src/pages/index.astro
    ↓ pasa los datos como props
src/components/CollectionSection.astro
    ↓ renderiza
src/components/ProductCard.astro
    ↓
HTML estático generado por Astro
```

---

## 🌐 Deploy options

### Opción A: Build estático (recomendado para empezar)
```bash
npm run build
# Sube la carpeta dist/ a cualquier hosting
```
Funciona en: Netlify, Vercel, Cloudflare Pages, cualquier hosting.

**⚠️ Importante:** Cada vez que publiques contenido en WordPress, necesitas hacer build de nuevo.
Configura un **webhook** en WordPress para que dispare el build automáticamente.

### Opción B: SSR (Server-Side Rendering)
Cambia en `astro.config.mjs`:
```js
output: 'server'  // en vez de 'static'
```
Ventaja: el contenido siempre está actualizado sin rebuild.
Requiere: Node.js server, no funciona en hosting estático.

---

## 🎨 Paleta de colores

| Variable         | Color        | Uso                    |
|-----------------|-------------|------------------------|
| `--c-bg`        | `#0a0906`   | Fondo principal        |
| `--c-gold`      | `#c9a96e`   | Acentos dorados        |
| `--c-gold-light`| `#e8c98a`   | Gold hover             |
| `--c-cream`     | `#f5efe6`   | Texto principal        |
| `--c-muted`     | `#6b6355`   | Texto secundario       |

---

## 📦 Dependencias

Solo una: **Astro** (el framework). Sin React, sin Vue, sin jQuery.
Astro genera HTML puro → súper rápido, excelente SEO.
