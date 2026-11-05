import { json, sessionCookie } from '../server/github-auth.mjs';

function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(request, '', 0) });
}

export default { fetch: handler };
