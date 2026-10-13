'use strict'

/* ---------- Aba: Decks ---------- */
const NOMES_TIPO = { P: 'Pokémon', T: 'Treinador', E: 'Energia' }
const tipoDoGrupo = t => t === 'EB' ? 'E' : t || 'P'
let mapaDeCartas = null
function cartaPorChave(chave) {
	if (!mapaDeCartas) {
		mapaDeCartas = new Map()
		for (const set of dados.sets) for (const carta of set.cartas) mapaDeCartas.set(`${set.id}|${carta.n}`, { set, carta })
	}
	return mapaDeCartas.get(chave)
}
const totalDoDeck = deck => Object.values(deck.cartas).reduce((soma, q) => soma + q, 0)
function itensDoDeck(deck) {
	return Object.entries(deck.cartas).map(([chave, qtd]) => ({ chave, qtd, ...cartaPorChave(chave) })).filter(i => i.carta)
}
// Regras básicas do Pokémon TCG: 60 cartas e no máximo 4 com o mesmo nome (energia básica não tem limite).
function avisosDoDeck(deck) {
	const avisos = []
	const total = totalDoDeck(deck)
	if (total < 60) avisos.push(`Faltam ${60 - total} carta${60 - total > 1 ? 's' : ''} para 60.`)
	if (total > 60) avisos.push(`O deck tem ${total - 60} carta${total - 60 > 1 ? 's' : ''} a mais (o máximo é 60).`)
	const porNome = {}
	for (const { carta, qtd } of itensDoDeck(deck)) if (carta.t !== 'EB') porNome[carta.nome] = (porNome[carta.nome] || 0) + qtd
	for (const [nome, qtd] of Object.entries(porNome)) if (qtd > 4) avisos.push(`${nome}: ${qtd} cópias (o máximo é 4 com o mesmo nome).`)
	if (total && !itensDoDeck(deck).some(i => i.carta.t === 'P')) avisos.push('O deck precisa de pelo menos um Pokémon.')
	return avisos
}
const novoIdDeDeck = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

function telaDecks() {
	definirTopo('Decks', '', false)
	tela.innerHTML = `
		<form class="novo-deck" id="novo-deck">
			<input class="busca" id="nome-deck" placeholder="Nome do novo deck" maxlength="60" autocomplete="off" required>
			<button class="botao" type="submit">Criar deck</button>
		</form>
		<div id="conteudo"></div>`
	$('#novo-deck').addEventListener('submit', evento => {
		evento.preventDefault()
		const nome = $('#nome-deck').value.trim()
		if (!nome) return
		const id = novoIdDeDeck()
		decks[id] = { nome, criado: Date.now(), cartas: {} }
		salvarDeck(id)
		registrar('info', `Deck criado: ${nome}`)
		location.hash = `#/deck/${id}`
	})
	desenharListaDecks()
}

function desenharListaDecks() {
	const conteudo = $('#conteudo')
	if (!conteudo || rotaAtual().deckId) return
	const lista = Object.entries(decks).sort((a, b) => b[1].criado - a[1].criado)
	$('#subtitulo').textContent = lista.length ? `${lista.length} deck${lista.length > 1 ? 's' : ''}` : ''
	if (!lista.length) {
		conteudo.innerHTML = `
			<div class="vazio dica-pesquisa">
				<div class="icone-grande" aria-hidden="true">🃏</div>
				<p><b>Nenhum deck ainda</b></p>
				<p>Dê um nome acima e toque em <b>Criar deck</b>. Depois é só buscar e adicionar as cartas.</p>
			</div>`
		return
	}
	conteudo.innerHTML = `<ul class="lista-sets">${lista.map(([id, deck]) => {
		const total = totalDoDeck(deck)
		const itens = itensDoDeck(deck)
		const tem = itens.filter(i => tenho(i.set.id, i.carta.n)).length
		const p = { tem, total: itens.length, pct: itens.length ? Math.floor(tem / itens.length * 100) : 0 }
		const ok = total === 60 && !avisosDoDeck(deck).length
		return `<li><a class="item-set" href="#/deck/${id}">
			<span class="logo-set icone-deck" aria-hidden="true">🃏</span>
			<span class="item-set-info">
				<b>${escapar(deck.nome)}</b>
				<small>${total}/60 cartas${ok ? ' · ✓ pronto' : ''} · você tem ${tem} de ${itens.length} diferentes</small>
				${barraHtml(p)}
			</span>
			<span class="pct${ok ? ' completa' : ''}">${total}</span>
		</a></li>`
	}).join('')}</ul>`
}

