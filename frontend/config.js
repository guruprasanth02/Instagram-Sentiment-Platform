/**
 * SentiGram — API Configuration
 *
 * On localhost, API calls use relative paths (e.g. /login) — Flask serves
 * everything from the same origin, so session cookies work fine.
 *
 * On Vercel (production), the Flask backend lives on Render. Vercel's
 * rewrites proxy the request but the Set-Cookie response header is scoped
 * to onrender.com, so the browser never sends the cookie back to vercel.app.
 * Calling the Render backend directly (with credentials:'include') and
 * configuring CORS on Flask fixes the cookie/session problem.
 */
const IS_LOCAL = (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
);

// Replace this with your actual Render backend URL if it differs.
const RENDER_BACKEND = 'https://instagram-sentiment-platform.onrender.com';

window.API_BASE = IS_LOCAL ? '' : RENDER_BACKEND;

/**
 * Wrapper around fetch() that:
 *  - Prepends API_BASE to the path
 *  - Always sends credentials (cookies) so Flask sessions work cross-origin
 */
window.apiFetch = function(path, options = {}) {
  const url = window.API_BASE + path;
  const defaults = { credentials: 'include' };
  // Merge headers carefully
  const merged = Object.assign({}, defaults, options);
  if (options.headers) {
    merged.headers = Object.assign({}, options.headers);
  }
  return fetch(url, merged);
};
