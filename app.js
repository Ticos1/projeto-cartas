'use strict'

/* =========================================================
   Minha Coleção TCG
   - data/cartas.json: lista de sets e cartas (gerada por scripts/gerar_dados.mjs)
   - localStorage: quais cartas eu tenho
   ========================================================= */

const CHAVE_COLECAO = 'colecao-tcg'
const CHAVE_TEMA = 'colecao-tcg-tema'
const CHAVE_SEM_MASTER = 'colecao-tcg-sem-master-set'
const IMAGENS = 'https://assets.tcgdex.net'
const VERSAO_APP = 'v21'   // mantenha igual à VERSAO do sw.js

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
function fontesImagem(setId, arquivo) {
	return [
		`img/${setId}/${arquivo}`,
		`${IMAGENS}/pt/${dados.serie}/${setId}/${arquivo}`,
		`${IMAGENS}/en/${dados.serie}/${setId}/${arquivo}`,
	]
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
	return set.oficiais && /^\d+$/.test(carta.n) ? `${carta.n}/${String(set.oficiais).padStart(3, '0')}` : carta.n
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
	document.title = `${titulo} · Minha Coleção TCG`
}

/* ---------- Cartas na grade ---------- */
const ICONE_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'

function criarCarta(set, carta, mostrarSet) {
	const botao = document.createElement('button')
	botao.className = 'carta' + (tenho(set.id, carta.n) ? ' tenho' : '')
	botao.dataset.set = set.id
	botao.dataset.n = carta.n
	botao.setAttribute('aria-pressed', tenho(set.id, carta.n))
	botao.innerHTML = `
		<div class="carta-img">
			<span class="sem-imagem">${escapar(carta.nome)}</span>
			<img alt="${escapar(carta.nome)}" loading="lazy" decoding="async">
			<span class="selo">${ICONE_CHECK}</span>
		</div>
		<span class="carta-legenda"><b>${escapar(carta.nome)}</b>${escapar(mostrarSet ? `${set.nome} · ${carta.n}` : numeroExibido(set, carta))}</span>`
	carregarImagem(botao.querySelector('img'), set.id, carta.n, 'low')
	return botao
}

function atualizarCarta(botao) {
	const marcada = tenho(botao.dataset.set, botao.dataset.n)
	botao.classList.toggle('tenho', marcada)
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

	$('#zoom-nome').textContent = carta.nome
	$('#zoom-info').textContent = [set.nome, numeroExibido(set, carta), carta.raridade].filter(Boolean).join(' · ')
	atualizarBotaoZoom()
	$('#zoom').hidden = false
	registrarSobreposicao()

	pararEfeitos()
	if (semAnimacao()) { iniciarEfeitos(carta.raridade, true); return }
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
			if (idAbertura === aberturaDoZoom && !$('#zoom').hidden) iniciarEfeitos(carta.raridade)
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
	return { url: `${LIGA}?view=cards/card&card=${codificarLiga(`${carta.nome}(${carta.n}/${total})`)}`, busca, exato: true }
}

