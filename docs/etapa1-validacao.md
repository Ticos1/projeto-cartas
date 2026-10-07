# Etapa 1 — Validação dos dados (TCGdex em português)

Data da análise: 07/10/2026

## Como foi testado

A API (`api.tcgdex.net`) está bloqueada pela rede do ambiente onde rodei o teste,
então analisei direto o **banco de dados oficial do TCGdex no GitHub**
(`github.com/tcgdex/cards-database`), que é exatamente de onde a API tira as
informações. O script usado está em `scripts/cobertura_pt.py`.

> No seu celular a API funciona normalmente — o bloqueio é só do servidor de testes.

## Resultado por coleção (série)

| Série | Sets com nome em PT | Cartas com nome em PT |
|---|---|---|
| Megaevolução (2025–2026) | 10/10 | 1266/1298 |
| Escarlate e Violeta | 18/19 | 3640/3698 |
| Espada e Escudo | 25/26 | 3640/3675 |
| Sol e Lua | 18/18 | 2736/2918 |
| XY | 15/17 | 1593/1932 |
| Preto e Branco | 12/14 | 1175/1437 |
| Antigas (Base, Neo, EX, DP, Platinum, HGSS…) | poucos | 0 |

**Conclusão:** de *Preto e Branco* (2011) até hoje — que é o período em que a
Copag lança cartas no Brasil — praticamente tudo tem nome em português.
As séries antigas não têm dados em PT (na época não havia cartas em português).

## Imagens

- As imagens ficam em `assets.tcgdex.net/pt/...`. Segundo a documentação e outros
  projetos que usam o TCGdex, existem imagens localizadas em PT de
  *Preto e Branco* até os sets mais novos.
- Não consegui baixar uma imagem para confirmar visualmente (rede bloqueada aqui).
- Quando uma carta não tiver imagem em PT, o app vai mostrar a imagem em inglês
  como alternativa, para não ficar buraco na grade.

## Alternativas (caso algo falhe)

1. **Pokémon TCG API (pokemontcg.io)** — muito completa, mas só em inglês.
2. **Liga Pokémon (ligapokemon.com.br)** — tem nomes em PT, mas não tem API pública.
3. **Usar o TCGdex com imagem em inglês** como reserva — é o plano adotado.

## Sets das séries recentes (nome em PT e cartas com nome em PT)

