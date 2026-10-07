# Minha Coleção TCG (PT-BR)

App (PWA) para marcar as cartas Pokémon TCG da Copag que eu tenho e ver o que falta
em cada set da série **Megaevolução**.

## O que o app faz

- Lista dos sets com a porcentagem completa de cada um (e o total geral).
- Tela do set com as cartas em grade:
  - **toque** numa carta = marca/desmarca "tenho";
  - **toque longo** = mostra a carta grande;
  - filtros **Todas / Faltam / Tenho**.
- Busca por nome ou número (ex.: `pikachu`, `25`, `025/094`), dentro do set ou em todos.
- **Conta (e-mail e senha)** para sincronizar a coleção entre celular e PC (ícone ☁️ no topo).
- Coleção salva também no próprio aparelho, com **exportar/importar backup** (menu ⋮).
- Modo escuro automático (ou escolha manual no menu ⋮).
- Instalável na tela inicial e funciona sem internet (as imagens já vistas ficam guardadas).

Sets incluídos: Megaevolução, Fogo Fantasmagórico, Heróis Excelsos, Equilíbrio Perfeito,
Caos Ascendente, Escuridão Absoluta, Celebração de 30 Anos, Coleção Clássica de 30 Anos
e Promos MEP.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.html` | A página do app |
| `styles.css` | Visual (cores, grade, modo escuro) |
| `app.js` | Toda a lógica (telas, marcar cartas, busca, backup) |
| `nuvem.js` | Login e sincronização com o Firebase |
| `data/cartas.json` | Lista de sets e cartas, gerada a partir do TCGdex |
| `manifest.webmanifest` | Nome e ícone para instalar na tela inicial |
| `sw.js` | Service worker: faz o app funcionar offline |
| `icons/` | Ícones do app |
| `scripts/baixar_imagens.mjs` | Baixa as imagens das cartas (roda no GitHub Actions) |
| `.github/workflows/pages.yml` | Publica o app no GitHub Pages |
| `scripts/gerar_dados.mjs` | Gera o `data/cartas.json` (para atualizar ou adicionar sets) |
| `docs/etapa1-validacao.md` | Análise dos dados em português (Etapa 1) |

## Imagens e publicação (GitHub Pages)

A cada push, o GitHub Actions (`.github/workflows/pages.yml`) baixa as imagens das cartas do
TCGdex (`scripts/baixar_imagens.mjs`, em português e, se não houver, em inglês) para a pasta
`img/` e publica o site no GitHub Pages. O resumo de quantas imagens vieram em PT/inglês
aparece na página da execução, na aba **Actions**.

Se uma imagem não estiver na pasta `img/`, o app tenta buscar direto no TCGdex.

## Testar no computador

Precisa de um servidor simples (abrir o arquivo direto não funciona com service worker):

```bash
python3 -m http.server 8000
```

Depois abra `http://localhost:8000`.

## Atualizar a lista de cartas

```bash
git clone --depth 1 https://github.com/tcgdex/cards-database ../cards-database
node scripts/gerar_dados.mjs ../cards-database
```

Para mudar os sets, edite a lista `SETS` no começo de `scripts/gerar_dados.mjs`.
Depois de mudar qualquer arquivo do app, aumente `VERSAO` em `sw.js` para os
celulares pegarem a versão nova.

## Login e sincronização (Firebase)

- Projeto Firebase: `colecao-tcg-3bd8b` (login por e-mail/senha + banco Firestore).
- Cada usuário tem o documento `colecoes/{id do usuário}` com `{ cartas: { idDoSet: [números] } }`.
- Regras do Firestore: cada pessoa só lê e altera o próprio documento.
- No primeiro login em um aparelho, o que já estava marcado nele é somado ao que está na nuvem.
- Sem internet, as marcações ficam guardadas e são enviadas quando a conexão volta.
