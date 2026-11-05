import crypto from 'node:crypto';

const SESSION_COOKIE = 'nosso_caixa_session';
const OAUTH_STATE_COOKIE = 'nosso_caixa_oauth_state';
const OAUTH_VERIFIER_COOKIE = 'nosso_caixa_oauth_verifier';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
});

export function appOrigin(request) {
  return (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, '');
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.get('cookie') || '').split(';').map(part => {
    const [name, ...value] = part.trim().split('=');
    return [name, decodeURIComponent(value.join('='))];
  }).filter(([name]) => name));
}

function cookie(request, name, value, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function sessionCookie(request, value, maxAge = SESSION_TTL_SECONDS) {
  return cookie(request, SESSION_COOKIE, value, maxAge);
}

export function oauthStateCookie(request, state, maxAge = 600) {
  return cookie(request, OAUTH_STATE_COOKIE, state, maxAge);
}

export function oauthVerifierCookie(request, verifier, maxAge = 600) {
  return cookie(request, OAUTH_VERIFIER_COOKIE, verifier, maxAge);
}

export function readOAuthVerifier(request) { return parseCookies(request)[OAUTH_VERIFIER_COOKIE] || ''; }

function sessionKey() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET deve ter pelo menos 32 caracteres.');
  }
  return crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest();
}

export function createOAuthState() {
  const value = `${crypto.randomBytes(24).toString('hex')}.${Date.now()}`;
  const signature = crypto.createHmac('sha256', sessionKey()).update(value).digest('base64url');
  return `${value}.${signature}`;
}

export function verifyOAuthState(request, state) {
  const [nonce, timestamp, signature] = String(state || '').split('.');
  if (!nonce || !timestamp || !signature || Date.now() - Number(timestamp) > 10 * 60 * 1000) return false;
  const expected = crypto.createHmac('sha256', sessionKey()).update(`${nonce}.${timestamp}`).digest('base64url');
  const cookieState = parseCookies(request)[OAUTH_STATE_COOKIE] || '';
  return signature.length === expected.length
    && cookieState.length === String(state).length
    && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    && crypto.timingSafeEqual(Buffer.from(cookieState), Buffer.from(String(state)));
}

export function createSession(token, user) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey(), iv);
  const payload = Buffer.from(JSON.stringify({ token, user, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 }));
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(value => value.toString('base64url')).join('.');
}

export function readSession(request) {
  try {
    const [iv, tag, encrypted] = String(parseCookies(request)[SESSION_COOKIE] || '').split('.').map(value => Buffer.from(value, 'base64url'));
    if (!iv?.length || !tag?.length || !encrypted?.length) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', sessionKey(), iv);
    decipher.setAuthTag(tag);
    const session = JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'));
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export function requireSession(request) {
  const session = readSession(request);
  if (!session) throw Object.assign(new Error('Faça login com o GitHub para continuar.'), { status: 401 });
  return session;
}

export function isAllowedUser(login) {
  const allowed = (process.env.GITHUB_ALLOWED_USERS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  return allowed.length > 0 && allowed.includes(String(login || '').toLowerCase());
}
