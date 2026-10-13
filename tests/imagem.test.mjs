import test from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, dadosDeTeste } from './ambiente.mjs'

const amb = criarAmbiente({ dados: dadosDeTeste })

// Imagens de mentira (RGBA): cada "carta" é um desenho de faixas coloridas diferente.
amb.avaliar(`
	var desenhar = (largura, altura, cor) => {
		const px = new Uint8Array(largura * altura * 4)
		for (let y = 0; y < altura; y++) for (let x = 0; x < largura; x++) {
			const [r, g, b] = cor(x / largura, y / altura)
			px.set([r, g, b, 255], (y * largura + x) * 4)
		}
		return px
	}
	var CORES = [
		(x, y) => [255 * x, 255 * y, 80],
		(x, y) => [255 * y, 40, 255 * x],
		(x, y) => [y < 0.5 ? 250 : 20, x < 0.5 ? 200 : 30, 120],
		(x, y) => [120, 255 * (1 - x), 255 * (1 - y)],
		(x, y) => [Math.round(x * 4) % 2 ? 240 : 10, 128, Math.round(y * 4) % 2 ? 240 : 10],
	]
	var lista = cartasEmOrdem().slice(0, CORES.length)
	var paraBanco = () => {
		const tam = GRADE.largura * GRADE.altura * 3
		const bytes = new Int8Array(lista.length * tam)
		CORES.forEach((cor, i) => {
			const a = assinaturaDaCarta(desenhar(50, 70, cor), 50, 70)
			for (let j = 0; j < tam; j++) bytes[i * tam + j] = Math.max(-127, Math.min(127, Math.round(a[j] * 400)))
		})
		return montarBancoDeAssinaturas(bytes, 400, lista)
	}
	var banco = paraBanco()
	// Foto de mentira: fundo cinza, carta (com borda clara) no meio, mais escura (luz fraca).
	var foto = (indice, luz = 0.7) => {
		const L = 150, A = 200, x0 = 30, y0 = 30, x1 = 120, y1 = 154
		return desenhar(L, A, (fx, fy) => {
			const x = fx * L, y = fy * A
			if (x < x0 || x >= x1 || y < y0 || y >= y1) return [90, 90, 90]
			const u = (x - x0) / (x1 - x0), v = (y - y0) / (y1 - y0)
			if (u < 0.04 || u > 0.96 || v < 0.04 || v > 0.96) return [250, 250, 250]
			return CORES[indice](u, v).map(c => c * luz)
		})
	}
`)

test('assinatura é igual com mais ou menos luz', () => {
	const s = amb.avaliar(`(() => {
		const a = assinaturaDaCarta(desenhar(50, 70, CORES[0]), 50, 70)
		const b = assinaturaDaCarta(desenhar(50, 70, (x, y) => CORES[0](x, y).map(c => c * 0.6 + 20)), 50, 70)
		let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s })()`)
	assert.ok(s > 0.99, `semelhança ${s}`)
})

test('acha o contorno da carta na foto', () => {
	const r = JSON.parse(JSON.stringify(amb.avaliar(`(() => {
		const px = foto(1), L = 150, A = 200, c = new Float32Array(L * A)
		for (let i = 0; i < c.length; i++) c[i] = px[i * 4]
		return acharContornos(c, L, A, 1)[0] })()`)))
	assert.ok(Math.abs(r.x0 - 0.2) < 0.03 && Math.abs(r.y0 - 0.15) < 0.03, JSON.stringify(r))
	assert.ok(Math.abs(r.x1 - 0.8) < 0.03 && Math.abs(r.y1 - 0.77) < 0.03, JSON.stringify(r))
})

test('reconhece cada carta pela imagem, mesmo com luz fraca', () => {
	for (let i = 0; i < 5; i++) {
		const r = amb.avaliar(`(() => { const r = reconhecerPorImagem(foto(${i}, 0.6), 150, 200, banco); return [r[0].indice, r[0].pontos, escolherPelaImagem(r, banco)?.carta.indice] })()`)
		assert.equal(r[0], i)
		assert.ok(r[1] > 0.8, `nota ${r[1]}`)
		assert.equal(r[2], i)
	}
})

test('imagem sem carta não é aceita', () => {
	const r = amb.avaliar(`(() => { const px = desenhar(150, 200, () => [90, 90, 90]); return escolherPelaImagem(reconhecerPorImagem(px, 150, 200, banco), banco) })()`)
	assert.equal(r, null)
})

test('cartas sem imagem (assinatura zerada) são ignoradas', () => {
	const r = amb.avaliar(`(() => {
		const tam = GRADE.largura * GRADE.altura * 3
		const b = montarBancoDeAssinaturas(new Int8Array(lista.length * tam), 400, lista)
		return [b.valida.reduce((s, v) => s + v, 0), reconhecerPorImagem(foto(0), 150, 200, b).length] })()`)
	assert.deepEqual([...r], [0, 0])
})

test('marca da lista de cartas muda quando a lista muda', () => {
	const [a, b] = amb.avaliar(`[marcaDasCartas(cartasEmOrdem()), marcaDasCartas(cartasEmOrdem().slice(1))]`)
	assert.notEqual(a, b)
	assert.match(a, /^\d+-[0-9a-f]+$/)
})
