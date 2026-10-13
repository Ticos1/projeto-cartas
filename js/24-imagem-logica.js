'use strict'

/* ---------- Escanear carta pela imagem: lógica (sem câmera, para poder testar) ---------- */
// Cada carta tem uma "assinatura": a cor média de uma grade de 10 × 14 quadradinhos da imagem da carta
// (sem a borda de 4%), sem a média de cada cor (luz mais forte ou mais fraca não muda nada) e com tamanho 1.
// As assinaturas de todas as cartas são geradas na publicação do site (scripts/gerar_assinaturas.mjs) a
// partir das imagens em img/, e o app compara a imagem da câmera com elas: a mais parecida é a carta.
// Testado com fotos simuladas (carta pequena, torta, desfocada, com reflexo e cor alterada): ~92% de acerto.
// Cartas com a mesma arte em coleções diferentes (reimpressões, energias) ficam empatadas; o número lido
// pelo leitor de texto (23-reconhecer-logica.js) desempata.
const GRADE = { largura: 10, altura: 14 }
const GRADE_GROSSA = { largura: 5, altura: 7 }   // 2 × 2 quadradinhos viram 1: comparação rápida
const MARGEM_DA_CARTA = 0.04
const PROPORCAO_DA_CARTA = 600 / 825            // largura / altura

// Soma acumulada de cada cor (imagem integral): a média de qualquer retângulo sai com 4 contas.
// `pixels` é RGBA (como o getImageData do canvas) ou RGB (`canais` = 3).
function imagemIntegral(pixels, largura, altura, canais = 4) {
	const L = largura + 1
	const soma = new Float64Array(L * (altura + 1) * 3)
	for (let y = 0; y < altura; y++) {
		const linha = [0, 0, 0]
		for (let x = 0; x < largura; x++) {
			const p = (y * largura + x) * canais
			for (let c = 0; c < 3; c++) {
				linha[c] += pixels[p + c]
				soma[((y + 1) * L + x + 1) * 3 + c] = soma[(y * L + x + 1) * 3 + c] + linha[c]
			}
		}
	}
	return { soma, largura, altura }
}

// Cor média de cada quadradinho da grade dentro do retângulo [x0, x1) × [y0, y1) (em pixels).
function gradeDaRegiao(integral, x0, y0, x1, y1, grade = GRADE) {
	const { soma, largura } = integral
	const L = largura + 1
	const saida = new Float32Array(grade.largura * grade.altura * 3)
	for (let gy = 0; gy < grade.altura; gy++) {
		const ya = Math.round(y0 + (y1 - y0) * gy / grade.altura)
		const yb = Math.max(ya + 1, Math.round(y0 + (y1 - y0) * (gy + 1) / grade.altura))
		for (let gx = 0; gx < grade.largura; gx++) {
			const xa = Math.round(x0 + (x1 - x0) * gx / grade.largura)
			const xb = Math.max(xa + 1, Math.round(x0 + (x1 - x0) * (gx + 1) / grade.largura))
			const area = (xb - xa) * (yb - ya)
			for (let c = 0; c < 3; c++) {
				const s = soma[(yb * L + xb) * 3 + c] - soma[(ya * L + xb) * 3 + c] - soma[(yb * L + xa) * 3 + c] + soma[(ya * L + xa) * 3 + c]
				saida[(gy * grade.largura + gx) * 3 + c] = s / area
			}
		}
	}
	return saida
}

// Tira a média de cada cor e deixa o vetor com tamanho 1 (assim a comparação é só um produto).
function normalizarAssinatura(vetor) {
	const media = [0, 0, 0]
	const n = vetor.length / 3
	for (let i = 0; i < vetor.length; i++) media[i % 3] += vetor[i] / n
	let tamanho = 0
	const saida = new Float32Array(vetor.length)
	for (let i = 0; i < vetor.length; i++) {
		saida[i] = vetor[i] - media[i % 3]
		tamanho += saida[i] * saida[i]
	}
	tamanho = Math.sqrt(tamanho) || 1
	for (let i = 0; i < saida.length; i++) saida[i] /= tamanho
	return saida
}

