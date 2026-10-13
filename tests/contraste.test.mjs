// Confere o contraste (WCAG) das cores de cada tema, no modo claro e no escuro.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function carregarTemas() {
	const contexto = { matchMedia: () => ({ matches: false, addEventListener() {} }), document: {} }
	vm.createContext(contexto)
	vm.runInContext(fs.readFileSync(path.join(raiz, 'js/62-tema.js'), 'utf8') + '\nthis.TEMAS = TEMAS; this.corDeTextoSobre = corDeTextoSobre; this.coresComContraste = coresComContraste', contexto)
	return contexto
}

// Cores do styles.css (tema Padrão), que valem para tudo o que o tema não muda.
const css = fs.readFileSync(path.join(raiz, 'styles.css'), 'utf8')
const lerBloco = seletor => {
	const bloco = css.slice(css.indexOf(seletor)).match(/\{([^}]*)\}/)[1]
	return Object.fromEntries([...bloco.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})/gi)].map(m => [m[1], m[2]]))
}
const BASE = { claro: lerBloco(':root {'), escuro: { ...lerBloco(':root {'), ...lerBloco(':root[data-tema="escuro"]') } }

const luminancia = cor => {
	const n = parseInt(cor.slice(1), 16)
	const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
	return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (a, b) => { const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

// [cor do texto, cor do fundo, mínimo]. Texto comum pede 4,5:1 (WCAG AA).
const PARES = [
	['--texto', '--fundo', 4.5], ['--texto', '--superficie', 4.5], ['--texto', '--superficie-2', 4.5],
	['--texto-fraco', '--fundo', 4.5], ['--texto-fraco', '--superficie', 4.5], ['--texto-fraco', '--superficie-2', 4.5],
	['--destaque-texto', '--destaque', 4.5],
	// O verde de "completo" e "sincronizado" também aparece como letra.
	['--ok', '--fundo', 4.5], ['--ok', '--superficie', 4.5],
	// A versão do destaque usada como cor de letra (erros, item ativo do menu, números dos passos).
	['--destaque-letra', '--fundo', 4.5], ['--destaque-letra', '--superficie', 4.5], ['--destaque-letra', '--superficie-2', 4.5],
]

test('contraste: todos os temas passam no WCAG AA, no claro e no escuro', () => {
	const { TEMAS, coresComContraste } = carregarTemas()
	const falhas = []
	for (const [id, tema] of Object.entries(TEMAS)) {
		for (const modo of ['claro', 'escuro']) {
			const cores = coresComContraste({ ...BASE[modo], ...tema[modo] })
			for (const [texto, fundo, minimo] of PARES) {
				const valor = contraste(cores[texto], cores[fundo])
				if (valor < minimo) falhas.push(`${id} (${modo}): ${texto} sobre ${fundo} = ${valor.toFixed(2)} (mínimo ${minimo})`)
			}
		}
	}
	assert.deepEqual(falhas, [])
})

test('contraste: na cor personalizada, o texto sobre o destaque é o que lê melhor', () => {
	const { corDeTextoSobre } = carregarTemas()
	for (let i = 0; i < 4096; i += 7) {
		const cor = '#' + [i >> 8, (i >> 4) & 15, i & 15].map(c => (c * 17).toString(16).padStart(2, '0')).join('')
		const escolhida = corDeTextoSobre(cor)
		const outra = escolhida === '#ffffff' ? '#1b1d24' : '#ffffff'
		assert.ok(contraste(escolhida, cor) >= contraste(outra, cor), `${cor}: ${escolhida}`)
	}
})

test('contraste: as cores padrão do styles.css (sem JavaScript) também passam', () => {
	const { coresComContraste } = carregarTemas()
	for (const modo of ['claro', 'escuro']) {
		const corrigidas = coresComContraste(BASE[modo])
		assert.equal(BASE[modo]['--destaque-letra'], corrigidas['--destaque-letra'], modo)
		assert.equal(BASE[modo]['--destaque-texto'], corrigidas['--destaque-texto'], modo)
	}
})
