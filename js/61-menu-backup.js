'use strict'

/* ---------- Menu: backup e tema ---------- */
function abrirMenu() {
	if (!$('#menu').hidden) return
	configurarSecaoApk()
	$('#menu').hidden = false
	registrarSobreposicao()
}
function fecharMenu(veioDoHistorico = false) {
	if ($('#menu').hidden) return
	$('#menu').hidden = true
	if (!veioDoHistorico) liberarSobreposicao()
}
$('#abrir-menu').addEventListener('click', abrirMenu)
$('#status-nuvem').addEventListener('click', abrirMenu)
$('#fechar-menu').addEventListener('click', () => fecharMenu())
$('#menu-config').addEventListener('click', () => irParaRotaFechandoSobreposicao('#/configuracoes'))
$('#menu').addEventListener('click', evento => {
	if (evento.target.id === 'menu') fecharMenu()
})

// Entrega um arquivo de texto ao usuário: menu de compartilhar (Android/celular) ou download.
// Devolve 'compartilhado', 'baixado', 'cancelado' ou 'erro'.
async function entregarArquivo(nome, texto, tipo, titulo) {
	// Dentro do app Android: salva o arquivo e abre o menu de compartilhar do Android.
	const nativo = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins
	if (nativo?.Filesystem && nativo?.Share) {
		try {
			const { uri } = await nativo.Filesystem.writeFile({ path: nome, data: texto, directory: 'CACHE', encoding: 'utf8' })
			await nativo.Share.share({ title: titulo, files: [uri] })
			return 'compartilhado'
		} catch (erro) {
			return /cancel/i.test(erro?.message || '') ? 'cancelado' : 'erro'
		}
	}
	const arquivo = new File([texto], nome, { type: tipo })
	if (navigator.canShare?.({ files: [arquivo] })) {
		try {
			await navigator.share({ files: [arquivo], title: titulo })
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

$('#exportar').addEventListener('click', async () => {
	const cartas = colecaoComoObjeto()
	const quantidade = Object.values(cartas).reduce((soma, lista) => soma + lista.length, 0)
	const backup = { app: 'minha-colecao-tcg', versao: 2, exportadoEm: new Date().toISOString(), cartas, quantidades: quantidadesComoObjeto(), desejos: desejosComoObjeto(), decks: decksParaNuvem() }
	const nome = `colecao-tcg-${new Date().toISOString().slice(0, 10)}.json`
	const resultado = await entregarArquivo(nome, JSON.stringify(backup, null, 1), 'application/json', 'Backup da coleção')
	if (resultado === 'compartilhado') avisar(`Backup com ${quantidade} cartas exportado.`)
	else if (resultado === 'baixado') avisar(`Backup com ${quantidade} cartas baixado.`)
	else if (resultado === 'erro') avisar('Não foi possível exportar o backup.')
	registrar(resultado === 'erro' ? 'erro' : 'info', `Backup da coleção: ${resultado} (${quantidade} cartas)`)
})

$('#importar').addEventListener('click', () => $('#arquivo-backup').click())

$('#arquivo-backup').addEventListener('change', async evento => {
	const arquivo = evento.target.files[0]
	evento.target.value = ''
	if (!arquivo) return
	if (arquivo.size > BACKUP_TAMANHO_MAXIMO) {
		avisar('Esse arquivo é grande demais para ser um backup do app.')
		registrar('aviso', `Backup recusado: arquivo de ${Math.round(arquivo.size / 1024)} KB`)
		return
	}
	let limpo
	try {
		// Só passam sets e cartas que existem na lista do app (limparBackup, em js/10-modelo.js).
		limpo = limparBackup(JSON.parse(await arquivo.text()))
	} catch {
		avisar('Esse arquivo não parece ser um backup válido.')
		return
	}
	const quantidade = Object.values(limpo.cartas).reduce((soma, lista) => soma + lista.length, 0)
	const atuais = Object.values(colecao).reduce((soma, s) => soma + s.size, 0)
	const ondeSubstitui = usuario ? ' (no aparelho e na sua conta)' : ''
	const ignoradas = limpo.descartadas ? `\n\n${limpo.descartadas} ${limpo.descartadas === 1 ? 'item desconhecido será ignorado' : 'itens desconhecidos serão ignorados'} (cartas ou coleções que não existem no app).` : ''
	if (!confirm(`Substituir sua coleção atual${ondeSubstitui} (${atuais} cartas) pelo backup (${quantidade} cartas)?${ignoradas}`)) return
	const lido = lerColecaoSalva({ cartas: limpo.cartas, quantidades: limpo.quantidades })
	colecao = lido.cartas
	quantidades = lido.quantidades
	salvarColecao()
	if (limpo.desejos) {
		desejos = {}
		for (const [set, numeros] of Object.entries(limpo.desejos)) desejos[set] = new Set(numeros)
		salvarDesejos()
	}
	if (limpo.decks) {
		decks = decksDeObjeto(limpo.decks)
		gravar(CHAVE_DECKS, JSON.stringify(decksParaNuvem()))
	}
	nuvem?.substituirNaNuvem(colecaoComoObjeto(), limpo.desejos ? desejosComoObjeto() : undefined, limpo.decks ? decksParaNuvem() : undefined, quantidadesComoObjeto())
	registrar('info', `Backup importado: ${quantidade} cartas`, limpo.descartadas ? `${limpo.descartadas} itens ignorados` : undefined)
	fecharMenu()
	navegar()
	avisar(`Backup importado: ${quantidade} cartas.`)
})