// Junta 2 × 2 quadradinhos (10 × 14 → 5 × 7) e normaliza de novo.
function assinaturaGrossa(fina) {
	const grossa = new Float32Array(GRADE_GROSSA.largura * GRADE_GROSSA.altura * 3)
	for (let y = 0; y < GRADE.altura; y++) {
		for (let x = 0; x < GRADE.largura; x++) {
			const destino = (Math.floor(y / 2) * GRADE_GROSSA.largura + Math.floor(x / 2)) * 3
			for (let c = 0; c < 3; c++) grossa[destino + c] += fina[(y * GRADE.largura + x) * 3 + c]
		}
	}
	return normalizarAssinatura(grossa)
}

// Assinatura de uma imagem inteira de carta (usada para gerar o banco de assinaturas).
function assinaturaDaCarta(pixels, largura, altura, canais = 4) {
	const integral = imagemIntegral(pixels, largura, altura, canais)
	const mx = largura * MARGEM_DA_CARTA, my = altura * MARGEM_DA_CARTA
	return normalizarAssinatura(gradeDaRegiao(integral, mx, my, largura - mx, altura - my))
}

// Lugares prováveis da carta na imagem: retângulos no formato da carta com as bordas mais fortes.
// `cinza` tem um valor (0–255) por pixel. Devolve [{ x0, y0, x1, y1, pontos }] em frações da imagem.
function acharContornos(cinza, largura, altura, quantos = 4) {
	const gx = new Float32Array(largura * altura)
	const gy = new Float32Array(largura * altura)
	for (let y = 0; y < altura; y++) {
		for (let x = 0; x < largura; x++) {
			const i = y * largura + x
			if (x > 0 && x < largura - 1) gx[i] = Math.abs(cinza[i + 1] - cinza[i - 1])
			if (y > 0 && y < altura - 1) gy[i] = Math.abs(cinza[i + largura] - cinza[i - largura])
		}
	}
	// colunas[y][x] = soma de gx da coluna x até a linha y; linhas[y][x] = soma de gy da linha y até a coluna x.
	const colunas = new Float32Array((altura + 1) * largura)
	for (let y = 0; y < altura; y++) for (let x = 0; x < largura; x++) colunas[(y + 1) * largura + x] = colunas[y * largura + x] + gx[y * largura + x]
	const L = largura + 1
	const linhas = new Float32Array(altura * L)
	for (let y = 0; y < altura; y++) for (let x = 0; x < largura; x++) linhas[y * L + x + 1] = linhas[y * L + x] + gy[y * largura + x]
	const achados = []
	for (let ch = Math.ceil(altura * 0.35); ch < altura; ch++) {
		const cw = Math.round(ch * PROPORCAO_DA_CARTA)
		if (cw >= largura) break
		for (let y0 = 0; y0 < altura - ch; y0++) {
			const y1 = y0 + ch
			let melhor = -1, melhorX = 0
			for (let x0 = 0; x0 < largura - cw; x0++) {
				const esquerda = colunas[y1 * largura + x0] - colunas[y0 * largura + x0]
				const direita = colunas[y1 * largura + x0 + cw] - colunas[y0 * largura + x0 + cw]
				const topo = linhas[y0 * L + x0 + cw] - linhas[y0 * L + x0]
				const base = linhas[y1 * L + x0 + cw] - linhas[y1 * L + x0]
				// As 4 bordas precisam aparecer: vale a mais fraca de cada par.
				const pontos = Math.min(esquerda, direita) / ch + Math.min(topo, base) / cw
				if (pontos > melhor) { melhor = pontos; melhorX = x0 }
			}
			if (melhor >= 0) achados.push({ x0: melhorX / largura, y0: y0 / altura, x1: (melhorX + cw) / largura, y1: y1 / altura, pontos: melhor })
		}
	}
	achados.sort((a, b) => b.pontos - a.pontos)
	// Retângulos quase iguais contam uma vez só.
	const escolhidos = []
	for (const r of achados) {
		if (escolhidos.every(q => Math.abs(r.x0 - q.x0) + Math.abs(r.y0 - q.y0) + Math.abs(r.x1 - q.x1) + Math.abs(r.y1 - q.y1) > 0.12)) escolhidos.push(r)
		if (escolhidos.length >= quantos) break
	}
	return escolhidos
}

