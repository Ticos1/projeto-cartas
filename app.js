'use strict'

/* =========================================================
   Minha Coleção TCG
   - data/cartas.json: lista de sets e cartas (gerada por scripts/gerar_dados.mjs)
   - localStorage: quais cartas eu tenho
   ========================================================= */

const CHAVE_COLECAO = 'colecao-tcg'
const CHAVE_DESEJOS = 'colecao-tcg-desejos'
const CHAVE_ESCONDIDAS = 'colecao-tcg-colecoes-escondidas'
const CHAVE_LIGA_ABERTAS = 'colecao-tcg-liga-abertas'
const CHAVE_TEMA = 'colecao-tcg-tema'
const CHAVE_SEM_MASTER = 'colecao-tcg-sem-master-set'
const CHAVE_PALETA = 'colecao-tcg-paleta'
const CHAVE_COR = 'colecao-tcg-cor-destaque'
const CHAVE_LOGS = 'colecao-tcg-logs'
const IMAGENS = 'https://assets.tcgdex.net'
const VERSAO_APP = 'v33'   // mantenha igual à VERSAO do sw.js

let dados = null              // conteúdo de data/cartas.json
let colecao = {}              // { idDoSet: Set(['001', '002', ...]) }
let nuvem = null              // módulo nuvem.js (login e sincronização), quando disponível
let usuario = null            // { email } de quem está logado
const filtros = {}            // filtro escolhido em cada set: 'todas' | 'faltam' | 'tenho'
const buscas = {}             // texto da busca em cada tela

const $ = seletor => document.querySelector(seletor)
const tela = $('#tela')

/* ---------- Armazenamento seguro (localStorage pode falhar em modo privado) ---------- */
function ler(chave) {
	try { return localStorage.getItem(chave) } catch { return null }
}
function gravar(chave, valor) {
	try { localStorage.setItem(chave, valor); return true } catch { return false }
}

/* ---------- Logs: registro de erros e eventos do app (ficam só neste aparelho) ---------- */
const MAX_LOGS = 300
let logs = []
try { logs = JSON.parse(ler(CHAVE_LOGS) || '[]') } catch { logs = [] }
let gravacaoDosLogs = 0

function textoDe(valor) {
	if (valor instanceof Error) return `${valor.name}: ${valor.message}`
	if (typeof valor === 'object' && valor !== null) { try { return JSON.stringify(valor) } catch { return String(valor) } }
	return String(valor)
}

// nivel: 'info' | 'aviso' | 'erro'
function registrar(nivel, mensagem, detalhe = '') {
	logs.push({ t: Date.now(), n: nivel, m: textoDe(mensagem).slice(0, 400), d: textoDe(detalhe).slice(0, 800) })
	if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS)
	clearTimeout(gravacaoDosLogs)
	gravacaoDosLogs = setTimeout(() => gravar(CHAVE_LOGS, JSON.stringify(logs)), 400)
	if (typeof atualizarListaLogs === 'function') atualizarListaLogs()
}

// Erros que o navegador não trata e avisos/erros que o próprio código escreve no console.
window.addEventListener('error', evento => registrar('erro', evento.message || 'Erro de script', evento.filename ? `${evento.filename.split('/').pop()}:${evento.lineno}:${evento.colno}` : ''))
window.addEventListener('unhandledrejection', evento => registrar('erro', `Promessa rejeitada: ${textoDe(evento.reason?.message || evento.reason)}`))
for (const [metodo, nivel] of [['warn', 'aviso'], ['error', 'erro']]) {
	const original = console[metodo].bind(console)
	console[metodo] = (...argumentos) => { registrar(nivel, argumentos.map(textoDe).join(' ')); original(...argumentos) }
}

/* ---------- Coleção ---------- */
function carregarColecao() {
	colecao = {}
	try {
		const salvo = JSON.parse(ler(CHAVE_COLECAO) || '{}')
		for (const [set, numeros] of Object.entries(salvo.cartas || {})) {
			colecao[set] = new Set(numeros)
		}
	} catch { /* coleção vazia */ }
}

function colecaoComoObjeto() {
	const cartas = {}
	for (const [set, numeros] of Object.entries(colecao)) {
		if (numeros.size) cartas[set] = [...numeros]
	}
	return cartas
}

function salvarColecao() {
	const ok = gravar(CHAVE_COLECAO, JSON.stringify({ versao: 1, cartas: colecaoComoObjeto() }))
	if (!ok) avisar('Não foi possível salvar. O navegador está em modo privado?')
}

/* ---------- Lista de desejos ---------- */
let desejos = {}   // { idDoSet: Set(['001', ...]) }
function carregarDesejos() {
	desejos = {}
	try {
		for (const [set, numeros] of Object.entries(JSON.parse(ler(CHAVE_DESEJOS) || '{}'))) desejos[set] = new Set(numeros)
	} catch { /* lista vazia */ }
}
function desejosComoObjeto() {
	const lista = {}
	for (const [set, numeros] of Object.entries(desejos)) if (numeros.size) lista[set] = [...numeros]
	return lista
}
function salvarDesejos() { gravar(CHAVE_DESEJOS, JSON.stringify(desejosComoObjeto())) }
const desejada = (setId, numero) => desejos[setId]?.has(numero) || false
function alternarDesejo(setId, numero) {
	const numeros = desejos[setId] || (desejos[setId] = new Set())
	if (numeros.has(numero)) numeros.delete(numero)
	else numeros.add(numero)
	salvarDesejos()
	nuvem?.marcarDesejoNaNuvem(setId, numero, numeros.has(numero))
	return numeros.has(numero)
}

function tenho(setId, numero) {
	return colecao[setId]?.has(numero) || false
}

function alternar(setId, numero) {
	const numeros = colecao[setId] || (colecao[setId] = new Set())
	if (numeros.has(numero)) numeros.delete(numero)
	else numeros.add(numero)
	salvarColecao()
	nuvem?.marcarNaNuvem(setId, numero, numeros.has(numero))
	return numeros.has(numero)
}

/* ---------- Master set ---------- */
// Master set = todas as cartas do set, incluindo as especiais (secretas, numeradas acima
// do total oficial, ex.: 133/132). Vem ligado por padrão; a lista guarda os sets DESLIGADOS.
let semMasterSet = new Set()
try { semMasterSet = new Set(JSON.parse(ler(CHAVE_SEM_MASTER) || '[]')) } catch { /* padrão: todos ligados */ }

/* ---------- Coleções escondidas ---------- */
// O usuário escolhe quais coleções acompanha. As escondidas somem de Coleções, da Pesquisa e dos filtros
// (a lista de desejos continua mostrando as cartas que ele desejou). O que já foi marcado não se perde.
let escondidas = new Set()
try { escondidas = new Set(JSON.parse(ler(CHAVE_ESCONDIDAS) || '[]')) } catch { /* todas visíveis */ }
const colecaoVisivel = set => !escondidas.has(set.id)
const setsVisiveis = () => dados.sets.filter(colecaoVisivel)

function definirEscondidas(ids, esconder) {
	for (const id of ids) { if (esconder) escondidas.add(id); else escondidas.delete(id) }
	gravar(CHAVE_ESCONDIDAS, JSON.stringify([...escondidas]))
	nuvem?.escondidasNaNuvem(ids, esconder)
	if (pesquisa.set && escondidas.has(pesquisa.set)) pesquisa.set = ''
}

function cartaNormal(set, carta) {
	return /^\d+$/.test(carta.n) && parseInt(carta.n, 10) <= set.oficiais
}

// Só mostra o botão de master set quando o set tem cartas normais e especiais.
function temCartasEspeciais(set) {
	return set.oficiais > 0 && set.cartas.some(c => !cartaNormal(set, c))
}

function masterSetLigado(set) {
	return !semMasterSet.has(set.id)
}

// Cartas que contam para o set, conforme o master set está ligado ou não.
function cartasDoSet(set) {
	if (masterSetLigado(set) || !temCartasEspeciais(set)) return set.cartas
	return set.cartas.filter(c => cartaNormal(set, c))
}

function definirMasterSet(set, ligado) {
	if (ligado) semMasterSet.delete(set.id)
	else semMasterSet.add(set.id)
	gravar(CHAVE_SEM_MASTER, JSON.stringify([...semMasterSet]))
	nuvem?.masterSetNaNuvem(set.id, ligado)
}

function progresso(set) {
	const numeros = colecao[set.id]
	const cartas = cartasDoSet(set)
	const tem = numeros ? cartas.filter(c => numeros.has(c.n)).length : 0
	return { tem, total: cartas.length, pct: Math.floor((tem / cartas.length) * 100) }
}

/* ---------- Imagens ---------- */
// Ordem: cópia publicada junto com o app (pasta img/) → TCGdex em português → TCGdex em inglês.
// Sets "altaOnline" (séries antigas) não guardam a imagem grande no site: ela vem direto do TCGdex.
function fontesImagem(setId, arquivo) {
	const set = dados.sets.find(s => s.id === setId)
	const fontes = [
		`${IMAGENS}/pt/${set?.serie}/${setId}/${arquivo}`,
		`${IMAGENS}/en/${set?.serie}/${setId}/${arquivo}`,
	]
	if (set?.altaOnline && arquivo.endsWith('/high.webp')) return fontes
	return [`img/${setId}/${arquivo}`, ...fontes]
}

// Tenta cada endereço até um funcionar; se nenhum funcionar, chama semImagem().
function carregarEmOrdem(img, fontes, semImagem) {
	let i = 0
	img.onerror = () => {
		i++
		if (i < fontes.length) img.src = fontes[i]
		else semImagem()
	}
	img.hidden = false
	img.src = fontes[0]
}

// Imagem da carta; enquanto carrega (ou se não existir), aparece o nome da carta.
function carregarImagem(img, setId, numero, qualidade) {
	img.onload = () => img.parentElement.classList.add('com-imagem')
	img.parentElement.classList.remove('com-imagem')
	carregarEmOrdem(img, fontesImagem(setId, `${numero}/${qualidade}.webp`), () => { img.hidden = true })
}

