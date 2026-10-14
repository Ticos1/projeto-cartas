'use strict'

/* ---------- Navegação (endereços com #) ---------- */
// Abas: #/como-usar (tutorial, abre por padrão ao entrar no app), #/pesquisa, #/colecoes, #/desejos e #/configuracoes. Um set (#/set/ID) fica dentro de Coleções.
// #/receber não é uma aba: é onde o app abre quando algo é compartilhado com ele (veja receberCompartilhado).
function rotaAtual() {
	const partes = location.hash.replace(/^#\/?/, '').split('/')
	if (partes[0] === 'set') return { aba: 'colecoes', setId: decodeURIComponent(partes[1] || '') }
	if (partes[0] === 'colecoes') return { aba: 'colecoes' }
	if (partes[0] === 'desejos') return { aba: 'desejos', sub: partes[1] === 'comprar' ? 'comprar' : '' }
	if (partes[0] === 'decks') return { aba: 'decks' }
	if (partes[0] === 'trocas') return { aba: 'trocas' }
	if (partes[0] === 'escanear') return { aba: 'escanear' }
	if (partes[0] === 'deck') return { aba: 'decks', deckId: decodeURIComponent(partes[1] || '') }
	if (partes[0] === 'configuracoes') return { aba: 'configuracoes', sub: partes[1] === 'logs' ? 'logs' : 'temas' }
	if (partes[0] === 'pesquisa') return { aba: 'pesquisa' }
	if (partes[0] === 'receber') return { aba: 'receber' }
	return { aba: 'ajuda' }
}

function navegar() {
	$('#zoom').hidden = true
	aberturaDoZoom++
	pararEfeitos()
	entradasDeSobreposicao = 0
	focoAntesDasSobreposicoes = []
	// Toda tela que o app abre fica marcada como "do app" no histórico.
	if (!history.state?.app) history.replaceState({ app: true }, '')
	$('#gaveta').hidden = true
	$('#escolha').hidden = true
	const { setId, aba, sub } = rotaAtual()
	if (aba === 'receber') { receberCompartilhado(); return }
	if (setId) telaSet(setId)
	else if (aba === 'colecoes') telaColecoes()
	else if (aba === 'ajuda') telaComoUsar()
	else if (aba === 'decks') rotaAtual().deckId ? telaDeck(rotaAtual().deckId) : telaDecks()
	else if (aba === 'trocas') telaTrocas()
	else if (aba === 'escanear') telaEscanear()
	else if (aba === 'desejos') sub === 'comprar' ? telaComprarNaLiga() : telaDesejos()
	else if (aba === 'configuracoes') telaConfiguracoes(sub)
	else telaPesquisa()
	marcarAbaNaGaveta(aba)
	window.scrollTo(0, 0)
	mostrarDicaSegurar()
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
	focoAntesDasSobreposicoes.push(document.activeElement)
	history.pushState({ app: true, sobreposicao: true }, '')
	entradasDeSobreposicao++
}

/* ---------- Teclado e leitor de tela nas sobreposições ---------- */
// Ao abrir, o foco vai para dentro da sobreposição; ao fechar, volta para onde estava
// (a carta, o botão do filtro…). Esc fecha, e o Tab não sai dela enquanto está aberta.
let focoAntesDasSobreposicoes = []

function focar(elemento) {
	elemento?.focus({ preventScroll: true })
}

function devolverFoco() {
	const anterior = focoAntesDasSobreposicoes.pop()
	if (anterior && anterior !== document.body && document.body.contains(anterior)) focar(anterior)
}

const sobreposicaoAberta = () => ['#dialogo', '#zoom', '#menu', '#gaveta', '#escolha'].map(seletor => $(seletor)).find(el => !el.hidden)

function focaveis(caixa) {
	return [...caixa.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
		.filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
}

function fecharSobreposicao(aberta) {
	if (aberta.id === 'zoom') fecharZoom(true, true)
	else if (aberta.id === 'menu') fecharMenu()
	else if (aberta.id === 'gaveta') fecharGaveta()
	else if (aberta.id === 'escolha') fecharEscolha()
}

document.addEventListener('keydown', evento => {
	const aberta = sobreposicaoAberta()
	if (!aberta || evento.defaultPrevented) return
	if (evento.key === 'Escape') { evento.preventDefault(); fecharSobreposicao(aberta); return }
	if (evento.key !== 'Tab') return
	const lista = focaveis(aberta)
	if (!lista.length) return
	const primeiro = lista[0]
	const ultimo = lista[lista.length - 1]
	if (!aberta.contains(document.activeElement)) { evento.preventDefault(); focar(evento.shiftKey ? ultimo : primeiro) }
	else if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); focar(ultimo) }
	else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); focar(primeiro) }
})

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
	if (!$('#dialogo').hidden) cancelarDialogo(true)
	else if (!$('#zoom').hidden) fecharZoom(true, true, true)
	else if (!$('#menu').hidden) fecharMenu(true)
	else if (!$('#gaveta').hidden) fecharGaveta(true)
	else if (!$('#escolha').hidden) fecharEscolha(true)
})

function prepararHistorico() {
	if (history.state?.sobreposicao) history.replaceState({ app: true }, '')
	if (history.state?.app) return   // recarregou dentro do app: o histórico já é nosso
	const { setId, aba, sub } = rotaAtual()
	const abaixo = setId ? '#/colecoes' : aba === 'desejos' && sub === 'comprar' ? '#/desejos' : rotaAtual().deckId ? '#/decks' : null
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
		else if (rotaAtual().deckId) location.hash = '#/decks'
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
	focar($('.gaveta-item[aria-current="page"]') || $('.gaveta-item'))
	if (semAnimacao()) return
	$('.gaveta').animate([{ transform: 'translateX(-100%)' }, { transform: 'none' }], { duration: 220, easing: 'ease-out' })
	$('#gaveta').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 })
}

function fecharGaveta(veioDoHistorico = false) {
	if ($('#gaveta').hidden) return
	$('#gaveta').hidden = true
	if (!veioDoHistorico) liberarSobreposicao()
	devolverFoco()
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