// Banco de assinaturas: Int8Array (uma assinatura fina por carta, na ordem de dados.sets) → vetores prontos para comparar.
function montarBancoDeAssinaturas(bytes, escala, cartas) {
	const tamFina = GRADE.largura * GRADE.altura * 3
	const tamGrossa = GRADE_GROSSA.largura * GRADE_GROSSA.altura * 3
	const n = cartas.length
	const fina = new Float32Array(n * tamFina)
	const grossa = new Float32Array(n * tamGrossa)
	const valida = new Uint8Array(n)
	for (let i = 0; i < n; i++) {
		const vetor = new Float32Array(tamFina)
		let vazio = true
		for (let j = 0; j < tamFina; j++) { vetor[j] = bytes[i * tamFina + j] / escala; if (vetor[j]) vazio = false }
		if (vazio) continue   // carta sem imagem
		valida[i] = 1
		fina.set(normalizarAssinatura(vetor), i * tamFina)
		grossa.set(assinaturaGrossa(vetor), i * tamGrossa)
	}
	return { n, fina, grossa, valida, cartas, tamFina, tamGrossa }
}

// Lista das cartas na ordem do banco: [{ set, carta }].
function cartasEmOrdem() {
	const lista = []
	for (const set of dados.sets) for (const carta of set.cartas) lista.push({ set, carta })
	return lista
}

// Marca curta da lista de cartas (o banco só vale para a mesma lista, na mesma ordem).
function marcaDasCartas(lista) {
	let h = 5381
	for (const { set, carta } of lista) for (const ch of `${set.id}|${carta.n};`) h = (h * 33 + ch.charCodeAt(0)) >>> 0
	return `${lista.length}-${h.toString(16)}`
}

