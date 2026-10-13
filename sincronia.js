// Regras de junção da coleção local com a da nuvem (usadas no primeiro login em um aparelho).
// Ficam num arquivo à parte, sem Firebase, para poderem ser testadas.

// Junta duas tabelas { set: [números] } sem repetir.
export function juntar(a = {}, b = {}) {
	const resultado = {}
	for (const set of new Set([...Object.keys(a), ...Object.keys(b)])) {
		const numeros = [...new Set([...(a[set] || []), ...(b[set] || [])])]
		if (numeros.length) resultado[set] = numeros
	}
	return resultado
}

// Junta duas tabelas de quantidades ({ set: { número: qtd } }): fica a maior de cada carta.
export function juntarQuantidades(a = {}, b = {}) {
	const resultado = {}
	for (const set of new Set([...Object.keys(a), ...Object.keys(b)])) {
		const porNumero = {}
		for (const n of new Set([...Object.keys(a[set] || {}), ...Object.keys(b[set] || {})])) {
			porNumero[n] = Math.max(Number(a[set]?.[n]) || 0, Number(b[set]?.[n]) || 0)
		}
		if (Object.keys(porNumero).length) resultado[set] = porNumero
	}
	return resultado
}
