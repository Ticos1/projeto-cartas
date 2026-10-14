// Conferências de segurança que não precisam de navegador: Content-Security-Policy, bibliotecas servidas pelo
// próprio site, GitHub Actions fixadas por SHA e regras do Firestore versionadas.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pastasDasBibliotecas, trocarImportsDoFirebase } from '../scripts/copiar_bibliotecas.mjs'

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const ler = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8')
const index = ler('index.html')

function politica(html) {
	const m = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html)
	assert.ok(m, 'falta a Content-Security-Policy')
	return Object.fromEntries(m[1].split(';').map(p => p.trim().split(/\s+/)).filter(p => p[0]).map(([nome, ...valores]) => [nome, valores]))
}

test('CSP: existe, vem antes de qualquer script e não libera script embutido nem eval', () => {
	const csp = politica(index)
	assert.ok(index.indexOf('Content-Security-Policy') < index.indexOf('<script'), 'a CSP precisa vir antes dos scripts')
	assert.deepEqual(csp['default-src'], ["'self'"])
	assert.deepEqual(csp['object-src'], ["'none'"])
	for (const proibido of ["'unsafe-inline'", "'unsafe-eval'", 'data:', 'blob:', 'https:', '*']) {
		assert.ok(!csp['script-src'].includes(proibido), `script-src não pode ter ${proibido}`)
	}
	assert.ok(!csp['script-src'].some(fonte => /jsdelivr|firebasejs/.test(fonte)), 'Firebase e Tesseract vêm de lib/, não de CDN')
})

test('CSP: o index.html não tem script embutido nem atributos on*', () => {
	for (const m of index.matchAll(/<script\b([^>]*)>/g)) assert.match(m[1], /\bsrc="[^"]+"/, `script embutido: ${m[0]}`)
	assert.doesNotMatch(index, /\son[a-z]+="/)
})

test('CSP: os endereços externos usados pelo app estão liberados', () => {
	const csp = politica(index)
	const permitidos = [...csp['connect-src'], ...csp['img-src']]
	const codigo = fs.readdirSync(path.join(raiz, 'js')).map(a => ler(`js/${a}`)).join('\n') + ler('nuvem.js')
	const hostsUsados = new Set([...codigo.matchAll(/fetch\(\s*'https:\/\/([^/']+)/g)].map(m => m[1]))
	hostsUsados.add(new URL(/const IMAGENS = '([^']+)'/.exec(ler('js/00-base.js'))[1]).host)
	for (const host of hostsUsados) assert.ok(permitidos.includes(`https://${host}`), `falta https://${host} na CSP`)
	for (const host of ['firestore.googleapis.com', 'identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'content-firebaseappcheck.googleapis.com']) {
		assert.ok(csp['connect-src'].includes(`https://${host}`), `falta https://${host} no connect-src`)
	}
})

test('CSP: a política de privacidade também tem a sua', () => {
	const csp = politica(ler('privacidade.html'))
	assert.deepEqual(csp['default-src'], ["'none'"])
})

test('todo script do index.html está na lista offline do sw.js e na lista do reparo', () => {
	const sw = ler('sw.js')
	const reparo = ler('js/reparo.js')
	for (const [, src] of index.matchAll(/<script src="([^"]+)"/g)) {
		assert.ok(sw.includes(`'${src}'`), `${src} falta em ARQUIVOS_APP (sw.js)`)
		assert.ok(reparo.includes(`'${src}'`), `${src} falta na lista de js/reparo.js`)
	}
})

test('bibliotecas: o app usa as pastas de lib/ das versões de bibliotecas/package.json', () => {
	const { dependencies } = JSON.parse(ler('bibliotecas/package.json'))
	for (const versao of Object.values(dependencies)) assert.match(versao, /^\d+\.\d+\.\d+$/, 'versões exatas, sem ^ ou ~')
	const pastas = pastasDasBibliotecas(dependencies)
	assert.ok(ler('nuvem.js').includes(`'./${pastas.firebase}'`), `nuvem.js deve usar ${pastas.firebase}`)
	const escanear = ler('js/57-aba-escanear.js')
	for (const pasta of [pastas.tesseract, pastas.tesseractCore, pastas.tesseractDados]) assert.ok(escanear.includes(`'${pasta}`), `js/57-aba-escanear.js deve usar ${pasta}`)
	assert.doesNotMatch(ler('nuvem.js') + escanear, /gstatic\.com\/firebasejs|cdn\.jsdelivr\.net/)
	const lock = JSON.parse(ler('bibliotecas/package-lock.json'))
	for (const [nome, versao] of Object.entries(dependencies)) {
		const pacote = lock.packages[`node_modules/${nome}`]
		assert.equal(pacote?.version, versao, `${nome} no package-lock.json`)
		assert.match(pacote.integrity, /^sha512-/)
	}
	assert.match(ler('.github/workflows/pages.yml'), /copiar_bibliotecas\.mjs/)
})

