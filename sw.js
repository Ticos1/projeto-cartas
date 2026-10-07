// Service worker: guarda o app e as imagens no aparelho para funcionar sem internet.
//
// Ao mudar algum arquivo do app, aumente o número da VERSAO para os celulares
// baixarem a versão nova.
const VERSAO = 'v1'
const CACHE_APP = `colecao-app-${VERSAO}`
const CACHE_IMAGENS = 'colecao-imagens'

const ARQUIVOS_APP = [
	'./',
	'index.html',
	'styles.css',
	'app.js',
	'data/cartas.json',
	'manifest.webmanifest',
	'icons/icon.svg',
	'icons/icon-192.png',
	'icons/icon-512.png',
]

self.addEventListener('install', evento => {
	evento.waitUntil(caches.open(CACHE_APP).then(cache => cache.addAll(ARQUIVOS_APP)))
	self.skipWaiting()
})

self.addEventListener('activate', evento => {
	evento.waitUntil(
		caches.keys()
			.then(nomes => Promise.all(nomes
				.filter(nome => nome.startsWith('colecao-app-') && nome !== CACHE_APP)
				.map(nome => caches.delete(nome))))
			.then(() => self.clients.claim())
	)
})

self.addEventListener('fetch', evento => {
	const { request } = evento
	if (request.method !== 'GET') return
	const url = new URL(request.url)

	if (url.hostname === 'assets.tcgdex.net') {
		evento.respondWith(imagem(request))
	} else if (url.origin === self.location.origin) {
		evento.respondWith(arquivoDoApp(request))
	}
})

// Arquivos do app: responde na hora com o que está guardado e atualiza em segundo plano.
async function arquivoDoApp(request) {
	const cache = await caches.open(CACHE_APP)
	const guardado = await cache.match(request, { ignoreSearch: true })
	const daRede = fetch(request)
		.then(resposta => {
			if (resposta.ok) cache.put(request, resposta.clone())
			return resposta
		})
		.catch(() => null)
	return guardado || (await daRede) || (await cache.match('index.html')) || Response.error()
}

// Imagens das cartas: se já baixou uma vez, usa a cópia guardada.
async function imagem(request) {
	const cache = await caches.open(CACHE_IMAGENS)
	const guardado = await cache.match(request.url)
	if (guardado) return guardado
	try {
		const resposta = await fetch(request.url, { mode: 'cors' })
		if (resposta.ok) cache.put(request.url, resposta.clone())
		return resposta // se der 404, o app tenta a imagem em inglês
	} catch {
		// Sem internet, ou o servidor não permite CORS: busca do jeito normal.
		try {
			const resposta = await fetch(request)
			if (resposta.type === 'opaque') cache.put(request.url, resposta.clone())
			return resposta
		} catch {
			return Response.error()
		}
	}
}
