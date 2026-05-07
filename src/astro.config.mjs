import { defineConfig } from 'astro/config';

export default defineConfig({
  // Cambia esto por tu dominio final cuando tengas hosting
  // Si no lo defines, el canonical URL usará la URL actual del navegador
  site: 'https://reyes.saulpedroza.com.mx',
  output: 'static', // Cambia a 'server' si quieres SSR con WordPress en tiempo real
});
