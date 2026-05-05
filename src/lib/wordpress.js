/**
 * 📡 WORDPRESS HEADLESS API — ELYSIAN AROMAS
 * ─────────────────────────────────────────────────────────────────────────────
 * Puente entre Astro y WordPress REST API.
 *
 * ESTRUCTURA EN WORDPRESS (lo que necesitas configurar):
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  Custom Post Type: "perfume"  (show_in_rest: true)             │
 * │  Campos ACF:                                                    │
 * │    price          → Text      → "€195"                         │
 * │    compare_price  → Text      → "€240"  (precio tachado)       │
 * │    size           → Text      → "50ml"                         │
 * │    stock          → Number    → 15                              │
 * │    featured       → True/False                                  │
 * │    notes_top      → Text      → "Bergamota, Pimienta Rosa"     │
 * │    notes_heart    → Text      → "Rosa, Jazmín"                 │
 * │    notes_base     → Text      → "Sándalo, Ámbar"               │
 * │    specs          → Repeater  → [{label, value}, ...]          │
 * │    gallery        → Gallery   → [img1, img2, ...]              │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * PLUGINS NECESARIOS:
 *   1. Advanced Custom Fields (ACF)
 *   2. ACF to REST API
 *
 * SIN PLUGINS: funciona con MOCK_PRODUCTS (datos de prueba incluidos abajo)
 */

const WP_URL = import.meta.env.WP_URL || 'https://reyes.saulpedroza.com.mx';

// ─── Fetch base ───────────────────────────────────────────────────────────────
async function wpFetch(endpoint, params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = `${WP_URL}/wp-json/wp/v2/${endpoint}${query ? '?' + query : ''}`;
  try {
    const res = await fetch(url);
    if (!res.ok) { console.warn(`[WP API] ${res.status} → ${url}`); return null; }
    return await res.json();
  } catch (err) {
    console.warn(`[WP API] Sin conexión: ${err.message}`);
    return null;
  }
}

// ─── Normalización ────────────────────────────────────────────────────────────
function normalizeProduct(item) {
  const acf = item.acf || {};
  const featuredImg = item._embedded?.['wp:featuredmedia']?.[0];
  const gallery = acf.gallery?.length
    ? acf.gallery.map(img => ({ url: img.url || img, alt: img.alt || '' }))
    : featuredImg
      ? [{ url: featuredImg.source_url, alt: featuredImg.alt_text || item.title?.rendered }]
      : [];

  const specs = acf.specs?.length ? acf.specs : [
    { label: 'Concentración', value: 'Eau de Parfum' },
    { label: 'Tamaño', value: acf.size || '50ml' },
    { label: 'Procedencia', value: 'Francia' },
    { label: 'Tipo', value: 'Unisex' },
  ];

  return {
    id: item.id,
    slug: item.slug,
    title: item.title?.rendered || 'Sin título',
    description: item.content?.rendered || '',
    excerpt: item.excerpt?.rendered?.replace(/<[^>]*>/g, '') || '',
    price: acf.price || '€180',
    comparePrice: acf.compare_price || null,
    stock: acf.stock ?? 10,
    size: acf.size || '50ml',
    featured: acf.featured || false,
    image: gallery[0]?.url || null,
    imageAlt: gallery[0]?.alt || item.title?.rendered,
    gallery,
    notes: {
      top:   acf.notes_top   ? acf.notes_top.split(',').map(n => n.trim())   : [],
      heart: acf.notes_heart ? acf.notes_heart.split(',').map(n => n.trim()) : [],
      base:  acf.notes_base  ? acf.notes_base.split(',').map(n => n.trim())  : [],
    },
    notesFlat: [
      ...(acf.notes_top   ? acf.notes_top.split(',')   : []),
      ...(acf.notes_heart ? acf.notes_heart.split(',') : []),
      ...(acf.notes_base  ? acf.notes_base.split(',')  : []),
    ].map(n => n.trim()).filter(Boolean),
    specs,
    categories: item._embedded?.['wp:term']?.[0]?.map(c => c.slug) || [],
  };
}

function normalizePost(item) {
  const featuredImg = item._embedded?.['wp:featuredmedia']?.[0];
  return {
    id: item.id, slug: item.slug,
    title: item.title?.rendered || 'Sin título',
    description: item.content?.rendered || '',
    excerpt: item.excerpt?.rendered?.replace(/<[^>]*>/g, '') || '',
    price: '€180', comparePrice: null, stock: 10, size: '50ml', featured: false,
    image: featuredImg?.source_url || null,
    imageAlt: item.title?.rendered,
    gallery: featuredImg ? [{ url: featuredImg.source_url, alt: featuredImg.alt_text || '' }] : [],
    notes: { top: [], heart: [], base: [] },
    notesFlat: [],
    specs: [{ label: 'Concentración', value: 'Eau de Parfum' }, { label: 'Tamaño', value: '50ml' }],
    categories: [],
  };
}