/* ---------- Ajudantes ---------- */
function semAcento(texto) {
	return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function numeroExibido(set, carta) {
	return set.oficiais && /^\d+$/.test(carta.n) ? `${carta.n.padStart(3, '0')}/${String(set.oficiais).padStart(3, '0')}` : carta.n
}

function dataBr(iso) {
	const [ano, mes, dia] = iso.split('-')
	return `${dia}/${mes}/${ano}`
}

function escapar(texto) {
	return String(texto).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// A busca aceita nome ("pikachu") ou número ("25", "025" ou "25/132").
function combina(carta, busca) {
	if (!busca) return true
	const numeroBuscado = busca.split('/')[0].trim()
	if (/^\d+$/.test(numeroBuscado)) {
		return parseInt(carta.n, 10) === parseInt(numeroBuscado, 10)
	}
	return semAcento(carta.nome).includes(busca) || semAcento(carta.n) === busca
}

let temporizadorAviso
function avisar(mensagem) {
	const aviso = $('#aviso')
	aviso.textContent = mensagem
	aviso.classList.add('visivel')
	clearTimeout(temporizadorAviso)
	temporizadorAviso = setTimeout(() => aviso.classList.remove('visivel'), 2600)
}

function barraHtml(p) {
	return `<div class="barra${p.pct === 100 ? ' completa' : ''}"><span style="width:${(p.tem / p.total) * 100}%"></span></div>`
}

function definirTopo(titulo, subtitulo, comVoltar) {
	$('#titulo').textContent = titulo
	$('#subtitulo').textContent = subtitulo
	$('#voltar').hidden = !comVoltar
	$('#abrir-gaveta').hidden = comVoltar
	document.title = `${titulo} · Ticards`
}

/* ---------- Cartas na grade ---------- */
const ICONE_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'

function criarCarta(set, carta, mostrarSet) {
	const botao = document.createElement('button')
	botao.className = 'carta' + (tenho(set.id, carta.n) ? ' tenho' : '') + (desejada(set.id, carta.n) ? ' desejada' : '')
	botao.dataset.set = set.id
	botao.dataset.n = carta.n
	botao.setAttribute('aria-pressed', tenho(set.id, carta.n))
	botao.innerHTML = `
		<div class="carta-img">
			<span class="sem-imagem">${escapar(carta.nome)}</span>
			<img alt="${escapar(carta.nome)}" loading="lazy" decoding="async">
			<span class="selo">${ICONE_CHECK}</span>
			<span class="selo-desejo" aria-hidden="true">★</span>
		</div>
		<span class="carta-legenda"><b>${escapar(carta.nome)}</b>${escapar(mostrarSet ? `${set.nome} · ${carta.n}` : numeroExibido(set, carta))}</span>`
	carregarImagem(botao.querySelector('img'), set.id, carta.n, 'low')
	return botao
}

function atualizarCarta(botao) {
	const marcada = tenho(botao.dataset.set, botao.dataset.n)
	botao.classList.toggle('tenho', marcada)
	botao.classList.toggle('desejada', desejada(botao.dataset.set, botao.dataset.n))
	botao.setAttribute('aria-pressed', marcada)
}

function montarGrade(itens, mostrarSet) {
	const grade = document.createElement('div')
	grade.className = 'grade'
	for (const { set, carta } of itens) grade.appendChild(criarCarta(set, carta, mostrarSet))
	return grade
}

// Toque = marcar/desmarcar.  Segurar = ver a carta grande.
// No celular, segurar pode chegar de dois jeitos: pelo nosso cronômetro ou pelo
// "toque longo" do próprio Android (evento contextmenu). Qualquer um abre a carta.
const TEMPO_SEGURAR = 500
const TOLERANCIA_DEDO = 6   // px que o dedo pode tremer sem virar rolagem
let toqueLongo = null
let foiToqueLongo = false
let inicioDoGestoAberto = null   // onde começou o dedo que abriu a carta (enquanto ainda está na tela)

function abrirPorToqueLongo(botao) {
	if (foiToqueLongo) return
	foiToqueLongo = true
	inicioDoGestoAberto = toqueLongo?.inicio || null
	pararToqueLongo()
	abrirZoom(botao)
}

// Segurou e depois começou a rolar: era rolagem, então desfaz a abertura da carta.
function desfazerSeRolou(x, y) {
	if (!inicioDoGestoAberto) return
	if (Math.hypot(x - inicioDoGestoAberto.x, y - inicioDoGestoAberto.y) > TOLERANCIA_DEDO * 2) {
		inicioDoGestoAberto = null
		fecharZoom(false, true)
	}
}

function pararToqueLongo() {
	if (!toqueLongo) return
	clearTimeout(toqueLongo.timer)
	clearTimeout(toqueLongo.timerAfundar)
	toqueLongo.botao.classList.remove('pressionando')
	toqueLongo = null
}

tela.addEventListener('pointerdown', evento => {
	const botao = evento.target.closest('.carta')
	if (!botao) return
	pararToqueLongo()
	foiToqueLongo = false
	toqueLongo = {
		botao,
		inicio: { x: evento.clientX, y: evento.clientY },
		mexeu: false,
		// A carta "afunda" um pouco enquanto o dedo segura, para mostrar que algo vai acontecer.
		timerAfundar: setTimeout(() => botao.classList.add('pressionando'), 120),
		timer: setTimeout(() => abrirPorToqueLongo(botao), TEMPO_SEGURAR),
	}
})

// Dedo se mexeu além da tolerância: é rolagem, não "segurar".
function conferirMovimento(x, y) {
	if (!toqueLongo) return
	const distancia = Math.hypot(x - toqueLongo.inicio.x, y - toqueLongo.inicio.y)
	toqueLongo.maiorDistancia = Math.max(toqueLongo.maiorDistancia || 0, distancia)
	if (distancia > TOLERANCIA_DEDO) pararToqueLongo()
}

tela.addEventListener('pointermove', evento => {
	conferirMovimento(evento.clientX, evento.clientY)
	desfazerSeRolou(evento.clientX, evento.clientY)
})
// touchmove continua chegando mesmo depois que a tela começa a rolar.
tela.addEventListener('touchmove', evento => {
	const dedo = evento.touches[0]
	if (!dedo) return
	conferirMovimento(dedo.clientX, dedo.clientY)
	desfazerSeRolou(dedo.clientX, dedo.clientY)
}, { passive: true })
for (const tipo of ['touchend', 'touchcancel', 'pointerup']) {
	tela.addEventListener(tipo, () => { inicioDoGestoAberto = null })
}
// Se a tela rolou, com certeza não era para abrir a carta.
window.addEventListener('scroll', pararToqueLongo, { passive: true })

tela.addEventListener('pointerup', pararToqueLongo)

// O navegador cancela o toque quando começa a rolar a tela; o Android às vezes cancela
// também no próprio toque longo. Só continuamos esperando se o dedo estava parado.
tela.addEventListener('pointercancel', () => {
	if (!toqueLongo || (toqueLongo.maiorDistancia || 0) > 3) pararToqueLongo()
})

tela.addEventListener('contextmenu', evento => {
	const botao = evento.target.closest('.carta')
	if (!botao) return
	evento.preventDefault()
	abrirPorToqueLongo(botao)
})

tela.addEventListener('click', evento => {
	const botao = evento.target.closest('.carta')
	if (!botao) return
	if (foiToqueLongo) { foiToqueLongo = false; return }
	alternar(botao.dataset.set, botao.dataset.n)
	atualizarCarta(botao)
	atualizarProgressoNaTela()
})

/* ---------- Tela: carta ampliada ---------- */
let cartaAberta = null
let toqueComecouNoZoom = false   // o toque atual começou dentro da carta aberta?

let animandoZoom = false
let aberturaDoZoom = 0   // qual abertura da carta grande está valendo
const semAnimacao = () => matchMedia('(prefers-reduced-motion: reduce)').matches

// Posição da carta da grade em relação à carta grande: usada para a carta "sair" da grade.
function transformacaoDaGrade(botao) {
	const grande = $('#zoom-giro').getBoundingClientRect()
	const pequena = botao?.querySelector('.carta-img')?.getBoundingClientRect()
	if (!pequena || !pequena.width) return null
	const dx = pequena.left + pequena.width / 2 - (grande.left + grande.width / 2)
	const dy = pequena.top + pequena.height / 2 - (grande.top + grande.height / 2)
	return `translate(${dx}px, ${dy}px) scale(${pequena.width / grande.width})`
}

// Toque longo: a carta sai da grade girando (mostra o verso) e para de frente, grande.
function abrirZoom(botao) {
	const set = dados.sets.find(s => s.id === botao.dataset.set)
	const carta = set.cartas.find(c => c.n === botao.dataset.n)
	cartaAberta = botao
	toqueComecouNoZoom = false

	// Começa com a imagem que já está na grade e troca pela de alta qualidade quando chegar.
	const imgGrade = botao.querySelector('.carta-img img')
	const img = $('#zoom-img')
	const temImagem = imgGrade && !imgGrade.hidden && imgGrade.complete && imgGrade.naturalWidth
	img.hidden = !temImagem
	if (temImagem) img.src = imgGrade.currentSrc || imgGrade.src
	img.alt = carta.nome
	$('#zoom-sem-imagem').textContent = carta.nome
	const alta = new Image()
	alta.onload = () => { if (cartaAberta === botao) { img.src = alta.src; img.hidden = false } }
	carregarEmOrdem(alta, fontesImagem(set.id, `${carta.n}/high.webp`), () => {})

	$('#zoom-estrela').classList.remove('visivel')
	$('#zoom-nome').textContent = carta.nome
	$('#zoom-info').textContent = [set.nome, numeroExibido(set, carta), carta.raridade].filter(Boolean).join(' · ')
	atualizarBotaoZoom()
	$('#zoom').hidden = false
	registrarSobreposicao()

	pararEfeitos()
	if (semAnimacao()) { iniciarEfeitos(carta.raridade, true); mostrarEstrela(); return }
	const idAbertura = ++aberturaDoZoom
	const origem = transformacaoDaGrade(botao) || 'scale(.3)'
	animandoZoom = true
	$('#zoom').animate([{ backgroundColor: 'rgba(0,0,0,0)' }, { backgroundColor: 'rgba(0,0,0,.8)' }], { duration: 350 })
	$('#zoom-giro').animate([
		{ transform: `${origem} rotateY(0deg)` },
		{ transform: 'translate(0, 0) scale(1) rotateY(720deg)' },
	], { duration: 950, easing: 'cubic-bezier(.2, .7, .25, 1)' }).finished
		.catch(() => { /* animação interrompida (ex.: começou a rolar) */ })
		.finally(() => { animandoZoom = false })
		.then(() => {
			// A carta parou de frente: solta os efeitos da raridade (se ainda estiver aberta).
			if (idAbertura === aberturaDoZoom && !$('#zoom').hidden) { iniciarEfeitos(carta.raridade); mostrarEstrela() }
		})
	$('#zoom-detalhes').animate([
		{ opacity: 0, transform: 'translateY(12px)' },
		{ opacity: 0, transform: 'translateY(12px)', offset: .6 },
		{ opacity: 1, transform: 'none' },
	], { duration: 1100 })
}

// Fecha: a carta volta girando para o lugar dela na grade.
async function fecharZoom(animar = true, forcar = false, veioDoHistorico = false) {
	if ($('#zoom').hidden || (animandoZoom && !forcar)) return
	if (forcar) animandoZoom = false
	aberturaDoZoom++
	pararEfeitos()
	$('#zoom-estrela').classList.remove('visivel')
	const destino = animar && !semAnimacao() && document.body.contains(cartaAberta) ? transformacaoDaGrade(cartaAberta) : null
	if (destino) {
		animandoZoom = true
		const opcoes = { duration: 450, easing: 'cubic-bezier(.5, 0, .75, 0)', fill: 'forwards' }
		$('#zoom-detalhes').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' })
		$('#zoom').animate([{ backgroundColor: 'rgba(0,0,0,.8)' }, { backgroundColor: 'rgba(0,0,0,0)' }], opcoes)
		const giro = $('#zoom-giro').animate([
			{ transform: 'translate(0, 0) scale(1) rotateY(0deg)' },
			{ transform: `${destino} rotateY(-360deg)` },
		], opcoes)
		await giro.finished.catch(() => {})
		animandoZoom = false
	}
	$('#zoom').hidden = true
	for (const el of [$('#zoom'), $('#zoom-giro'), $('#zoom-detalhes')]) el.getAnimations().forEach(a => a.cancel())
	if (!veioDoHistorico) liberarSobreposicao()
	if (rotaAtual().aba === 'desejos' && !rotaAtual().sub) { const y = window.scrollY; desenharDesejos(); window.scrollTo(0, y) }
}

/* ---------- Efeitos de raridade ---------- */
// Quando a carta termina de girar e para de frente, a raridade dela solta efeitos:
// brilho que passa, halo colorido, reflexo holográfico e partículas. Quanto mais rara, mais efeito.
const ARCO = ['#ff5ea8', '#ffd45e', '#6dffb0', '#5ec8ff', '#b48cff']
const EFEITOS_RARIDADE = {
	'Incomum':                 { brilho: 1 },
	'Rara':                    { brilho: 1, halo: '#c9d6ea', particulas: { n: 14, cores: ['#ffffff', '#c9d6ea'] } },
	'Promo':                   { brilho: 1, halo: '#8fd0ff', particulas: { n: 14, cores: ['#ffffff', '#8fd0ff'] } },
	'Rara Dupla':              { brilho: 2, halo: '#ffd24d', particulas: { n: 28, cores: ['#fff3b0', '#ffd24d', '#ffffff'] } },
	'Ultra Rara':              { brilho: 2, halo: '#ffbf1f', pulso: true, particulas: { n: 46, estrelas: 10, cores: ['#fff3b0', '#ffbf1f', '#ff9d00'] } },
	'Rara Ilustrada':          { brilho: 1, holo: true, halo: '#8fe6ff', pulso: true, particulas: { n: 40, estrelas: 12, cores: ARCO } },
	'Rara Ilustrada Especial': { brilho: 2, holo: true, halo: '#c08cff', pulso: true, flash: 'rgba(192,140,255,.4)', particulas: { n: 64, estrelas: 22, chuva: true, cores: ARCO } },
	'Mega Rara Hiper':         { brilho: 3, holo: 'ouro', halo: '#ffb300', pulso: true, flash: 'rgba(255,200,60,.5)', particulas: { n: 90, estrelas: 28, chuva: true, cores: ['#fff1a8', '#ffd24d', '#ffb300', '#ff8a00'] } },
	'Rara Mega Ataque':        { brilho: 2, halo: '#ff5a3c', pulso: true, particulas: { n: 46, estrelas: 6, cores: ['#ffd1a8', '#ff8a3c', '#ff3c2a'] } },
	'Rara Futurista':          { brilho: 2, holo: true, halo: '#3cf0ff', pulso: true, particulas: { n: 40, estrelas: 10, cores: ['#d9fcff', '#3cf0ff', '#5a8cff'] } },
	'Rara Pikachu':            { brilho: 2, halo: '#ffe14a', pulso: true, particulas: { n: 40, raios: true, cores: ['#fff7b0', '#ffe14a', '#ffb800'] } },
	'Rara RGB':                { brilho: 2, holo: true, halo: '#ff5ea8', pulso: true, particulas: { n: 56, estrelas: 16, cores: ARCO } },
	// Escarlate e Violeta / Espada e Escudo
	'Rara Holo':               { brilho: 1, halo: '#c9d6ea', particulas: { n: 14, cores: ['#ffffff', '#c9d6ea'] } },
	'Rara Holo V':             { brilho: 2, halo: '#5a9bff', particulas: { n: 30, cores: ['#d6e6ff', '#5a9bff', '#ffffff'] } },
	'Rara Holo VMAX':          { brilho: 2, halo: '#ff4d4d', pulso: true, particulas: { n: 46, estrelas: 8, cores: ['#ffd6d6', '#ff4d4d', '#ff9d3c'] } },
	'Rara Holo VSTAR':         { brilho: 2, halo: '#b48cff', pulso: true, particulas: { n: 46, estrelas: 12, cores: ['#eadcff', '#b48cff', '#ffffff'] } },
	'Rara Radiante':           { brilho: 2, holo: true, halo: '#ff9ac8', pulso: true, particulas: { n: 40, estrelas: 10, cores: ARCO } },
	'Rara Incrível':           { brilho: 2, holo: true, halo: '#7ee6ad', pulso: true, particulas: { n: 50, estrelas: 14, cores: ARCO } },
	'Treinador Arte Completa': { brilho: 2, halo: '#ffd24d', particulas: { n: 28, cores: ['#fff3b0', '#ffd24d', '#ffffff'] } },
	'Rara Secreta':            { brilho: 3, holo: 'ouro', halo: '#ffb300', pulso: true, flash: 'rgba(255,200,60,.45)', particulas: { n: 70, estrelas: 20, chuva: true, cores: ['#fff1a8', '#ffd24d', '#ffb300'] } },
	'Rara Brilhante':          { brilho: 2, holo: true, halo: '#ffe27a', pulso: true, particulas: { n: 40, estrelas: 12, cores: ['#fff6c4', '#ffe27a', '#ffffff'] } },
	'Rara Brilhante V':        { brilho: 2, holo: true, halo: '#ffe27a', pulso: true, particulas: { n: 44, estrelas: 14, cores: ['#fff6c4', '#ffe27a', '#8fc0ff'] } },
	'Rara Brilhante VMAX':     { brilho: 3, holo: true, halo: '#ffd24d', pulso: true, particulas: { n: 56, estrelas: 18, cores: ['#fff6c4', '#ffd24d', '#ff6b6b'] } },
	'Ultra Rara Brilhante':    { brilho: 3, holo: 'ouro', halo: '#ffd24d', pulso: true, flash: 'rgba(255,220,90,.4)', particulas: { n: 60, estrelas: 18, chuva: true, cores: ['#fff6c4', '#ffd24d', '#ffffff'] } },
	'ACE SPEC':                { brilho: 2, halo: '#ff5ea8', pulso: true, particulas: { n: 34, estrelas: 8, cores: ['#ffd1e6', '#ff5ea8', '#ffffff'] } },
	'Rara Preto e Branco':     { brilho: 2, halo: '#ffffff', pulso: true, particulas: { n: 34, estrelas: 8, cores: ['#ffffff', '#9aa1ad', '#2a2d34'] } },
	'Rara Hiper':              { brilho: 3, holo: 'ouro', halo: '#ffb300', pulso: true, flash: 'rgba(255,200,60,.5)', particulas: { n: 90, estrelas: 28, chuva: true, cores: ['#fff1a8', '#ffd24d', '#ffb300', '#ff8a00'] } },
	'Coleção Clássica':        { brilho: 1, halo: '#8fd0ff', particulas: { n: 14, cores: ['#ffffff', '#8fd0ff'] } },
}
const CLASSES_EFEITO = ['ef-ativo', 'ef-com-holo', 'ef-holo-ouro', 'ef-pulso']
let idEfeito = 0          // muda a cada início/parada: partículas antigas se encerram sozinhas
let quadroParticulas = 0

function pararEfeitos() {
	idEfeito++
	cancelAnimationFrame(quadroParticulas)
	const canvas = $('#zoom-particulas')
	if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
	const caixa = document.querySelector('.carta-3d')
	if (caixa) {
		caixa.classList.remove(...CLASSES_EFEITO)
		void caixa.offsetWidth   // para a animação poder recomeçar do zero
	}
}

// parado = true: só o halo, sem movimento (quem desligou as animações do celular)
function iniciarEfeitos(raridade, parado = false) {
	pararEfeitos()
	const config = EFEITOS_RARIDADE[raridade]
	const caixa = document.querySelector('.carta-3d')
	if (!config || !caixa) return
	if (config.halo) caixa.style.setProperty('--ef-cor', config.halo)
	caixa.style.setProperty('--ef-brilhos', parado ? 0 : config.brilho || 0)
	caixa.classList.add('ef-ativo')
	if (config.holo) caixa.classList.add('ef-com-holo')
	if (config.holo === 'ouro') caixa.classList.add('ef-holo-ouro')
	if (config.pulso) caixa.classList.add('ef-pulso')
	// Os efeitos duram poucos segundos; depois a carta fica limpa.
	const meu = idEfeito
	setTimeout(() => { if (meu === idEfeito) pararEfeitos() }, 2900)
	if (parado) return
	if (config.flash) $('#zoom').animate([{ backgroundColor: config.flash }, { backgroundColor: 'rgba(0,0,0,.8)' }], { duration: 650, easing: 'ease-out' })
	if (config.particulas) dispararParticulas(config.particulas, caixa)
}

function dispararParticulas(config, caixa) {
	const canvas = $('#zoom-particulas')
	if (!canvas) return
	const dpr = Math.min(window.devicePixelRatio || 1, 2)
	const largura = window.innerWidth, altura = window.innerHeight
	canvas.width = Math.round(largura * dpr)
	canvas.height = Math.round(altura * dpr)
	const ctx = canvas.getContext('2d')
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

	const r = caixa.getBoundingClientRect()
	const cx = r.left + r.width / 2, cy = r.top + r.height / 2
	const sorte = (a, b) => a + Math.random() * (b - a)
	const cor = () => config.cores[Math.floor(Math.random() * config.cores.length)]
	const ps = []

	for (let i = 0; i < config.n; i++) {   // faíscas: saem das bordas da carta, para fora
		const ang = Math.random() * Math.PI * 2, v = sorte(90, 300)
		ps.push({ t: 'faisca', idade: 0, vida: sorte(.8, 1.6), r: sorte(1.4, 3.4), cor: cor(), g: 160,
			x: cx + Math.cos(ang) * r.width * sorte(.35, .52), y: cy + Math.sin(ang) * r.height * sorte(.35, .52),
			vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - 30 })
	}
	for (let i = 0; i < (config.estrelas || 0); i++) {   // estrelinhas que brilham e sobem
		ps.push({ t: 'estrela', idade: 0, vida: sorte(1, 1.8), r: sorte(6, 14), cor: cor(), atraso: sorte(0, .5),
			x: cx + sorte(-.55, .55) * r.width, y: cy + sorte(-.55, .55) * r.height, vx: sorte(-14, 14), vy: sorte(-34, -8) })
	}
	if (config.chuva) {   // confete caindo do topo da tela
		for (let i = 0; i < 40; i++) {
			ps.push({ t: 'confete', idade: 0, vida: sorte(1.4, 2), r: sorte(3, 6), cor: cor(), atraso: sorte(0, .4),
				x: sorte(0, largura), y: sorte(-altura * .3, -10), vx: sorte(-30, 30), vy: sorte(140, 300),
				giro: sorte(0, 6.28), vgiro: sorte(-6, 6) })
		}
	}
	if (config.raios) {   // raios em zigue-zague em volta da carta
		for (let i = 0; i < 9; i++) {
			const x = cx + sorte(-.62, .62) * r.width, y = cy + sorte(-.6, .6) * r.height, tam = sorte(18, 42)
			const pontos = [[0, 0]]
			for (let k = 1; k <= 5; k++) pontos.push([sorte(-.35, .35) * tam, k * tam / 5])
			ps.push({ t: 'raio', idade: 0, vida: sorte(.12, .22), atraso: sorte(0, 1.1), cor: cor(), x, y, pontos })
		}
	}

	const meu = idEfeito
	let ultimo = performance.now()
	const quadro = agora => {
		if (meu !== idEfeito) return
		const dt = Math.min((agora - ultimo) / 1000, .05)
		ultimo = agora
		ctx.clearRect(0, 0, largura, altura)
		ctx.globalCompositeOperation = 'lighter'
		let vivas = 0
		for (const p of ps) {
			if (p.atraso > 0) { p.atraso -= dt; vivas++; continue }
			p.idade += dt
			if (p.idade >= p.vida) continue
			vivas++
			const k = p.idade / p.vida
			ctx.fillStyle = p.cor
			ctx.strokeStyle = p.cor
			if (p.t === 'faisca') {
				p.vx *= 1 - .6 * dt
				p.vy += p.g * dt
				p.x += p.vx * dt
				p.y += p.vy * dt
				ctx.globalAlpha = (1 - k) * .25
				ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3, 0, 6.283); ctx.fill()
				ctx.globalAlpha = 1 - k
				ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - .4 * k), 0, 6.283); ctx.fill()
			} else if (p.t === 'estrela') {
				p.x += p.vx * dt
				p.y += p.vy * dt
				ctx.globalAlpha = Math.sin(k * Math.PI) * (.65 + .35 * Math.sin(p.idade * 16))
				const s = p.r * (.6 + .4 * Math.sin(k * Math.PI))
				ctx.beginPath()
				ctx.moveTo(p.x, p.y - s)
				ctx.quadraticCurveTo(p.x, p.y, p.x + s, p.y)
				ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + s)
				ctx.quadraticCurveTo(p.x, p.y, p.x - s, p.y)
				ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - s)
				ctx.fill()
			} else if (p.t === 'confete') {
				p.vy += 40 * dt
				p.x += (p.vx + Math.sin(p.idade * 4 + p.giro) * 40) * dt
				p.y += p.vy * dt
				p.giro += p.vgiro * dt
				ctx.globalAlpha = Math.min(1, (p.vida - p.idade) * 2) * .9
				ctx.save()
				ctx.translate(p.x, p.y)
				ctx.rotate(p.giro)
				ctx.fillRect(-p.r, -p.r * .5, p.r * 2, p.r)
				ctx.restore()
			} else if (p.t === 'raio') {
				ctx.globalAlpha = (1 - k) * (Math.random() > .3 ? 1 : .4)
				ctx.lineWidth = 2
				ctx.lineJoin = 'round'
				ctx.beginPath()
				p.pontos.forEach(([dx, dy], i) => (i ? ctx.lineTo(p.x + dx, p.y + dy) : ctx.moveTo(p.x, p.y)))
				ctx.stroke()
			}
		}
		ctx.globalAlpha = 1
		if (vivas) quadroParticulas = requestAnimationFrame(quadro)
		else ctx.clearRect(0, 0, largura, altura)
	}
	quadroParticulas = requestAnimationFrame(quadro)
}

