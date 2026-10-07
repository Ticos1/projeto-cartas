# Minha Coleção TCG (PT-BR)

| | |
|---|---|
| 🌐 **Site (PC e celular)** | **https://ticos1.github.io/projeto-cartas/** |
| 📲 **App Android (APK)** | **[Baixar colecao-tcg.apk](https://github.com/Ticos1/projeto-cartas/releases/latest/download/colecao-tcg.apk)** |

> Para instalar o APK: abra o link no celular Android, toque no arquivo baixado e, se o
> Android pedir, permita "instalar apps desta fonte".

App (PWA) para marcar as cartas Pokémon TCG da Copag que eu tenho e ver o que falta
em cada set da série **Megaevolução**.

## O que o app faz

- Lista dos sets com a porcentagem completa de cada um (e o total geral).
- Tela do set com as cartas em grade:
  - **toque** numa carta = marca/desmarca "tenho";
  - **toque longo** = mostra a carta grande, com o botão de **comprar na Liga Pokémon**
    (nas cartas que faltam);
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

## App Android (APK)

- Pasta `android-app/`: projeto [Capacitor](https://capacitorjs.com) que abre o site
  `https://ticos1.github.io/projeto-cartas/` em tela cheia. Mudanças no site aparecem no app
  sem precisar de APK novo.
- O GitHub Actions (`.github/workflows/android.yml`) gera o APK quando algo em `android-app/`
  muda (ou manualmente na aba Actions) e publica em **Releases**.
- Link fixo do APK mais recente:
  https://github.com/Ticos1/projeto-cartas/releases/latest/download/colecao-tcg.apk
- O app avisa quando existe um APK mais novo (`verificarVersaoDoApp` em `app.js`).
- Assinatura: a chave e a senha ficam **só** nos segredos do repositório
  (`ANDROID_KEYSTORE_BASE64` e `ANDROID_KEYSTORE_PASSWORD`), nunca no código.
  Guarde uma cópia delas: sem a mesma chave, atualizações não instalam por cima do app.

## Liga Pokémon (botão de comprar)

- O botão aparece ao segurar uma carta que **ainda não foi marcada** e abre a página da carta em
  `ligapokemon.com.br`. O formato do endereço é `?view=cards/card&card=Nome(número/total)`,
  copiado dos links públicos da própria Liga (ver `linkLiga` em `app.js`).
- Na Coleção Clássica de 30 Anos e nas Promos MEP a numeração da Liga é diferente da nossa;
  nelas o botão abre a **busca da Liga pelo nome** da carta.
- A Liga protege as páginas internas contra robôs, então os links não são testados
  automaticamente: confira algumas cartas depois de mudar essa parte.

## Botão voltar do celular

- No app Android, `MainActivity.java` faz o botão voltar andar no histórico do site
  (tela anterior). Só fecha o app quando não há mais para onde voltar (na lista de sets).
- No site (`app.js`, seção "Botão voltar do celular"): a carta grande e o menu ganham uma
  entrada no histórico, então o voltar só os fecha; e um set sempre tem a lista logo abaixo,
  mesmo se o app foi aberto direto nele.

## Atualização do app feita pelo próprio app

- `AtualizadorPlugin.java` (peça nativa do APK): baixa o APK novo com o gerenciador de downloads
  do Android (progresso na notificação) e abre o instalador. Só baixa de
  `github.com/Ticos1/projeto-cartas/releases/`.
- No site (`app.js`, "Atualização do app feita pelo próprio app"): o aviso verde e o botão
  **Atualizar agora** (menu ⋮ → App Android) mostram o progresso e pedem ao Android, uma vez,
  a permissão "Permitir desta fonte".
- APKs antigos (sem a peça) e o navegador usam o link de download comum.
- Cada versão é publicada com nome próprio (`colecao-tcg-1.N.apk`).

## Efeitos de raridade

Quando a carta termina de girar e para de frente, ela solta efeitos conforme a raridade
(`EFEITOS_RARIDADE` em `app.js`): brilho que passa, halo colorido, reflexo holográfico e
partículas. Comum não tem efeito. Para mudar ou criar um efeito, edite essa tabela.
Quem desligou as animações no celular vê só um halo parado.
