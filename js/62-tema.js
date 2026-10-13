'use strict'

/* ---------- Aparência: modo (claro/escuro) e temas de cores ---------- */
const VARIAVEIS_TEMA = ['--fundo', '--superficie', '--superficie-2', '--texto', '--texto-fraco', '--borda', '--destaque', '--destaque-texto', '--destaque-letra']
// Cada tema muda só as variáveis de cor, uma versão para o modo claro e outra para o escuro.
// O tema "Padrão" não muda nada (usa as cores do styles.css).
// Um tema para cada coleção. Cada paleta:
// [fundo, superfície, superfície 2, borda, texto, texto fraco, destaque, texto sobre o destaque (opcional)]
const montarPaleta = p => ({ '--fundo': p[0], '--superficie': p[1], '--superficie-2': p[2], '--borda': p[3], '--texto': p[4], '--texto-fraco': p[5], '--destaque': p[6], ...(p[7] ? { '--destaque-texto': p[7] } : {}) })
const temaDoSet = (nome, set, claro, escuro) => ({ nome, set, claro: montarPaleta(claro), escuro: montarPaleta(escuro) })
const TEMAS = {
	'padrao': { nome: 'Padrão', claro: { '--fundo': '#f4f5f8', '--superficie': '#ffffff', '--destaque': '#d6342c' }, escuro: { '--fundo': '#14161c', '--superficie': '#1e2129', '--destaque': '#f0524a' }, padrao: true },
	// As cores vêm da arte de cada coleção (logo e cartas).
	// Megaevolução: o logo degradê verde-limão → amarelo, sobre preto
	'me01': temaDoSet('Megaevolução', 'me01',
		['#f5f8e4', '#ffffff', '#e8efc4', '#d5e09c', '#1a2108', '#626d38', '#8fb300', '#141a04'],
		['#0c0f06', '#151a0b', '#222b10', '#344217', '#f0f6d8', '#a4b274', '#c6e82a', '#141a04']),
	// Fogo Fantasmagórico: chamas roxas e azuis com letras magenta
	'me02': temaDoSet('Fogo Fantasmagórico', 'me02',
		['#f3eefb', '#ffffff', '#e6dcf5', '#d3c3ec', '#1c1030', '#6a5a8f', '#a02fb5'],
		['#0e0a1f', '#171231', '#241c4a', '#35296b', '#efe9ff', '#a99bd6', '#d65bf0', '#1a0626']),
	// Heróis Excelsos: letras douradas com contorno escuro
	'me02.5': temaDoSet('Heróis Excelsos', 'me02.5',
		['#fdf7e0', '#ffffff', '#f8ebb5', '#ecd98a', '#2a2105', '#776729', '#e8a900', '#1e1802'],
		['#12100a', '#1d1a0e', '#2e2913', '#443c1b', '#fbf3d2', '#c4b67c', '#ffc933', '#1e1802']),
	// Equilíbrio Perfeito: preto e branco com borda verde neon
	'me03': temaDoSet('Equilíbrio Perfeito', 'me03',
		['#f1f3ef', '#ffffff', '#e2e6dc', '#cdd4c3', '#0d0f0b', '#5a6350', '#2fa31a'],
		['#050605', '#0e100c', '#181b14', '#272c20', '#f4f6f0', '#9aa48c', '#58e03a', '#04160a']),
	// Caos Ascendente: azul gelo e respingos de água
	'me04': temaDoSet('Caos Ascendente', 'me04',
		['#eaf5fd', '#ffffff', '#d6eaf9', '#bddcf2', '#0b1f33', '#4a6983', '#107ac2'],
		['#08141f', '#0e2133', '#16344f', '#21496c', '#e6f4ff', '#86abc9', '#38b6ff', '#04182a']),
	// Escuridão Absoluta (Pitch Black): preto com roxo
	'me05': temaDoSet('Escuridão Absoluta', 'me05',
		['#f0ecf8', '#ffffff', '#e1d9f0', '#cdc0e4', '#150c26', '#62548a', '#6a2fd0'],
		['#000000', '#0a0710', '#150f22', '#271c3d', '#ece6fb', '#9588b8', '#9d5cff', '#12062a']),
	// Celebração de 30 Anos: amarelo do Pikachu e o "30" vermelho
	'30th': temaDoSet('Celebração de 30 Anos', '30th',
		['#fff6dc', '#ffffff', '#fbe6a8', '#f2d27a', '#2b1405', '#85602a', '#e0301e'],
		['#1b0f08', '#27160c', '#3b2210', '#55331a', '#fff0d6', '#cfa97c', '#ff5a3c', '#2a0804']),
	// Coleção Clássica: laranja do Charizard, das cartas antigas
	'30th-c': temaDoSet('Coleção Clássica de 30 Anos', '30th-c',
		['#fcf1e4', '#ffffff', '#f6dfc4', '#ebc9a0', '#2a1608', '#7e5c45', '#d9620f'],
		['#170e08', '#231610', '#36231a', '#4d3322', '#fbeadb', '#c8a58a', '#ff8a3d', '#2a1204']),
	// Escarlate e Violeta: violeta do logo, sobre fundo quente
	'sv': temaDoSet('Escarlate e Violeta', 'sv01',
		['#f7f0fb', '#ffffff', '#eadcf6', '#dac6ee', '#22103a', '#6f5a8f', '#8a3fd1'],
		['#130b1c', '#1d1229', '#2c1c40', '#412a5c', '#f3eafc', '#b39bd0', '#c58bff', '#1c0a30']),
	// Espada e Escudo: azul da espada e do escudo
	'swsh': temaDoSet('Espada e Escudo', 'swsh1',
		['#edf1fb', '#ffffff', '#dce4f6', '#c6d2ee', '#0d1633', '#505b82', '#2b4fd6'],
		['#090e1f', '#101830', '#192647', '#26396b', '#e8eeff', '#8d9bc7', '#6f8dff', '#07102b']),
	// Promos MEP: grafite e prata da estrela preta
	'mep': temaDoSet('Promos MEP', 'mep',
		['#f0f1f3', '#ffffff', '#e3e5e9', '#d0d3da', '#13151a', '#5c616c', '#454b59'],
		['#0d0e11', '#17181d', '#23252c', '#33363f', '#eceef2', '#9296a2', '#c3c8d4', '#101216']),
}
const ORDEM_TEMAS = ['padrao', 'me01', 'me02', 'me02.5', 'me03', 'me04', 'me05', '30th', '30th-c', 'mep', 'sv', 'swsh', 'personalizado']
// Temas antigos (v24) → o tema de coleção mais parecido
const TEMAS_ANTIGOS = { oceano: 'me04', floresta: 'me01', 'por-do-sol': '30th-c', sakura: 'me02', 'meia-noite': 'me05', eletrico: 'me02.5', mega: 'me02' }
const idDoTema = () => { const id = ler(CHAVE_PALETA) || 'padrao'; return TEMAS_ANTIGOS[id] || id }