let buscaDeck = ''
function telaDeck(id) {
	const deck = decks[id]
	if (!deck) { location.hash = '#/decks'; return }
	buscaDeck = ''
	definirTopo(deck.nome, '', true)
	tela.innerHTML = `
		<section class="resumo" id="resumo-deck"></section>
		<div class="acoes-deck">
			<button class="botao secundario" id="deck-copiar">Copiar lista</button>
			<button class="botao secundario" id="deck-foto">Compartilhar foto</button>
			<button class="botao secundario" id="deck-desejos">Faltantes → desejos</button>
			<button class="botao secundario" id="deck-renomear">Renomear</button>
			<button class="botao secundario" id="deck-excluir">Excluir</button>
		</div>
		<h2 class="titulo-secao">Adicionar cartas</h2>
		<input class="busca" id="busca-deck" type="search" placeholder="Nome ou número da carta" autocomplete="off" enterkeyhint="search">
		<ul class="lista-deck" id="resultados-deck"></ul>
		<div id="conteudo"></div>`

	let espera = 0
	$('#busca-deck').addEventListener('input', () => {
		clearTimeout(espera)
		espera = setTimeout(() => { buscaDeck = $('#busca-deck').value; desenharResultadosDeck(id) }, 150)
	})
	$('#deck-copiar').addEventListener('click', async () => avisar(await copiarTexto(textoDoDeck(deck)) ? 'Lista do deck copiada.' : 'Não foi possível copiar.'))
	$('#deck-foto').addEventListener('click', async evento => {
		const botao = evento.currentTarget
		if (!totalDoDeck(deck)) { avisar('O deck está vazio.'); return }
		botao.disabled = true
		avisar('Gerando a foto do deck…')
		let resultado
		try { resultado = await compartilharFotoDoDeck(deck) } catch { resultado = 'erro' }
		botao.disabled = false
		if (resultado === 'compartilhado') avisar('Foto do deck compartilhada.')
		else if (resultado === 'baixado') avisar('Foto do deck baixada.')
		else if (resultado === 'erro') avisar('Não foi possível gerar a foto do deck.')
		registrar(resultado === 'erro' ? 'erro' : 'info', `Foto do deck "${deck.nome}": ${resultado}`)
	})
	$('#deck-desejos').addEventListener('click', () => {
		let n = 0
		for (const { set, carta } of itensDoDeck(deck)) {
			if (!tenho(set.id, carta.n) && !desejada(set.id, carta.n)) { alternarDesejo(set.id, carta.n); n++ }
		}
		avisar(n ? `${n} carta${n > 1 ? 's' : ''} adicionada${n > 1 ? 's' : ''} à lista de desejos ★` : 'Nada a adicionar: você já tem ou já deseja todas.')
	})
	$('#deck-renomear').addEventListener('click', () => {
		const nome = prompt('Novo nome do deck:', deck.nome)?.trim()
		if (!nome) return
		deck.nome = nome.slice(0, 60)
		salvarDeck(id)
		definirTopo(deck.nome, $('#subtitulo').textContent, true)
	})
	$('#deck-excluir').addEventListener('click', () => {
		if (!confirm(`Excluir o deck "${deck.nome}"? Isso não pode ser desfeito.`)) return
		delete decks[id]
		salvarDeck(id)
		registrar('info', `Deck excluído: ${deck.nome}`)
		history.back()
		setTimeout(() => { if (rotaAtual().deckId) location.hash = '#/decks' }, 400)
	})
	desenharDeck(id)
}

