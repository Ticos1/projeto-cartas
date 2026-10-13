// Copia as bibliotecas externas (Firebase e Tesseract) para lib/, para o site servir tudo do próprio
// endereço (sem depender da gstatic.com e da jsDelivr na hora de usar).
//
// As versões e a verificação de integridade vêm de bibliotecas/package.json e bibliotecas/package-lock.json
// (o `npm ci` confere o hash de cada pacote). Cada pasta de lib/ leva o número da versão no nome, então o
// service worker pode guardar os arquivos para sempre: versão nova = endereço novo.
//
// Uso:
//   npm ci --prefix bibliotecas --ignore-scripts
//   node scripts/copiar_bibliotecas.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const modulos = path.join(raiz, 'bibliotecas', 'node_modules')

// Pastas de lib/ que o app usa (nuvem.js e js/57-aba-escanear.js). Os testes conferem que batem com as versões.
export function pastasDasBibliotecas(versoes) {
	return {
		firebase: `lib/firebase-${versoes.firebase}`,
		tesseract: `lib/tesseract-${versoes['tesseract.js']}`,
		tesseractCore: `lib/tesseract-core-${versoes['tesseract.js-core']}`,
		tesseractDados: `lib/tesseract-eng-${versoes['@tesseract.js-data/eng']}`,
	}
}

export const ARQUIVOS_FIREBASE = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js', 'firebase-app-check.js']

// Os arquivos do Firebase importam o firebase-app.js pelo endereço da gstatic.com; aqui ele passa a vir da mesma pasta.
export function trocarImportsDoFirebase(texto, versao) {
	const externo = `https://www.gstatic.com/firebasejs/${versao}/firebase-app.js`
	let saida = texto.split(externo).join('./firebase-app.js')
	saida = saida.replace(/\n\/\/# sourceMappingURL=\S+\s*$/, '\n')
	if (/https:\/\/www\.gstatic\.com\/firebasejs\//.test(saida)) throw new Error('Sobrou um import da gstatic.com no Firebase.')
	return saida
}

function copiar(origem, destino, transformar) {
	fs.mkdirSync(path.dirname(destino), { recursive: true })
	if (transformar) fs.writeFileSync(destino, transformar(fs.readFileSync(origem, 'utf8')))
	else fs.copyFileSync(origem, destino)
}

export function copiarBibliotecas() {
	const { dependencies: versoes } = JSON.parse(fs.readFileSync(path.join(raiz, 'bibliotecas', 'package.json'), 'utf8'))
	for (const [nome, versao] of Object.entries(versoes)) {
		const instalado = JSON.parse(fs.readFileSync(path.join(modulos, nome, 'package.json'), 'utf8')).version
		if (instalado !== versao) throw new Error(`${nome}: instalado ${instalado}, esperado ${versao}. Rode "npm ci --prefix bibliotecas".`)
	}
	const pastas = pastasDasBibliotecas(versoes)
	fs.rmSync(path.join(raiz, 'lib'), { recursive: true, force: true })

	for (const arquivo of ARQUIVOS_FIREBASE) {
		copiar(path.join(modulos, 'firebase', arquivo), path.join(raiz, pastas.firebase, arquivo), texto => trocarImportsDoFirebase(texto, versoes.firebase))
	}
	for (const arquivo of ['tesseract.min.js', 'worker.min.js']) {
		copiar(path.join(modulos, 'tesseract.js', 'dist', arquivo), path.join(raiz, pastas.tesseract, arquivo), texto => texto.replace(/\n\/\/# sourceMappingURL=\S+\s*$/, '\n'))
	}
	// O app usa o modo LSTM (o padrão do Tesseract.js 5): com e sem SIMD, conforme o aparelho.
	for (const arquivo of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js']) {
		copiar(path.join(modulos, 'tesseract.js-core', arquivo), path.join(raiz, pastas.tesseractCore, arquivo))
	}
	copiar(path.join(modulos, '@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz'), path.join(raiz, pastas.tesseractDados, 'eng.traineddata.gz'))
	return pastas
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const pastas = copiarBibliotecas()
	console.log('Bibliotecas copiadas:', Object.values(pastas).join(', '))
}
