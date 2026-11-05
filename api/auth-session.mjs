import { json, readSession } from '../server/github-auth.mjs';

function handler(request) {
  const session = readSession(request);
  return session ? json({ authenticated: true, user: session.user }) : json({ authenticated: false }, 401);
}

export default { fetch: handler };