// Botões + e − das cartas do deck (um ouvinte só, para a tela inteira).
tela.addEventListener('click', evento => {
	const botao = evento.target.closest('button[data-qtd]')
	const { deckId } = rotaAtual()
	const deck = decks[deckId]
	if (!botao || !deck) return
	const chave = botao.dataset.chave
	const nova = Math.max(0, Math.min(60, (deck.cartas[chave] || 0) + Number(botao.dataset.qtd)))
	if (nova) deck.cartas[chave] = nova
	else delete deck.cartas[chave]
	salvarDeck(deckId)
	desenharDeck(deckId)
})

const controlesQtd = (chave, qtd) => `<span class="qtd">
	<button class="qtd-botao" data-chave="${escapar(chave)}" data-qtd="-1" aria-label="Tirar uma"${qtd ? '' : ' disabled'}>−</button>
	<b>${qtd}</b>
	<button class="qtd-botao" data-chave="${escapar(chave)}" data-qtd="1" aria-label="Pôr mais uma">+</button>
</span>`
const linhaDeCarta = (set, carta, chave, qtd) => `<li class="item-deck">
	<span class="item-liga-img" data-set="${escapar(set.id)}" data-n="${escapar(carta.n)}"><img alt="" loading="lazy"></span>
	<span class="item-liga-texto"><b>${escapar(carta.nome)}</b><small>${escapar([set.sigla || set.nome, numeroExibido(set, carta)].join(' · '))}</small>
		<small class="${tenho(set.id, carta.n) ? 'deck-tenho' : 'deck-falta'}">${tenho(set.id, carta.n) ? '✓ Você tem' : 'Você não tem'}</small></span>
	${controlesQtd(chave, qtd)}
</li>`
function carregarMiniaturas(elemento) {
	for (const caixa of elemento.querySelectorAll('.item-liga-img')) {
		const img = caixa.querySelector('img')
		if (!img.src) carregarImagem(img, caixa.dataset.set, caixa.dataset.n, 'low')
	}
}

function desenharResultadosDeck(id) {
	const deck = decks[id]
	const lista = $('#resultados-deck')
	if (!lista || !deck) return
	const texto = semAcento(buscaDeck.trim())
	if (!texto) { lista.innerHTML = ''; return }
	const LIMITE = 12
	const achadas = []
	for (const set of dados.sets) for (const carta of set.cartas) if (combina(carta, texto)) achadas.push({ set, carta })
	lista.innerHTML = achadas.length
		? achadas.slice(0, LIMITE).map(({ set, carta }) => { const chave = `${set.id}|${carta.n}`; return linhaDeCarta(set, carta, chave, deck.cartas[chave] || 0) }).join('') +
			(achadas.length > LIMITE ? `<li class="dica">Mostrando ${LIMITE} de ${achadas.length}. Digite mais (ex.: o número da carta) para achar mais rápido.</li>` : '')
		: '<li class="vazio">Nenhuma carta encontrada.</li>'
	carregarMiniaturas(lista)
}

function desenharDeck(id) {
	const deck = decks[id]
	if (!deck || !$('#resumo-deck')) return
	const total = totalDoDeck(deck)
	const itens = itensDoDeck(deck)
	const porTipo = { P: 0, T: 0, E: 0 }
	for (const { carta, qtd } of itens) porTipo[tipoDoGrupo(carta.t)] += qtd
	const avisos = avisosDoDeck(deck)
	$('#subtitulo').textContent = `${total}/60 cartas`
	$('#resumo-deck').innerHTML = `
		<div class="resumo-linha"><strong>${total}/60</strong><span>Pokémon ${porTipo.P} · Treinador ${porTipo.T} · Energia ${porTipo.E}</span></div>
		${barraHtml({ pct: Math.min(100, Math.round(total / 60 * 100)), tem: total, total: 60 })}
		${avisos.length ? `<ul class="avisos-deck">${avisos.map(a => `<li>${escapar(a)}</li>`).join('')}</ul>` : total === 60 ? '<p class="deck-ok">✓ Deck completo e dentro das regras básicas.</p>' : ''}`
	const conteudo = $('#conteudo')
	if (!itens.length) {
		conteudo.innerHTML = '<p class="vazio">O deck está vazio. Busque cartas acima e toque em <b>+</b> para adicionar.</p>'
	} else {
		conteudo.innerHTML = ['P', 'T', 'E'].map(tipo => {
			const doTipo = itens.filter(i => tipoDoGrupo(i.carta.t) === tipo).sort((a, b) => a.carta.nome.localeCompare(b.carta.nome))
			if (!doTipo.length) return ''
			return `<h2 class="titulo-secao">${NOMES_TIPO[tipo]} (${porTipo[tipo]})</h2>
				<ul class="lista-deck">${doTipo.map(({ set, carta, chave, qtd }) => linhaDeCarta(set, carta, chave, qtd)).join('')}</ul>`
		}).join('')
		carregarMiniaturas(conteudo)
	}
	desenharResultadosDeck(id)
}