| Série | Set (inglês) | ID | Nome em PT | Cartas PT |
|---|---|---|---|---|
| Mega Evolution | 30th Celebration | `30th` | Celebração de 30 Anos | 161/161 |
| Mega Evolution | 30th Classic Collection | `30th-c` | Coleção Clássica de 30 Anos | 30/30 |
| Mega Evolution | Ascended Heroes | `me02.5` | Heróis Excelsos | 295/295 |
| Mega Evolution | Chaos Rising | `me04` | Caos Ascendente | 122/122 |
| Mega Evolution | MEP Black Star Promos | `mep` | MEP Black Star Promos | 80/112 |
| Mega Evolution | Mega Evolution Energy | `mee` | Megaevolução Energia | 16/16 |
| Mega Evolution | Mega Evolution | `me01` | Megaevolução | 188/188 |
| Mega Evolution | Perfect Order | `me03` | Equilíbrio Perfeito | 124/124 |
| Mega Evolution | Phantasmal Flames | `me02` | Fogo Fantasmagórico | 130/130 |
| Mega Evolution | Pitch Black | `me05` | Escuridão Absoluta | 120/120 |
| Scarlet & Violet | 151 | `sv03.5` | 151 | 207/207 |
| Scarlet & Violet | Black Bolt | `sv10.5b` | Raio Preto | 172/172 |
| Scarlet & Violet | Destined Rivals | `sv10` | Rivais Predestinados | 244/244 |
| Scarlet & Violet | Journey Together | `sv09` | Amigos de Jornada | 190/190 |
| Scarlet & Violet | My First Battle | `mfb` | - | 2/34 |
| Scarlet & Violet | Obsidian Flames | `sv03` | Obsidiana em Chamas | 230/230 |
| Scarlet & Violet | Paldea Evolved | `sv02` | Evoluções em Paldea | 279/279 |
| Scarlet & Violet | Paldean Fates | `sv04.5` | Destinos de Paldea | 245/245 |
| Scarlet & Violet | Paradox Rift | `sv04` | Fenda Paradoxal | 266/266 |
| Scarlet & Violet | Prismatic Evolutions | `sv08.5` | Evoluções Prismáticas | 180/180 |
| Scarlet & Violet | SVP Black Star Promos | `svp` | SVP Black Star Promos | 200/226 |
| Scarlet & Violet | Scarlet & Violet Energy | `sve` | Escarlate e Violeta Energia | 24/24 |
| Scarlet & Violet | Scarlet & Violet | `sv01` | Escarlate e Violeta | 258/258 |
| Scarlet & Violet | Shrouded Fable | `sv06.5` | Fábulas Nebulosas | 99/99 |
| Scarlet & Violet | Stellar Crown | `sv07` | Coroa Estelar | 175/175 |
| Scarlet & Violet | Surging Sparks | `sv08` | Fagulhas Impetuosas | 252/252 |
| Scarlet & Violet | Temporal Forces | `sv05` | Forças Temporais | 218/218 |
| Scarlet & Violet | Twilight Masquerade | `sv06` | Máscaras do Crepúsculo | 226/226 |
| Scarlet & Violet | White Flare | `sv10.5w` | Fogo Branco | 173/173 |
| Sun & Moon | Burning Shadows | `sm3` | Sombras Ardentes | 169/169 |
| Sun & Moon | Celestial Storm | `sm7` | Tempestade Celestial | 183/183 |
| Sun & Moon | Cosmic Eclipse | `sm12` | Eclipse Cósmico | 271/271 |
| Sun & Moon | Crimson Invasion | `sm4` | Invasão Carmim | 124/125 |
| Sun & Moon | Detective Pikachu | `det1` | Detetive Pikachu | 18/19 |
| Sun & Moon | Dragon Majesty | `sm7.5` | Dragões Soberanos | 78/78 |
| Sun & Moon | Forbidden Light | `sm6` | Luz Proibida | 146/146 |
| Sun & Moon | Guardians Rising | `sm2` | Guardiões Ascendentes | 169/169 |
| Sun & Moon | Hidden Fates Shiny Vault | `sma` | Destinos Ocultos Cofre Brilhante | 0/94 |
| Sun & Moon | Hidden Fates | `sm115` | Destinos Ocultos | 0/69 |
| Sun & Moon | Lost Thunder | `sm8` | Trovões Perdidos | 236/236 |
| Sun & Moon | SM Black Star Promos | `smp` | Sol e Lua Promos | 240/248 |
| Sun & Moon | Shining Legends | `sm3.5` | Lendas Luminescentes | 78/78 |
| Sun & Moon | Sun & Moon | `sm1` | Sol e Lua | 163/172 |
| Sun & Moon | Team Up | `sm9` | União de Aliados | 196/196 |
| Sun & Moon | Ultra Prism | `sm5` | Ultra Prisma | 173/173 |
| Sun & Moon | Unbroken Bonds | `sm10` | Elos Inquebráveis | 234/234 |
| Sun & Moon | Unified Minds | `sm11` | Sintonia Mental  | 258/258 |
| Sword & Shield | Astral Radiance Trainer Gallery | `swsh10tg` | Estrelas Radiantes Galeria de Treinador | 30/30 |
| Sword & Shield | Astral Radiance | `swsh10` | Estrelas Radiantes | 216/216 |
| Sword & Shield | Battle Styles | `swsh5` | Estilos de Batalha | 183/183 |
| Sword & Shield | Brilliant Stars Trainer Gallery | `swsh9tg` | Astros Cintilantes Galeria de Treinador | 30/30 |
| Sword & Shield | Brilliant Stars | `swsh9` | Astros Cintilantes | 186/186 |
| Sword & Shield | Celebrations Classic Collection | `cel25cc` | Celebrações Coleção Clássica | 0/25 |
| Sword & Shield | Celebrations | `cel25` | Celebrações | 25/25 |
| Sword & Shield | Champion's Path | `swsh3.5` | Caminho do Campeão | 80/80 |
| Sword & Shield | Chilling Reign | `swsh6` | Reinado Arrepiante | 233/233 |
| Sword & Shield | Crown Zenith Galarian Gallery | `swsh12.5gg` | Realeza Absoluta Galeria de Galar | 70/70 |
| Sword & Shield | Crown Zenith | `swsh12.5` | Realeza Absoluta | 160/160 |
| Sword & Shield | Darkness Ablaze | `swsh3` | Escuridão Incandescente | 201/201 |
| Sword & Shield | Evolving Skies | `swsh7` | Céus em Evolução | 237/237 |
| Sword & Shield | Fusion Strike | `swsh8` | Golpe Fusão | 284/284 |
| Sword & Shield | Lost Origin Trainer Gallery | `swsh11tg` | Origem Perdida Galeria de Treinador | 30/30 |
| Sword & Shield | Lost Origin | `swsh11` | Origem Perdida | 217/217 |
| Sword & Shield | Pokémon Futsal 2020 | `fut2020` | - | 0/5 |
| Sword & Shield | Pokémon GO | `swsh10.5` | Pokémon GO | 88/88 |
| Sword & Shield | Rebel Clash | `swsh2` | Rixa Rebelde | 209/209 |
| Sword & Shield | SWSH Black Star Promos | `swshp` | ESES Promos | 302/307 |
| Sword & Shield | Shining Fates Shiny Vault | `swsh4.5sv` | Destinos Brilhantes Cofre Brilhante | 122/122 |
| Sword & Shield | Shining Fates | `swsh4.5` | Destinos Brilhantes  | 73/73 |
| Sword & Shield | Silver Tempest Trainer Gallery | `swsh12tg` | Tempestade Prateada Galeria de Treinador | 30/30 |
| Sword & Shield | Silver Tempest | `swsh12` | Tempestade Prateada | 215/215 |
| Sword & Shield | Sword & Shield | `swsh1` | Espada e Escudo | 216/216 |
| Sword & Shield | Vivid Voltage | `swsh4` | Voltagem Vívida | 203/203 |
