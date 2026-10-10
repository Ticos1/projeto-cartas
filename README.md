# Ticards — coleção Pokémon TCG (PT-BR)

| | |
|---|---|
| 🌐 **Site (PC e celular)** | **https://ticos1.github.io/projeto-cartas/** |
| 📲 **App Android (APK)** | **[Baixar colecao-tcg.apk](https://github.com/Ticos1/projeto-cartas/releases/latest/download/colecao-tcg.apk)** |

> Para instalar o APK: abra o link no celular Android, toque no arquivo baixado e, se o
> Android pedir, permita "instalar apps desta fonte".

App (PWA) para marcar as cartas Pokémon TCG da Copag que eu tenho e ver o que falta
em cada set da série **Megaevolução**.

## O que o app faz

- **Abas** pelo botão de três riscos (canto superior esquerdo): **Pesquisa** (a primeira, abre por
  padrão) e **Coleções**.
- Aba **Pesquisa**: busca por nome ou número em todos os sets, com filtros de set, raridade e
  situação (Todas / Faltam / Tenho).
- Aba **Coleções**: lista dos sets com a porcentagem completa de cada um (e o total geral).
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

Para mudar os sets, edite a lista `SERIES` no começo de `scripts/gerar_dados.mjs`.
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
partículas. Comum não tem efeito. Os efeitos aparecem só na entrada da carta (cerca de 2 segundos)
e depois somem, deixando a carta limpa. Para mudar ou criar um efeito, edite essa tabela.
Quem desligou as animações no celular vê só um clarão rápido, sem movimento.

## Abas

- Endereços: `#/pesquisa` (padrão), `#/colecoes` e `#/set/ID` (um set fica dentro de Coleções).
- A gaveta (três riscos) é uma sobreposição no histórico: o botão voltar do celular só a fecha.
- Para criar uma aba nova: um item em `<nav class="gaveta">` no `index.html`, uma função
  `telaXxx()` em `app.js` e o caso correspondente em `rotaAtual()` e `navegar()`.

## Filtros com ícones (Pesquisa)

- **Coleção:** lista com o logo de cada set.
- **Raridade:** lista com os mesmos símbolos impressos no canto da carta (● ◆ ★ ★★ …).
  Os desenhos estão em `FORMAS_SIMBOLO` / `SIMBOLOS_RARIDADE` em `app.js`; a cor do "preto"
  muda com o tema (`--simbolo-preto` em `styles.css`).

## Configurações (Temas e Logs)
Aba **Configurações** (☰ ou ⋮ → "Temas, modo claro/escuro e logs").
- **Temas**: Modo Automático/Claro/Escuro, um tema para cada coleção (Megaevolução, Fogo Fantasmagórico, Heróis Excelsos, Equilíbrio Perfeito, Caos Ascendente, Escuridão Absoluta, Celebração de 30 Anos, Clássica de 30 Anos, Promos MEP) mais o Padrão e uma **cor personalizada**. A escolha fica salva no aparelho.
- **Logs**: registro de erros, avisos e eventos do app (início, login, sincronização, atualizações). Dá para filtrar, copiar, compartilhar como arquivo e limpar. Ficam só no aparelho (máximo de 300).

## Lista de Desejos
- Segure uma carta; quando ela termina de girar, aparece uma **estrela** no canto superior direito. Tocar na estrela põe (ou tira) a carta da **Lista de Desejos**.
- A aba **Lista de Desejos** (☰) mostra essas cartas, com filtro de coleção e de raridade. Cartas da lista ganham uma estrelinha amarela na grade.
- A lista fica salva no aparelho e sincroniza pela conta (campo `desejos` do documento no Firestore) e entra no backup.
- **Comprar na Liga**: além de abrir carta por carta, a tela tem a **Compra por Lista**: o app copia a lista ("1 Nome (número/total)") e abre a Compra por Lista da Liga, onde você cola, filtra NM/estado e põe tudo no carrinho. Na Lista de Desejos, o botão "Comprar na Liga Pokémon" abre uma lista das cartas desejadas que você ainda não tem (respeitando os filtros). "Abrir próxima" abre a carta na Liga, onde você filtra NM e uma loja do seu estado; o app marca quais já foram abertas e mostra o progresso. (A Liga não permite montar o carrinho automaticamente.)

## Séries incluídas
**Megaevolução** (9 coleções), **Escarlate e Violeta** (19) e **Espada e Escudo** (26): 54 coleções e cerca de 8.600 cartas. Na aba Coleções e no filtro de coleção elas aparecem agrupadas por série.
Nas séries Escarlate e Violeta e Espada e Escudo o site guarda só a imagem pequena de cada carta (para caber no limite do GitHub Pages); a imagem grande, ao segurar a carta, vem direto do TCGdex e precisa de internet na primeira vez.

## Escolher quais coleções aparecem
Em **Coleções**, o botão **Escolher coleções** abre uma lista com um interruptor para cada coleção (e "Todas / Nenhuma" por série). As desligadas somem de Coleções, da Pesquisa e dos filtros; o que já foi marcado continua salvo e a Lista de Desejos não muda. A escolha fica salva no aparelho e sincroniza pela conta (campo `colecoesEscondidas`).

## Segurança
- **Dados na nuvem:** as regras do Firestore só deixam cada pessoa ler e escrever o próprio documento (`colecoes/{uid}`). Testado: sem login nada é lido; logado, não dá para ler, listar ou alterar o documento de outra pessoa nem criar outras coleções.
- **Senhas:** ficam só no Firebase Authentication (o app nunca guarda a senha).
- **Atualização do APK:** o app só baixa APKs de `github.com/Ticos1/projeto-cartas/releases/…` e, antes de abrir o instalador, confere se o arquivo é do mesmo app e assinado com a mesma chave; se não for, apaga o arquivo. O próprio Android também recusa uma atualização assinada com outra chave.
- **APK:** sem backup automático dos dados do app (`allowBackup=false`), sem tráfego sem criptografia, e só as permissões de internet e de instalar a própria atualização.
- **Chave de assinatura:** fica só nos segredos do GitHub (nunca no repositório).

## Como usar o app (tutorial)
Aba **Como usar o app** (primeira do menu ☰): um guia passo a passo de todas as funções. Ela é a tela que aparece sempre que o app é aberto; o botão **Começar a usar** leva para a Pesquisa.

## Anúncios (AdMob, só no app Android)
- Um quadrado (300×250, "Publicidade") que aparece **só com a gaveta ☰ aberta**, no espaço vazio embaixo das abas. Com a gaveta fechada não há anúncio. Em telas baixas, onde não cabe, não aparece. O site (PC) não tem anúncio.
- Hoje estão os **IDs de teste do Google** (aparece "Test Ad"). Para ganhar dinheiro, crie uma conta no AdMob e troque:
  - o **ID do app** em `android-app/android/app/src/main/AndroidManifest.xml` (`com.google.android.gms.ads.APPLICATION_ID`) — precisa gerar APK novo;
  - o **ID do bloco de anúncios (banner)** em `bloco` e `teste: false` na constante `ANUNCIO` do `app.js` — muda pelo site, sem APK novo.
- O AdMob usa o ID de publicidade do aparelho; é preciso ter uma política de privacidade publicada para usar anúncios de verdade.
