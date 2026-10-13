'use strict'

/* ---------- Aba: Trocas ---------- */
// "Tenho para trocar" vem das cópias que passam de 1 (ver cartasRepetidas); "Procuro" vem da Lista de Desejos.
// O botão de compartilhar monta um texto pronto para grupos de troca (WhatsApp etc.).
const filtroTrocas = { set: '', raridade: '', limite: PASSO_PESQUISA }

function telaTrocas() {
	definirTopo('Trocas', '', false)
	tela.innerHTML = `
		<div class="filtros">
			<button class="seletor" id="filtro-set" aria-haspopup="dialog" aria-label="Filtrar por coleção"></button>
			<button class="seletor" id="filtro-raridade" aria-haspopup="dialog" aria-label="Filtrar por raridade"></button>
		</div>
		<div id="conteudo"></div>`
	atualizarSeletorSet(filtroTrocas)
	atualizarSeletorRaridade(filtroTrocas)
	$('#filtro-set').addEventListener('click', () => abrirEscolhaSet(filtroTrocas, desenharTrocas, false))
	$('#filtro-raridade').addEventListener('click', () => abrirEscolhaRaridade(filtroTrocas, desenharTrocas, false))
	desenharTrocas()
}

const passaNoFiltroDeTroca = ({ set, carta }) =>
	(!filtroTrocas.set || set.id === filtroTrocas.set) && (!filtroTrocas.raridade || carta.raridade === filtroTrocas.raridade)

function linhaDeTroca({ set, carta, extras }) {
	const dados_ = `data-set="${escapar(set.id)}" data-n="${escapar(carta.n)}"`
	const acao = extras
		? `<span class="qtd">
			<button class="qtd-botao" data-troca="menos" ${dados_} aria-label="Troquei uma cópia">−</button>
			<b>${extras}</b>
			<button class="qtd-botao" data-troca="mais" ${dados_} aria-label="Ganhei mais uma cópia">+</button>
		</span>`
		: `<button class="botao secundario item-liga-abrir" data-troca="recebi" ${dados_}>Recebi</button>`
	return `<li class="item-deck">
		<span class="item-liga-img" data-set="${escapar(set.id)}" data-n="${escapar(carta.n)}"><img alt="" loading="lazy"></span>
		<span class="item-liga-texto"><b>${escapar(carta.nome)}</b><small>${escapar([set.sigla || set.nome, numeroExibido(set, carta), carta.raridade].filter(Boolean).join(' · '))}</small></span>
		${acao}
	</li>`
}

function desenharTrocas() {
	const conteudo = $('#conteudo')
	if (!conteudo || rotaAtual().aba !== 'trocas') return
	const todasSobrando = cartasRepetidas()
	const todasProcuro = cartasProcuradas()
	const sobrando = todasSobrando.filter(passaNoFiltroDeTroca)
	const procuro = todasProcuro.filter(passaNoFiltroDeTroca)
	const nSobrando = sobrando.reduce((soma, i) => soma + i.extras, 0)
	$('#subtitulo').textContent = nSobrando || procuro.length ? `${nSobrando} para trocar · ${procuro.length} procurando` : ''
	if (!todasSobrando.length && !todasProcuro.length) {
		conteudo.innerHTML = `
			<div class="vazio dica-pesquisa">
				<div class="icone-grande" aria-hidden="true">🔁</div>
				<p><b>Nada para trocar ainda</b></p>
				<p>Quando você tiver <b>2 ou mais cópias</b> de uma carta (segure a carta e use + e −), as cópias que sobram aparecem aqui. As cartas da sua <b>Lista de Desejos</b> que você ainda não tem aparecem em "Procuro".</p>
			</div>`
		return
	}
	const limite = filtroTrocas.limite
	const secao = (titulo, itens, vazio) => `<h2 class="titulo-secao">${titulo}</h2>` + (itens.length
		? `<ul class="lista-deck">${itens.slice(0, limite).map(linhaDeTroca).join('')}</ul>${itens.length > limite ? `<p class="dica">Mostrando ${limite} de ${itens.length} (o texto compartilhado leva todas).</p>` : ''}`
		: `<p class="dica">${vazio}</p>`)
	conteudo.innerHTML = `
		<div class="acoes-deck">
			<button class="botao secundario" id="troca-copiar">Copiar lista</button>
			<button class="botao" id="troca-compartilhar">Compartilhar</button>
		</div>
		${secao(`Tenho para trocar (${nSobrando})`, sobrando, 'Nenhuma cópia sobrando com esses filtros.')}
		${secao(`Procuro (${procuro.length})`, procuro, 'Nenhuma carta desejada com esses filtros.')}
		${sobrando.length > limite || procuro.length > limite ? '<button class="botao secundario" id="troca-mais">Mostrar mais</button>' : ''}`
	carregarMiniaturas(conteudo)

	const texto = () => textoDeTroca(sobrando, procuro)
	$('#troca-copiar').addEventListener('click', async () => avisar(await copiarTexto(texto()) ? 'Lista de trocas copiada.' : 'Não foi possível copiar.'))
	$('#troca-compartilhar').addEventListener('click', async () => {
		const resultado = await compartilharTexto(texto(), 'Minhas trocas')
		if (resultado === 'copiado') avisar('Lista de trocas copiada. Cole no grupo!')
		else if (resultado === 'erro') avisar('Não foi possível compartilhar.')
		registrar(resultado === 'erro' ? 'erro' : 'info', `Lista de trocas: ${resultado}`)
	})
	$('#troca-mais')?.addEventListener('click', () => {
		const y = window.scrollY
		filtroTrocas.limite += PASSO_PESQUISA
		desenharTrocas()
		window.scrollTo(0, y)
	})
}

// −, + e "Recebi" nas linhas da aba (um ouvinte só, para a tela inteira).
tela.addEventListener('click', evento => {
	const botao = evento.target.closest('button[data-troca]')
	if (!botao || rotaAtual().aba !== 'trocas') return
	const { set, n } = botao.dataset
	const acao = botao.dataset.troca
	if (acao === 'menos') definirQuantidade(set, n, quantidadeDe(set, n) - 1)
	else if (acao === 'mais') definirQuantidade(set, n, quantidadeDe(set, n) + 1)
	else if (acao === 'recebi') { definirQuantidade(set, n, Math.max(1, quantidadeDe(set, n))); avisar('Carta marcada como sua ✓') }
	const y = window.scrollY
	desenharTrocas()
	window.scrollTo(0, y)
})

// Compartilha um texto: menu de compartilhar do Android/celular, ou copia se não houver.
// Devolve 'compartilhado', 'copiado', 'cancelado' ou 'erro'.
async function compartilharTexto(texto, titulo) {
	const nativo = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins
	try {
		if (nativo?.Share) { await nativo.Share.share({ title: titulo, text: texto }); return 'compartilhado' }
		if (navigator.share) { await navigator.share({ title: titulo, text: texto }); return 'compartilhado' }
	} catch (erro) {
		if (erro?.name === 'AbortError' || /cancel/i.test(erro?.message || '')) return 'cancelado'
	}
	return (await copiarTexto(texto)) ? 'copiado' : 'erro'
}