function modoEscuro(modo) {
	return modo === 'escuro' || (modo !== 'claro' && matchMedia('(prefers-color-scheme: dark)').matches)
}

// Contraste entre duas cores (#rrggbb), pela fórmula do WCAG: vai de 1 (igual) a 21 (preto no branco).
function luminancia(cor) {
	const n = parseInt(String(cor).slice(1), 16) || 0
	const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
	return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contraste(a, b) {
	const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
	return (claro + 0.05) / (escuro + 0.05)
}

// Preto ou branco, o que ler melhor em cima da cor escolhida.
function corDeTextoSobre(cor) {
	return contraste('#ffffff', cor) >= contraste('#1b1d24', cor) ? '#ffffff' : '#1b1d24'
}

// Mistura duas cores (#rrggbb); `parte` vai de 0 (só a primeira) a 1 (só a segunda).
function misturar(a, b, parte) {
	const [x, y] = [a, b].map(cor => parseInt(String(cor).slice(1), 16) || 0)
	const canal = desloc => Math.round(((x >> desloc) & 255) * (1 - parte) + ((y >> desloc) & 255) * parte)
	return '#' + ((canal(16) << 16) | (canal(8) << 8) | canal(0)).toString(16).padStart(6, '0')
}

// Ajusta o que depende do destaque para ficar legível (WCAG AA, 4,5:1):
// - o texto em cima dos botões (--destaque-texto) vira preto ou branco se o do tema não ler bem;
// - o destaque usado como cor de letra (--destaque-letra) escurece (no claro) ou clareia (no escuro)
//   até ler bem sobre o fundo e as superfícies. Os botões continuam com a cor original do tema.
function coresComContraste(cores) {
	const resultado = { ...cores }
	const destaque = cores['--destaque']
	if (!cores['--destaque-texto'] || contraste(cores['--destaque-texto'], destaque) < 4.5) resultado['--destaque-texto'] = corDeTextoSobre(destaque)
	const fundos = [cores['--fundo'], cores['--superficie'], cores['--superficie-2']]
	const pior = cor => Math.min(...fundos.map(fundo => contraste(cor, fundo)))
	let letra = destaque
	for (let parte = 0.05; pior(letra) < 4.5 && parte <= 1; parte += 0.05) letra = misturar(destaque, cores['--texto'], parte)
	resultado['--destaque-letra'] = letra
	return resultado
}

// Variáveis do tema escolhido para o modo (claro ou escuro) de agora.
function variaveisDoTema(id, escuro) {
	const cor = ler(CHAVE_COR) || '#d6342c'
	if (id === 'personalizado') return { '--destaque': cor, '--destaque-texto': corDeTextoSobre(cor) }
	const tema = TEMAS[id]
	if (!tema || tema.padrao) return {}
	return tema[escuro ? 'escuro' : 'claro']
}

function aplicarTema(modo) {
	const raiz = document.documentElement
	if (modo === 'claro' || modo === 'escuro') raiz.dataset.tema = modo
	else delete raiz.dataset.tema
	const escuro = modoEscuro(modo)
	for (const variavel of VARIAVEIS_TEMA) raiz.style.removeProperty(variavel)
	const variaveis = variaveisDoTema(idDoTema(), escuro)
	for (const [nome, valor] of Object.entries(variaveis)) raiz.style.setProperty(nome, valor)
	// Com as cores do tema no lugar, lê a paleta completa (o que o tema não muda vem do styles.css) e corrige o contraste.
	const estilo = getComputedStyle(raiz)
	const cores = Object.fromEntries(VARIAVEIS_TEMA.map(nome => [nome, estilo.getPropertyValue(nome).trim()]))
	const corrigidas = coresComContraste(cores)
	for (const nome of ['--destaque-texto', '--destaque-letra']) if (/^#[0-9a-f]{6}$/i.test(corrigidas[nome])) raiz.style.setProperty(nome, corrigidas[nome])
	// Cor da barra do sistema no celular
	const fundo = variaveis['--fundo'] || (escuro ? '#14161c' : '#f4f5f8')
	for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.content = fundo
}

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => aplicarTema(ler(CHAVE_TEMA) || 'auto'))
