'use strict'

/* ---------- Escanear carta: lógica (sem câmera, para poder testar) ---------- */
// O leitor de texto (OCR) devolve o texto solto de uma foto da carta. Aqui procuramos nele o
// número impresso na carta ("025/094") e o nome, e cruzamos com a lista de cartas do app.

// Números no formato "025/094", "SV001/SV122", "TG01/TG30". O OCR confunde algumas letras com
// números (O→0, I/l→1), então arrumamos antes de procurar.
function numerosNoTexto(texto) {
	const achados = []
	// A barra às vezes sai como |, \ ou vírgula ("060,132"); a vírgula só conta entre dois números de 3 dígitos.
	const limpo = String(texto).replace(/[|\\]/g, '/').replace(/(\d{3}),(?=\d{3}\b)/g, '$1/')
	for (const m of limpo.matchAll(/([A-Za-z]{0,4}[0-9OoIl]{1,3})\s*\/\s*([A-Za-z]{0,4}[0-9OoIl]{2,3})/g)) {
		const arrumar = parte => parte.replace(/[Oo]/g, '0').replace(/[Il]/g, '1')
		const lado = parte => {
			// Prefixo de verdade tem 2 letras ou mais (TG, SV, SWSH); uma letra só (O, I, l) é dígito mal lido.
			const prefixo = /^[A-Za-z]{2,4}(?=[0-9OoIl])/.exec(parte)?.[0] || ''
			return prefixo.toUpperCase() + arrumar(parte.slice(prefixo.length))
		}
		achados.push({ numero: lado(m[1]), total: lado(m[2]) })
	}
	return achados
}

// Quanto o nome da carta aparece no texto lido (0 a 1): palavra por palavra, ignorando acento e maiúsculas.
function pontosDoNome(nome, textoSemAcento) {
	const palavras = semAcento(nome).split(/[^a-z0-9]+/).filter(p => p.length >= 3)
	if (!palavras.length) return 0
	return palavras.filter(p => textoSemAcento.includes(p)).length / palavras.length
}

// Devolve até `limite` cartas prováveis, da mais para a menos provável: [{ set, carta, pontos }].
function reconhecerCartas(texto, limite = 5) {
	const limpo = semAcento(String(texto))
	const numeros = numerosNoTexto(texto)
	const candidatos = []
	for (const set of dados.sets) {
		for (const carta of set.cartas) {
			let pontos = 0
			for (const { numero, total } of numeros) {
				if (chaveDeNumero(carta.n) !== chaveDeNumero(numero)) continue
				const totalNum = parseInt(total.replace(/^[A-Z]+/, ''), 10)
				// Número e total batendo com o set é o sinal mais forte; só o número já vale um pouco.
				pontos = Math.max(pontos, totalNum === set.oficiais ? 10 : 2)
			}
			const nome = pontosDoNome(carta.nome, limpo)
			if (nome === 1) pontos += 6
			else if (nome >= 0.5) pontos += 2
			// Sem número e sem o nome inteiro, não é candidata.
			if (pontos >= 6) candidatos.push({ set, carta, pontos })
		}
	}
	// Empate: coleções que o usuário acompanha (não escondidas) primeiro, depois as mais novas.
	const visivel = c => (escondidas.has(c.set.id) ? 0 : 1)
	candidatos.sort((a, b) => b.pontos - a.pontos || visivel(b) - visivel(a) || new Date(b.set.lancamento) - new Date(a.set.lancamento))
	return candidatos.slice(0, limite)
}
