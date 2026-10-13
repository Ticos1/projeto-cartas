import test from 'node:test'
import assert from 'node:assert/strict'
import { cartasReais as dados } from './ambiente.mjs'

// Confere a lista real de cartas (data/cartas.json). Também protege a atualização automática dos dados.
test('há séries, sets e cartas', () => {
	assert.ok(dados.series.length >= 3)
	assert.ok(dados.sets.length >= 50)
	assert.ok(dados.sets.reduce((soma, s) => soma + s.cartas.length, 0) > 8000)
})

test('todo set tem id único, série existente, nome, data e cartas', () => {
	const ids = new Set()
	const series = new Set(dados.series.map(s => s.id))
	for (const set of dados.sets) {
		assert.ok(!ids.has(set.id), `id repetido: ${set.id}`)
		ids.add(set.id)
		assert.ok(series.has(set.serie), `${set.id}: série ${set.serie} não existe`)
		assert.ok(set.nome, `${set.id}: sem nome`)
		assert.match(set.lancamento, /^\d{4}-\d{2}-\d{2}$/, `${set.id}: data inválida`)
		assert.ok(set.cartas.length > 0, `${set.id}: sem cartas`)
	}
})

test('dentro de um set, o número de cada carta é único e todas têm nome e tipo', () => {
	for (const set of dados.sets) {
		const numeros = new Set()
		for (const carta of set.cartas) {
			assert.ok(!numeros.has(carta.n), `${set.id}: número repetido ${carta.n}`)
			numeros.add(carta.n)
			assert.ok(carta.nome, `${set.id} ${carta.n}: sem nome`)
			assert.ok(['P', 'T', 'E', 'EB'].includes(carta.t), `${set.id} ${carta.n}: tipo ${carta.t}`)
		}
	}
})

test('os ids de set cabem nas regras do app (usados como chave na nuvem e no deck "set|número")', () => {
	for (const set of dados.sets) {
		assert.match(set.id, /^[a-z0-9.-]+$/i, `id estranho: ${set.id}`)
		for (const carta of set.cartas) assert.ok(!carta.n.includes('|'), `${set.id}: número com "|"`)
	}
})
