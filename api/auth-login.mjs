import crypto from 'node:crypto';
import { appOrigin, createOAuthState, oauthStateCookie, oauthVerifierCookie } from '../server/github-auth.mjs';

async function handler(request) {
  if (!process.env.GITHUB_CLIENT_ID) return new Response('GITHUB_CLIENT_ID não configurado.', { status: 500 });
  const origin = appOrigin(request);
  if (new URL(request.url).origin !== origin) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${origin}/api/auth-login?v=2`, 'Cache-Control': 'no-store' }
    });
  }
  const state = createOAuthState();
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: `${origin}/api/auth-callback`,
    scope: 'repo',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });
  const headers = new Headers({
    Location: `https://github.com/login/oauth/authorize?${params}`,
    'Cache-Control': 'no-store'
  });
  headers.append('Set-Cookie', oauthStateCookie(request, state));
  headers.append('Set-Cookie', oauthVerifierCookie(request, verifier));
  return new Response(null, { status: 302, headers });
}

export default { fetch: handler };