/* ---------- Liga Pokémon ---------- */
const LIGA = 'https://www.ligapokemon.com.br/'

// A Liga escreve os endereços com + no lugar de espaço e codifica ( ) / e acentos.
function codificarLiga(texto) {
	return encodeURIComponent(texto)
		.replace(/%20/g, '+')
		.replace(/[!'()*~]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

// Endereço da carta na Liga: "Nome(número/total)", ex.: Mega Darkrai ex(116/084).
// Em coleções onde a numeração da Liga não bate com a nossa (Coleção Clássica, promos),
// o botão leva para a busca da Liga pelo nome da carta.
function linkLiga(set, carta) {
	const busca = `${LIGA}?view=cards%2Fsearch&card=${codificarLiga(carta.nome)}&tipo=1`
	let total = null
	if (set.id === '30th' && /^[BGR]$/.test(carta.n)) total = 'RGB'
	else if (/^\d+$/.test(carta.n) && set.oficiais > 0 && set.id !== '30th-c') total = String(set.oficiais).padStart(3, '0')
	if (!total) return { url: busca, busca, exato: false }
	return { url: `${LIGA}?view=cards/card&card=${codificarLiga(`${carta.nome}(${/^\d+$/.test(carta.n) ? carta.n.padStart(3, '0') : carta.n}/${total})`)}`, busca, exato: true }
}

// A estrela da lista de desejos aparece quando a carta termina de girar e para de frente.
function mostrarEstrela() {
	if (!$('#zoom').hidden) $('#zoom-estrela').classList.add('visivel')
}

function atualizarBotaoZoom() {
	const quer = desejada(cartaAberta.dataset.set, cartaAberta.dataset.n)
	$('#zoom-estrela').setAttribute('aria-pressed', quer)
	$('#zoom-estrela').setAttribute('aria-label', quer ? 'Tirar da lista de desejos' : 'Adicionar à lista de desejos')
	const marcada = tenho(cartaAberta.dataset.set, cartaAberta.dataset.n)
	// Só quem ainda não tem a carta vê o botão de comprar.
	const set = dados.sets.find(s => s.id === cartaAberta.dataset.set)
	const carta = set.cartas.find(c => c.n === cartaAberta.dataset.n)
	const liga = linkLiga(set, carta)
	if ($('#zoom-liga')) {
		$('#zoom-liga').hidden = marcada
		$('#zoom-comprar').href = liga.url
		$('#zoom-comprar-texto').textContent = liga.exato ? 'Comprar na Liga Pokémon' : 'Buscar na Liga Pokémon'
		$('#zoom-buscar').href = liga.busca
		$('#zoom-buscar').hidden = !liga.exato
	}
	if ($('#zoom-status')) $('#zoom-status').hidden = !marcada
	$('#zoom-marcar').textContent = marcada ? 'Desmarcar' : 'Marcar como "tenho"'
	$('#zoom-marcar').classList.toggle('secundario', marcada)
}

$('#zoom').addEventListener('pointerdown', () => { toqueComecouNoZoom = true })

// Os links da Liga também ignoram o "soltar" do dedo que segurou a carta.
for (const link of [$('#zoom-comprar'), $('#zoom-buscar')].filter(Boolean)) {
	link.addEventListener('click', evento => {
		evento.stopPropagation()
		const novoToque = toqueComecouNoZoom || evento.detail === 0
		toqueComecouNoZoom = false
		if (!novoToque) evento.preventDefault()
	})
}

$('#zoom-estrela').addEventListener('click', evento => {
	evento.stopPropagation()
	const novoToque = toqueComecouNoZoom || evento.detail === 0
	toqueComecouNoZoom = false
	if (!novoToque) return
	const quer = alternarDesejo(cartaAberta.dataset.set, cartaAberta.dataset.n)
	atualizarCarta(cartaAberta)
	atualizarBotaoZoom()
	avisar(quer ? 'Adicionada à lista de desejos ★' : 'Tirada da lista de desejos')
})

$('#zoom-marcar').addEventListener('click', evento => {
	evento.stopPropagation()
	// Ignora o "soltar" do mesmo dedo que segurou a carta (o botão pode estar embaixo dele).
	const novoToque = toqueComecouNoZoom || evento.detail === 0
	toqueComecouNoZoom = false
	if (!novoToque) return
	alternar(cartaAberta.dataset.set, cartaAberta.dataset.n)
	atualizarCarta(cartaAberta)
	atualizarBotaoZoom()
	atualizarProgressoNaTela()
})

// Fecha ao tocar fora do botão, mas só num toque novo: o mesmo dedo que segurou a
// carta, ao soltar, não deve fechar a carta que acabou de abrir.
$('#zoom').addEventListener('click', evento => {
	const novoToque = toqueComecouNoZoom
	toqueComecouNoZoom = false
	if (novoToque && !evento.target.closest('button, a')) fecharZoom()
})
$('#zoom').addEventListener('contextmenu', evento => evento.preventDefault())

/* ---------- Tela: início (lista de sets) ---------- */
/* ---------- Aba: Coleções (lista de sets) ---------- */
let editandoColecoes = false

function telaColecoes() {
	editandoColecoes = false
	tela.innerHTML = `
		${htmlConvite()}
		<section class="resumo" id="resumo"></section>
		<button class="botao secundario" id="editar-colecoes"></button>
		<div id="conteudo"></div>`

	ligarConvite()
	$('#editar-colecoes').addEventListener('click', () => {
		editandoColecoes = !editandoColecoes
		desenharColecoes()
		if (!editandoColecoes) window.scrollTo(0, 0)
	})
	$('#conteudo').addEventListener('change', evento => {
		const caixa = evento.target.closest('input[data-escolher]')
		if (!caixa) return
		definirEscondidas([caixa.dataset.escolher], !caixa.checked)
		caixa.closest('.item-escolha').classList.toggle('escondida', !caixa.checked)
		atualizarContagemDasSeries()
	})
	$('#conteudo').addEventListener('click', evento => {
		const botao = evento.target.closest('button[data-serie]')
		if (!botao) return
		const ids = dados.sets.filter(set => set.serie === botao.dataset.serie).map(set => set.id)
		definirEscondidas(ids, botao.dataset.acao === 'nenhuma')
		desenharColecoes()
	})
	desenharColecoes()
}

// Na hora de escolher, mostra quantas coleções de cada série estão visíveis.
function atualizarContagemDasSeries() {
	for (const serie of dados.series) {
		const sets = dados.sets.filter(set => set.serie === serie.id)
		const el = document.querySelector(`[data-contagem-serie="${serie.id}"]`)
		if (el) el.textContent = `${sets.filter(colecaoVisivel).length} de ${sets.length} coleções escolhidas`
	}
}

// Convite para entrar na conta (some quando já está conectado).
function htmlConvite() {
	return `
		<button class="convite" id="convite" ${usuario || !nuvem ? 'hidden' : ''}>
			<span aria-hidden="true">☁️</span>
			<span><b>Sincronize o celular e o PC.</b> Toque aqui para entrar ou criar sua conta.</span>
		</button>`
}
function ligarConvite() { $('#convite').addEventListener('click', abrirMenu) }

function atualizarResumo() {
	let tem = 0, total = 0
	for (const set of setsVisiveis()) {
		const p = progresso(set)
		tem += p.tem
		total += p.total
	}
	const geral = { tem, total, pct: total ? Math.floor((tem / total) * 100) : 0 }
	$('#resumo').innerHTML = `
		<div class="resumo-linha"><strong>${geral.pct}%</strong><span>${tem} de ${total} cartas</span></div>
		${barraHtml(geral)}`
}

function desenharColecoes() {
	const conteudo = $('#conteudo')
	const itemDoSet = set => {
		const p = progresso(set)
		return `
			<li><a class="item-set" href="#/set/${encodeURIComponent(set.id)}" data-set="${escapar(set.id)}">
				<span class="logo-set"><img alt="" data-logo="${escapar(set.id)}"><span hidden>${escapar(set.sigla || set.id)}</span></span>
				<span class="item-set-info">
					<b>${escapar(set.nome)}</b>
					<small>${p.tem} de ${p.total}${temCartasEspeciais(set) && !masterSetLigado(set) ? ' · sem especiais' : ''} · ${dataBr(set.lancamento)}</small>
					${barraHtml(p)}
				</span>
				<span class="pct${p.pct === 100 ? ' completa' : ''}">${p.pct}%</span>
			</a></li>`
	}
	const itemDeEscolha = set => `
		<li><label class="item-set item-escolha${colecaoVisivel(set) ? '' : ' escondida'}">
			<span class="logo-set"><img alt="" data-logo="${escapar(set.id)}"><span hidden>${escapar(set.sigla || set.id)}</span></span>
			<span class="item-set-info"><b>${escapar(set.nome)}</b><small>${set.cartas.length} cartas · ${dataBr(set.lancamento)}</small></span>
			<input type="checkbox" class="interruptor" data-escolher="${escapar(set.id)}" ${colecaoVisivel(set) ? 'checked' : ''} aria-label="Acompanhar ${escapar(set.nome)}">
		</label></li>`

	$('#editar-colecoes').textContent = editandoColecoes ? '✓ Concluir' : 'Escolher coleções'
	$('#editar-colecoes').classList.toggle('secundario', !editandoColecoes)
	definirTopo('Coleções', editandoColecoes ? 'Escolha o que você coleciona' : `${setsVisiveis().length} de ${dados.sets.length} coleções`, false)
	atualizarResumo()

	if (editandoColecoes) {
		conteudo.innerHTML = `<p class="dica">Ligue só as coleções que você coleciona. As desligadas somem do app (da lista, da pesquisa e dos filtros), e o que você já marcou continua salvo.</p>` +
			dados.series.map(serie => {
				const sets = dados.sets.filter(set => set.serie === serie.id)
				return `<h2 class="titulo-serie linha-serie"><span>${escapar(serie.nome)}<small data-contagem-serie="${escapar(serie.id)}">${sets.filter(colecaoVisivel).length} de ${sets.length} coleções escolhidas</small></span>
					<span class="serie-acoes"><button data-serie="${escapar(serie.id)}" data-acao="todas">Todas</button><button data-serie="${escapar(serie.id)}" data-acao="nenhuma">Nenhuma</button></span></h2>
					<ul class="lista-sets">${sets.map(itemDeEscolha).join('')}</ul>`
			}).join('')
	} else {
		const series = dados.series.map(serie => ({ serie, sets: setsVisiveis().filter(set => set.serie === serie.id) })).filter(g => g.sets.length)
		conteudo.innerHTML = series.length ? series.map(({ serie, sets }) => {
			const soma = sets.reduce((t, set) => { const p = progresso(set); return { tem: t.tem + p.tem, total: t.total + p.total } }, { tem: 0, total: 0 })
			return `<h2 class="titulo-serie">${escapar(serie.nome)}<small>${soma.tem} de ${soma.total} cartas · ${sets.length} coleç${sets.length > 1 ? 'ões' : 'ão'}</small></h2>
				<ul class="lista-sets">${sets.map(itemDoSet).join('')}</ul>`
		}).join('') : '<p class="vazio">Nenhuma coleção escolhida. Toque em <b>Escolher coleções</b> para ligar as que você coleciona.</p>'
	}

	// Logo do set; se não houver, fica a sigla em texto.
	for (const img of conteudo.querySelectorAll('img[data-logo]')) {
		carregarEmOrdem(img, fontesImagem(img.dataset.logo, 'logo.webp'), () => {
			img.hidden = true
			img.nextElementSibling.hidden = false
		})
	}
}

/* ---------- Aba: Pesquisa ---------- */
const ORDEM_RARIDADES = ['Comum', 'Incomum', 'Rara', 'Rara Dupla', 'Ultra Rara', 'Rara Ilustrada', 'Rara Ilustrada Especial',
	'Mega Rara Hiper', 'Rara Mega Ataque', 'Rara Pikachu', 'Rara Futurista', 'Rara RGB', 'Promo',
	'Rara Holo', 'Rara Holo V', 'Rara Holo VMAX', 'Rara Holo VSTAR', 'Rara Radiante', 'Rara Incrível', 'Treinador Arte Completa', 'Rara Secreta',
	'Rara Brilhante', 'Rara Brilhante V', 'Rara Brilhante VMAX', 'Ultra Rara Brilhante', 'ACE SPEC', 'Rara Preto e Branco', 'Rara Hiper', 'Coleção Clássica']
const PASSO_PESQUISA = 60
// Os filtros ficam guardados enquanto o app está aberto (ao trocar de aba e voltar, continuam).
const pesquisa = { texto: '', set: '', raridade: '', status: 'todas', limite: PASSO_PESQUISA }

function raridadesDasCartas() {
	const achadas = new Set()
	for (const set of dados.sets) for (const carta of set.cartas) if (carta.raridade) achadas.add(carta.raridade)
	return [...ORDEM_RARIDADES.filter(r => achadas.has(r)), ...[...achadas].filter(r => !ORDEM_RARIDADES.includes(r))]
}

function telaPesquisa() {
	definirTopo('Pesquisa', 'Todas as cartas', false)

	tela.innerHTML = `
		${htmlConvite()}
		<input class="busca" id="busca" type="search" placeholder="Nome ou número da carta" value="${escapar(pesquisa.texto)}" autocomplete="off" enterkeyhint="search">
		<div class="filtros">
			<button class="seletor" id="filtro-set" aria-haspopup="dialog" aria-label="Filtrar por coleção"></button>
			<button class="seletor" id="filtro-raridade" aria-haspopup="dialog" aria-label="Filtrar por raridade"></button>
		</div>
		<div class="segmentos" id="filtro-status">
			<button data-status="todas">Todas</button>
			<button data-status="faltam">Faltam</button>
			<button data-status="tenho">Tenho</button>
		</div>
		<div id="conteudo"></div>`

	ligarConvite()
	let espera = 0
	$('#busca').addEventListener('input', () => {
		clearTimeout(espera)
		espera = setTimeout(() => {
			pesquisa.texto = $('#busca').value
			pesquisa.limite = PASSO_PESQUISA
			desenharPesquisa()
		}, 120)
	})
	atualizarSeletorSet()
	$('#filtro-set').addEventListener('click', () => abrirEscolhaSet())
	atualizarSeletorRaridade()
	$('#filtro-raridade').addEventListener('click', () => abrirEscolhaRaridade())
	$('#filtro-status').addEventListener('click', evento => {
		const botao = evento.target.closest('button')
		if (!botao) return
		pesquisa.status = botao.dataset.status
		pesquisa.limite = PASSO_PESQUISA
		desenharPesquisa()
	})
	desenharPesquisa()
}

// Ícone de uma coleção: o logo do set; sem logo, a sigla em texto. id vazio = "todos os sets".
function htmlIconeSet(set) {
	if (!set) return `<span class="icone-logo"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg></span>`
	return `<span class="icone-logo"><img alt="" data-logo="${escapar(set.id)}"><span hidden>${escapar(set.sigla || set.id)}</span></span>`
}
function carregarLogosDentro(elemento) {
	for (const img of elemento.querySelectorAll('img[data-logo]')) {
		carregarEmOrdem(img, fontesImagem(img.dataset.logo, 'logo.webp'), () => {
			img.hidden = true
			img.nextElementSibling.hidden = false
		})
	}
}

// O botão do filtro mostra a coleção escolhida (logo + nome).
function atualizarSeletorSet(estado = pesquisa) {
	const botao = $('#filtro-set')
	if (!botao) return
	const set = dados.sets.find(s => s.id === estado.set)
	botao.innerHTML = `${htmlIconeSet(set)}<span class="seletor-texto">${escapar(set ? set.nome : 'Todos os sets')}</span>${SETA_SELETOR}`
	carregarLogosDentro(botao)
}
const SETA_SELETOR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'

/* Símbolos de raridade: os mesmos que a carta traz impressos no canto inferior esquerdo. */
const ESTRELA = 'M12 2.8l2.8 6 6.5.8-4.8 4.5 1.3 6.5L12 17.4l-5.8 3.2 1.3-6.5-4.8-4.5 6.5-.8z'
const PRETO = 'var(--simbolo-preto)'   // o "preto" das cartas; muda com o tema para aparecer em fundo claro e escuro
// Cada forma é desenhada com style (e não com atributos) para poder usar a variável de cor do tema.
const forma = (preenchimento, contorno, largura) => `fill:${preenchimento};stroke:${contorno};stroke-width:${largura}`
const estrela = (preenchimento, contorno) => `<path d="${ESTRELA}" style="${forma(preenchimento, contorno, 1.7)}" stroke-linejoin="round"/>`
const FORMAS_SIMBOLO = {
	'circulo': `<circle cx="12" cy="12" r="6.5" style="${forma(PRETO, '#fff', 2)}"/>`,
	'losango': `<path d="M12 3.5l7 8.5-7 8.5-7-8.5z" style="${forma(PRETO, '#fff', 2)}" stroke-linejoin="round"/>`,
	'estrela-preta': estrela(PRETO, '#fff'),
	'estrela-branca': estrela('#fff', '#8b93a1'),
	'estrela-dourada': estrela('#ffc933', '#fff2c2'),
	'brilho-dourado': `<path d="M12 2.5l2.4 7.1 7.1 2.4-7.1 2.4L12 21.5l-2.4-7.1L2.5 12l7.1-2.4z" style="${forma('#2a2410', '#ffc933', 2)}" stroke-linejoin="round"/>`,
	'estrela-rosa': estrela('#ff9ac8', '#ff2f92'),
	'estrela-verde': estrela('#7ee6ad', '#1ba463'),
	'estrela-roxa': estrela('#b58cff', '#6a3fd0'),
	'estrela-vermelha': estrela('#ff7a7a', '#d02f2f'),
	'estrela-azul': estrela('#7aa8ff', '#2f5fd0'),
	'promo': `${estrela(PRETO, '#fff')}<circle cx="9.6" cy="12" r=".9" fill="#fff"/><circle cx="12" cy="13.6" r=".9" fill="#fff"/><circle cx="14.4" cy="12" r=".9" fill="#fff"/>`,
	'pikachu': `<path d="M5 3l6.5 6L4.5 10.5zM19 3l-6.5 6 7 1.5z" style="${forma(PRETO, '#fff', 1.4)}" stroke-linejoin="round"/><ellipse cx="12" cy="15" rx="7.5" ry="6" style="${forma(PRETO, '#fff', 1.6)}"/>`,
}
const SIMBOLOS_RARIDADE = {
	'Comum': ['circulo'],
	'Incomum': ['losango'],
	'Rara': ['estrela-preta'],
	'Rara Dupla': ['estrela-preta', 'estrela-preta'],
	'Ultra Rara': ['estrela-branca', 'estrela-branca'],
	'Rara Ilustrada': ['estrela-dourada'],
	'Rara Ilustrada Especial': ['estrela-dourada', 'estrela-dourada'],
	'Mega Rara Hiper': ['brilho-dourado'],
	'Rara Mega Ataque': ['estrela-rosa', 'estrela-verde'],
	'Rara Pikachu': ['pikachu'],
	'Rara Futurista': ['estrela-roxa'],
	'Rara RGB': ['estrela-vermelha', 'estrela-verde', 'estrela-azul'],
	'Promo': ['promo'],
	'Rara Holo': ['estrela-preta'],
	'Rara Holo V': ['estrela-azul'],
	'Rara Holo VMAX': ['estrela-vermelha'],
	'Rara Holo VSTAR': ['estrela-roxa'],
	'Rara Radiante': ['estrela-rosa'],
	'Rara Incrível': ['estrela-verde', 'estrela-roxa'],
	'Treinador Arte Completa': ['estrela-branca'],
	'Rara Secreta': ['estrela-dourada'],
	'Rara Brilhante': ['brilho-dourado'],
	'Rara Brilhante V': ['brilho-dourado', 'estrela-azul'],
	'Rara Brilhante VMAX': ['brilho-dourado', 'estrela-vermelha'],
	'Ultra Rara Brilhante': ['brilho-dourado', 'brilho-dourado'],
	'ACE SPEC': ['estrela-rosa', 'estrela-rosa'],
	'Rara Preto e Branco': ['estrela-preta', 'estrela-branca'],
	'Rara Hiper': ['estrela-dourada', 'estrela-dourada', 'estrela-dourada'],
	'Coleção Clássica': ['promo'],
}
function htmlIconeRaridade(raridade) {
	const nomes = raridade ? SIMBOLOS_RARIDADE[raridade] || ['circulo'] : ['circulo', 'losango', 'estrela-preta']   // vazio = todas
	return `<span class="icone-simbolos">${nomes.map(n => `<svg class="simbolo" viewBox="0 0 24 24" aria-hidden="true">${FORMAS_SIMBOLO[n]}</svg>`).join('')}</span>`
}
function atualizarSeletorRaridade(estado = pesquisa) {
	const botao = $('#filtro-raridade')
	if (!botao) return
	botao.innerHTML = `${htmlIconeRaridade(estado.raridade)}<span class="seletor-texto">${escapar(estado.raridade || 'Todas as raridades')}</span>${SETA_SELETOR}`
}

/* Lista de escolha com ícones, que abre de baixo (o voltar do celular fecha só ela). */
let aoEscolher = null
function abrirEscolha(titulo, opcoes, atual, escolheu) {
	if (!$('#escolha').hidden) return
	$('#escolha-titulo').textContent = titulo
	$('#opcoes-escolha').innerHTML = opcoes.map(o => o.cabecalho ? `<li class="cabecalho-escolha">${escapar(o.cabecalho)}</li>` : `<li><button class="opcao-set${o.apagada ? ' apagada' : ''}" role="radio" aria-checked="${o.valor === atual}" data-valor="${escapar(o.valor)}">
		${o.icone}
		<span class="opcao-nome">${escapar(o.rotulo)}<small>${escapar(o.detalhe)}</small></span>
		<svg class="marca" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
	</button></li>`).join('')
	carregarLogosDentro($('#opcoes-escolha'))
	aoEscolher = escolheu
	$('#escolha').hidden = false
	registrarSobreposicao()
	if (!semAnimacao()) $('#escolha .folha').animate([{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 200, easing: 'ease-out' })
}

function fecharEscolha(veioDoHistorico = false) {
	if ($('#escolha').hidden) return
	$('#escolha').hidden = true
	if (!veioDoHistorico) liberarSobreposicao()
}

$('#escolha').addEventListener('click', evento => {
	if (evento.target.id === 'escolha') { fecharEscolha(); return }
	const botao = evento.target.closest('.opcao-set')
	if (!botao) return
	const escolheu = aoEscolher
	fecharEscolha()
	escolheu?.(botao.dataset.valor)
})

// estado: { set, raridade, limite } da tela que usa o filtro; aoMudar redesenha essa tela.
// soDesejadas: nas contagens, só conta as cartas da lista de desejos.
function abrirEscolhaSet(estado = pesquisa, aoMudar = desenharPesquisa, soDesejadas = false) {
	const contar = set => cartasDoSet(set).filter(c => !soDesejadas || desejada(set.id, c.n)).length
	const opcoes = [{ valor: '', icone: htmlIconeSet(null), rotulo: 'Todos os sets', detalhe: `${soDesejadas ? dados.sets.length : setsVisiveis().length} coleções` },
		...dados.series.flatMap(serie => [{ cabecalho: serie.nome },
			...(soDesejadas ? dados.sets : setsVisiveis()).filter(set => set.serie === serie.id).map(set => ({ valor: set.id, icone: htmlIconeSet(set), rotulo: set.nome, detalhe: `${contar(set)} cartas` }))])]
	abrirEscolha('Coleção', opcoes, estado.set, valor => {
		estado.set = valor
		estado.limite = PASSO_PESQUISA
		atualizarSeletorSet(estado)
		aoMudar()
	})
}

function abrirEscolhaRaridade(estado = pesquisa, aoMudar = desenharPesquisa, soDesejadas = false) {
	// Quantas cartas de cada raridade existem (na coleção escolhida, se houver uma).
	const contagem = {}
	for (const set of soDesejadas ? dados.sets : setsVisiveis()) {
		if (estado.set && set.id !== estado.set) continue
		for (const carta of cartasDoSet(set)) if (carta.raridade && (!soDesejadas || desejada(set.id, carta.n))) contagem[carta.raridade] = (contagem[carta.raridade] || 0) + 1
	}
	const total = Object.values(contagem).reduce((soma, n) => soma + n, 0)
	const opcoes = [{ valor: '', icone: htmlIconeRaridade(''), rotulo: 'Todas as raridades', detalhe: `${total} cartas` },
		...raridadesDasCartas().map(r => ({ valor: r, icone: htmlIconeRaridade(r), rotulo: r, detalhe: `${contagem[r] || 0} carta${contagem[r] === 1 ? '' : 's'}`, apagada: !contagem[r] }))]
	abrirEscolha('Raridade', opcoes, estado.raridade, valor => {
		estado.raridade = valor
		estado.limite = PASSO_PESQUISA
		atualizarSeletorRaridade(estado)
		aoMudar()
	})
}

/* ---------- Aba: Lista de Desejos ---------- */
const ICONE_CARRINHO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h8.1a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.1"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="16.5" cy="19.5" r="1.4"/></svg>'
const ICONE_EXTERNO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>'

// Cartas da lista que já foram abertas na Liga (para saber qual é a próxima).
let abertasNaLiga = new Set()
try { abertasNaLiga = new Set(JSON.parse(ler(CHAVE_LIGA_ABERTAS) || '[]')) } catch { /* nenhuma */ }
const chaveLiga = (set, carta) => `${set.id}|${carta.n}`

// Cartas para comprar: as da lista de desejos que ainda não tenho, com os filtros da lista.
function cartasParaComprar() {
	const itens = []
	for (const set of dados.sets) {
		if (filtroDesejos.set && set.id !== filtroDesejos.set) continue
		for (const carta of set.cartas) {
			if (!desejada(set.id, carta.n) || tenho(set.id, carta.n)) continue
			if (filtroDesejos.raridade && carta.raridade !== filtroDesejos.raridade) continue
			itens.push({ set, carta })
		}
	}
	return itens
}

function telaComprarNaLiga() {
	definirTopo('Comprar na Liga', '', true)
	tela.innerHTML = `
		<div class="dica-liga">
			<p><b>Como funciona</b></p>
			<ol>
				<li>Toque em <b>Abrir próxima</b>: a página dela abre na Liga Pokémon.</li>
				<li>Lá, filtre a qualidade <b>NM</b> e escolha uma loja do <b>seu estado</b>.</li>
				<li>Adicione ao carrinho e volte para cá para abrir a próxima.</li>
			</ol>
		</div>
		<div id="conteudo"></div>`
	desenharComprarNaLiga()
}

function desenharComprarNaLiga() {
	const conteudo = $('#conteudo')
	if (!conteudo) return
	const itens = cartasParaComprar()
	const filtrado = filtroDesejos.set || filtroDesejos.raridade
	if (!itens.length) {
		$('#subtitulo').textContent = ''
		conteudo.innerHTML = `<p class="vazio">Nenhuma carta para comprar${filtrado ? ' com os filtros da lista' : ''}. Cartas que você já tem não entram aqui.</p>`
		return
	}
	const abertas = itens.filter(i => abertasNaLiga.has(chaveLiga(i.set, i.carta))).length
	const proxima = itens.find(i => !abertasNaLiga.has(chaveLiga(i.set, i.carta)))
	$('#subtitulo').textContent = `${itens.length} carta${itens.length > 1 ? 's' : ''}${filtrado ? ' (com filtros)' : ''}`
	conteudo.innerHTML = `
		<div class="progresso-liga">
			<div class="barra"><span style="width:${Math.round(abertas / itens.length * 100)}%"></span></div>
			<p>${abertas} de ${itens.length} aberta${itens.length > 1 ? 's' : ''} na Liga</p>
		</div>
		${proxima
			? `<a class="botao comprar-liga" id="liga-proxima" href="${escapar(linkLiga(proxima.set, proxima.carta).url)}" target="_blank" rel="noopener noreferrer" data-chave="${escapar(chaveLiga(proxima.set, proxima.carta))}">${ICONE_EXTERNO}<span>Abrir próxima: ${escapar(proxima.carta.nome)}</span></a>`
			: '<p class="liga-concluido">✓ Você abriu todas as cartas. Confira o carrinho na Liga!</p>'}
		<ul class="lista-liga">${itens.map(({ set, carta }) => {
			const chave = chaveLiga(set, carta)
			const aberta = abertasNaLiga.has(chave)
			return `<li class="item-liga${aberta ? ' aberta' : ''}">
				<span class="item-liga-img" data-set="${escapar(set.id)}" data-n="${escapar(carta.n)}"><img alt="" loading="lazy"></span>
				<span class="item-liga-texto"><b>${escapar(carta.nome)}</b><small>${escapar([set.nome, numeroExibido(set, carta), carta.raridade].filter(Boolean).join(' · '))}</small>${aberta ? '<small class="item-liga-ok">✓ Aberta na Liga</small>' : ''}</span>
				<a class="botao secundario item-liga-abrir" href="${escapar(linkLiga(set, carta).url)}" target="_blank" rel="noopener noreferrer" data-chave="${escapar(chave)}">${aberta ? 'Abrir de novo' : 'Abrir'}</a>
			</li>`
		}).join('')}</ul>
		${abertas ? '<button class="botao secundario" id="liga-recomecar">Recomeçar (desmarcar as abertas)</button>' : ''}`

	for (const caixa of conteudo.querySelectorAll('.item-liga-img')) carregarImagem(caixa.querySelector('img'), caixa.dataset.set, caixa.dataset.n, 'low')
	// Ao abrir uma carta na Liga, marca como aberta (o link abre normalmente em outra janela).
	for (const link of conteudo.querySelectorAll('a[data-chave]')) {
		link.addEventListener('click', () => {
			abertasNaLiga.add(link.dataset.chave)
			gravar(CHAVE_LIGA_ABERTAS, JSON.stringify([...abertasNaLiga]))
			setTimeout(desenharComprarNaLiga, 300)
		})
	}
	$('#liga-recomecar')?.addEventListener('click', () => {
		for (const { set, carta } of itens) abertasNaLiga.delete(chaveLiga(set, carta))
		gravar(CHAVE_LIGA_ABERTAS, JSON.stringify([...abertasNaLiga]))
		desenharComprarNaLiga()
	})
}

const filtroDesejos = { set: '', raridade: '', limite: PASSO_PESQUISA }

function telaDesejos() {
	definirTopo('Lista de Desejos', '', false)
	tela.innerHTML = `
		<div class="filtros">
			<button class="seletor" id="filtro-set" aria-haspopup="dialog" aria-label="Filtrar por coleção"></button>
			<button class="seletor" id="filtro-raridade" aria-haspopup="dialog" aria-label="Filtrar por raridade"></button>
		</div>
		<div id="conteudo"></div>`
	atualizarSeletorSet(filtroDesejos)
	atualizarSeletorRaridade(filtroDesejos)
	$('#filtro-set').addEventListener('click', () => abrirEscolhaSet(filtroDesejos, desenharDesejos, true))
	$('#filtro-raridade').addEventListener('click', () => abrirEscolhaRaridade(filtroDesejos, desenharDesejos, true))
	desenharDesejos()
}

function desenharDesejos() {
	const conteudo = $('#conteudo')
	if (!conteudo) return
	const itens = []
	let total = 0
	for (const set of dados.sets) {
		for (const carta of set.cartas) {
			if (!desejada(set.id, carta.n)) continue
			total++
			if (filtroDesejos.set && set.id !== filtroDesejos.set) continue
			if (filtroDesejos.raridade && carta.raridade !== filtroDesejos.raridade) continue
			itens.push({ set, carta })
		}
	}
	$('#subtitulo').textContent = total ? `${total} carta${total > 1 ? 's' : ''}` : ''
	if (!total) {
		conteudo.innerHTML = `
			<div class="vazio dica-pesquisa">
				<div class="icone-grande" aria-hidden="true">★</div>
				<p><b>Sua lista está vazia</b></p>
				<p>Segure uma carta para ampliá-la e, quando ela parar de girar, toque na estrela no canto de cima.</p>
			</div>`
		return
	}
	if (!itens.length) { conteudo.innerHTML = '<p class="vazio">Nenhuma carta da lista com esses filtros.</p>'; return }
	const faltam = itens.filter(({ set, carta }) => !tenho(set.id, carta.n)).length
	conteudo.innerHTML = `
		${faltam ? `<a class="botao comprar-liga" href="#/desejos/comprar">${ICONE_CARRINHO}<span>Comprar na Liga Pokémon (${faltam})</span></a>` : ''}
		<h2 class="titulo-secao">${itens.length} carta${itens.length > 1 ? 's' : ''}</h2>`
	conteudo.appendChild(montarGrade(itens.slice(0, filtroDesejos.limite), true))
	if (itens.length > filtroDesejos.limite) {
		const mais = document.createElement('button')
		mais.className = 'botao secundario'
		mais.textContent = `Mostrar mais (${itens.length - filtroDesejos.limite} restantes)`
		mais.addEventListener('click', () => {
			const y = window.scrollY
			filtroDesejos.limite += PASSO_PESQUISA
			desenharDesejos()
			window.scrollTo(0, y)
		})
		conteudo.appendChild(mais)
	}
}

function desenharPesquisa() {
	for (const botao of document.querySelectorAll('#filtro-status button')) {
		botao.classList.toggle('ativo', botao.dataset.status === pesquisa.status)
	}
	const conteudo = $('#conteudo')
	const texto = semAcento(pesquisa.texto.trim())

	if (!texto && !pesquisa.set && !pesquisa.raridade && pesquisa.status === 'todas') {
		conteudo.innerHTML = `
			<div class="vazio dica-pesquisa">
				<div class="icone-grande" aria-hidden="true">🔍</div>
				<p><b>Busque uma carta</b></p>
				<p>Digite o nome (ex.: <i>Pikachu</i>) ou o número (ex.: <i>25</i>), ou use os filtros acima.</p>
			</div>`
		return
	}

	const itens = []
	for (const set of setsVisiveis()) {
		if (pesquisa.set && set.id !== pesquisa.set) continue
		for (const carta of cartasDoSet(set)) {
			if (pesquisa.raridade && carta.raridade !== pesquisa.raridade) continue
			const marcada = tenho(set.id, carta.n)
			if (pesquisa.status === 'faltam' && marcada) continue
			if (pesquisa.status === 'tenho' && !marcada) continue
			if (combina(carta, texto)) itens.push({ set, carta })
		}
	}

	if (!itens.length) {
		conteudo.innerHTML = '<p class="vazio">Nenhuma carta encontrada.</p>'
		return
	}
	conteudo.innerHTML = `<h2 class="titulo-secao">${itens.length} carta${itens.length > 1 ? 's' : ''} encontrada${itens.length > 1 ? 's' : ''}</h2>`
	conteudo.appendChild(montarGrade(itens.slice(0, pesquisa.limite), true))
	if (itens.length > pesquisa.limite) {
		const mais = document.createElement('button')
		mais.className = 'botao secundario'
		mais.id = 'mais-resultados'
		mais.textContent = `Mostrar mais (${itens.length - pesquisa.limite} restantes)`
		mais.addEventListener('click', () => {
			const y = window.scrollY
			pesquisa.limite += PASSO_PESQUISA
			desenharPesquisa()
			window.scrollTo(0, y)
		})
		conteudo.appendChild(mais)
	}
}

/* ---------- Aba: Como usar o app (tutorial) ---------- */
const PASSOS_TUTORIAL = [
	{ icone: '☰', titulo: 'Navegue pelas abas', texto: [
		'Toque nos <b>três riscos</b> no canto de cima para trocar de aba: Como usar, Pesquisa, Coleções, Lista de Desejos e Configurações.',
		'O botão <b>voltar</b> do celular volta para a tela anterior (e fecha a carta ampliada ou os menus).'] },
	{ icone: '✓', titulo: 'Marque as cartas que você tem', texto: [
		'<b>Toque</b> numa carta para marcar que você tem (ela fica colorida, com um ✓ verde). Toque de novo para desmarcar.',
		'As cartas que faltam ficam apagadas, em preto e branco.'] },
	{ icone: '👆', titulo: 'Segure para ver a carta grande', texto: [
		'<b>Segure</b> uma carta por meio segundo: ela gira, mostra o verso e para de frente, com efeitos conforme a raridade.',
		'Na carta grande dá para marcar ou desmarcar, e abrir a carta na <b>Liga Pokémon</b> para comprar.',
		'Toque fora da carta (ou use o voltar) para fechar.'] },
	{ icone: '📚', titulo: 'Coleções', texto: [
		'Mostra cada coleção com o seu progresso (quantas você tem e a porcentagem), agrupadas por série.',
		'Em <b>Escolher coleções</b> você liga só as que coleciona; as outras somem do app.',
		'Dentro de uma coleção: o filtro <b>Faltam</b> mostra só o que falta, e o botão <b>Master set</b> inclui ou tira as cartas especiais (secretas).'] },
	{ icone: '🔍', titulo: 'Pesquisa', texto: [
		'Busque pelo <b>nome</b> (ex.: Pikachu) ou pelo <b>número</b> (ex.: 25 ou 025/132).',
		'Filtre por <b>coleção</b> e por <b>raridade</b> (com os mesmos símbolos impressos nas cartas), e por <b>Todas / Faltam / Tenho</b>.'] },
	{ icone: '★', titulo: 'Lista de Desejos', texto: [
		'Segure uma carta e espere ela parar de girar: aparece uma <b>estrela</b> no canto de cima. Toque nela para guardar a carta na sua lista.',
		'Na aba <b>Lista de Desejos</b> você filtra por coleção e raridade e usa <b>Comprar na Liga Pokémon</b> para abrir as cartas uma por uma na Liga (lá, escolha qualidade NM e uma loja do seu estado).'] },
	{ icone: '☁', titulo: 'Conta e sincronização', texto: [
		'Toque na <b>nuvem</b> no topo para entrar ou criar sua conta (e-mail e senha).',
		'Com a conta, a coleção, a lista de desejos e as coleções escolhidas ficam iguais no celular e no PC (site: ticos1.github.io/projeto-cartas).',
		'Sem internet o app continua funcionando; as mudanças são enviadas quando a conexão voltar.'] },
	{ icone: '🎨', titulo: 'Temas e logs', texto: [
		'Em <b>Configurações → Temas</b>: modo claro, escuro ou automático e um tema com as cores de cada coleção (ou a sua cor).',
		'Em <b>Configurações → Logs</b> ficam os erros do app; se algo der errado, use <b>Compartilhar</b> e mande para quem for te ajudar.'] },
	{ icone: '⋮', titulo: 'Menu de três pontinhos', texto: [
		'<b>Backup</b>: exporte sua coleção para um arquivo e importe de volta quando quiser.',
		'<b>App Android</b>: o app avisa quando há uma versão nova e se atualiza sozinho; use <b>Procurar atualização</b> para conferir.'] },
]

function telaComoUsar() {
	definirTopo('Como usar o app', 'Guia rápido do Ticards', false)
	tela.innerHTML = `
		<section class="tutorial-topo">
			<img src="icons/icon-192.png" alt="" width="72" height="72">
			<div>
				<h2>Bem-vindo ao Ticards!</h2>
				<p>Controle sua coleção de cartas Pokémon TCG: marque o que você tem, veja o que falta e monte sua lista de desejos.</p>
			</div>
		</section>
		<a class="botao" href="#/pesquisa">Começar a usar</a>
		<ol class="tutorial">${PASSOS_TUTORIAL.map((passo, i) => `
			<li class="passo">
				<span class="passo-icone" aria-hidden="true">${passo.icone}</span>
				<div>
					<h3><span class="passo-numero">${i + 1}.</span> ${passo.titulo}</h3>
					${passo.texto.map(t => `<p>${t}</p>`).join('')}
				</div>
			</li>`).join('')}
		</ol>
		<a class="botao" href="#/pesquisa">Começar a usar</a>
		<p class="dica rodape">Este guia abre sempre que você entra no app. Você pode voltar a ele pelo menu ☰ → Como usar o app.</p>`
}

/* ---------- Aba: Configurações (sub-abas Temas e Logs) ---------- */
function telaConfiguracoes(sub) {
	definirTopo('Configurações', sub === 'logs' ? 'Logs' : 'Temas', false)
	tela.innerHTML = `
		<div class="segmentos" id="sub-abas">
			<button data-sub="temas" class="${sub === 'temas' ? 'ativo' : ''}">Temas</button>
			<button data-sub="logs" class="${sub === 'logs' ? 'ativo' : ''}">Logs</button>
		</div>
		<div id="conteudo"></div>`
	$('#sub-abas').addEventListener('click', evento => {
		const botao = evento.target.closest('button')
		if (!botao || botao.dataset.sub === sub) return
		// Trocar de sub-aba não cria entrada no histórico: o voltar do celular continua saindo da Configurações.
		history.replaceState({ app: true }, '', botao.dataset.sub === 'logs' ? '#/configuracoes/logs' : '#/configuracoes')
		navegar()
	})
	if (sub === 'logs') desenharLogs()
	else desenharTemas()
}

/* ----- Temas ----- */
function cartaDoTema(id, escuro, ativo) {
	const variaveis = id === 'personalizado'
		? { ...TEMAS.padrao[escuro ? 'escuro' : 'claro'], ...variaveisDoTema('personalizado', escuro) }
		: TEMAS[id][escuro ? 'escuro' : 'claro']
	const nome = id === 'personalizado' ? 'Personalizado' : TEMAS[id].nome
	return `<button class="tema-card" data-tema-id="${id}" aria-pressed="${id === ativo}">
		<span class="tema-previa" style="background:${variaveis['--fundo']}">
			<span class="previa-barra" style="background:${variaveis['--destaque']}"></span>
			<span class="previa-caixa" style="background:${variaveis['--superficie']}"></span>
			<span class="previa-ponto" style="background:${variaveis['--destaque']}"></span>
		</span>
		<span class="tema-nome">${TEMAS[id]?.set ? htmlIconeSet({ id: TEMAS[id].set, sigla: TEMAS[id].set }) : ''}<span class="tema-texto">${nome}</span><svg class="marca" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
	</button>`
}

function desenharTemas() {
	const modo = ler(CHAVE_TEMA) || 'auto'
	const ativo = idDoTema()
	const escuro = modoEscuro(modo)
	$('#conteudo').innerHTML = `
		<h2 class="titulo-secao">Modo</h2>
		<div class="segmentos" id="modo">
			<button data-modo="auto">Automático</button>
			<button data-modo="claro">Claro</button>
			<button data-modo="escuro">Escuro</button>
		</div>
		<p class="dica">Automático segue o modo do seu celular.</p>

		<h2 class="titulo-secao">Temas das coleções</h2>
		<p class="dica">Cada coleção tem o seu tema, com as cores da arte dela.</p>
		<div class="grade-temas" id="grade-temas">${ORDEM_TEMAS.map(id => cartaDoTema(id, escuro, ativo)).join('')}</div>

		<h2 class="titulo-secao">Cor de destaque personalizada</h2>
		<label class="cor-personalizada">
			<input type="color" id="cor-destaque" value="${escapar(ler(CHAVE_COR) || '#d6342c')}">
			<span>Escolha a cor dos botões e destaques<small>Vira o tema "Personalizado".</small></span>
		</label>`

	carregarLogosDentro($('#grade-temas'))
	const marcarModo = () => {
		for (const botao of document.querySelectorAll('#modo button')) botao.classList.toggle('ativo', botao.dataset.modo === (ler(CHAVE_TEMA) || 'auto'))
	}
	marcarModo()
	$('#modo').addEventListener('click', evento => {
		const botao = evento.target.closest('button')
		if (!botao) return
		gravar(CHAVE_TEMA, botao.dataset.modo)
		aplicarTema(botao.dataset.modo)
		registrar('info', `Modo: ${botao.dataset.modo}`)
		desenharTemas()   // as prévias mudam com o modo
	})
	$('#grade-temas').addEventListener('click', evento => {
		const cartao = evento.target.closest('.tema-card')
		if (!cartao) return
		gravar(CHAVE_PALETA, cartao.dataset.temaId)
		aplicarTema(ler(CHAVE_TEMA) || 'auto')
		registrar('info', `Tema: ${cartao.dataset.temaId}`)
		desenharTemas()
	})
	$('#cor-destaque').addEventListener('input', evento => {
		gravar(CHAVE_COR, evento.target.value)
		gravar(CHAVE_PALETA, 'personalizado')
		aplicarTema(ler(CHAVE_TEMA) || 'auto')
		// Só atualiza a prévia e a seleção (redesenhar tudo fecharia o seletor de cor).
		const cartao = document.querySelector('[data-tema-id="personalizado"]')
		if (cartao) cartao.outerHTML = cartaDoTema('personalizado', modoEscuro(ler(CHAVE_TEMA) || 'auto'), 'personalizado')
		for (const outro of document.querySelectorAll('.tema-card')) outro.setAttribute('aria-pressed', outro.dataset.temaId === 'personalizado')
	})
	$('#cor-destaque').addEventListener('change', () => registrar('info', `Tema: personalizado (${ler(CHAVE_COR)})`))
}

/* ----- Logs ----- */
const filtroLogs = { nivel: 'todos' }
const ROTULO_NIVEL = { info: 'INFO', aviso: 'AVISO', erro: 'ERRO' }
const dataHora = t => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })

function infoDoSistema() {
	const apk = versaoInstaladaDoApk()
	return [
		['Versão do app', VERSAO_APP],
		['Onde roda', apk ? `App Android 1.${apk}` : 'Navegador'],
		['Conta', usuario ? 'conectada' : 'não conectada'],
		['Internet', navigator.onLine ? 'conectado' : 'sem conexão'],
		['Modo offline', navigator.serviceWorker?.controller ? 'ativo' : 'inativo'],
		['Tela', `${window.innerWidth}×${window.innerHeight} (${window.devicePixelRatio || 1}x)`],
		['Cartas marcadas', Object.values(colecao).reduce((soma, s) => soma + s.size, 0)],
		['Aparelho', navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 110)],
	]
}

function logsFiltrados() {
	return logs.filter(l => filtroLogs.nivel === 'todos' || (filtroLogs.nivel === 'erro' ? l.n === 'erro' : l.n !== 'info'))
}

function textoDosLogs() {
	const cabecalho = infoDoSistema().map(([rotulo, valor]) => `${rotulo}: ${valor}`).join('\n')
	const linhas = logs.map(l => `[${new Date(l.t).toISOString().replace('T', ' ').slice(0, 19)}] ${ROTULO_NIVEL[l.n] || l.n} ${l.m}${l.d ? `\n    ${l.d}` : ''}`)
	return `Ticards - relatório de logs\nGerado em: ${new Date().toISOString()}\n${cabecalho}\n\n${linhas.join('\n') || '(sem registros)'}\n`
}

function atualizarListaLogs() {
	const lista = $('#lista-logs')
	if (!lista) return
	const itens = logsFiltrados().slice().reverse()
	lista.innerHTML = itens.length
		? itens.map(l => `<li class="log ${l.n}"><time>${dataHora(l.t)}</time><span class="nivel">${ROTULO_NIVEL[l.n] || l.n}</span>${escapar(l.m)}${l.d ? `<div class="detalhe">${escapar(l.d)}</div>` : ''}</li>`).join('')
		: '<li class="vazio">Nenhum registro por aqui.</li>'
	const contagem = (nivel) => logs.filter(l => nivel === 'todos' ? true : nivel === 'erro' ? l.n === 'erro' : l.n !== 'info').length
	for (const botao of document.querySelectorAll('#filtro-logs button')) {
		botao.classList.toggle('ativo', botao.dataset.nivel === filtroLogs.nivel)
		botao.textContent = `${{ todos: 'Todos', problemas: 'Avisos e erros', erro: 'Erros' }[botao.dataset.nivel]} (${contagem(botao.dataset.nivel)})`
	}
}

async function copiarTexto(texto) {
	try {
		await navigator.clipboard.writeText(texto)
		return true
	} catch {
		const campo = document.createElement('textarea')
		campo.value = texto
		campo.style.position = 'fixed'
		campo.style.opacity = '0'
		document.body.appendChild(campo)
		campo.select()
		const ok = document.execCommand('copy')
		campo.remove()
		return ok
	}
}

function desenharLogs() {
	$('#conteudo').innerHTML = `
		<dl class="logs-info">${infoDoSistema().map(([r, v]) => `<dt>${escapar(r)}</dt><dd>${escapar(v)}</dd>`).join('')}</dl>
		<p class="dica">Os logs ficam só neste aparelho. Se precisar de ajuda, copie ou compartilhe e envie para quem for te ajudar.</p>
		<div class="logs-acoes">
			<button class="botao secundario" id="logs-copiar">Copiar</button>
			<button class="botao secundario" id="logs-exportar">Compartilhar</button>
			<button class="botao secundario" id="logs-limpar">Limpar</button>
		</div>
		<div class="segmentos" id="filtro-logs">
			<button data-nivel="todos"></button><button data-nivel="problemas"></button><button data-nivel="erro"></button>
		</div>
		<ul class="lista-logs" id="lista-logs"></ul>`
	atualizarListaLogs()
	$('#filtro-logs').addEventListener('click', evento => {
		const botao = evento.target.closest('button')
		if (!botao) return
		filtroLogs.nivel = botao.dataset.nivel
		atualizarListaLogs()
	})
	$('#logs-copiar').addEventListener('click', async () => avisar(await copiarTexto(textoDosLogs()) ? 'Logs copiados.' : 'Não foi possível copiar.'))
	$('#logs-exportar').addEventListener('click', async () => {
		const resultado = await entregarArquivo(`colecao-tcg-logs-${new Date().toISOString().slice(0, 10)}.txt`, textoDosLogs(), 'text/plain', 'Logs do Ticards')
		if (resultado === 'baixado') avisar('Logs baixados.')
		else if (resultado === 'erro') avisar('Não foi possível compartilhar os logs.')
	})
	$('#logs-limpar').addEventListener('click', () => {
		if (!logs.length || !confirm('Apagar todos os registros de logs deste aparelho?')) return
		logs = []
		gravar(CHAVE_LOGS, '[]')
		atualizarListaLogs()
		avisar('Logs apagados.')
	})
}

/* ---------- Tela: um set (grade de cartas) ---------- */
function telaSet(setId) {
	const set = dados.sets.find(s => s.id === setId)
	if (!set) { location.hash = '#/colecoes'; return }

	filtros[set.id] ||= 'todas'
	const busca = buscas[set.id] || ''

	definirTopo(set.nome, '', true)
	tela.innerHTML = `
		<section class="resumo" id="resumo-set"></section>
		<input class="busca" id="busca" type="search" placeholder="Buscar por nome ou número" value="${escapar(busca)}" autocomplete="off" enterkeyhint="search">
		${temCartasEspeciais(set) ? `
		<button class="opcao-master" id="master-set" role="switch">
			<span class="opcao-texto">
				<b>Master set</b>
				<small id="master-set-dica"></small>
			</span>
			<span class="chave" aria-hidden="true"></span>
		</button>` : ''}
		<div class="segmentos" id="filtro">
			<button data-filtro="todas">Todas</button>
			<button data-filtro="faltam">Faltam</button>
			<button data-filtro="tenho">Tenho</button>
		</div>
		<div id="conteudo"></div>`

	atualizarProgressoNaTela()

	const campo = $('#busca')
	campo.addEventListener('input', () => {
		buscas[set.id] = campo.value
		desenharGradeSet(set)
	})

	$('#master-set')?.addEventListener('click', () => {
		definirMasterSet(set, !masterSetLigado(set))
		desenharGradeSet(set)
		atualizarProgressoNaTela()
	})

	$('#filtro').addEventListener('click', evento => {
		const botao = evento.target.closest('button')
		if (!botao) return
		filtros[set.id] = botao.dataset.filtro
		desenharGradeSet(set)
	})

	desenharGradeSet(set)
}

function desenharGradeSet(set) {
	const filtro = filtros[set.id]
	for (const botao of document.querySelectorAll('#filtro button')) {
		botao.classList.toggle('ativo', botao.dataset.filtro === filtro)
	}

	const busca = semAcento((buscas[set.id] || '').trim())
	const master = $('#master-set')
	if (master) {
		const ligado = masterSetLigado(set)
		const normais = set.cartas.filter(c => cartaNormal(set, c)).length
		master.setAttribute('aria-checked', ligado)
		$('#master-set-dica').textContent = ligado
			? `Todas as ${set.cartas.length} cartas, com as ${set.cartas.length - normais} especiais`
			: `Só as ${normais} cartas da numeração normal`
	}

	const itens = cartasDoSet(set)
		.filter(carta => {
			if (filtro === 'faltam' && tenho(set.id, carta.n)) return false
			if (filtro === 'tenho' && !tenho(set.id, carta.n)) return false
			return combina(carta, busca)
		})
		.map(carta => ({ set, carta }))

	const conteudo = $('#conteudo')
	conteudo.innerHTML = ''
	if (itens.length) {
		conteudo.appendChild(montarGrade(itens, false))
	} else {
		const mensagem = busca ? 'Nenhuma carta encontrada.'
			: filtro === 'faltam' ? 'Parabéns! Você completou este set. 🎉'
			: filtro === 'tenho' ? 'Você ainda não marcou nenhuma carta deste set. Toque numa carta para marcar.'
			: 'Nenhuma carta.'
		conteudo.innerHTML = `<p class="vazio">${mensagem}</p>`
	}
}

// Atualiza números e barras depois de marcar uma carta (sem redesenhar a grade).
function atualizarProgressoNaTela() {
	if ($('#resumo')) atualizarResumo()
	const resumoSet = $('#resumo-set')
	if (resumoSet) {
		const set = dados.sets.find(s => s.id === rotaAtual().setId)
		const p = progresso(set)
		resumoSet.innerHTML = `
			<div class="resumo-linha"><strong>${p.pct}%</strong><span>${p.tem} de ${p.total} cartas · faltam ${p.total - p.tem}</span></div>
			${barraHtml(p)}`
	}
}

/* ---------- Navegação (endereços com #) ---------- */
// Abas: #/como-usar (tutorial, abre por padrão ao entrar no app), #/pesquisa, #/colecoes, #/desejos e #/configuracoes. Um set (#/set/ID) fica dentro de Coleções.
function rotaAtual() {
	const partes = location.hash.replace(/^#\/?/, '').split('/')
	if (partes[0] === 'set') return { aba: 'colecoes', setId: decodeURIComponent(partes[1] || '') }
	if (partes[0] === 'colecoes') return { aba: 'colecoes' }
	if (partes[0] === 'desejos') return { aba: 'desejos', sub: partes[1] === 'comprar' ? 'comprar' : '' }
	if (partes[0] === 'configuracoes') return { aba: 'configuracoes', sub: partes[1] === 'logs' ? 'logs' : 'temas' }
	if (partes[0] === 'pesquisa') return { aba: 'pesquisa' }
	return { aba: 'ajuda' }
}

function navegar() {
	$('#zoom').hidden = true
	aberturaDoZoom++
	pararEfeitos()
	entradasDeSobreposicao = 0
	// Toda tela que o app abre fica marcada como "do app" no histórico.
	if (!history.state?.app) history.replaceState({ app: true }, '')
	$('#gaveta').hidden = true
	$('#escolha').hidden = true
	const { setId, aba, sub } = rotaAtual()
	if (setId) telaSet(setId)
	else if (aba === 'colecoes') telaColecoes()
	else if (aba === 'ajuda') telaComoUsar()
	else if (aba === 'desejos') sub === 'comprar' ? telaComprarNaLiga() : telaDesejos()
	else if (aba === 'configuracoes') telaConfiguracoes(sub)
	else telaPesquisa()
	marcarAbaNaGaveta(aba)
	window.scrollTo(0, 0)
}

window.addEventListener('hashchange', navegar)

/* ---------- Botão voltar do celular ---------- */
// O voltar do Android (e do navegador) anda no histórico. Para ele voltar para a tela
// anterior em vez de sair do app: (1) cada sobreposição aberta (carta grande, menu) ganha
// uma entrada no histórico, então o voltar só a fecha; (2) um set sempre tem a lista logo
// abaixo dele, mesmo se o app foi aberto direto no set.
let entradasDeSobreposicao = 0   // quantas entradas extras o app empurrou no histórico
let ignorarPopstate = 0          // voltas que o próprio app pediu (não são o botão do celular)

function registrarSobreposicao() {
	history.pushState({ app: true, sobreposicao: true }, '')
	entradasDeSobreposicao++
}

// A sobreposição foi fechada pela própria tela (toque fora, botão Fechar): tira a entrada.
function liberarSobreposicao() {
	if (entradasDeSobreposicao === 0) return
	entradasDeSobreposicao--
	ignorarPopstate++
	history.back()
}

window.addEventListener('popstate', () => {
	if (ignorarPopstate) { ignorarPopstate--; return }
	if (entradasDeSobreposicao === 0) return
	// O voltar do celular já desfez a entrada: só falta esconder o que está aberto.
	entradasDeSobreposicao--
	if (!$('#zoom').hidden) fecharZoom(true, true, true)
	else if (!$('#menu').hidden) fecharMenu(true)
	else if (!$('#gaveta').hidden) fecharGaveta(true)
	else if (!$('#escolha').hidden) fecharEscolha(true)
})

function prepararHistorico() {
	if (history.state?.sobreposicao) history.replaceState({ app: true }, '')
	if (history.state?.app) return   // recarregou dentro do app: o histórico já é nosso
	const { setId, aba, sub } = rotaAtual()
	const abaixo = setId ? '#/colecoes' : aba === 'desejos' && sub === 'comprar' ? '#/desejos' : null
	if (abaixo) {
		const destino = location.hash
		history.replaceState({ app: true }, '', abaixo)
		history.pushState({ app: true }, '', destino)
	} else {
		history.replaceState({ app: true }, '')
	}
}

$('#voltar').addEventListener('click', () => {
	const antes = location.hash
	history.back()
	// Se não havia para onde voltar, vai para a lista de coleções direto.
	setTimeout(() => {
		if (location.hash !== antes) return
		const { setId, sub } = rotaAtual()
		if (setId) location.hash = '#/colecoes'
		else if (sub === 'comprar') location.hash = '#/desejos'
	}, 400)
})

/* ---------- Abas (botão de três riscos) ---------- */
function marcarAbaNaGaveta(aba) {
	for (const item of document.querySelectorAll('.gaveta-item')) {
		if (item.dataset.aba === aba) item.setAttribute('aria-current', 'page')
		else item.removeAttribute('aria-current')
	}
}

function abrirGaveta() {
	if (!$('#gaveta').hidden) return
	marcarAbaNaGaveta(rotaAtual().aba)
	$('#gaveta').hidden = false
	registrarSobreposicao()
	if (semAnimacao()) return
	$('.gaveta').animate([{ transform: 'translateX(-100%)' }, { transform: 'none' }], { duration: 220, easing: 'ease-out' })
	$('#gaveta').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 })
}