test('bibliotecas: os imports do Firebase passam a ser do próprio site', () => {
	const original = 'import{a}from"https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";x()\n//# sourceMappingURL=firebase-auth.js.map\n'
	assert.equal(trocarImportsDoFirebase(original, '11.10.0'), 'import{a}from"./firebase-app.js";x()\n')
	assert.throws(() => trocarImportsDoFirebase('import"https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js"', '11.10.0'))
})

test('GitHub Actions: todas fixadas por SHA', () => {
	const pasta = path.join(raiz, '.github/workflows')
	for (const arquivo of fs.readdirSync(pasta)) {
		for (const m of fs.readFileSync(path.join(pasta, arquivo), 'utf8').matchAll(/uses:\s*(\S+)/g)) {
			assert.match(m[1], /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/, `${arquivo}: ${m[1]} não está fixada por SHA`)
		}
	}
	assert.ok(fs.existsSync(path.join(raiz, '.github/dependabot.yml')))
})

test('regras do Firestore: versionadas, fechadas por padrão e só com os campos conhecidos', () => {
	const regras = ler('firestore.rules')
	assert.match(regras, /match \/colecoes\/\{uid\}/)
	assert.match(regras, /request\.auth\.uid == uid/)
	assert.match(regras, /match \/\{documento=\*\*\}\s*\{\s*allow read, write: if false;/)
	assert.doesNotMatch(regras, /if true/)
	const campos = /hasOnly\(\[([^\]]+)\]\)/.exec(regras)[1].match(/'(\w+)'/g).map(c => c.slice(1, -1)).sort()
	assert.deepEqual(campos, ['atualizadoEm', 'cartas', 'colecoesEscondidas', 'decks', 'desejos', 'quantidades', 'semMasterSet'])
	// Todo campo que o app grava precisa estar na lista das regras.
	for (const m of ler('nuvem.js').matchAll(/setDoc\([^{]*\{([^\n]*)/g)) {
		for (const [, campo] of m[1].matchAll(/(?:^|[{,]\s*)(\w+):/g)) {
			if (['merge', 'mergeFields'].includes(campo)) continue
			assert.ok(campos.includes(campo), `nuvem.js grava o campo "${campo}", que firestore.rules não aceita`)
		}
	}
	assert.equal(JSON.parse(ler('firebase.json')).firestore.rules, 'firestore.rules')
})

test('manifesto: atalhos, compartilhar e capturas apontam para arquivos e rotas que existem', () => {
	const manifesto = JSON.parse(ler('manifest.webmanifest'))
	assert.equal(manifesto.theme_color, '#14161c', 'mesma cor do index.html e do app Android')
	assert.equal(manifesto.background_color, '#14161c')
	assert.equal(ler('android-app/capacitor.config.json').includes(manifesto.background_color), true)
	assert.notEqual(manifesto.orientation, 'portrait', 'o tablet pode usar o app deitado')
	const imagens = [...manifesto.shortcuts.flatMap(a => a.icons), ...manifesto.screenshots]
	for (const imagem of imagens) assert.ok(fs.existsSync(new URL(`../${imagem.src}`, import.meta.url)), `${imagem.src} não existe`)
	const rotas = ler('js/60-navegacao.js')
	for (const atalho of manifesto.shortcuts) {
		const rota = /^\.\/#\/([a-z-]+)$/.exec(atalho.url)?.[1]
		assert.ok(rota && rotas.includes(`partes[0] === '${rota}'`), `atalho ${atalho.url} sem rota no app`)
	}
	const alvo = manifesto.share_target
	assert.equal(alvo.method, 'POST')
	assert.ok(ler('sw.js').includes(`url.pathname.endsWith('/${alvo.action.replace('./', '')}')`), 'o sw.js recebe o que é compartilhado')
	assert.ok(ler('sw.js').includes(`getAll('${alvo.params.files[0].name}')`))
	assert.ok(rotas.includes("partes[0] === 'receber'"))
	assert.ok(manifesto.screenshots.some(s => s.form_factor === 'wide') && manifesto.screenshots.some(s => s.form_factor === 'narrow'))
})
