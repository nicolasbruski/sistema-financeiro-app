import { json, requireSession } from '../server/github-auth.mjs';

const MAX_BODY_SIZE = 2 * 1024 * 1024;

function githubConfig() {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const path = process.env.GITHUB_DATA_PATH || 'data/finances.json';
  const branch = process.env.GITHUB_BRANCH || 'main';
  if (!owner || !repo) throw Object.assign(new Error('GITHUB_OWNER e GITHUB_REPO não configurados.'), { status: 500 });
  return { owner, repo, path, branch };
}

function apiPath({ owner, repo, path }) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;
}

function githubHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'nosso-caixa'
  };
}

async function readGithubFile(token, config) {
  const response = await fetch(`${apiPath(config)}?ref=${encodeURIComponent(config.branch)}`, { headers: githubHeaders(token) });
  if (response.status === 404) return { data: null, sha: null };
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.message || 'Não foi possível ler o JSON no GitHub.'), { status: response.status });
  try {
    const content = Buffer.from(String(result.content || '').replace(/\n/g, ''), 'base64').toString('utf8');
    return { data: JSON.parse(content), sha: result.sha };
  } catch {
    throw Object.assign(new Error('O arquivo de dados no GitHub não contém um JSON válido.'), { status: 422 });
  }
}

function newer(first, second) {
  return new Date(first?.updatedAt || 0).getTime() > new Date(second?.updatedAt || 0).getTime();
}

function mergeData(stored, incoming) {
  const current = stored && typeof stored === 'object' ? stored : {};
  const next = incoming && typeof incoming === 'object' ? incoming : {};
  const currentMonths = current.months && typeof current.months === 'object' ? current.months : {};
  const nextMonths = next.months && typeof next.months === 'object' ? next.months : {};
  const months = { ...currentMonths };
  Object.entries(nextMonths).forEach(([key, value]) => {
    if (/^\d{4}-\d{2}$/.test(key) && value && typeof value === 'object' && (!months[key] || newer(value, months[key]))) months[key] = value;
  });
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    config: !current.config || newer(next.config, current.config) ? next.config : current.config,
    months
  };
}

async function writeGithubFile(token, config, data, sha) {
  const body = {
    message: `chore(data): atualizar finanças em ${new Date().toISOString()}`,
    content: Buffer.from(`${JSON.stringify(data, null, 2)}\n`, 'utf8').toString('base64'),
    branch: config.branch,
    ...(sha ? { sha } : {})
  };
  const response = await fetch(apiPath(config), {
    method: 'PUT',
    headers: { ...githubHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.message || 'Não foi possível salvar o JSON no GitHub.'), { status: response.status });
}

async function handler(request) {
  try {
    const { token } = requireSession(request);
    const config = githubConfig();
    if (request.method === 'GET') return json({ data: (await readGithubFile(token, config)).data });
    if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
    const declaredSize = Number(request.headers.get('content-length') || 0);
    if (declaredSize > MAX_BODY_SIZE) return json({ error: 'Os dados ultrapassam o limite de 2 MB.' }, 413);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > MAX_BODY_SIZE) return json({ error: 'Os dados ultrapassam o limite de 2 MB.' }, 413);
    let incoming;
    try { incoming = JSON.parse(raw); } catch { return json({ error: 'JSON inválido.' }, 400); }
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return json({ error: 'Formato de dados inválido.' }, 400);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const stored = await readGithubFile(token, config);
      const merged = mergeData(stored.data, incoming);
      try {
        await writeGithubFile(token, config, merged, stored.sha);
        return json({ data: merged });
      } catch (error) {
        if (error.status !== 409 || attempt === 1) throw error;
      }
    }
  } catch (error) {
    console.error(error);
    return json({ error: error.message || 'Erro interno.', authRequired: error.status === 401 }, error.status || 500);
  }
}

export default { fetch: handler };