// Imagem da câmera (RGBA) → cartas mais parecidas: [{ set, carta, indice, pontos }], da mais para a menos parecida.
// `pontos` vai de -1 a 1 (1 = idêntica); acima de ~0,6 é quase sempre a carta certa. Também devolve a
// região (em frações da imagem) onde a carta foi achada, para o leitor de texto ler o número dali.
function reconhecerPorImagem(pixels, largura, altura, banco, limite = 5) {
	// Os contornos são procurados numa versão com metade do tamanho (bem mais rápido, e basta).
	const lc = Math.floor(largura / 2), ac = Math.floor(altura / 2)
	const cinza = new Float32Array(lc * ac)
	for (let y = 0; y < ac; y++) {
		for (let x = 0; x < lc; x++) {
			let s = 0
			for (const [px, py] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
				const i = ((y * 2 + py) * largura + x * 2 + px) * 4
				s += pixels[i] * 3 + pixels[i + 1] * 6 + pixels[i + 2]
			}
			cinza[y * lc + x] = s / 40
		}
	}
	const integral = imagemIntegral(pixels, largura, altura)
	// Janelas: cada contorno achado, um pouco menor (capa protetora em volta) e um pouco deslocado.
	const janelas = []
	const regiaoDaJanela = (r, tamanho, dx, dy) => {
		const cx = (r.x0 + r.x1) / 2 + dx * (r.x1 - r.x0), cy = (r.y0 + r.y1) / 2 + dy * (r.y1 - r.y0)
		const meiaL = (r.x1 - r.x0) / 2 * tamanho * (1 - 2 * MARGEM_DA_CARTA)
		const meiaA = (r.y1 - r.y0) / 2 * tamanho * (1 - 2 * MARGEM_DA_CARTA)
		return { x0: Math.max(0, cx - meiaL), y0: Math.max(0, cy - meiaA), x1: Math.min(1, cx + meiaL), y1: Math.min(1, cy + meiaA) }
	}
	const assinaturaDaJanela = regiao => normalizarAssinatura(gradeDaRegiao(integral, regiao.x0 * largura, regiao.y0 * altura, regiao.x1 * largura, regiao.y1 * altura))
	const centrais = []
	for (const r of acharContornos(cinza, lc, ac, 4)) {
		for (const tamanho of [1, 0.93, 0.86, 0.8]) {
			centrais.push(assinaturaGrossa(assinaturaDaJanela(regiaoDaJanela(r, tamanho, 0, 0))))
			for (const dx of [-0.03, 0, 0.03]) {
				for (const dy of [-0.03, 0, 0.03]) {
					const regiao = regiaoDaJanela(r, tamanho, dx, dy)
					janelas.push({ regiao, fina: assinaturaDaJanela(regiao) })
				}
			}
		}
	}
	if (!janelas.length) return []
	// 1ª passada (rápida): nota grossa de cada carta nas janelas centradas; ficam as 60 melhores cartas.
	const { n, tamFina, tamGrossa, valida } = banco
	const notaGrossa = new Float32Array(n).fill(-2)
	for (const q of centrais) {
		for (let i = 0; i < n; i++) {
			if (!valida[i]) continue
			let s = 0
			const base = i * tamGrossa
			for (let k = 0; k < tamGrossa; k++) s += q[k] * banco.grossa[base + k]
			if (s > notaGrossa[i]) notaGrossa[i] = s
		}
	}
	const candidatas = [...notaGrossa.keys()].filter(i => valida[i]).sort((a, b) => notaGrossa[b] - notaGrossa[a]).slice(0, 60)
	// 2ª passada (fina): essas cartas em todas as janelas (centradas e deslocadas).
	const resultado = candidatas.map(i => {
		let pontos = -2, regiao = null
		for (const janela of janelas) {
			const q = janela.fina
			let s = 0
			const base = i * tamFina
			for (let k = 0; k < tamFina; k++) s += q[k] * banco.fina[base + k]
			if (s > pontos) { pontos = s; regiao = janela.regiao }
		}
		return { ...banco.cartas[i], indice: i, pontos, regiao }
	})
	resultado.sort((a, b) => b.pontos - a.pontos)
	return resultado.slice(0, limite)
}

// Quão parecidas são duas cartas do banco (1 = mesma arte, como reimpressões).
function semelhancaNoBanco(banco, a, b) {
	let s = 0
	for (let k = 0; k < banco.tamFina; k++) s += banco.fina[a * banco.tamFina + k] * banco.fina[b * banco.tamFina + k]
	return s
}

// Decide se o resultado da imagem é confiável: a melhor carta precisa ter nota boa e ficar à frente das
// outras artes (cartas com a mesma arte, as "gêmeas", não contam: quem desempata é o número lido).
// Devolve { carta, gemeas } (gemeas inclui a própria carta) ou null.
const NOTA_MINIMA_IMAGEM = 0.6
const FOLGA_MINIMA_IMAGEM = 0.04
function escolherPelaImagem(resultado, banco) {
	const [melhor] = resultado
	if (!melhor || melhor.pontos < NOTA_MINIMA_IMAGEM) return null
	const gemeas = resultado.filter(r => r === melhor || semelhancaNoBanco(banco, r.indice, melhor.indice) > 0.9)
	const rival = resultado.find(r => !gemeas.includes(r))
	if (rival && melhor.pontos - rival.pontos < FOLGA_MINIMA_IMAGEM) return null
	return { carta: melhor, gemeas }
}
