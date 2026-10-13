// Compara duas versões do data/cartas.json (ignorando a data de geração) e resume o que mudou.
// Usado por gerar_dados.mjs e testado em tests/scripts.test.mjs.

const semData = dados => JSON.stringify({ ...dados, geradoEm: undefined })

export function compararDados(antigo, novo) {
	const resultado = { iguais: !!antigo && semData(antigo) === semData(novo), setsNovos: [], setsRemovidos: [], cartasNovas: 0, cartasRemovidas: 0, setsComCartasNovas: [] }
	if (!antigo) return resultado
	const antigos = new Map(antigo.sets.map(s => [s.id, s]))
	const novos = new Map(novo.sets.map(s => [s.id, s]))
	for (const set of novo.sets) {
		const velho = antigos.get(set.id)
		if (!velho) { resultado.setsNovos.push({ id: set.id, nome: set.nome, cartas: set.cartas.length }); resultado.cartasNovas += set.cartas.length; continue }
		const numeros = new Set(velho.cartas.map(c => c.n))
		const adicionadas = set.cartas.filter(c => !numeros.has(c.n)).length
		const sumiram = velho.cartas.filter(c => !set.cartas.some(x => x.n === c.n)).length
		resultado.cartasNovas += adicionadas
		resultado.cartasRemovidas += sumiram
		if (adicionadas) resultado.setsComCartasNovas.push({ id: set.id, nome: set.nome, cartas: adicionadas })
	}
	for (const velho of antigo.sets) if (!novos.has(velho.id)) { resultado.setsRemovidos.push({ id: velho.id, nome: velho.nome, cartas: velho.cartas.length }); resultado.cartasRemovidas += velho.cartas.length }
	return resultado
}

export function descreverMudancas(m) {
	if (m.iguais) return 'Nenhuma mudança nas cartas.'
	const linhas = []
	if (m.setsNovos.length) linhas.push(`Coleções novas (${m.setsNovos.length}):\n${m.setsNovos.map(s => `- ${s.nome} (\`${s.id}\`): ${s.cartas} cartas`).join('\n')}`)
	if (m.setsComCartasNovas.length) linhas.push(`Cartas novas em coleções que já existiam:\n${m.setsComCartasNovas.map(s => `- ${s.nome} (\`${s.id}\`): +${s.cartas}`).join('\n')}`)
	if (m.setsRemovidos.length) linhas.push(`Coleções que saíram (${m.setsRemovidos.length}):\n${m.setsRemovidos.map(s => `- ${s.nome} (\`${s.id}\`)`).join('\n')}`)
	if (m.cartasRemovidas && !m.setsRemovidos.length) linhas.push(`Cartas que saíram de coleções: ${m.cartasRemovidas}`)
	if (!linhas.length) linhas.push('Textos, raridades ou tipos de cartas foram corrigidos na fonte (TCGdex).')
	return `Total de cartas novas: ${m.cartasNovas}\n\n${linhas.join('\n\n')}`
}
