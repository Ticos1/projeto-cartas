// Service worker: guarda o app e as imagens no aparelho para funcionar sem internet.
//
// Ao mudar algum arquivo do app, aumente o número da VERSAO para os celulares
// baixarem a versão nova.
const VERSAO = 'v55'
const CACHE_APP = `colecao-app-${VERSAO}`
const CACHE_IMAGENS = 'colecao-imagens'

const ARQUIVOS_APP = [
	'./',
	'index.html',
	'styles.css',
	'js/reparo.js',
	'js/00-base.js',
	'js/10-modelo.js',
	'js/20-imagens-ajudantes.js',
	'js/21-trocas-logica.js',
	'js/22-importar-deck-logica.js',
	'js/23-reconhecer-logica.js',
	'js/24-imagem-logica.js',
	'js/30-cartas-grade.js',
	'js/35-efeitos.js',
	'js/40-liga-e-carta-grande.js',
	'js/50-aba-colecoes.js',
	'js/51-aba-pesquisa.js',
	'js/52-aba-desejos.js',
	'js/53-aba-decks.js',
	'js/54-aba-ajuda-config.js',
	'js/55-tela-set.js',
	'js/56-aba-trocas.js',
	'js/57-aba-escanear.js',
	'js/60-navegacao.js',
	'js/61-menu-backup.js',
	'js/62-tema.js',
	'js/63-conta.js',
	'js/70-app-android.js',
	'js/71-anuncio.js',
	'js/99-iniciar.js',
	'nuvem.js',
	'sincronia.js',
	'data/cartas.json',
	'manifest.webmanifest',
	'privacidade.html',
	'icons/icon.svg',
	'icons/icon-192.png',
	'icons/icon-512.png',
]

self.addEventListener('install', evento => {
	evento.waitUntil(precarregar())
	self.skipWaiting()
})

// Baixa TODOS os arquivos do app de uma vez, direto da rede (sem usar cópias velhas do
// navegador), e guarda no cache desta versão. Assim index.html, js/*.js e os outros
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
	} else if (url.origin === self.location.origin && url.pathname.includes('/lib/')) {
		// Bibliotecas (Firebase e leitor de texto do Escanear), servidas pelo próprio site. A pasta de cada
		// uma leva a versão no nome e nunca muda, então guarda e reutiliza.
		evento.respondWith(biblioteca(request))
	} else if (url.origin === self.location.origin && /\/data\/assinaturas-[^/]*\.bin$/.test(url.pathname)) {
		// Assinaturas das imagens (Escanear): o nome muda quando o conteúdo muda, então guarda e reutiliza.
		evento.respondWith(biblioteca(request))
	} else if (url.origin === self.location.origin && url.pathname.endsWith('/data/assinaturas.json')) {
		evento.respondWith(daRedeOuGuardado(request))
	} else if (url.origin === self.location.origin) {
		evento.respondWith(arquivoDoApp(request))
	}
})

// Arquivos do app: sempre do lote guardado desta versão (rápido, funciona sem internet e
// nunca mistura versões). A versão nova chega pelo service worker novo, que recarrega a tela.
async function arquivoDoApp(request) {
	const cache = await caches.open(CACHE_APP)
	// Abrir o app (endereço da pasta ou index.html) usa o index.html guardado; outras páginas, a própria.
	const caminho = new URL(request.url).pathname
	const ehApp = request.mode === 'navigate' && (caminho.endsWith('/') || caminho.endsWith('/index.html'))
	const guardado = await cache.match(ehApp ? 'index.html' : request, { ignoreSearch: true })
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

// Bibliotecas (Firebase, Tesseract) e assinaturas: cada endereço nunca muda de conteúdo, então guarda e reutiliza.
async function biblioteca(request) {
	const cache = await caches.open(CACHE_IMAGENS)
	const guardado = await cache.match(request.url)
	if (guardado) return guardado
	const resposta = await fetch(request)
	if (resposta.ok) cache.put(request.url, resposta.clone())
	return resposta
}

// Pequenos arquivos que mudam a cada publicação (índice das assinaturas): da internet quando dá; sem internet, a última cópia.
async function daRedeOuGuardado(request) {
	const cache = await caches.open(CACHE_IMAGENS)
	try {
		const resposta = await fetch(request.url, { cache: 'no-cache' })
		if (resposta.ok) cache.put(request.url, resposta.clone())
		return resposta
	} catch {
		return (await cache.match(request.url)) || Response.error()
	}
}
