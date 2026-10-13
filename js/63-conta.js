'use strict'

/* ---------- Conta e sincronização ---------- */
const TEXTO_STATUS = {
	sincronizado: '✅ Tudo sincronizado.',
	sincronizando: '🔄 Sincronizando…',
	offline: '📴 Sem internet. As mudanças serão enviadas quando a conexão voltar.',
	desconectado: '',
}

let ultimoStatus = null
function mostrarStatus(status) {
	if (status !== ultimoStatus) { registrar(status === 'offline' ? 'aviso' : 'info', `Sincronização: ${status}`); ultimoStatus = status }
	$('#status-nuvem').dataset.status = status
	$('#status-nuvem').title = TEXTO_STATUS[status] || 'Entrar na conta'
	$('#conta-status').textContent = TEXTO_STATUS[status]
}

function mostrarUsuario(novo) {
	const entrou = !usuario && novo
	if (!!usuario !== !!novo) registrar('info', novo ? 'Login feito' : 'Saiu da conta', novo?.email)
	usuario = novo
	$('#conta-carregando').hidden = true
	$('#conta-desconectado').hidden = !!usuario
	$('#conta-conectado').hidden = !usuario
	$('#conta-email').textContent = usuario?.email || ''
	$('#conta-confirmar').hidden = !usuario || !!usuario.verificado
	if ($('#convite')) $('#convite').hidden = !!usuario
	if (entrou && !$('#menu').hidden) {
		fecharMenu()
		avisar(`Conectado como ${usuario.email}`)
	}
}

// Chegou a coleção da nuvem (de outro aparelho, ou a junção do primeiro login).
function receberColecao(cartas, semMaster = [], desejosNuvem = {}, escondidasNuvem = [], decksNuvem = {}, quantidadesNuvem = {}) {
	decks = decksDeObjeto(decksNuvem)
	gravar(CHAVE_DECKS, JSON.stringify(decksParaNuvem()))
	escondidas = new Set(escondidasNuvem)
	gravar(CHAVE_ESCONDIDAS, JSON.stringify(escondidasNuvem))
	if (pesquisa.set && escondidas.has(pesquisa.set)) pesquisa.set = ''
	desejos = {}
	for (const [set, numeros] of Object.entries(desejosNuvem)) desejos[set] = new Set(numeros)
	salvarDesejos()
	const mudouMaster = semMaster.length !== semMasterSet.size || semMaster.some(id => !semMasterSet.has(id))
	if (mudouMaster) {
		semMasterSet = new Set(semMaster)
		gravar(CHAVE_SEM_MASTER, JSON.stringify(semMaster))
		const { setId } = rotaAtual()
		if (setId) desenharGradeSet(dados.sets.find(s => s.id === setId))
	}
	const lido = lerColecaoSalva({ cartas, quantidades: quantidadesNuvem })
	colecao = lido.cartas
	quantidades = lido.quantidades
	salvarColecao()
	// Atualiza a tela sem perder a rolagem nem o que foi digitado na busca.
	for (const botao of document.querySelectorAll('.carta')) atualizarCarta(botao)
	if (!$('#zoom').hidden && cartaAberta) atualizarBotaoZoom()
	const { aba, setId, sub } = rotaAtual()
	if (aba === 'decks') { const { deckId } = rotaAtual(); if (deckId) desenharDeck(deckId); else desenharListaDecks() }
	if (!setId) { if (aba === 'colecoes') { if (!editandoColecoes) desenharColecoes(); else atualizarContagemDasSeries() } else if (aba === 'desejos') sub === 'comprar' ? desenharComprarNaLiga() : desenharDesejos(); else if (aba === 'pesquisa') desenharPesquisa(); else if (aba === 'trocas') desenharTrocas() }
	atualizarProgressoNaTela()
}

