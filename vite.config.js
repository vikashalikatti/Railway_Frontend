import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, /customer and /admin calls are forwarded to the Spring Boot app,
// so the browser never makes a cross-origin request.
const BACKEND = process.env.BACKEND_URL || 'http://localhost:8080';

/**
 * Content-Security-Policy for the built app: scripts only from this site (no inline or injected
 * scripts), API calls only to this site, fonts from Google Fonts. This stops most cross-site
 * scripting from doing anything even if some text slipped through.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

/** Headers for the dev and preview servers. Use the same ones on the real web server. */
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

/**
 * Forwards /customer and /admin to Spring Boot. The browser sees these calls as going to the
 * page's own address, so they aren't cross-site — but the browser still adds an Origin header
 * (e.g. http://192.168.1.5:5173 when opened from a phone), and Spring's CORS check would refuse
 * any address it doesn't know. The header is dropped here, so the app works from any device
 * on your network without listing its address in CORS_ORIGINS.
 */
const apiProxy = {
  target: BACKEND,
  changeOrigin: true,
  configure: (proxy) => {
    proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'));
  },
};
const PROXY = { '/customer': apiProxy, '/admin': apiProxy };

/** Puts the CSP into the built index.html (not in dev: Vite's hot reload needs inline scripts) */
function cspMeta() {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
    },
  };
}

export default defineConfig({
  plugins: [react(), cspMeta()],
  css: {
    preprocessorOptions: {
      // Bootstrap 5.3's Sass still uses @import; hide those upstream warnings
      scss: { quietDeps: true, silenceDeprecations: ['mixed-decls'] },
    },
  },
  build: {
    sourcemap: false, // don't publish the original source with the site
  },
  server: {
    port: 5173,
    host: true, // reachable from phones on the same Wi-Fi (http://<this computer's IP>:5173)
    headers: SECURITY_HEADERS,
    proxy: PROXY,
  },
  preview: {
    port: 4173,
    host: true,
    headers: { ...SECURITY_HEADERS, 'Content-Security-Policy': `${CSP}; frame-ancestors 'none'` },
    proxy: PROXY,
  },
});
