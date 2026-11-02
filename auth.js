import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = '__Host-jarvis_session';
const REMEMBER_SECONDS = 30 * 24 * 60 * 60;
const TAB_SESSION_SECONDS = 12 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGINS = 10;

const validSecret = secret => typeof secret === 'string' && secret.length >= 16;
function equal(left, right) {
 const a = Buffer.from(left), b = Buffer.from(right);
 return a.length === b.length && timingSafeEqual(a, b);
}
function signature(payload, secret) {
 const key = createHmac('sha256', secret).update('jarvis remembered device session v1').digest();
 return createHmac('sha256', key).update(payload).digest('base64url');
}
function issueSession(secret, expiresAt) {
 const payload = `v1.${expiresAt}.${randomBytes(18).toString('base64url')}`;
 return `${payload}.${signature(payload, secret)}`;
}
function cookieValue(req) {
 const header = req.headers?.cookie;
 if (typeof header !== 'string' || header.length > 16000) return null;
 const values = header.split(';').map(part => part.trim()).filter(part => part.startsWith(SESSION_COOKIE + '='));
 // Reject ambiguous cookies rather than relying on browser/path ordering.
 return values.length === 1 ? values[0].slice(SESSION_COOKIE.length + 1) : null;
}
function validSession(value, secret, time) {
 if (typeof value !== 'string' || value.length > 160) return false;
 const match = /^v1\.([0-9]{10})\.([A-Za-z0-9_-]{24})\.([A-Za-z0-9_-]{43})$/.exec(value);
 if (!match || Number(match[1]) <= Math.floor(time / 1000)) return false;
 const payload = value.slice(0, value.lastIndexOf('.'));
 return equal(match[3], signature(payload, secret));
}
function crossOrigin(req) {
 const site = req.headers?.['sec-fetch-site'];
 if (site === 'cross-site' || site === 'same-site') return true;
 const origin = req.headers?.origin;
 if (!origin) return false; // Non-browser clients need not provide Origin.
 try { return new URL(origin).host !== req.headers?.host; }
 catch { return true; }
}

/** Accept the existing API bearer credential or an unexpired signed device cookie. */
export function authenticateRequest(req, secret, { now = Date.now } = {}) {
 if (!validSecret(secret)) return false;
 const authorization = req.headers?.authorization;
 if (typeof authorization === 'string' && authorization.startsWith('Bearer ') && equal(authorization.slice(7), secret)) return true;
 if (crossOrigin(req)) return false;
 return validSession(cookieValue(req), secret, now());
}

function sessionCookie(value, seconds) {
 return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict${seconds === undefined ? '' : `; Max-Age=${seconds}`}`;
}
function json(res, status, data, headers = {}) {
 res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
 res.end(JSON.stringify(data));
}

/** Routes only /api/auth/status, /api/auth/login and /api/auth/logout. */
export function createAuthHandler({ env = process.env, now = Date.now } = {}) {
 const failures = new Map();
 return async function auth(req, res, pathname) {
  if (pathname === '/api/auth/status') {
   if (req.method !== 'GET') { json(res, 405, { error: 'Use GET.' }, { Allow: 'GET' }); return; }
   json(res, 200, { authenticated: authenticateRequest(req, env.JARVIS_ACCESS_TOKEN, { now }) });
   return;
  }
  if (pathname !== '/api/auth/login' && pathname !== '/api/auth/logout') {
   json(res, 404, { error: 'Not found.' }); return;
  }
  if (req.method !== 'POST') { json(res, 405, { error: 'Use POST.' }, { Allow: 'POST' }); return; }
  if (crossOrigin(req)) { json(res, 403, { error: 'Use JARVIS from its own website.' }); return; }
  if (pathname === '/api/auth/logout') {
   json(res, 200, { authenticated: false }, { 'Set-Cookie': sessionCookie('', 0) });
   return;
  }
  if (!validSecret(env.JARVIS_ACCESS_TOKEN)) {
   json(res, 503, { error: 'The private JARVIS password is not configured on the server.' }); return;
  }
  if (String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') {
   json(res, 415, { error: 'Expected JSON.' }); return;
  }
  const time = now();
  for (const [address, attempts] of failures) {
   const recent = attempts.filter(attempt => time - attempt < LOGIN_WINDOW_MS);
   if (recent.length) failures.set(address, recent); else failures.delete(address);
  }
  const address = req.socket?.remoteAddress || 'local';
  const attempts = failures.get(address) || [];
  if (attempts.length >= MAX_FAILED_LOGINS) {
   const wait = Math.max(1, Math.ceil((attempts[0] + LOGIN_WINDOW_MS - time) / 1000));
   json(res, 429, { error: 'Too many password attempts. Try again in a few minutes.' }, { 'Retry-After': String(wait) }); return;
  }
  let bytes = 0;
  const chunks = [];
  try {
   for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 4096) { json(res, 413, { error: 'Login request is too large.' }); return; }
    chunks.push(chunk);
   }
  } catch { json(res, 400, { error: 'Could not read login request.' }); return; }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { json(res, 400, { error: 'Invalid JSON.' }); return; }
  if (!body || typeof body.password !== 'string' || body.password.length > 1024 || (body.remember !== undefined && typeof body.remember !== 'boolean')) {
   json(res, 400, { error: 'Enter a password and choose whether to remember this device.' }); return;
  }
  if (!equal(body.password, env.JARVIS_ACCESS_TOKEN)) {
   attempts.push(time); failures.set(address, attempts);
   json(res, 401, { error: 'That JARVIS password is incorrect.' }); return;
  }
  failures.delete(address);
  const remember = body.remember !== false;
  const duration = remember ? REMEMBER_SECONDS : TAB_SESSION_SECONDS;
  const token = issueSession(env.JARVIS_ACCESS_TOKEN, Math.floor(time / 1000) + duration);
  json(res, 200, { authenticated: true, remembered: remember }, {
   'Set-Cookie': sessionCookie(token, remember ? REMEMBER_SECONDS : undefined),
  });
 };
}