// Lista no formato usado pelo Pokémon TCG Live: "4 Nome SIGLA número".
function textoDoDeck(deck) {
	const itens = itensDoDeck(deck)
	const partes = ['P', 'T', 'E'].map(tipo => {
		const doTipo = itens.filter(i => tipoDoGrupo(i.carta.t) === tipo)
		if (!doTipo.length) return ''
		const soma = doTipo.reduce((t, i) => t + i.qtd, 0)
		return `${NOMES_TIPO[tipo]}: ${soma}\n${doTipo.map(i => `${i.qtd} ${i.carta.nome} ${i.set.sigla || i.set.id} ${/^\d+$/.test(i.carta.n) ? parseInt(i.carta.n, 10) : i.carta.n}`).join('\n')}`
	}).filter(Boolean)
	return `${deck.nome}\n\n${partes.join('\n\n')}\n\nTotal de cartas: ${totalDoDeck(deck)}\n`
}

// Foto do deck: desenha as cartas (com a quantidade) num canvas e entrega como PNG.
function carregarImagemParaCanvas(setId, numero) {
	const fontes = fontesImagem(setId, `${numero}/low.webp`)
	return new Promise(resolve => {
		let i = 0
		const img = new Image()
		img.crossOrigin = 'anonymous'
		img.onload = () => resolve(img)
		img.onerror = () => { if (++i < fontes.length) img.src = fontes[i]; else resolve(null) }
		img.src = fontes[0]
	})
}

function retanguloArredondado(ctx, x, y, w, h, r) {
	ctx.beginPath()
	ctx.moveTo(x + r, y)
	ctx.arcTo(x + w, y, x + w, y + h, r)
	ctx.arcTo(x + w, y + h, x, y + h, r)
	ctx.arcTo(x, y + h, x, y, r)
	ctx.arcTo(x, y, x + w, y, r)
	ctx.closePath()
}

