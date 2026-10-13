'use strict'

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
			<p>A Liga não deixa outros apps mexerem no seu carrinho, então o Ticards prepara tudo e você só confirma lá: use a <b>Compra por Lista</b> (todas de uma vez) ou abra as cartas uma por uma.</p>
		</div>
		<div id="conteudo"></div>`
	desenharComprarNaLiga()
}

// "Compra por Lista" da Liga: cola-se uma lista de cartas e a Liga busca todas de uma vez,
// mostra as lojas e deixa colocar no carrinho. O app monta a lista no formato "1 Nome (número/total)".
const LIGA_COMPRA_POR_LISTA = `${LIGA}?view=cards/lista`
let listaComNumero = ler('colecao-tcg-lista-com-numero') !== '0'
function textoDaListaLiga(itens) {
	return itens.map(({ set, carta }) => {
		const numero = listaComNumero && /^\d+$/.test(carta.n) && set.oficiais ? ` (${numeroExibido(set, carta)})` : ''
		return `1 ${carta.nome}${numero}`
	}).join('\n')
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
		<section class="compra-lista">
			<h2>Mais rápido: Compra por Lista</h2>
			<p class="dica">A Liga tem a <b>Compra por Lista</b>: você cola todas as cartas de uma vez, ela mostra as lojas de cada uma e você coloca tudo no carrinho.</p>
			<ol>
				<li>Toque em <b>Copiar lista e abrir a Liga</b>.</li>
				<li>Na Liga, cole a lista no campo e busque.</li>
				<li>Filtre por qualidade <b>NM</b> e lojas do <b>seu estado</b>, e adicione ao carrinho.</li>
			</ol>
			<textarea class="busca lista-liga-texto" id="lista-liga-texto" readonly rows="${Math.min(itens.length, 6)}">${escapar(textoDaListaLiga(itens))}</textarea>
			<label class="opcao-lista"><input type="checkbox" id="lista-com-numero" ${listaComNumero ? 'checked' : ''}> Incluir o número da carta (ex.: 004/094)</label>
			<a class="botao comprar-liga" id="liga-lista" href="${LIGA_COMPRA_POR_LISTA}" target="_blank" rel="noopener noreferrer">${ICONE_CARRINHO}<span>Copiar lista e abrir a Liga</span></a>
		</section>
		<h2 class="titulo-secao">Ou abra carta por carta</h2>
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
				<span class="item-liga-botoes">
					<a class="botao secundario item-liga-abrir" href="${escapar(linkLiga(set, carta).url)}" target="_blank" rel="noopener noreferrer" data-chave="${escapar(chave)}">${aberta ? 'Liga ✓' : 'Liga'}</a>
					<a class="botao secundario item-liga-abrir" href="${escapar(linkMyp(carta))}" target="_blank" rel="noopener noreferrer">MYP</a>
				</span>
			</li>`
		}).join('')}</ul>
		${abertas ? '<button class="botao secundario" id="liga-recomecar">Recomeçar (desmarcar as abertas)</button>' : ''}`

	$('#liga-lista').addEventListener('click', () => {
		copiarTexto($('#lista-liga-texto').value).then(ok => avisar(ok ? 'Lista copiada! Cole na Compra por Lista da Liga.' : 'Não deu para copiar: segure no texto da lista e copie.'))
	})
	$('#lista-com-numero').addEventListener('change', evento => {
		listaComNumero = evento.target.checked
		gravar('colecao-tcg-lista-com-numero', listaComNumero ? '1' : '0')
		$('#lista-liga-texto').value = textoDaListaLiga(itens)
	})
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

	// Cartas que combinam, mas estão em coleções que o usuário escondeu: avisa e deixa mostrar de novo.
	const escondidasAchadas = new Map()
	if (escondidas.size && (texto || pesquisa.raridade || pesquisa.status !== 'todas')) {
		for (const set of dados.sets) {
			if (colecaoVisivel(set)) continue
			for (const carta of cartasDoSet(set)) {
				if (pesquisa.raridade && carta.raridade !== pesquisa.raridade) continue
				const marcada = tenho(set.id, carta.n)
				if (pesquisa.status === 'faltam' && marcada) continue
				if (pesquisa.status === 'tenho' && !marcada) continue
				if (combina(carta, texto)) escondidasAchadas.set(set.id, (escondidasAchadas.get(set.id) || 0) + 1)
			}
		}
	}
	const avisoEscondidas = escondidasAchadas.size ? `<div class="aviso-escondidas">
		<p>Também há cartas assim em coleções que você escondeu: <b>${[...escondidasAchadas.keys()].slice(0, 4).map(id => escapar(dados.sets.find(s => s.id === id).nome)).join(', ')}${escondidasAchadas.size > 4 ? ` e mais ${escondidasAchadas.size - 4}` : ''}</b>.</p>
		<button class="botao secundario" id="mostrar-escondidas">Mostrar ${escondidasAchadas.size > 1 ? 'essas coleções' : 'essa coleção'}</button>
	</div>` : ''
	const ligarAvisoEscondidas = () => $('#mostrar-escondidas')?.addEventListener('click', () => {
		definirEscondidas([...escondidasAchadas.keys()], false)
		atualizarSeletorSet()
		desenharPesquisa()
	})

	if (!itens.length) {
		conteudo.innerHTML = `<p class="vazio">Nenhuma carta encontrada.</p>${avisoEscondidas}`
		ligarAvisoEscondidas()
		return
	}
	conteudo.innerHTML = `<h2 class="titulo-secao">${itens.length} carta${itens.length > 1 ? 's' : ''} encontrada${itens.length > 1 ? 's' : ''}</h2>${avisoEscondidas}`
	ligarAvisoEscondidas()
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
