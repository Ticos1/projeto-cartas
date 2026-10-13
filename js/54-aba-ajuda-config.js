'use strict'

/* ---------- Aba: Como usar o app (tutorial) ---------- */
const PASSOS_TUTORIAL = [
	{ icone: '☰', titulo: 'Navegue pelas abas', texto: [
		'Toque nos <b>três riscos</b> no canto de cima para trocar de aba: Como usar, Pesquisa, Coleções, Lista de Desejos, Decks, Trocas, Escanear cartas e Configurações.',
		'O botão <b>voltar</b> do celular volta para a tela anterior (e fecha a carta ampliada ou os menus).'] },
	{ icone: '✓', titulo: 'Marque as cartas que você tem', texto: [
		'<b>Toque</b> numa carta para marcar que você tem (ela fica colorida, com um ✓ verde). Toque de novo para desmarcar.',
		'As cartas que faltam ficam apagadas, em preto e branco.'] },
	{ icone: '×2', titulo: 'Cópias repetidas', texto: [
		'Tem mais de uma cópia? Segure a carta e use <b>+</b> e <b>−</b> em "Quantas cópias você tem". Na grade, a carta mostra <b>×2</b>, <b>×3</b>…',
		'Tocar na carta para desmarcar tira <b>todas</b> as cópias. Os decks usam esse número para dizer quantas cópias ainda faltam.'] },
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
	{ icone: '🃏', titulo: 'Decks', texto: [
		'Na aba <b>Decks</b>, crie um deck com um nome, busque as cartas e use <b>+</b> e <b>−</b> para escolher quantas cópias.',
		'O app conta as 60 cartas, separa Pokémon, Treinador e Energia e avisa se passar de 4 cópias com o mesmo nome.',
		'Mostra quais cartas você já tem, manda as que faltam para a <b>Lista de Desejos</b> e copia a lista do deck ou compartilha uma <b>foto</b> dele.',
		'Em <b>Importar uma lista de deck</b> você cola a lista do Pokémon TCG Live e o app monta o deck pela sigla e pelo número de cada carta.'] },
	{ icone: '🔁', titulo: 'Trocas', texto: [
		'A aba <b>Trocas</b> junta as <b>cópias que sobram</b> (tudo que passa de 1 de cada carta) e as cartas da sua <b>Lista de Desejos</b> que você ainda não tem.',
		'Toque em <b>Compartilhar</b> para mandar o texto pronto no WhatsApp ou em um grupo de trocas. Quando trocar, use <b>−</b> (cópia que saiu) ou <b>Recebi</b>.'] },
	{ icone: '📷', titulo: 'Escanear cartas', texto: [
		'Na aba <b>Escanear cartas</b> a câmera já abre sozinha: coloque <b>uma carta por vez</b> na moldura. O app lê o número (ex.: 057/198) e o nome e mostra a carta logo abaixo.',
		'Ali você marca como <b>tenho</b>, ajusta as cópias, põe na <b>Lista de Desejos</b> ou compra na Liga / MYP. Se não reconhecer, use <b>Tirar foto</b> ou procure à mão. As imagens ficam só no seu aparelho.'] },
	{ icone: '☁', titulo: 'Conta e sincronização', texto: [
		'Toque na <b>nuvem</b> no topo para entrar ou criar sua conta (e-mail e senha).',
		'Com a conta, a coleção (com as quantidades), a lista de desejos, os decks e as coleções escolhidas ficam iguais no celular e no PC (site: ticos1.github.io/projeto-cartas).',
		'Sem internet o app continua funcionando; as mudanças são enviadas quando a conexão voltar.'] },
	{ icone: '🎨', titulo: 'Temas e logs', texto: [
		'Em <b>Configurações → Temas</b>: modo claro, escuro ou automático e um tema com as cores de cada coleção (ou a sua cor).',
		'Em <b>Configurações → Logs</b> ficam os erros do app; se algo der errado, use <b>Compartilhar</b> e mande para quem for te ajudar.'] },
	{ icone: '⋮', titulo: 'Menu de três pontinhos', texto: [
		'<b>Backup</b>: exporte sua coleção para um arquivo e importe de volta quando quiser.',
		'<b>App Android</b>: o app avisa quando há uma versão nova e se atualiza sozinho; use <b>Procurar atualização</b> para conferir.',
		'No app Android, ao abrir a gaveta ☰ aparece um anúncio no espaço vazio embaixo das abas: é ele que ajuda a manter o Ticards de graça.'] },
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
		<p class="dica rodape">Este guia abre sempre que você entra no app. Você pode voltar a ele pelo menu ☰ → Como usar o app. · <a href="privacidade.html" target="_blank" rel="noopener">Política de Privacidade</a></p>`
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
