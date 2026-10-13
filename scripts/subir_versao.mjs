// Sobe o número da versão do app (sw.js e js/00-base.js) em 1. Sem isso, os celulares continuam com
// a lista de cartas antiga guardada (o service worker guarda os arquivos de cada versão).
//
// Uso: node scripts/subir_versao.mjs

import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const ARQUIVOS = [
	{ caminho: 'sw.js', padrao: /(const VERSAO = ')v(\d+)(')/ },
	{ caminho: 'js/00-base.js', padrao: /(const VERSAO_APP = ')v(\d+)(')/ },
]

// Devolve o texto com a versão trocada por `numero`.
export function trocarVersao(texto, padrao, numero) {
	if (!padrao.test(texto)) throw new Error('Não achei a versão no arquivo.')
	return texto.replace(padrao, `$1v${numero}$3`)
}

export function versaoDe(texto, padrao) {
	const m = padrao.exec(texto)
	if (!m) throw new Error('Não achei a versão no arquivo.')
	return Number(m[2])
}

export function subirVersao(raiz) {
	const textos = ARQUIVOS.map(a => fs.readFileSync(new URL(a.caminho, raiz), 'utf8'))
	const nova = Math.max(...ARQUIVOS.map((a, i) => versaoDe(textos[i], a.padrao))) + 1
	ARQUIVOS.forEach((a, i) => fs.writeFileSync(new URL(a.caminho, raiz), trocarVersao(textos[i], a.padrao, nova)))
	return nova
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	console.log(`Versão do app: v${subirVersao(new URL('../', import.meta.url))}`)
}
