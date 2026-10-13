'use strict'

/* ---------- Início ---------- */
async function iniciar() {
	const rotuloVersao = $('#versao-app')
	if (rotuloVersao) rotuloVersao.textContent = VERSAO_APP
	aplicarTema(ler(CHAVE_TEMA) || 'auto')
	carregarColecao()
	carregarDesejos()
	try {
		const resposta = await fetch('data/cartas.json')
		dados = await resposta.json()
	} catch (erro) {
		registrar('erro', 'Falha ao carregar a lista de cartas', textoDe(erro))
		window.__appPronto = true
		tela.innerHTML = '<p class="vazio">Não foi possível carregar a lista de cartas. Verifique a internet e tente de novo.</p>'
		return
	}
	registrar('info', `App iniciado (${VERSAO_APP})`)
	prepararHistorico()
	navegar()
	window.__appPronto = true
	carregarNuvem()
	iniciarAnuncio()
	verificarVersaoDoApp()

	if ('serviceWorker' in navigator) {
		// Quando sai uma versão nova, o service worker novo assume e recarrega a tela sozinho.
		// Ao voltar para o app (ou abrir), confere se há novidade.
		navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(registro => {
			registro.addEventListener('updatefound', () => registrar('info', 'Atualização do app encontrada'))
			registro.update().catch(() => {})
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible') { registro.update().catch(() => {}); verificarVersaoDoApp() }
			})
		}).catch(erro => registrar('aviso', 'Modo offline indisponível', textoDe(erro)))
	}
}

iniciar()