// ─── API pública ──────────────────────────────────────────────────────────────
export async function getProducts({ perPage = 12 } = {}) {
  const cpt = await wpFetch('perfume', { per_page: perPage, _embed: true });
  if (cpt?.length) return cpt.map(normalizeProduct);
  const posts = await wpFetch('posts', { per_page: perPage, _embed: true });
  if (posts?.length) return posts.map(normalizePost);
  console.info('[WP API] Usando MOCK_PRODUCTS');
  return MOCK_PRODUCTS;
}

export async function getProductBySlug(slug) {
  const cpt = await wpFetch('perfume', { slug, _embed: true });
  if (cpt?.[0]) return normalizeProduct(cpt[0]);
  const posts = await wpFetch('posts', { slug, _embed: true });
  if (posts?.[0]) return normalizePost(posts[0]);
  return MOCK_PRODUCTS.find(p => p.slug === slug) || null;
}

export async function getAllSlugs() {
  const products = await getProducts({ perPage: 100 });
  return products.map(p => p.slug);
}

export async function getRelatedProducts(currentSlug, { perPage = 4 } = {}) {
  const all = await getProducts({ perPage: 20 });
  return all.filter(p => p.slug !== currentSlug).slice(0, perPage);
}

export async function getPage(slug) {
  const data = await wpFetch('pages', { slug, _embed: true });
  return data?.[0] || null;
}

