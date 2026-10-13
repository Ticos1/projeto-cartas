import test from 'node:test'
import assert from 'node:assert/strict'
import { juntar, juntarQuantidades } from '../sincronia.js'

test('juntar une as duas coleções sem repetir', () => {
	const r = juntar({ a: ['1', '2'], b: ['1'] }, { a: ['2', '3'], c: ['9'] })
	assert.deepEqual(Object.keys(r).sort(), ['a', 'b', 'c'])
	assert.deepEqual(r.a.sort(), ['1', '2', '3'])
})

test('juntar aceita um lado vazio ou ausente', () => {
	assert.deepEqual(juntar(undefined, { a: ['1'] }), { a: ['1'] })
	assert.deepEqual(juntar({ a: [] }, {}), {})
})

test('juntarQuantidades fica com a maior quantidade de cada carta', () => {
	const r = juntarQuantidades({ a: { '1': 3, '2': 2 } }, { a: { '1': 5 }, b: { '9': 2 } })
	assert.deepEqual(r, { a: { '1': 5, '2': 2 }, b: { '9': 2 } })
})

test('juntarQuantidades ignora valores que não são número', () => {
	assert.deepEqual(juntarQuantidades({ a: { '1': 'x' } }, { a: { '1': 2 } }), { a: { '1': 2 } })
	assert.deepEqual(juntarQuantidades(undefined, undefined), {})
})
