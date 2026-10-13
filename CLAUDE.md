# Instruções para o Claude

## Como entregar alterações (pedido do dono do projeto)
- O site (e o app Android, que abre o site) é publicado a partir da branch **`claude/pokemon-tcg-pwa-cyu417`**.
- **Sempre** entregue alterações por **pull request** para `claude/pokemon-tcg-pwa-cyu417`.
- **Sempre faça o merge do pull request automaticamente**, sem perguntar, assim que os testes passarem e não houver conflito.
- Antes de abrir o PR: rode `npm test` e, se mudou algum arquivo do app, rode `node scripts/subir_versao.mjs`.

## Idioma
- Responda, escreva commits, PRs e textos do app em **português do Brasil**.
