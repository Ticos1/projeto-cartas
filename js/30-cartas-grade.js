'use strict'

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
			<span class="selo-qtd" aria-hidden="true"></span>
			<span class="selo-desejo" aria-hidden="true">★</span>
		</div>
		<span class="carta-legenda"><b>${escapar(carta.nome)}</b>${escapar(mostrarSet ? `${set.nome} · ${carta.n}` : numeroExibido(set, carta))}</span>`
	carregarImagem(botao.querySelector('img'), set.id, carta.n, 'low')
	mostrarQuantidadeNaCarta(botao)
	return botao
}

// Carta com 2 ou mais cópias ganha o selo "×N" no canto de baixo.
function mostrarQuantidadeNaCarta(botao) {
	const qtd = quantidadeDe(botao.dataset.set, botao.dataset.n)
	const selo = botao.querySelector('.selo-qtd')
	selo.textContent = qtd >= 2 ? `×${qtd}` : ''
	selo.classList.toggle('visivel', qtd >= 2)
}

function atualizarCarta(botao) {
	mostrarQuantidadeNaCarta(botao)
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
