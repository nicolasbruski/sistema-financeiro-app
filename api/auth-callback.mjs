import {
  appOrigin, createSession, isAllowedUser, oauthStateCookie, oauthVerifierCookie,
  readOAuthVerifier, sessionCookie, verifyOAuthState
} from '../server/github-auth.mjs';

async function handler(request) {
  const url = new URL(request.url);
  if (!verifyOAuthState(request, url.searchParams.get('state'))) return new Response('Estado OAuth inválido ou expirado.', { status: 400 });
  if (url.searchParams.get('error')) return Response.redirect(`${appOrigin(request)}/?auth=denied`, 302);
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code: url.searchParams.get('code'),
      redirect_uri: `${appOrigin(request)}/api/auth-callback`,
      code_verifier: readOAuthVerifier(request)
    })
  });
  const tokenResult = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenResult.access_token) return new Response('Não foi possível concluir o login com o GitHub.', { status: 502 });
  const userResponse = await fetch('https://api.github.com/user', {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${tokenResult.access_token}`, 'User-Agent': 'nosso-caixa' }
  });
  const user = await userResponse.json();
  if (!userResponse.ok) return new Response('Não foi possível identificar o usuário do GitHub.', { status: 502 });
  if (!isAllowedUser(user.login)) return new Response('Este usuário do GitHub não está autorizado.', { status: 403 });
  const session = createSession(tokenResult.access_token, { login: user.login, name: user.name, avatarUrl: user.avatar_url });
  const headers = new Headers({ Location: appOrigin(request) });
  headers.append('Set-Cookie', sessionCookie(request, session));
  headers.append('Set-Cookie', oauthStateCookie(request, '', 0));
  headers.append('Set-Cookie', oauthVerifierCookie(request, '', 0));
  return new Response(null, { status: 302, headers });
}

export default { fetch: handler };