function fecharGaveta(veioDoHistorico = false) {
	if ($('#gaveta').hidden) return
	$('#gaveta').hidden = true
	if (!veioDoHistorico) liberarSobreposicao()
}

// Vai para outra tela a partir da gaveta ou do menu: a entrada de histórico da sobreposição
// vira a da nova tela, assim o voltar do celular não passa por ela.
function irParaRotaFechandoSobreposicao(destino) {
	$('#gaveta').hidden = true
	$('#menu').hidden = true
	if (entradasDeSobreposicao > 0) {
		entradasDeSobreposicao--
		history.replaceState({ app: true }, '', destino)
		navegar()
	} else {
		location.hash = destino
	}
}

$('#abrir-gaveta').addEventListener('click', abrirGaveta)
$('#gaveta').addEventListener('click', evento => {
	if (evento.target.id === 'gaveta') fecharGaveta()
})
for (const item of document.querySelectorAll('.gaveta-item')) {
	item.addEventListener('click', evento => {
		evento.preventDefault()
		const destino = item.getAttribute('href')
		if (item.dataset.aba === rotaAtual().aba) { fecharGaveta(); return }
		irParaRotaFechandoSobreposicao(destino)
	})
}

/* ---------- Menu: backup e tema ---------- */
function abrirMenu() {
	if (!$('#menu').hidden) return
	configurarSecaoApk()
	$('#menu').hidden = false
	registrarSobreposicao()
}
function fecharMenu(veioDoHistorico = false) {
	if ($('#menu').hidden) return
	$('#menu').hidden = true
	if (!veioDoHistorico) liberarSobreposicao()
}
$('#abrir-menu').addEventListener('click', abrirMenu)
$('#status-nuvem').addEventListener('click', abrirMenu)
$('#fechar-menu').addEventListener('click', () => fecharMenu())
$('#menu-config').addEventListener('click', () => irParaRotaFechandoSobreposicao('#/configuracoes'))
$('#menu').addEventListener('click', evento => {
	if (evento.target.id === 'menu') fecharMenu()
})

