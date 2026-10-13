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
	try {
		const backup = JSON.parse(await arquivo.text())
		if (!backup || typeof backup.cartas !== 'object') throw new Error('formato')
		const novas = {}
		let quantidade = 0
		for (const [set, numeros] of Object.entries(backup.cartas)) {
			if (!Array.isArray(numeros)) continue
			novas[set] = new Set(numeros.map(String))
			quantidade += novas[set].size
		}
		const atuais = Object.values(colecao).reduce((soma, s) => soma + s.size, 0)
		const ondeSubstitui = usuario ? ' (no aparelho e na sua conta)' : ''
		if (!await perguntar({ titulo: 'Importar backup?', texto: `Sua coleção atual${ondeSubstitui} (${atuais} cartas) será substituída pelo backup (${quantidade} cartas).`, confirmar: 'Substituir', perigo: true })) return
		const lido = lerColecaoSalva({ cartas: backup.cartas, quantidades: backup.quantidades })
		colecao = lido.cartas
		quantidades = lido.quantidades
		salvarColecao()
		if (backup.desejos && typeof backup.desejos === 'object') {
			desejos = {}
			for (const [set, numeros] of Object.entries(backup.desejos)) if (Array.isArray(numeros)) desejos[set] = new Set(numeros.map(String))
			salvarDesejos()
		}
		if (backup.decks && typeof backup.decks === 'object') {
			decks = decksDeObjeto(backup.decks)
			gravar(CHAVE_DECKS, JSON.stringify(decksParaNuvem()))
		}
		nuvem?.substituirNaNuvem(colecaoComoObjeto(), desejosComoObjeto(), decksParaNuvem(), quantidadesComoObjeto())
		fecharMenu()
		navegar()
		avisar(`Backup importado: ${quantidade} cartas.`)
	} catch {
		avisar('Esse arquivo não parece ser um backup válido.')
	}
})
