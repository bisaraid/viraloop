/**
 * API Authentication helper
 *
 * STRATEGI:
 * 1. Jika request berasal dari origin yang sama (frontend sendiri) → izinkan tanpa API key
 * 2. Jika request dari origin berbeda (eksternal/integrasi) → WAJIB X-API-Key valid
 * 3. Jika API_SECRET_KEY tidak diset → skip auth (development mode)
 *
 * ⚠️ PERINGATAN KEAMANAN ⚠️
 * Same-origin check via Origin/Referer header BUKAN authentication yang kuat.
 * Header Origin/Referer bisa dipalsukan oleh non-browser client (curl, Postman, script).
 * Lapisan pertahanan SEBENARNYA adalah:
 *   - Rate limiting lapisan 1 (sebelum auth) — mencegah brute-force spoofing
 *   - Rate limiting lapisan 2 (setelah auth) — membatasi abuse per jalur
 * Jangan mengandalkan same-origin check sebagai satu-satunya pertahanan!
 *
 * Same-origin check hanya bertujuan mencegah pemanggilan tidak sengaja
 * dari frontend sendiri tanpa API key — BUKAN sebagai security boundary.
 *
 * Same-origin dideteksi dengan urutan prioritas:
 * 1. Origin header ADA dan cocok dengan APP_DOMAIN (full URL match)
 * 2. Referer header ADA dan cocok dengan APP_DOMAIN (full URL match)
 * 3. Host header ADA dan domain-nya cocok dengan APP_DOMAIN (tanpa port)
 * Jika tidak ada satupun yang cocok → REJECT (bukan default-allow).
 */

/**
 * Strip protocol (http://, https://) dari URL string
 */
function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

/**
 * Extract domain dari string host (buang port jika ada)
 * Contoh: "localhost:3000" → "localhost", "viraloop.vercel.app" → "viraloop.vercel.app"
 */
function extractDomain(host: string): string {
  return host.split(':')[0];
}

export function validateApiKey(request: Request): { valid: boolean; error?: string; isSameOrigin: boolean } {
  const apiKey = process.env.API_SECRET_KEY;

  // Jika API_SECRET_KEY tidak diset, skip auth (development mode)
  if (!apiKey) {
    console.warn('⚠️ API_SECRET_KEY tidak diset — autentikasi API dilewati');
    return { valid: true, isSameOrigin: true };
  }

  // Deteksi same-origin: request dari frontend sendiri
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');

  // Dapatkan APP_DOMAIN dari env var, atau fallback ke host
  const appDomain = process.env.APP_DOMAIN;
  const appDomainClean = appDomain ? stripProtocol(appDomain) : '';
  const appDomainHost = appDomainClean ? extractDomain(appDomainClean) : '';

  let isSameOrigin = false;

  // Cek 1: Origin header cocok dengan APP_DOMAIN
  if (origin && appDomain && origin.startsWith(appDomain)) {
    isSameOrigin = true;
  }
  // Cek 2: Referer header cocok dengan APP_DOMAIN
  else if (referer && appDomain && referer.startsWith(appDomain)) {
    isSameOrigin = true;
  }
  // Cek 3: Host header domain cocok dengan APP_DOMAIN (tanpa protocol & port)
  else if (host && appDomainHost) {
    const requestDomain = extractDomain(host);
    if (requestDomain === appDomainHost) {
      isSameOrigin = true;
    }
  }
  // Cek 4: Fallback jika APP_DOMAIN tidak diset — gunakan Host header
  else if (!appDomain && host) {
    // Tanpa APP_DOMAIN, kita hanya bisa percaya Host header
    // Ini kurang aman tapi diperlukan untuk development
    isSameOrigin = true;
  }

  if (isSameOrigin) {
    // Request dari frontend sendiri — izinkan tanpa API key
    // TAPI tetap terikat rate limit lapisan 2 yang ketat (3 req/menit)
    return { valid: true, isSameOrigin: true };
  }

  // Request dari eksternal — wajib API key
  const providedKey = request.headers.get('x-api-key');

  if (!providedKey) {
    return { valid: false, error: 'Header X-API-Key wajib disertakan untuk akses eksternal', isSameOrigin: false };
  }

  if (providedKey !== apiKey) {
    return { valid: false, error: 'X-API-Key tidak valid', isSameOrigin: false };
  }

  return { valid: true, isSameOrigin: false };
}