// Entrega um arquivo de texto ao usuário: menu de compartilhar (Android/celular) ou download.
// Devolve 'compartilhado', 'baixado', 'cancelado' ou 'erro'.
async function entregarArquivo(nome, texto, tipo, titulo) {
	// Dentro do app Android: salva o arquivo e abre o menu de compartilhar do Android.
	const nativo = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins
	if (nativo?.Filesystem && nativo?.Share) {
		try {
			const { uri } = await nativo.Filesystem.writeFile({ path: nome, data: texto, directory: 'CACHE', encoding: 'utf8' })
			await nativo.Share.share({ title: titulo, files: [uri] })
			return 'compartilhado'
		} catch (erro) {
			return /cancel/i.test(erro?.message || '') ? 'cancelado' : 'erro'
		}
	}
	const arquivo = new File([texto], nome, { type: tipo })
	if (navigator.canShare?.({ files: [arquivo] })) {
		try {
			await navigator.share({ files: [arquivo], title: titulo })
			return 'compartilhado'
		} catch (erro) {
			if (erro.name === 'AbortError') return 'cancelado'
		}
	}
	const link = document.createElement('a')
	link.href = URL.createObjectURL(arquivo)
	link.download = nome
	link.click()
	setTimeout(() => URL.revokeObjectURL(link.href), 1000)
	return 'baixado'
}