function atualizarBotaoZoom() {
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
function telaColecoes() {
	definirTopo('Coleções', 'Série Megaevolução', false)

	tela.innerHTML = `
		${htmlConvite()}
		<section class="resumo" id="resumo"></section>
		<div id="conteudo"></div>`

	atualizarResumo()
	ligarConvite()
	desenharColecoes()
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
	for (const set of dados.sets) {
		const p = progresso(set)
		tem += p.tem
		total += p.total
	}
	const geral = { tem, total, pct: Math.floor((tem / total) * 100) }
	$('#resumo').innerHTML = `
		<div class="resumo-linha"><strong>${geral.pct}%</strong><span>${tem} de ${total} cartas</span></div>
		${barraHtml(geral)}`
}

function desenharColecoes() {
	const conteudo = $('#conteudo')
	conteudo.innerHTML = `<ul class="lista-sets">${dados.sets.map(set => {
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
	}).join('')}</ul>`

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
	'Mega Rara Hiper', 'Rara Mega Ataque', 'Rara Pikachu', 'Rara Futurista', 'Rara RGB', 'Promo']
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
	const opcao = (valor, texto, atual) => `<option value="${escapar(valor)}"${valor === atual ? ' selected' : ''}>${escapar(texto)}</option>`

	tela.innerHTML = `
		${htmlConvite()}
		<input class="busca" id="busca" type="search" placeholder="Nome ou número da carta" value="${escapar(pesquisa.texto)}" autocomplete="off" enterkeyhint="search">
		<div class="filtros">
			<select id="filtro-set" aria-label="Filtrar por set">
				${opcao('', 'Todos os sets', pesquisa.set)}${dados.sets.map(s => opcao(s.id, s.nome, pesquisa.set)).join('')}
			</select>
			<select id="filtro-raridade" aria-label="Filtrar por raridade">
				${opcao('', 'Todas as raridades', pesquisa.raridade)}${raridadesDasCartas().map(r => opcao(r, r, pesquisa.raridade)).join('')}
			</select>
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
	$('#filtro-set').addEventListener('change', evento => { pesquisa.set = evento.target.value; pesquisa.limite = PASSO_PESQUISA; desenharPesquisa() })
	$('#filtro-raridade').addEventListener('change', evento => { pesquisa.raridade = evento.target.value; pesquisa.limite = PASSO_PESQUISA; desenharPesquisa() })
	$('#filtro-status').addEventListener('click', evento => {
		const botao = evento.target.closest('button')
		if (!botao) return
		pesquisa.status = botao.dataset.status
		pesquisa.limite = PASSO_PESQUISA
		desenharPesquisa()
	})
	desenharPesquisa()
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
	for (const set of dados.sets) {
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
// Abas: #/pesquisa (a primeira, abre por padrão) e #/colecoes. Um set (#/set/ID) fica dentro de Coleções.
function rotaAtual() {
	const partes = location.hash.replace(/^#\/?/, '').split('/')
	if (partes[0] === 'set') return { aba: 'colecoes', setId: decodeURIComponent(partes[1] || '') }
	if (partes[0] === 'colecoes') return { aba: 'colecoes' }
	return { aba: 'pesquisa' }
}

function navegar() {
	$('#zoom').hidden = true
	aberturaDoZoom++
	pararEfeitos()
	entradasDeSobreposicao = 0
	// Toda tela que o app abre fica marcada como "do app" no histórico.
	if (!history.state?.app) history.replaceState({ app: true }, '')
	$('#gaveta').hidden = true
	const { setId, aba } = rotaAtual()
	if (setId) telaSet(setId)
	else if (aba === 'colecoes') telaColecoes()
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
})

function prepararHistorico() {
	if (history.state?.sobreposicao) history.replaceState({ app: true }, '')
	if (history.state?.app) return   // recarregou dentro do app: o histórico já é nosso
	const { setId } = rotaAtual()
	if (setId) {
		const destino = location.hash
		history.replaceState({ app: true }, '', '#/colecoes')
		history.pushState({ app: true }, '', destino)
	} else {
		history.replaceState({ app: true }, '')
	}
}

$('#voltar').addEventListener('click', () => {
	const antes = location.hash
	history.back()
	// Se não havia para onde voltar, vai para a lista de coleções direto.
	setTimeout(() => { if (location.hash === antes && rotaAtual().setId) location.hash = '#/colecoes' }, 400)
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

$('#abrir-gaveta').addEventListener('click', abrirGaveta)
$('#gaveta').addEventListener('click', evento => {
	if (evento.target.id === 'gaveta') fecharGaveta()
})
for (const item of document.querySelectorAll('.gaveta-item')) {
	item.addEventListener('click', evento => {
		evento.preventDefault()
		const destino = item.getAttribute('href')
		if (item.dataset.aba === rotaAtual().aba) { fecharGaveta(); return }
		// A entrada de histórico da gaveta vira a da nova aba: o voltar não passa pela gaveta.
		$('#gaveta').hidden = true
		if (entradasDeSobreposicao > 0) {
			entradasDeSobreposicao--
			history.replaceState({ app: true }, '', destino)
			navegar()
		} else {
			location.hash = destino
		}
	})
}

/* ---------- Menu: backup e tema ---------- */
function abrirMenu() {
	if (!$('#menu').hidden) return
	marcarTemaNoMenu()
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
$('#menu').addEventListener('click', evento => {
	if (evento.target.id === 'menu') fecharMenu()
})

$('#exportar').addEventListener('click', async () => {
	const cartas = colecaoComoObjeto()
	const quantidade = Object.values(cartas).reduce((soma, lista) => soma + lista.length, 0)
	const backup = { app: 'minha-colecao-tcg', versao: 1, exportadoEm: new Date().toISOString(), cartas }
	const nome = `colecao-tcg-${new Date().toISOString().slice(0, 10)}.json`
	const texto = JSON.stringify(backup, null, 1)

	// Dentro do app Android: salva o arquivo e abre o menu de compartilhar do Android.
	const nativo = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins
	if (nativo?.Filesystem && nativo?.Share) {
		try {
			const { uri } = await nativo.Filesystem.writeFile({ path: nome, data: texto, directory: 'CACHE', encoding: 'utf8' })
			await nativo.Share.share({ title: 'Backup da coleção', files: [uri] })
			avisar(`Backup com ${quantidade} cartas exportado.`)
		} catch (erro) {
			if (!/cancel/i.test(erro?.message || '')) avisar('Não foi possível exportar o backup.')
		}
		return
	}

	const arquivo = new File([texto], nome, { type: 'application/json' })

	// No celular, abre o menu de compartilhar (salvar no Drive, mandar no WhatsApp...).
	if (navigator.canShare?.({ files: [arquivo] })) {
		try {
			await navigator.share({ files: [arquivo], title: 'Backup da coleção' })
			avisar(`Backup com ${quantidade} cartas exportado.`)
			return
		} catch (erro) {
			if (erro.name === 'AbortError') return
		}
	}
	const link = document.createElement('a')
	link.href = URL.createObjectURL(arquivo)
	link.download = nome
	link.click()
	setTimeout(() => URL.revokeObjectURL(link.href), 1000)
	avisar(`Backup com ${quantidade} cartas baixado.`)
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
		nuvem?.substituirNaNuvem(colecaoComoObjeto())
		fecharMenu()
		navegar()
		avisar(`Backup importado: ${quantidade} cartas.`)
	} catch {
		avisar('Esse arquivo não parece ser um backup válido.')
	}
})

function aplicarTema(tema) {
	if (tema === 'claro' || tema === 'escuro') document.documentElement.dataset.tema = tema
	else delete document.documentElement.dataset.tema
	// Cor da barra do sistema no celular
	const escuro = tema === 'escuro' || (tema !== 'claro' && matchMedia('(prefers-color-scheme: dark)').matches)
	for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
		meta.content = escuro ? '#14161c' : '#f4f5f8'
	}
}

function marcarTemaNoMenu() {
	const atual = ler(CHAVE_TEMA) || 'auto'
	for (const botao of document.querySelectorAll('#tema button')) {
		botao.classList.toggle('ativo', botao.dataset.tema === atual)
	}
}

$('#tema').addEventListener('click', evento => {
	const botao = evento.target.closest('button')
	if (!botao) return
	gravar(CHAVE_TEMA, botao.dataset.tema)
	aplicarTema(botao.dataset.tema)
	marcarTemaNoMenu()
})

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => aplicarTema(ler(CHAVE_TEMA) || 'auto'))

/* ---------- Conta e sincronização ---------- */
const TEXTO_STATUS = {
	sincronizado: '✅ Tudo sincronizado.',
	sincronizando: '🔄 Sincronizando…',
	offline: '📴 Sem internet. As mudanças serão enviadas quando a conexão voltar.',
	desconectado: '',
}

function mostrarStatus(status) {
	$('#status-nuvem').dataset.status = status
	$('#status-nuvem').title = TEXTO_STATUS[status] || 'Entrar na conta'
	$('#conta-status').textContent = TEXTO_STATUS[status]
}

function mostrarUsuario(novo) {
	const entrou = !usuario && novo
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
function receberColecao(cartas, semMaster = []) {
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
	const { aba, setId } = rotaAtual()
	if (!setId) { if (aba === 'colecoes') desenharColecoes(); else desenharPesquisa() }
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
			mostrarEstadoApk('Quase lá: ligue "Permitir desta fonte" para a Coleção TCG e volte para este app.')
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
	try {
		const resposta = await fetch('data/cartas.json')
		dados = await resposta.json()
	} catch {
		window.__appPronto = true
		tela.innerHTML = '<p class="vazio">Não foi possível carregar a lista de cartas. Verifique a internet e tente de novo.</p>'
		return
	}
	prepararHistorico()
	navegar()
	window.__appPronto = true
	carregarNuvem()
	verificarVersaoDoApp()

	if ('serviceWorker' in navigator) {
		// Quando sai uma versão nova, o service worker novo assume e recarrega a tela sozinho.
		// Ao voltar para o app (ou abrir), confere se há novidade.
		navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(registro => {
			registro.update().catch(() => {})
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible') { registro.update().catch(() => {}); verificarVersaoDoApp() }
			})
		}).catch(() => { /* app funciona sem modo offline */ })
	}
}

iniciar()
