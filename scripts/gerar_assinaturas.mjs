// Gera as assinaturas das imagens das cartas (para o Escanear reconhecer a carta pela imagem).
// Lê img/{set}/{número}/low.webp (baixadas por baixar_imagens.mjs) e grava:
//   data/assinaturas-{marca}.bin  uma assinatura por carta (Int8), na ordem de data/cartas.json
//   data/assinaturas.json         { arquivo, marca, escala, cartas, comImagem }
// A assinatura é calculada com o mesmo código do app (js/24-imagem-logica.js).
//
// Uso: npm install --no-save sharp && node scripts/gerar_assinaturas.mjs
// (roda automaticamente no GitHub Actions antes de publicar no GitHub Pages)

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import sharp from 'sharp'

const RAIZ = new URL('..', import.meta.url).pathname
const ESCALA = 400   // valor guardado = assinatura × ESCALA (cabe num Int8)
const LARGURA = 50, ALTURA = 70

const dados = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/cartas.json'), 'utf8'))
const contexto = { dados, Math, Float32Array, Float64Array, Uint8Array, Array, Object }
vm.createContext(contexto)
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js/24-imagem-logica.js'), 'utf8'), contexto)
const { assinaturaDaCarta, cartasEmOrdem, marcaDasCartas, GRADE } = vm.runInContext('({ assinaturaDaCarta, cartasEmOrdem, marcaDasCartas, GRADE })', contexto)

const lista = cartasEmOrdem()
const tamanho = GRADE.largura * GRADE.altura * 3
const bytes = new Int8Array(lista.length * tamanho)
let comImagem = 0
for (const [i, { set, carta }] of lista.entries()) {
	const arquivo = path.join(RAIZ, 'img', set.id, carta.n, 'low.webp')
	if (!fs.existsSync(arquivo)) continue   // sem imagem: fica zerada (o app ignora)
	try {
		const pixels = await sharp(arquivo).removeAlpha().resize(LARGURA, ALTURA, { fit: 'fill' }).raw().toBuffer()
		const assinatura = assinaturaDaCarta(pixels, LARGURA, ALTURA, 3)
		for (let j = 0; j < tamanho; j++) bytes[i * tamanho + j] = Math.max(-127, Math.min(127, Math.round(assinatura[j] * ESCALA)))
		comImagem++
	} catch (erro) {
		console.warn(`Não consegui ler ${arquivo}: ${erro.message}`)
	}
}

const conteudo = Buffer.from(bytes.buffer)
const hash = crypto.createHash('sha1').update(conteudo).digest('hex').slice(0, 10)
const nome = `assinaturas-${hash}.bin`
for (const antigo of fs.readdirSync(path.join(RAIZ, 'data')).filter(f => /^assinaturas-.*\.bin$/.test(f))) fs.unlinkSync(path.join(RAIZ, 'data', antigo))
fs.writeFileSync(path.join(RAIZ, 'data', nome), conteudo)
fs.writeFileSync(path.join(RAIZ, 'data/assinaturas.json'), JSON.stringify({ arquivo: nome, marca: marcaDasCartas(lista), escala: ESCALA, cartas: lista.length, comImagem }) + '\n')
console.log(`Assinaturas: ${comImagem} de ${lista.length} cartas com imagem → data/${nome} (${(conteudo.length / 1e6).toFixed(1)} MB)`)