$('#exportar').addEventListener('click', async () => {
	const cartas = colecaoComoObjeto()
	const quantidade = Object.values(cartas).reduce((soma, lista) => soma + lista.length, 0)
	const backup = { app: 'minha-colecao-tcg', versao: 1, exportadoEm: new Date().toISOString(), cartas, desejos: desejosComoObjeto() }
	const nome = `colecao-tcg-${new Date().toISOString().slice(0, 10)}.json`
	const resultado = await entregarArquivo(nome, JSON.stringify(backup, null, 1), 'application/json', 'Backup da coleção')
	if (resultado === 'compartilhado') avisar(`Backup com ${quantidade} cartas exportado.`)
	else if (resultado === 'baixado') avisar(`Backup com ${quantidade} cartas baixado.`)
	else if (resultado === 'erro') avisar('Não foi possível exportar o backup.')
	registrar(resultado === 'erro' ? 'erro' : 'info', `Backup da coleção: ${resultado} (${quantidade} cartas)`)
})

$('#importar').addEventListener('click', () => $('#arquivo-backup').click())

$('#arquivo-backup').addEventListener('change', async evento => {
	const arquivo = evento.target.files[0]
	evento.target.value = ''
	if (!arquivo) return
	try {
		const backup = JSON.parse(await arquivo.text())
		if (!backup || typeof backup.cartas !== 'object') throw new Error('formato')
		const novas = {}
		let quantidade = 0
		for (const [set, numeros] of Object.entries(backup.cartas)) {
			if (!Array.isArray(numeros)) continue
			novas[set] = new Set(numeros.map(String))
			quantidade += novas[set].size
		}
		const atuais = Object.values(colecao).reduce((soma, s) => soma + s.size, 0)
		const ondeSubstitui = usuario ? ' (no aparelho e na sua conta)' : ''
		if (!confirm(`Substituir sua coleção atual${ondeSubstitui} (${atuais} cartas) pelo backup (${quantidade} cartas)?`)) return
		colecao = novas
		salvarColecao()
		if (backup.desejos && typeof backup.desejos === 'object') {
			desejos = {}
			for (const [set, numeros] of Object.entries(backup.desejos)) if (Array.isArray(numeros)) desejos[set] = new Set(numeros.map(String))
			salvarDesejos()
		}
		nuvem?.substituirNaNuvem(colecaoComoObjeto(), desejosComoObjeto())
		fecharMenu()
		navegar()
		avisar(`Backup importado: ${quantidade} cartas.`)
	} catch {
		avisar('Esse arquivo não parece ser um backup válido.')
	}
})

