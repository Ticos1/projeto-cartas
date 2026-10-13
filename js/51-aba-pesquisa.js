'use strict'

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
