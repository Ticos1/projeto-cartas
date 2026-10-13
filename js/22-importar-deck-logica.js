'use strict'

/* ---------- Importar lista de deck: lógica (sem tela, para poder testar) ---------- */
// Entende listas no formato do Pokémon TCG Live ("4 Pikachu ex SVI 57") e a lista que o próprio
// app copia. Cada linha vira (quantidade, nome, sigla do set, número). A carta é achada pela
// sigla + número; se não achar, tenta pelo nome.

// "057" e "57" são o mesmo número; "TG01" e "TG1" também.
function chaveDeNumero(n) {
	const m = /^([A-Za-z]*)0*(\d+)$/.exec(String(n).trim())
	return m ? m[1].toUpperCase() + parseInt(m[2], 10) : String(n).trim().toUpperCase()
}

// Devolve { qtd, nome, sigla, numero, bruto } ou null (cabeçalhos como "Pokémon: 12" e linhas vazias).
function lerLinhaDeDeck(linha) {
	const texto = linha.replace(/^[\s*•\-–]+/, '').trim()
	const m = /^(\d{1,2})\s*x?\s+(.+)$/i.exec(texto)
	if (!m) return null
	const qtd = parseInt(m[1], 10)
	const resto = m[2].trim()
	if (!qtd) return null
	// "Nome SIGLA 57" ou "Nome SIGLA 57/198"; a sigla pode ter ":" (ex.: BRS:TG).
	const c = /^(.*?)\s+([A-Za-z0-9.]{2,8}(?::[A-Za-z0-9]+)?)\s+([A-Za-z]*\d+)(?:\s*\/\s*[A-Za-z]*\d+)?$/.exec(resto)
	if (c) return { qtd, nome: c[1].trim(), sigla: c[2], numero: c[3], bruto: resto }
	return { qtd, nome: resto, sigla: '', numero: '', bruto: resto }
}

const baseDaSigla = sigla => String(sigla).split(':')[0].toUpperCase()

// Acha a carta do app para uma linha. Prefere sigla + número; depois o nome (cartas que o usuário já tem primeiro, depois as mais novas).
function acharCartaDaLinha(item) {
	if (item.sigla && item.numero) {
		const chave = chaveDeNumero(item.numero)
		const exata = dados.sets.filter(s => (s.sigla || s.id).toUpperCase() === item.sigla.toUpperCase())
		const base = dados.sets.filter(s => s.sigla && baseDaSigla(s.sigla) === baseDaSigla(item.sigla))
		for (const set of [...exata, ...base]) {
			const carta = set.cartas.find(c => chaveDeNumero(c.n) === chave)
			if (carta) return { set, carta }
		}
	}
	// Pelo nome (o texto inteiro também vale: "Mega Pikachu 57" pode ter sido lido como nome + sigla).
	for (const candidato of [item.nome, item.bruto]) {
		const nome = semAcento(candidato || '')
		if (!nome) continue
		let melhor = null
		for (const set of dados.sets) {
			for (const carta of set.cartas) {
				if (semAcento(carta.nome) !== nome) continue
				const pontos = (tenho(set.id, carta.n) ? 1e6 : 0) + new Date(set.lancamento).getTime() / 1e8
				if (!melhor || pontos > melhor.pontos) melhor = { set, carta, pontos }
			}
		}
		if (melhor) return { set: melhor.set, carta: melhor.carta }
	}
	return null
}

// Texto colado → { cartas: { 'set|n': qtd }, total, naoAchadas: ['4 Nome SIGLA 57', ...] }
function importarListaDeDeck(texto) {
	const cartas = {}
	const naoAchadas = []
	let total = 0
	for (const linha of String(texto).split(/\r?\n/)) {
		const item = lerLinhaDeDeck(linha)
		if (!item) continue
		total += item.qtd
		const achada = acharCartaDaLinha(item)
		if (!achada) { naoAchadas.push(linha.trim()); continue }
		const chave = `${achada.set.id}|${achada.carta.n}`
		cartas[chave] = Math.min(60, (cartas[chave] || 0) + item.qtd)
	}
	return { cartas, total, naoAchadas }
}