/* ---------- Aparência: modo (claro/escuro) e temas de cores ---------- */
const VARIAVEIS_TEMA = ['--fundo', '--superficie', '--superficie-2', '--texto', '--texto-fraco', '--borda', '--destaque', '--destaque-texto']
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
		['#f5f8e4', '#ffffff', '#e8efc4', '#d5e09c', '#1a2108', '#65703a', '#8fb300', '#141a04'],
		['#0c0f06', '#151a0b', '#222b10', '#344217', '#f0f6d8', '#a4b274', '#c6e82a', '#141a04']),
	// Fogo Fantasmagórico: chamas roxas e azuis com letras magenta
	'me02': temaDoSet('Fogo Fantasmagórico', 'me02',
		['#f3eefb', '#ffffff', '#e6dcf5', '#d3c3ec', '#1c1030', '#6a5a8f', '#a02fb5'],
		['#0e0a1f', '#171231', '#241c4a', '#35296b', '#efe9ff', '#a99bd6', '#d65bf0', '#1a0626']),
	// Heróis Excelsos: letras douradas com contorno escuro
	'me02.5': temaDoSet('Heróis Excelsos', 'me02.5',
		['#fdf7e0', '#ffffff', '#f8ebb5', '#ecd98a', '#2a2105', '#7a6a2a', '#e8a900', '#1e1802'],
		['#12100a', '#1d1a0e', '#2e2913', '#443c1b', '#fbf3d2', '#c4b67c', '#ffc933', '#1e1802']),
	// Equilíbrio Perfeito: preto e branco com borda verde neon
	'me03': temaDoSet('Equilíbrio Perfeito', 'me03',
		['#f1f3ef', '#ffffff', '#e2e6dc', '#cdd4c3', '#0d0f0b', '#5a6350', '#2fa31a'],
		['#050605', '#0e100c', '#181b14', '#272c20', '#f4f6f0', '#9aa48c', '#58e03a', '#04160a']),
	// Caos Ascendente: azul gelo e respingos de água
	'me04': temaDoSet('Caos Ascendente', 'me04',
		['#eaf5fd', '#ffffff', '#d6eaf9', '#bddcf2', '#0b1f33', '#4f6f8a', '#1388d8'],
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
		['#fcf1e4', '#ffffff', '#f6dfc4', '#ebc9a0', '#2a1608', '#85624a', '#d9620f'],
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

// Preto ou branco, o que ler melhor em cima da cor escolhida.
function corDeTextoSobre(cor) {
	const n = parseInt(String(cor).slice(1), 16) || 0
	const brilho = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000
	return brilho > 150 ? '#1b1d24' : '#ffffff'
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
	// Cor da barra do sistema no celular
	const fundo = variaveis['--fundo'] || (escuro ? '#14161c' : '#f4f5f8')
	for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.content = fundo
}

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => aplicarTema(ler(CHAVE_TEMA) || 'auto'))

