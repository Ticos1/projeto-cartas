'use strict'

/* ---------- Trocas: lógica (sem tela, para poder testar) ---------- */
// "Tenho para trocar" = cópias que passam de 1 de cada carta (ver cartasRepetidas).
// "Procuro" = cartas da lista de desejos que ainda não tenho.
function cartasProcuradas() {
	const itens = []
	for (const set of dados.sets) {
		for (const carta of set.cartas) {
			if (desejada(set.id, carta.n) && !tenho(set.id, carta.n)) itens.push({ set, carta })
		}
	}
	return itens
}

// Texto para mandar em grupos de troca (WhatsApp, Discord...). `sobrando`: [{ set, carta, extras }], `procuro`: [{ set, carta }].
function textoDeTroca(sobrando, procuro) {
	const linha = (qtd, set, carta) => `${qtd}x ${carta.nome} · ${set.sigla || set.nome} ${numeroExibido(set, carta)}`
	const partes = ['🔁 Trocas · Ticards']
	if (sobrando.length) {
		const total = sobrando.reduce((soma, i) => soma + i.extras, 0)
		partes.push(`📤 Tenho para trocar (${total}):\n${sobrando.map(i => linha(i.extras, i.set, i.carta)).join('\n')}`)
	}
	if (procuro.length) {
		partes.push(`📥 Procuro (${procuro.length}):\n${procuro.map(i => linha(1, i.set, i.carta)).join('\n')}`)
	}
	if (partes.length === 1) partes.push('Nada para trocar ainda.')
	return partes.join('\n\n') + '\n'
}