async function carregarNuvem() {
	try {
		// O endereço é relativo a este arquivo (js/), não à página.
		nuvem = await import('../nuvem.js')
	} catch (erro) {
		console.warn('Login indisponível:', erro)
		$('#conta-carregando').hidden = true
		$('#conta-indisponivel').hidden = false
		return
	}
	nuvem.iniciarNuvem({
		colecaoLocal: colecaoComoObjeto,
		quantidadesLocal: quantidadesComoObjeto,
		semMasterSetLocal: () => [...semMasterSet],
		desejosLocal: desejosComoObjeto,
		escondidasLocal: () => [...escondidas],
		decksLocal: decksParaNuvem,
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
	acaoDeConta(async () => {
		await nuvem.criarConta(emailDigitado(), $('#login-senha').value)
		avisar('Conta criada! Enviamos um e-mail para você confirmar o endereço.')
	})
})

// Confirmação do e-mail: opcional, mas ajuda a recuperar a conta.
$('#botao-reenviar-confirmacao').addEventListener('click', async () => {
	try {
		await nuvem.reenviarConfirmacao()
		avisar('Enviamos de novo o e-mail de confirmação.')
	} catch (erro) {
		avisar(nuvem.mensagemDeErro(erro))
	}
})
$('#botao-ja-confirmei').addEventListener('click', async () => {
	try {
		const confirmado = await nuvem.emailConfirmado()
		if (usuario) usuario.verificado = confirmado
		$('#conta-confirmar').hidden = confirmado
		avisar(confirmado ? 'E-mail confirmado. Obrigado!' : 'Ainda não aparece como confirmado. Abra o link do e-mail e tente de novo.')
		if (confirmado) registrar('info', 'E-mail confirmado')
	} catch (erro) {
		avisar(nuvem.mensagemDeErro(erro))
	}
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

// Excluir conta (exigido pela LGPD e pela Play Store): apaga a conta e a coleção na nuvem.
function mostrarFormExcluir(mostrar) {
	$('#form-excluir').hidden = !mostrar
	$('#botao-excluir-conta').hidden = mostrar
	$('#excluir-erro').textContent = ''
	$('#excluir-senha').value = ''
	if (mostrar) $('#excluir-senha').focus()
}
$('#botao-excluir-conta').addEventListener('click', () => mostrarFormExcluir(true))
$('#botao-cancelar-exclusao').addEventListener('click', () => mostrarFormExcluir(false))
$('#form-excluir').addEventListener('submit', async evento => {
	evento.preventDefault()
	if (!navigator.onLine) { $('#excluir-erro').textContent = 'Conecte-se à internet para excluir a conta.'; return }
	if (!await perguntar({ titulo: 'Excluir sua conta?', texto: 'Sua conta e sua coleção na nuvem serão apagadas para sempre.', confirmar: 'Excluir', perigo: true })) return
	const botoes = document.querySelectorAll('#form-excluir button')
	botoes.forEach(b => { b.disabled = true })
	$('#excluir-erro').textContent = ''
	try {
		await nuvem.excluirConta($('#excluir-senha').value)
		registrar('info', 'Conta excluída')
		if ($('#excluir-local').checked) {
			for (const chave of [CHAVE_COLECAO, CHAVE_DESEJOS, CHAVE_DECKS, CHAVE_ESCONDIDAS, CHAVE_SEM_MASTER, CHAVE_LIGA_ABERTAS, CHAVE_LOGS]) {
				try { localStorage.removeItem(chave) } catch { /* sem localStorage */ }
			}
			await perguntar({ titulo: 'Conta excluída', texto: 'Sua conta e seus dados foram excluídos.', cancelar: null })
			location.reload()
			return
		}
		mostrarFormExcluir(false)
		fecharMenu()
		avisar('Conta excluída. Sua coleção continua salva só neste aparelho.')
	} catch (erro) {
		$('#excluir-erro').textContent = nuvem.mensagemDeErro(erro)
	} finally {
		botoes.forEach(b => { b.disabled = false })
	}
})

$('#botao-sair').addEventListener('click', async () => {
	await nuvem.sair()
	avisar('Você saiu da conta. A coleção continua salva neste aparelho.')
})
