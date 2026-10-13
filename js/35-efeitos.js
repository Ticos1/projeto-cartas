'use strict'

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
