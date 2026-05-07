/**
 * 📡 WOOCOMMERCE + WORDPRESS HEADLESS API — ELYSIAN AROMAS
 * ─────────────────────────────────────────────────────────────────────────────
 * Lee productos desde WooCommerce REST API v3.
 *
 * CONFIGURACIÓN EN .env:
 *   WP_URL     = https://reyes.saulpedroza.com.mx
 *   WC_KEY     = ck_xxxxx   (WooCommerce → Ajustes → Avanzado → REST API)
 *   WC_SECRET  = cs_xxxxx
 *
 * ENDPOINT BASE:
 *   /wp-json/wc/v3/products
 *
 * LA AUTENTICACIÓN ES BASIC AUTH:
 *   Base64(WC_KEY:WC_SECRET) en el header Authorization
 *   Esto es seguro porque solo se ejecuta en el servidor (build time)
 *   El visitante NUNCA ve las claves
 */

const WP_URL    = import.meta.env.WP_URL    || 'https://reyes.saulpedroza.com.mx';
const WC_KEY    = import.meta.env.WC_KEY    || '';
const WC_SECRET = import.meta.env.WC_SECRET || '';

// ─── Auth header para WooCommerce ─────────────────────────────────────────────
function getAuthHeader() {
  if (!WC_KEY || !WC_SECRET) return {};
  // btoa = Base64 encode (disponible en Node 18+ y en el browser)
  const token = btoa(`${WC_KEY}:${WC_SECRET}`);
  return { Authorization: `Basic ${token}` };
}

// ─── Fetch base WooCommerce ───────────────────────────────────────────────────
async function wcFetch(endpoint, params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = `${WP_URL}/wp-json/wc/v3/${endpoint}${query ? '?' + query : ''}`;

  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn(`[WC API] ${res.status} → ${url}`, err.message || '');
      return null;
    }

    return await res.json();
  } catch (err) {
    console.warn(`[WC API] Sin conexión: ${err.message}`);
    return null;
  }
}

// ─── Normalización WooCommerce → formato interno ──────────────────────────────
/**
 * WooCommerce devuelve productos con esta estructura:
 * {
 *   id, name, slug, description, short_description,
 *   price, regular_price, sale_price,
 *   stock_quantity, stock_status,
 *   images: [{src, alt}, ...],
 *   categories: [{id, name, slug}, ...],
 *   attributes: [{name, options}, ...],   ← notas aromáticas aquí
 *   meta_data: [{key, value}, ...],       ← campos extra aquí
 * }
 */
function normalizeWCProduct(item) {
  // Imágenes
  const gallery = (item.images || []).map(img => ({
    url: img.src,
    alt: img.alt || item.name,
  }));

  // Precio
  const price        = item.price        ? `€${item.price}`         : '€180';
  const comparePrice = item.regular_price && item.sale_price && item.regular_price !== item.sale_price
    ? `€${item.regular_price}`
    : null;

  // Stock
  const stock = item.stock_quantity ?? (item.stock_status === 'instock' ? 10 : 0);

  // Notas aromáticas desde atributos de WooCommerce
  // En WooCommerce crea atributos: "Notas Top", "Notas Corazón", "Notas Base"
  const attrs = item.attributes || [];
  const getAttr = (name) => {
    const a = attrs.find(a => a.name.toLowerCase().includes(name.toLowerCase()));
    return a ? a.options : [];
  };

  const notesTop   = getAttr('top')    || getAttr('salida')   || [];
  const notesHeart = getAttr('heart')  || getAttr('corazón')  || getAttr('corazon') || [];
  const notesBase  = getAttr('base')   || getAttr('fondo')    || [];

  // Specs desde meta_data (campos personalizados de WooCommerce)
  const meta = {};
  (item.meta_data || []).forEach(m => { meta[m.key] = m.value; });

  const specs = [
    { label: 'Concentración', value: meta.concentracion || meta.concentration || 'Eau de Parfum' },
    { label: 'Tamaño',        value: meta.tamano || meta.size || '50ml' },
    { label: 'Procedencia',   value: meta.procedencia || meta.origin || 'Francia' },
    { label: 'Familia',       value: meta.familia || meta.family || '' },
    { label: 'Tipo',          value: meta.tipo || meta.type || 'Unisex' },
  ].filter(s => s.value); // Quita los vacíos

  return {
    id:           item.id,
    slug:         item.slug,
    title:        item.name || 'Sin título',
    description:  item.description || '',
    excerpt:      item.short_description?.replace(/<[^>]*>/g, '') || '',
    price,
    comparePrice,
    stock,
    size:         meta.tamano || meta.size || '50ml',
    featured:     item.featured || false,
    image:        gallery[0]?.url || null,
    imageAlt:     gallery[0]?.alt || item.name,
    gallery,
    notes: {
      top:   notesTop,
      heart: notesHeart,
      base:  notesBase,
    },
    notesFlat: [...notesTop, ...notesHeart, ...notesBase],
    specs,
    categories: (item.categories || []).map(c => c.slug),
    // Campo extra por si necesitas el precio numérico
    priceRaw: parseFloat(item.price) || 0,
  };
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Lista de productos de WooCommerce.
 * Fallback a MOCK_PRODUCTS si no hay conexión o credenciales.
 */
export async function getProducts({ perPage = 12 } = {}) {
  const data = await wcFetch('products', {
    per_page: perPage,
    status: 'publish',      // Solo productos publicados
    orderby: 'date',
    order: 'desc',
  });

  if (data?.length) return data.map(normalizeWCProduct);

  console.info('[WC API] Usando MOCK_PRODUCTS — configura WC_KEY y WC_SECRET en .env');
  return MOCK_PRODUCTS;
}

/**
 * Producto individual por slug.
 */
export async function getProductBySlug(slug) {
  const data = await wcFetch('products', { slug, status: 'publish' });
  if (data?.[0]) return normalizeWCProduct(data[0]);
  return MOCK_PRODUCTS.find(p => p.slug === slug) || null;
}

/**
 * Todos los slugs (para getStaticPaths de Astro)
 */
export async function getAllSlugs() {
  const products = await getProducts({ perPage: 100 });
  return products.map(p => p.slug);
}

/**
 * Productos relacionados
 */
export async function getRelatedProducts(currentSlug, { perPage = 3 } = {}) {
  const all = await getProducts({ perPage: 20 });
  return all.filter(p => p.slug !== currentSlug).slice(0, perPage);
}

/**
 * Página estática de WordPress
 */
export async function getPage(slug) {
  try {
    const url = `${WP_URL}/wp-json/wp/v2/pages?slug=${slug}&_embed=true`;
    const res = await fetch(url);
    const data = await res.json();
    return data?.[0] || null;
  } catch {
    return null;
  }
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
// Se usa cuando WooCommerce no está conectado.
// Replica EXACTAMENTE la estructura de normalizeWCProduct().

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
    categories: ['florales'], priceRaw: 195,
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
    categories: ['orientales'], priceRaw: 220,
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
    categories: ['florales'], priceRaw: 175,
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
    categories: ['orientales'], priceRaw: 280,
  },
];
