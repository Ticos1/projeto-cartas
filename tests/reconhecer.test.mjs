import test from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, dadosDeTeste } from './ambiente.mjs'

const amb = criarAmbiente({ dados: dadosDeTeste })
const numeros = texto => JSON.parse(JSON.stringify(amb.avaliar(`numerosNoTexto(${JSON.stringify(texto)})`)))
const reconhecer = texto => JSON.parse(JSON.stringify(amb.avaliar(`reconhecerCartas(${JSON.stringify(texto)}).map(r => [r.set.id, r.carta.n, r.pontos])`)))

test('acha números no formato impresso na carta', () => {
	assert.deepEqual(numeros('Illus. Fulano 057/198 SVI'), [{ numero: '057', total: '198' }])
	assert.deepEqual(numeros('TG01/TG30'), [{ numero: 'TG01', total: 'TG30' }])
	assert.deepEqual(numeros('sem número nenhum'), [])
})

test('corrige letras que o OCR confunde com dígitos', () => {
	assert.deepEqual(numeros('O57/I98'), [{ numero: '057', total: '198' }])
	assert.deepEqual(numeros('057 | 198'), [{ numero: '057', total: '198' }])
})

test('número + total do set é o sinal mais forte', () => {
	const r = reconhecer('lixo 057/198 mais lixo')
	assert.deepEqual(r[0], ['sv01', '057', 10])
})

test('o nome desempata entre sets com o mesmo número', () => {
	// 057 existe no sv01 (Pikachu ex) e no sv02 (Pikachu); o total 193 é o do sv02.
	assert.deepEqual(reconhecer('Pikachu 057/193')[0].slice(0, 2), ['sv02', '057'])
	assert.deepEqual(reconhecer('Pikachu ex 057/198')[0].slice(0, 2), ['sv01', '057'])
})

test('só pelo nome também sugere cartas (mais novas primeiro)', () => {
	const r = reconhecer('Bulbasaur HP 70')
	assert.deepEqual(r.map(x => x.slice(0, 2)), [['sv02', '001']])
})

test('texto sem relação nenhuma não sugere nada', () => {
	assert.deepEqual(reconhecer('abc xyz 12'), [])
	assert.deepEqual(reconhecer(''), [])
})