/* ---------- Conta e sincronização ---------- */
const TEXTO_STATUS = {
	sincronizado: '✅ Tudo sincronizado.',
	sincronizando: '🔄 Sincronizando…',
	offline: '📴 Sem internet. As mudanças serão enviadas quando a conexão voltar.',
	desconectado: '',
}

let ultimoStatus = null
function mostrarStatus(status) {
	if (status !== ultimoStatus) { registrar(status === 'offline' ? 'aviso' : 'info', `Sincronização: ${status}`); ultimoStatus = status }
	$('#status-nuvem').dataset.status = status
	$('#status-nuvem').title = TEXTO_STATUS[status] || 'Entrar na conta'
	$('#conta-status').textContent = TEXTO_STATUS[status]
}

function mostrarUsuario(novo) {
	const entrou = !usuario && novo
	if (!!usuario !== !!novo) registrar('info', novo ? 'Login feito' : 'Saiu da conta', novo?.email)
	usuario = novo
	$('#conta-carregando').hidden = true
	$('#conta-desconectado').hidden = !!usuario
	$('#conta-conectado').hidden = !usuario
	$('#conta-email').textContent = usuario?.email || ''
	if ($('#convite')) $('#convite').hidden = !!usuario
	if (entrou && !$('#menu').hidden) {
		fecharMenu()
		avisar(`Conectado como ${usuario.email}`)
	}
}

// Chegou a coleção da nuvem (de outro aparelho, ou a junção do primeiro login).
function receberColecao(cartas, semMaster = [], desejosNuvem = {}, escondidasNuvem = []) {
	escondidas = new Set(escondidasNuvem)
	gravar(CHAVE_ESCONDIDAS, JSON.stringify(escondidasNuvem))
	if (pesquisa.set && escondidas.has(pesquisa.set)) pesquisa.set = ''
	desejos = {}
	for (const [set, numeros] of Object.entries(desejosNuvem)) desejos[set] = new Set(numeros)
	salvarDesejos()
	const mudouMaster = semMaster.length !== semMasterSet.size || semMaster.some(id => !semMasterSet.has(id))
	if (mudouMaster) {
		semMasterSet = new Set(semMaster)
		gravar(CHAVE_SEM_MASTER, JSON.stringify(semMaster))
		const { setId } = rotaAtual()
		if (setId) desenharGradeSet(dados.sets.find(s => s.id === setId))
	}
	colecao = {}
	for (const [set, numeros] of Object.entries(cartas)) colecao[set] = new Set(numeros)
	salvarColecao()
	// Atualiza a tela sem perder a rolagem nem o que foi digitado na busca.
	for (const botao of document.querySelectorAll('.carta')) atualizarCarta(botao)
	if (!$('#zoom').hidden && cartaAberta) atualizarBotaoZoom()
	const { aba, setId, sub } = rotaAtual()
	if (!setId) { if (aba === 'colecoes') { if (!editandoColecoes) desenharColecoes(); else atualizarContagemDasSeries() } else if (aba === 'desejos') sub === 'comprar' ? desenharComprarNaLiga() : desenharDesejos(); else if (aba === 'pesquisa') desenharPesquisa() }
	atualizarProgressoNaTela()
}

async function carregarNuvem() {
	try {
		nuvem = await import('./nuvem.js')
	} catch (erro) {
		console.warn('Login indisponível:', erro)
		$('#conta-carregando').hidden = true
		$('#conta-indisponivel').hidden = false
		return
	}
	nuvem.iniciarNuvem({
		colecaoLocal: colecaoComoObjeto,
		semMasterSetLocal: () => [...semMasterSet],
		desejosLocal: desejosComoObjeto,
		escondidasLocal: () => [...escondidas],
		aoMudarUsuario: mostrarUsuario,
		aoReceberColecao: receberColecao,
		aoMudarStatus: mostrarStatus,
	})
	if (!usuario && $('#convite')) $('#convite').hidden = false
}

// Trava os botões enquanto espera a resposta do Firebase.
async function acaoDeConta(acao) {
	const botoes = document.querySelectorAll('#form-login button')
	$('#login-erro').textContent = ''
	botoes.forEach(b => { b.disabled = true })
	try {
		await acao()
	} catch (erro) {
		$('#login-erro').textContent = nuvem.mensagemDeErro(erro)
	} finally {
		botoes.forEach(b => { b.disabled = false })
	}
}

const emailDigitado = () => $('#login-email').value.trim()

$('#form-login').addEventListener('submit', evento => {
	evento.preventDefault()
	acaoDeConta(() => nuvem.entrar(emailDigitado(), $('#login-senha').value))
})

$('#botao-criar').addEventListener('click', () => {
	if (!$('#form-login').reportValidity()) return
	acaoDeConta(() => nuvem.criarConta(emailDigitado(), $('#login-senha').value))
})

$('#botao-esqueci').addEventListener('click', () => {
	if (!emailDigitado()) {
		$('#login-erro').textContent = 'Digite seu e-mail acima e toque de novo em "Esqueci minha senha".'
		return
	}
	acaoDeConta(async () => {
		await nuvem.recuperarSenha(emailDigitado())
		avisar('Enviamos um e-mail para você criar uma nova senha.')
	})
})

$('#botao-sair').addEventListener('click', async () => {
	await nuvem.sair()
	avisar('Você saiu da conta. A coleção continua salva neste aparelho.')
})

/* ---------- App Android: aviso de versão nova ---------- */
// O APK se identifica como "ColecaoTCG-Android/N". Se houver um APK mais novo
// em Releases no GitHub, mostra um aviso para baixar.
const LINK_APK = 'https://github.com/Ticos1/projeto-cartas/releases/latest/download/colecao-tcg.apk'
const CHAVE_VERSAO = 'colecao-tcg-apk-mais-novo'
const VALIDADE_CONSULTA = 15 * 60 * 1000   // consulta o GitHub no máximo a cada 15 minutos

const versaoInstaladaDoApk = () => Number(navigator.userAgent.match(/ColecaoTCG-Android\/(\d+)/)?.[1]) || 0

// Pergunta ao GitHub qual é o APK mais novo. Devolve o número (ex.: 3) ou 0 se não deu.
async function versaoMaisNovaDoApk(ignorarGuardado = false) {
	let info = null
	try { info = JSON.parse(ler(CHAVE_VERSAO) || 'null') } catch { /* sem cache */ }
	if (!ignorarGuardado && info && Date.now() - info.quando < VALIDADE_CONSULTA) return info.versao
	try {
		const resposta = await fetch('https://api.github.com/repos/Ticos1/projeto-cartas/releases/latest', { cache: 'no-store' })
		if (!resposta.ok) return 0
		const release = await resposta.json()
		const versao = Number(String(release.tag_name).split('.')[1]) || 0
		if (versao) gravar(CHAVE_VERSAO, JSON.stringify({ quando: Date.now(), versao }))
		return versao
	} catch {
		return 0
	}
}

async function verificarVersaoDoApp() {
	const instalada = versaoInstaladaDoApk()
	if (!instalada) return
	const maisNova = await versaoMaisNovaDoApk()
	if (maisNova > instalada) mostrarAvisoDeVersao(maisNova)
}

// Cada versão tem o arquivo com nome próprio (colecao-tcg-1.3.apk), para não esbarrar em
// um download antigo com o mesmo nome. Sem saber a versão, usa o link "sempre o mais novo".
const linkApk = versao => versao
	? `https://github.com/Ticos1/projeto-cartas/releases/download/v1.${versao}/colecao-tcg-1.${versao}.apk`
	: LINK_APK
function baixarApk(versao) { location.href = linkApk(versao) }

function mostrarAvisoDeVersao(versao) {
	if ($('#aviso-versao')) return
	const aviso = document.createElement('button')
	aviso.id = 'aviso-versao'
	aviso.className = 'convite novidade'
	aviso.innerHTML = `<span aria-hidden="true">📲</span><span id="aviso-versao-texto"><b>Nova versão do app (1.${versao}).</b> Toque para atualizar.</span>`
	aviso.addEventListener('click', () => atualizarApp(versao))
	document.body.insertBefore(aviso, tela)
}

/* Atualização feita pelo próprio app (peça nativa "Atualizador" do APK):
   baixa com o gerenciador de downloads do Android e abre o instalador.
   Em APKs antigos ou no navegador essa peça não existe e cai no link de download. */
const atualizadorNativo = () => window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins?.Atualizador || null : null
let atualizacao = null            // { versao, nome, fase: 'baixando' | 'baixado' } enquanto atualiza
let aguardandoPermissao = false   // o usuário foi à tela do Android permitir instalar apps
let ouvintesPostos = false

function mostrarEstadoApk(texto) {
	if ($('#apk-texto')) $('#apk-texto').textContent = texto
	if ($('#aviso-versao-texto')) $('#aviso-versao-texto').textContent = texto
}

async function prepararOuvintes(atualizador) {
	if (ouvintesPostos) return
	ouvintesPostos = true
	await atualizador.addListener('progresso', evento => {
		if (atualizacao?.fase === 'baixando') mostrarEstadoApk(`Baixando a atualização… ${evento.percentual}%`)
	})
	await atualizador.addListener('baixado', () => {
		if (!atualizacao) return
		atualizacao.fase = 'baixado'
		instalarBaixado()
	})
	await atualizador.addListener('erro', evento => {
		atualizacao = null
		mostrarEstadoApk(`${evento.mensagem || 'Não consegui baixar.'} Verifique a internet e toque para tentar de novo.`)
	})
}

async function atualizarApp(versao) {
	const atualizador = atualizadorNativo()
	if (!atualizador) { baixarApk(versao); return }
	if (atualizacao?.fase === 'baixando') return
	if (atualizacao?.fase === 'baixado') { instalarBaixado(); return }   // tocou de novo: reabre o instalador
	atualizacao = { versao, nome: `colecao-tcg-1.${versao}.apk`, fase: 'baixando' }
	mostrarEstadoApk('Baixando a atualização…')
	try {
		await prepararOuvintes(atualizador)
		await atualizador.baixar({ url: linkApk(versao), nome: atualizacao.nome })
	} catch {
		atualizacao = null
		mostrarEstadoApk('Não consegui começar o download. Toque para tentar de novo.')
	}
}

async function instalarBaixado() {
	const atualizador = atualizadorNativo()
	if (!atualizador || !atualizacao) return
	try {
		const { permitido } = await atualizador.podeInstalar()
		if (!permitido) {
			// O Android exige que o usuário permita, uma vez, que este app instale outros apps.
			aguardandoPermissao = true
			mostrarEstadoApk('Quase lá: ligue "Permitir desta fonte" para o Ticards e volte para este app.')
			await atualizador.pedirPermissao()
			return
		}
		mostrarEstadoApk('Abrindo o instalador… toque em "Instalar".')
		await atualizador.instalar({ nome: atualizacao.nome })
	} catch {
		mostrarEstadoApk('Não consegui abrir o instalador. Abra a notificação de download concluído.')
	}
}

// Voltou da tela de permissão do Android: continua a instalação.
document.addEventListener('visibilitychange', () => {
	if (document.visibilityState === 'visible' && aguardandoPermissao) {
		aguardandoPermissao = false
		instalarBaixado()
	}
})

// Seção "App Android" do menu: mostra a versão instalada e deixa procurar atualização.
function configurarSecaoApk() {
	const texto = $('#apk-texto'), botao = $('#apk-botao')
	if (!texto || !botao) return
	const instalada = versaoInstaladaDoApk()
	botao.hidden = false
	if (!instalada) {
		texto.textContent = 'Você está usando pelo navegador. Para ter o app instalado no Android, baixe o APK.'
		botao.textContent = 'Baixar app Android'
		botao.onclick = () => baixarApk()
		return
	}
	texto.textContent = `Versão instalada: 1.${instalada}`
	botao.textContent = 'Procurar atualização'
	botao.onclick = async () => {
		botao.disabled = true
		texto.textContent = 'Procurando…'
		const maisNova = await versaoMaisNovaDoApk(true)
		botao.disabled = false
		if (!maisNova) {
			texto.textContent = `Versão instalada: 1.${instalada}. Não consegui consultar agora; verifique a internet.`
		} else if (maisNova > instalada) {
			texto.textContent = `Versão instalada: 1.${instalada}. Nova versão disponível: 1.${maisNova}.`
			botao.textContent = atualizadorNativo() ? 'Atualizar agora' : `Baixar versão 1.${maisNova}`
			botao.onclick = () => atualizarApp(maisNova)
			mostrarAvisoDeVersao(maisNova)
		} else {
			texto.textContent = `Versão instalada: 1.${instalada}. Você já está na versão mais nova.`
		}
	}
}

/* ---------- Início ---------- */
async function iniciar() {
	const rotuloVersao = $('#versao-app')
	if (rotuloVersao) rotuloVersao.textContent = VERSAO_APP
	aplicarTema(ler(CHAVE_TEMA) || 'auto')
	carregarColecao()
	carregarDesejos()
	try {
		const resposta = await fetch('data/cartas.json')
		dados = await resposta.json()
	} catch (erro) {
		registrar('erro', 'Falha ao carregar a lista de cartas', textoDe(erro))
		window.__appPronto = true
		tela.innerHTML = '<p class="vazio">Não foi possível carregar a lista de cartas. Verifique a internet e tente de novo.</p>'
		return
	}
	registrar('info', `App iniciado (${VERSAO_APP})`)
	prepararHistorico()
	navegar()
	window.__appPronto = true
	carregarNuvem()
	verificarVersaoDoApp()

	if ('serviceWorker' in navigator) {
		// Quando sai uma versão nova, o service worker novo assume e recarrega a tela sozinho.
		// Ao voltar para o app (ou abrir), confere se há novidade.
		navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(registro => {
			registro.addEventListener('updatefound', () => registrar('info', 'Atualização do app encontrada'))
			registro.update().catch(() => {})
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible') { registro.update().catch(() => {}); verificarVersaoDoApp() }
			})
		}).catch(erro => registrar('aviso', 'Modo offline indisponível', textoDe(erro)))
	}
}

iniciar()
