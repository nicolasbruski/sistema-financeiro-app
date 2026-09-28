# Nosso Caixa

Controle financeiro responsivo, instalável no celular e preparado para salvar um arquivo JSON por mês em um repositório privado do GitHub.

## Executar localmente

Sirva a pasta com qualquer servidor HTTP estático. Por exemplo:

```bash
npx serve .
```

O uso por `file://` não ativa o service worker.

Para visualizar a interface com dados fictícios, acesse `/?demo=1`. A versão normal começa vazia para evitar que exemplos sejam enviados por engano ao repositório.

## Publicar

Ative o GitHub Pages para a branch principal. Mantenha os dados financeiros em outro repositório privado e configure a conexão dentro do aplicativo.

O token refinado deve ter acesso somente ao repositório de dados, com a permissão `Contents: Read and write`. Ele é mantido em `sessionStorage`, portanto precisa ser informado novamente quando a sessão do navegador terminar.

## Arquivos mensais

Cada sincronização cria ou atualiza:

```text
dados/AAAA/AAAA-MM.json
```

Para exportar um relatório, use o botão de download e escolha **Salvar como PDF** na janela de impressão do aparelho.
