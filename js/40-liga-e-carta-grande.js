'use strict'

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

// MYP Cards: busca pelo nome da carta (o site usa números internos nas páginas das cartas,
// então não dá para abrir a carta exata; a busca mostra todas as versões com esse nome).
const linkMyp = carta => `https://mypcards.com/pokemon?ProdutoSearch%5Bquery%5D=${encodeURIComponent(carta.nome)}`

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
		$('#zoom-comprar-texto').textContent = 'Liga Pokémon'
		$('#zoom-myp').href = linkMyp(carta)
		$('#zoom-buscar').href = liga.busca
		$('#zoom-buscar').hidden = !liga.exato
	}
	if ($('#zoom-status')) $('#zoom-status').hidden = !marcada
	$('#zoom-marcar').textContent = marcada ? 'Desmarcar' : 'Marcar como "tenho"'
	$('#zoom-marcar').classList.toggle('secundario', marcada)
}

$('#zoom').addEventListener('pointerdown', () => { toqueComecouNoZoom = true })

// Os links da Liga também ignoram o "soltar" do dedo que segurou a carta.
for (const link of [$('#zoom-comprar'), $('#zoom-myp'), $('#zoom-buscar')].filter(Boolean)) {
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
