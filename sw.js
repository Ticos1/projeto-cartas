// Service worker: guarda o app e as imagens no aparelho para funcionar sem internet.
//
// Ao mudar algum arquivo do app, aumente o número da VERSAO para os celulares
// baixarem a versão nova.
const VERSAO = 'v12'
const CACHE_APP = `colecao-app-${VERSAO}`
const CACHE_IMAGENS = 'colecao-imagens'

const ARQUIVOS_APP = [
	'./',
	'index.html',
	'styles.css',
	'app.js',
	'nuvem.js',
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

	if (url.hostname === 'assets.tcgdex.net' || (url.origin === self.location.origin && url.pathname.includes('/img/'))) {
		evento.respondWith(imagem(request))
	} else if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
		evento.respondWith(bibliotecaFirebase(request))
	} else if (url.origin === self.location.origin) {
		evento.respondWith(arquivoDoApp(request))
	}
})

// Arquivos do app: com internet, sempre a versão mais nova (e guarda uma cópia);
// sem internet (ou se a rede demorar mais de 4 segundos), usa a cópia guardada.
async function arquivoDoApp(request) {
	const cache = await caches.open(CACHE_APP)
	const daRede = fetch(request, { cache: 'no-cache' }).then(resposta => {
		if (resposta.ok) cache.put(request, resposta.clone())
		return resposta
	})
	const guardado = () => cache.match(request, { ignoreSearch: true })
		.then(copia => copia || cache.match('index.html'))
	const limite = new Promise(resolver => setTimeout(resolver, 4000))
	try {
		const resposta = await Promise.race([daRede, limite.then(guardado)])
		if (resposta) return resposta
		return await daRede
	} catch {
		return (await guardado()) || Response.error()
	}
}

// Imagens das cartas: se já baixou uma vez, usa a cópia guardada.
async function imagem(request) {
	const cache = await caches.open(CACHE_IMAGENS)
	const guardado = await cache.match(request.url)
	if (guardado) return guardado
	try {
		const mesmoSite = new URL(request.url).origin === self.location.origin
		const resposta = await fetch(request.url, mesmoSite ? {} : { mode: 'cors' })
		if (resposta.ok) cache.put(request.url, resposta.clone())
		return resposta // se der 404, o app tenta o próximo endereço
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

// Biblioteca do Firebase (login): cada versão nunca muda, então guarda e reutiliza.
async function bibliotecaFirebase(request) {
	const cache = await caches.open(CACHE_IMAGENS)
	const guardado = await cache.match(request.url)
	if (guardado) return guardado
	const resposta = await fetch(request)
	if (resposta.ok) cache.put(request.url, resposta.clone())
	return resposta
}
