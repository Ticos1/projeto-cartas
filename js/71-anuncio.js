'use strict'

/* ---------- Anúncio (só no app Android, com o AdMob do Google) ---------- */
// Um quadrado (300×250) que aparece só com a gaveta ☰ aberta, no espaço vazio abaixo das abas.
// Com a gaveta fechada não há anúncio nenhum na tela. Se a tela for baixa e não couber, não mostra.
// IDs de TESTE do Google: troque "bloco" pelo ID do seu bloco de anúncios e "teste" para false.
const ANUNCIO = { bloco: 'ca-app-pub-3940256099942544/6300978111', teste: true, largura: 300, altura: 250, margem: 16 }
const pluginAnuncio = () => window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins?.AdMob || null : null
const estadoAnuncio = { iniciado: false, mostrando: false, criado: false, espera: 0 }

async function iniciarAnuncio() {
	const admob = pluginAnuncio()
	if (!admob) return   // navegador ou APK antigo (sem a peça de anúncios)
	try {
		await admob.initialize({ initializeForTesting: ANUNCIO.teste })
		admob.addListener('bannerAdFailedToLoad', erro => registrar('aviso', 'Anúncio não carregou', erro?.message || textoDe(erro)))
		estadoAnuncio.iniciado = true
		new MutationObserver(atualizarAnuncio).observe($('#gaveta'), { attributes: true, attributeFilter: ['hidden'] })
	} catch (erro) {
		registrar('aviso', 'Anúncios indisponíveis', textoDe(erro))
	}
}

// Cabe o quadrado entre a última aba da gaveta e o rodapé da tela?
function anuncioCabeNaGaveta() {
	const caixa = $('#gaveta-anuncio')
	const ultimaAba = [...document.querySelectorAll('.gaveta-item')].pop()
	if (!caixa || !ultimaAba) return false
	caixa.hidden = false
	const cabe = caixa.getBoundingClientRect().top - 24 > ultimaAba.getBoundingClientRect().bottom
	caixa.hidden = !cabe
	return cabe
}

function atualizarAnuncio() {
	const admob = pluginAnuncio()
	if (!admob || !estadoAnuncio.iniciado) return
	clearTimeout(estadoAnuncio.espera)
	const aberta = !$('#gaveta').hidden
	if (!aberta) {
		$('#gaveta-anuncio').hidden = true
		if (estadoAnuncio.mostrando) { estadoAnuncio.mostrando = false; admob.hideBanner().catch(() => {}) }
		return
	}
	// Se couber, a gaveta fica um pouco mais larga (o AdMob centraliza o quadrado na tela).
	const cabe = anuncioCabeNaGaveta()
	document.documentElement.classList.toggle('com-anuncio', cabe)
	if (!cabe) return
	// Espera a gaveta terminar de deslizar para o quadrado aparecer já no lugar.
	estadoAnuncio.espera = setTimeout(() => {
		if ($('#gaveta').hidden || estadoAnuncio.mostrando) return
		estadoAnuncio.mostrando = true
		const pedido = estadoAnuncio.criado
			? admob.resumeBanner()
			: admob.showBanner({ adId: ANUNCIO.bloco, adSize: 'MEDIUM_RECTANGLE', position: 'BOTTOM_CENTER', margin: ANUNCIO.margem, isTesting: ANUNCIO.teste })
		pedido.then(() => {
			estadoAnuncio.criado = true
			if ($('#gaveta').hidden) { estadoAnuncio.mostrando = false; admob.hideBanner().catch(() => {}) }
		}).catch(erro => {
			estadoAnuncio.mostrando = false
			$('#gaveta-anuncio').hidden = true
			registrar('aviso', 'Anúncio não apareceu', textoDe(erro))
		})
	}, semAnimacao() ? 0 : 240)
}
