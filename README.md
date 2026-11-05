# Nosso Caixa

Controle financeiro responsivo e instalável, hospedado na Vercel. Os dados ficam em um arquivo JSON versionado no GitHub e também em uma cópia local no navegador.

## Armazenamento

O aplicativo usa dois níveis de armazenamento:

- **GitHub:** cópia principal online em `data/finances.json`, com histórico de cada alteração em commits.
- **localStorage:** cópia local para carregamento rápido e uso temporário quando a conexão estiver indisponível.

Ao entrar, o aplicativo combina as versões pelo horário da última alteração. Cada mês é combinado separadamente para evitar que dados antigos de um aparelho substituam meses mais novos.

## Acesso com GitHub

O painel usa o fluxo OAuth Web do GitHub, semelhante ao gateway de autenticação usado pelo Decap CMS. O `client_secret` e o token do usuário ficam somente nas Vercel Functions. O navegador recebe um cookie de sessão criptografado, `HttpOnly` e com validade de sete dias.

Somente logins presentes em `GITHUB_ALLOWED_USERS` podem abrir o painel. Não é necessário banco de dados ou serviço de sessão: o token fica criptografado com `SESSION_SECRET`.

## Executar localmente

```bash
npm install
npm run dev
```

O Vite sozinho não executa as Vercel Functions. Para testar login e armazenamento, instale a Vercel CLI, configure as variáveis de desenvolvimento e execute `vercel dev`. Para desenvolvimento local, use outro OAuth App com callback `http://localhost:3000/api/auth-callback` e `APP_URL=http://localhost:3000`.

## Publicar na Vercel

1. Crie um repositório privado separado, por exemplo `nosso-caixa-dados`, com branch `main`. Separá-lo do código evita um novo deploy a cada lançamento financeiro.
2. Em **GitHub > Settings > Developer settings > OAuth Apps**, crie um OAuth App.
3. Na Vercel, clique em **Add New > Project**, importe este repositório e mantenha o preset **Vite**.
4. Depois do primeiro deploy, copie o domínio de produção, por exemplo `https://nosso-caixa.vercel.app`.
5. No OAuth App, use esse domínio como Homepage URL e `https://nosso-caixa.vercel.app/api/auth-callback` como Authorization callback URL.
6. Em **Vercel > Project > Settings > Environment Variables**, configure todas as variáveis de `.env.example`. Em `APP_URL`, informe exatamente o domínio de produção, sem barra no final.
7. Gere `SESSION_SECRET` com pelo menos 32 caracteres aleatórios e faça um novo deploy. O primeiro salvamento cria `data/finances.json` no repositório de dados.

As rotas em `api/` são publicadas automaticamente como Vercel Functions. O arquivo `vercel.json` mantém o service worker sem cache durante atualizações.

O usuário autorizado precisa ter permissão de escrita no repositório configurado. Para repositórios privados, este MVP solicita o escopo OAuth `repo`.

## Estrutura dos dados

- `data/finances.json` no GitHub: configurações e todos os meses em um único JSON pequeno.
- `nosso-caixa:config`: cópia local das configurações.
- `nosso-caixa:AAAA-MM`: cópia local dos dados de cada mês.

## Regras financeiras

- As rendas fixas de Nicolas e Isabella, informadas no planejamento, contam como entradas do mês.
- Entradas avulsas somam à renda fixa; saídas pagas reduzem o saldo; contas pendentes afetam apenas a projeção.
- O saldo trazido do mês anterior compõe o saldo atual, mas não é contado novamente como renda.
- Transferências entre Nicolas, Isabella e o saldo compartilhado apenas redistribuem o dinheiro e não alteram entradas, saídas ou saldo total.
