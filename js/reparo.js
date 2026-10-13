// Rede de segurança: se o app não conseguir iniciar (ex.: arquivos de versões misturadas),
// mostra um botão que limpa os arquivos guardados do app e recarrega. A coleção NÃO é apagada.
// Fica num arquivo (e não dentro do index.html) porque a Content-Security-Policy não deixa rodar scripts embutidos.
// É o primeiro script da página e não usa nada dos outros.
(function () {
	function reparar() {
		var passo = function (p) { return Promise.resolve(p).catch(function () {}) }
		passo(navigator.serviceWorker && navigator.serviceWorker.getRegistrations().then(function (rs) {
			return Promise.all(rs.map(function (r) { return r.unregister() }))
		})).then(function () {
			return passo(window.caches && caches.keys().then(function (ks) {
				return Promise.all(ks.map(function (k) { return caches.delete(k) }))
			}))
		}).then(function () {
			// Baixa de novo os arquivos do app, ignorando a memória do navegador (que guarda por 10 min).
			var arquivos = ['index.html', 'styles.css', 'js/reparo.js', 'js/00-base.js', 'js/10-modelo.js', 'js/20-imagens-ajudantes.js', 'js/21-trocas-logica.js', 'js/22-importar-deck-logica.js', 'js/23-reconhecer-logica.js', 'js/24-imagem-logica.js', 'js/30-cartas-grade.js', 'js/35-efeitos.js', 'js/40-liga-e-carta-grande.js', 'js/50-aba-colecoes.js', 'js/51-aba-pesquisa.js', 'js/52-aba-desejos.js', 'js/53-aba-decks.js', 'js/54-aba-ajuda-config.js', 'js/55-tela-set.js', 'js/56-aba-trocas.js', 'js/57-aba-escanear.js', 'js/60-navegacao.js', 'js/61-menu-backup.js', 'js/62-tema.js', 'js/63-conta.js', 'js/70-app-android.js', 'js/71-anuncio.js', 'js/99-iniciar.js', 'nuvem.js', 'sincronia.js', 'sw.js', 'data/cartas.json', 'manifest.webmanifest']
			return Promise.all(arquivos.map(function (a) { return passo(fetch(a, { cache: 'reload' })) }))
		}).then(function () { location.reload() })
	}
	function mostrar() {
		if (window.__appPronto || document.getElementById('reparo')) return
		var caixa = document.createElement('div')
		caixa.id = 'reparo'
		caixa.style.cssText = 'position:fixed;inset:0;z-index:99;display:grid;place-items:center;padding:24px;background:#14161c;color:#eef0f4;font-family:system-ui,sans-serif;text-align:center'
		caixa.innerHTML = '<div><h2>O app não abriu direito</h2><p style="color:#9aa1ad">Isso acontece quando uma atualização fica pela metade. Sua coleção está salva e não será apagada.</p><button id="reparar" style="padding:12px 24px;border:0;border-radius:12px;background:#f0524a;color:#fff;font:inherit;font-weight:600">Reparar e abrir</button></div>'
		document.body.appendChild(caixa)
		document.getElementById('reparar').onclick = reparar
	}
	window.addEventListener('error', function () { setTimeout(mostrar, 400) })
	setTimeout(mostrar, 8000)
})()
