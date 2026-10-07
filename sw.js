// Service worker: guarda o app e as imagens no aparelho para funcionar sem internet.
//
// Ao mudar algum arquivo do app, aumente o número da VERSAO para os celulares
// baixarem a versão nova.
const VERSAO = 'v22'
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
	evento.waitUntil(precarregar())
	self.skipWaiting()
})

// Baixa TODOS os arquivos do app de uma vez, direto da rede (sem usar cópias velhas do
// navegador), e guarda no cache desta versão. Assim index.html, app.js e os outros
// arquivos são sempre do mesmo lote: nunca se misturam versões diferentes.
async function precarregar() {
	const cache = await caches.open(CACHE_APP)
	await Promise.all(ARQUIVOS_APP.map(async caminho => {
		const resposta = await fetch(new Request(caminho, { cache: 'reload' }))
		if (!resposta.ok) throw new Error(`${caminho}: HTTP ${resposta.status}`)
		await cache.put(caminho, resposta)
	}))
}

self.addEventListener('activate', evento => {
	evento.waitUntil((async () => {
		const nomes = await caches.keys()
		const antigos = nomes.filter(nome => nome.startsWith('colecao-app-') && nome !== CACHE_APP)
		await Promise.all(antigos.map(nome => caches.delete(nome)))
		await self.clients.claim()
		// Era uma atualização: recarrega as telas abertas para já usarem a versão nova.
		if (antigos.length) {
			const telas = await self.clients.matchAll({ type: 'window' })
			telas.forEach(tela => tela.navigate(tela.url).catch(() => {}))
		}
	})())
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

// Arquivos do app: sempre do lote guardado desta versão (rápido, funciona sem internet e
// nunca mistura versões). A versão nova chega pelo service worker novo, que recarrega a tela.
async function arquivoDoApp(request) {
	const cache = await caches.open(CACHE_APP)
	const guardado = await cache.match(request.mode === 'navigate' ? 'index.html' : request, { ignoreSearch: true })
	if (guardado) return guardado
	try {
		return await fetch(request)
	} catch {
		return Response.error()
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