// ─── Mock Data (datos de prueba) ──────────────────────────────────────────────
export const MOCK_PRODUCTS = [
  {
    id: 1, slug: 'rose-jasmine', title: 'Rose & Jasmine',
    description: '<p>Una fragancia etérea que captura la dualidad entre la rosa de Damasco y el jazmín sambac nocturno. Delicada en la apertura, profunda en el seco.</p><p>Elaborada con aceites esenciales de primera extracción, esta fragancia evoluciona de forma diferente en cada piel.</p>',
    excerpt: 'Etéreo · Floral · Seductor',
    price: '€195', comparePrice: '€240', stock: 8, size: '50ml', featured: true,
    image: 'https://framerusercontent.com/images/MYZxK82zNzoKWlZ6byhg3sMiA1k.png',
    imageAlt: 'Rose & Jasmine — Elysian Aromas',
    gallery: [
      { url: 'https://framerusercontent.com/images/MYZxK82zNzoKWlZ6byhg3sMiA1k.png', alt: 'Rose & Jasmine frente' },
      { url: 'https://framerusercontent.com/images/Qi3nYHH8jDLxYC6vrOJ1VKaYI.png', alt: 'Rose & Jasmine detalle' },
      { url: 'https://framerusercontent.com/images/8EXryTCenq0CTCxok8dknZ6AW4Q.webp', alt: 'Rose & Jasmine ambiente' },
    ],
    notes: { top: ['Bergamota', 'Pimienta Rosa'], heart: ['Rosa de Damasco', 'Jazmín Sambac'], base: ['Sándalo', 'Almizcle Blanco'] },
    notesFlat: ['Bergamota', 'Pimienta Rosa', 'Rosa de Damasco', 'Jazmín Sambac', 'Sándalo', 'Almizcle Blanco'],
    specs: [
      { label: 'Concentración', value: 'Eau de Parfum' },
      { label: 'Tamaño', value: '50ml' },
      { label: 'Procedencia', value: 'Grasse, Francia' },
      { label: 'Familia', value: 'Floral Oriental' },
      { label: 'Tipo', value: 'Unisex' },
    ],
    categories: ['florales'],
  },
  {
    id: 2, slug: 'noir-absolu', title: 'Noir Absolu',
    description: '<p>Una oda a la oscuridad y el misterio. Noir Absolu abre con especias vibrantes y cierra con la calidez duradera del oud árabe y el ámbar gris.</p>',
    excerpt: 'Oscuro · Amaderado · Especiado',
    price: '€220', comparePrice: null, stock: 15, size: '50ml', featured: false,
    image: 'https://framerusercontent.com/images/8EXryTCenq0CTCxok8dknZ6AW4Q.webp',
    imageAlt: 'Noir Absolu — Elysian Aromas',
    gallery: [
      { url: 'https://framerusercontent.com/images/8EXryTCenq0CTCxok8dknZ6AW4Q.webp', alt: 'Noir Absolu frente' },
      { url: 'https://framerusercontent.com/images/WsDDxdWCgU7m5q5BnM8kMej8yw.webp', alt: 'Noir Absolu detalle' },
    ],
    notes: { top: ['Cardamomo', 'Pimienta Negra'], heart: ['Oud Árabe', 'Rosa Turca'], base: ['Ámbar Gris', 'Pachulí', 'Vetiver'] },
    notesFlat: ['Cardamomo', 'Pimienta Negra', 'Oud Árabe', 'Rosa Turca', 'Ámbar Gris', 'Pachulí', 'Vetiver'],
    specs: [
      { label: 'Concentración', value: 'Extrait de Parfum' },
      { label: 'Tamaño', value: '50ml' },
      { label: 'Procedencia', value: 'Dubai, UAE' },
      { label: 'Familia', value: 'Oriental Amaderado' },
      { label: 'Tipo', value: 'Unisex' },
    ],
    categories: ['orientales'],
  },
  {
    id: 3, slug: 'velvet-iris', title: 'Velvet Iris',
    description: '<p>La suavidad hecha fragancia. El iris pálido aporta una textura casi táctil, polvorosa y sedosa, amplificada por la violeta y el almizcle blanco.</p>',
    excerpt: 'Suave · Polvoriento · Íntimo',
    price: '€175', comparePrice: null, stock: 3, size: '50ml', featured: false,
    image: 'https://framerusercontent.com/images/WsDDxdWCgU7m5q5BnM8kMej8yw.webp',
    imageAlt: 'Velvet Iris — Elysian Aromas',
    gallery: [
      { url: 'https://framerusercontent.com/images/WsDDxdWCgU7m5q5BnM8kMej8yw.webp', alt: 'Velvet Iris frente' },
      { url: 'https://framerusercontent.com/images/MYZxK82zNzoKWlZ6byhg3sMiA1k.png', alt: 'Velvet Iris detalle' },
    ],
    notes: { top: ['Bergamota', 'Mandarina'], heart: ['Iris Pálido', 'Violeta'], base: ['Almizcle Blanco', 'Cedro'] },
    notesFlat: ['Bergamota', 'Mandarina', 'Iris Pálido', 'Violeta', 'Almizcle Blanco', 'Cedro'],
    specs: [
      { label: 'Concentración', value: 'Eau de Parfum' },
      { label: 'Tamaño', value: '50ml' },
      { label: 'Procedencia', value: 'Florencia, Italia' },
      { label: 'Familia', value: 'Floral Polvoroso' },
      { label: 'Tipo', value: 'Femenino' },
    ],
    categories: ['florales'],
  },
  {
    id: 4, slug: 'golden-oud', title: 'Golden Oud',
    description: '<p>La colisión entre Oriente y Occidente. El oud de primera calidad se equilibra con la frescura de la bergamota y la calidez del benjuí.</p>',
    excerpt: 'Resinoso · Dorado · Profundo',
    price: '€280', comparePrice: null, stock: 5, size: '50ml', featured: true,
    image: 'https://framerusercontent.com/images/XzpHmYtrKpOC2dXQ7lCieJQH90.png',
    imageAlt: 'Golden Oud — Elysian Aromas',
    gallery: [
      { url: 'https://framerusercontent.com/images/XzpHmYtrKpOC2dXQ7lCieJQH90.png', alt: 'Golden Oud frente' },
      { url: 'https://framerusercontent.com/images/Qi3nYHH8jDLxYC6vrOJ1VKaYI.png', alt: 'Golden Oud ambiente' },
    ],
    notes: { top: ['Bergamota', 'Azafrán'], heart: ['Oud', 'Rosa de Taif'], base: ['Benjuí', 'Ámbar', 'Vainilla'] },
    notesFlat: ['Bergamota', 'Azafrán', 'Oud', 'Rosa de Taif', 'Benjuí', 'Ámbar', 'Vainilla'],
    specs: [
      { label: 'Concentración', value: 'Extrait de Parfum' },
      { label: 'Tamaño', value: '50ml' },
      { label: 'Procedencia', value: 'Laos / Arabia' },
      { label: 'Familia', value: 'Oriental Resinoso' },
      { label: 'Tipo', value: 'Unisex' },
    ],
    categories: ['orientales'],
  },
];
