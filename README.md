# Nosso Caixa

Controle financeiro responsivo, instalável no celular e preparado para salvar um arquivo JSON por mês em um repositório privado do GitHub.

## Recursos

- Contas mensais e recorrentes, com alertas de vencimento e previsão de saldo.
- Movimentações editáveis, duplicáveis e filtráveis.
- Cartões e compras parceladas distribuídas nas faturas futuras.
- Fechamento do mês, transporte de saldo e registro do valor reservado.
- Divisão de despesas e acerto entre o casal sem distorcer receitas e gastos.
- Histórico comparativo dos meses armazenados no aparelho.

## Executar localmente

Sirva a pasta com qualquer servidor HTTP estático. Por exemplo:

```bash
npx serve .
```

O uso por `file://` não ativa o service worker.

Para visualizar a interface com dados fictícios, acesse `/?demo=1`. A versão normal começa vazia para evitar que exemplos sejam enviados por engano ao repositório.

## Publicar

Ative o GitHub Pages para a branch principal. Mantenha os dados financeiros em outro repositório privado e configure a conexão dentro do aplicativo.

O token refinado deve ter acesso somente ao repositório de dados, com a permissão `Contents: Read and write`. A conexão fica salva no `localStorage` deste aparelho. Ao abrir o aplicativo ou alterar um mês, os dados são sincronizados automaticamente; se a internet estiver indisponível, a cópia local continua funcionando.

## Arquivos mensais

Cada sincronização cria ou atualiza:

```text
dados/AAAA/AAAA-MM.json
dados/config.json
```

O arquivo `config.json` guarda cartões, recorrências e planos de parcelamento. Os arquivos mensais continuam contendo somente os dados daquele período.

Para exportar um relatório, use o botão de download e escolha **Salvar como PDF** na janela de impressão do aparelho.
