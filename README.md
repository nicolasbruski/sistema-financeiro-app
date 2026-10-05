# Nosso Caixa

Controle financeiro responsivo e instalável, com dados compartilhados entre computador e celular pelo Supabase e hospedagem estática no Netlify.

## Configurar o Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**, cole o conteúdo de `supabase.sql` e execute.
3. Em **Authentication > Users**, crie um usuário com e-mail e senha. Use `210321` como senha para manter o acesso por PIN.
4. Em **Project Settings > API**, copie a Project URL e a chave pública (`publishable` ou `anon`). Nunca use a chave `service_role` no navegador.
5. Preencha `supabase-config.js`:

```js
window.NOSSO_CAIXA_CONFIG = {
  supabaseUrl: 'https://seu-projeto.supabase.co',
  supabaseAnonKey: 'sua-chave-publica',
  authEmail: 'o-mesmo-email-do-usuario-criado'
};
```

A chave pública e a URL podem ficar no frontend. As políticas RLS de `supabase.sql` garantem que somente o usuário autenticado leia e altere os próprios dados.

## Migrar os dados existentes

Abra a nova versão no aparelho que contém os dados atuais e entre com o PIN. No primeiro acesso, os meses e configurações encontrados no `localStorage` são enviados automaticamente ao Supabase. A cópia local é mantida como cache para uso sem conexão.

Faça essa primeira entrada no aparelho com os dados mais completos antes de acessar pelo segundo dispositivo.

## Executar localmente

Sirva a pasta com um servidor HTTP estático:

```bash
npx serve .
```

O uso por `file://` não ativa o service worker.

## Publicar no Netlify

Crie um site no Netlify e publique esta pasta. O arquivo `netlify.toml` já define a raiz como diretório de publicação e evita cache persistente do service worker e da configuração.

O site não precisa de funções de servidor: o navegador conversa diretamente com o Supabase usando a sessão autenticada e as políticas RLS.

## Estrutura dos dados

- `monthly_data`: um documento JSON por usuário e mês.
- `app_config`: cartões, recorrências, parcelamentos e preferências.
- `localStorage`: cache offline e origem da importação inicial.

As alterações são salvas automaticamente. Quando dois aparelhos estão abertos, o Supabase Realtime distribui a versão mais recente.

## Regras financeiras

- As rendas fixas de Nicolas e Isabella, informadas no planejamento, contam como entradas do mês.
- Entradas avulsas somam à renda fixa; saídas pagas reduzem o saldo; contas pendentes afetam apenas a projeção.
- O saldo trazido do mês anterior compõe o saldo atual, mas não é contado novamente como renda.
- Transferências entre Nicolas, Isabella e o saldo compartilhado apenas redistribuem o dinheiro e não alteram entradas, saídas ou saldo total.
- O histórico usa as mesmas regras do painel: renda fixa mais entradas avulsas, sem duplicar o saldo inicial.