async function fotoDoDeck(deck) {
	const itens = itensDoDeck(deck).sort((a, b) =>
		['P', 'T', 'E'].indexOf(tipoDoGrupo(a.carta.t)) - ['P', 'T', 'E'].indexOf(tipoDoGrupo(b.carta.t)) || a.carta.nome.localeCompare(b.carta.nome))
	const imagens = await Promise.all(itens.map(i => carregarImagemParaCanvas(i.set.id, i.carta.n)))
	const COLUNAS = 6, LARGURA_CARTA = 200, ALTURA_CARTA = 280, ESPACO = 14, MARGEM = 30, TOPO = 110
	const largura = MARGEM * 2 + COLUNAS * LARGURA_CARTA + (COLUNAS - 1) * ESPACO
	const linhas = Math.max(1, Math.ceil(itens.length / COLUNAS))
	const altura = TOPO + linhas * (ALTURA_CARTA + ESPACO) + MARGEM
	const canvas = document.createElement('canvas')
	canvas.width = largura
	canvas.height = altura
	const ctx = canvas.getContext('2d')
	ctx.fillStyle = '#14161c'
	ctx.fillRect(0, 0, largura, altura)
	ctx.fillStyle = '#fff'
	ctx.textBaseline = 'alphabetic'
	ctx.font = 'bold 44px system-ui, sans-serif'
	ctx.fillText(deck.nome, MARGEM, 62, largura - MARGEM * 2 - 220)
	ctx.textAlign = 'right'
	ctx.fillStyle = '#e63946'
	ctx.font = 'bold 36px system-ui, sans-serif'
	ctx.fillText('Ticards', largura - MARGEM, 62)
	ctx.textAlign = 'left'
	const porTipo = { P: 0, T: 0, E: 0 }
	for (const { carta, qtd } of itens) porTipo[tipoDoGrupo(carta.t)] += qtd
	ctx.fillStyle = '#aab'
	ctx.font = '26px system-ui, sans-serif'
	ctx.fillText(`${totalDoDeck(deck)} cartas · Pokémon ${porTipo.P} · Treinador ${porTipo.T} · Energia ${porTipo.E}`, MARGEM, 96)
	itens.forEach((item, indice) => {
		const x = MARGEM + (indice % COLUNAS) * (LARGURA_CARTA + ESPACO)
		const y = TOPO + Math.floor(indice / COLUNAS) * (ALTURA_CARTA + ESPACO)
		ctx.save()
		retanguloArredondado(ctx, x, y, LARGURA_CARTA, ALTURA_CARTA, 10)
		ctx.clip()
		const img = imagens[indice]
		if (img) ctx.drawImage(img, x, y, LARGURA_CARTA, ALTURA_CARTA)
		else {
			ctx.fillStyle = '#2a2e38'
			ctx.fillRect(x, y, LARGURA_CARTA, ALTURA_CARTA)
			ctx.fillStyle = '#fff'
			ctx.font = '20px system-ui, sans-serif'
			ctx.textAlign = 'center'
			ctx.fillText(item.carta.nome, x + LARGURA_CARTA / 2, y + ALTURA_CARTA / 2, LARGURA_CARTA - 16)
			ctx.textAlign = 'left'
		}
		ctx.restore()
		// Selo com a quantidade no canto da carta.
		ctx.fillStyle = '#e63946'
		ctx.beginPath()
		ctx.arc(x + LARGURA_CARTA - 26, y + 26, 22, 0, Math.PI * 2)
		ctx.fill()
		ctx.strokeStyle = '#fff'
		ctx.lineWidth = 3
		ctx.stroke()
		ctx.fillStyle = '#fff'
		ctx.font = 'bold 26px system-ui, sans-serif'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'
		ctx.fillText(`${item.qtd}`, x + LARGURA_CARTA - 26, y + 27)
		ctx.textAlign = 'left'
		ctx.textBaseline = 'alphabetic'
	})
	// Se alguma imagem de outro endereço sujou o canvas, toBlob falha: tratamos como erro.
	return new Promise((resolve, reject) => {
		try { canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('sem imagem')), 'image/png') } catch (erro) { reject(erro) }
	})
}

async function compartilharFotoDoDeck(deck) {
	const nome = `${deck.nome.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'deck'}.png`
	const blob = await fotoDoDeck(deck)
	const nativo = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins
	if (nativo?.Filesystem && nativo?.Share) {
		try {
			const base64 = await new Promise((resolve, reject) => {
				const leitor = new FileReader()
				leitor.onload = () => resolve(String(leitor.result).split(',')[1])
				leitor.onerror = reject
				leitor.readAsDataURL(blob)
			})
			const { uri } = await nativo.Filesystem.writeFile({ path: nome, data: base64, directory: 'CACHE' })
			await nativo.Share.share({ title: deck.nome, files: [uri] })
			return 'compartilhado'
		} catch (erro) {
			return /cancel/i.test(erro?.message || '') ? 'cancelado' : 'erro'
		}
	}
	const arquivo = new File([blob], nome, { type: 'image/png' })
	if (navigator.canShare?.({ files: [arquivo] })) {
		try {
			await navigator.share({ files: [arquivo], title: deck.nome })
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
