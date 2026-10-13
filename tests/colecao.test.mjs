import test from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, dadosDeTeste } from './ambiente.mjs'

function novo() {
	const amb = criarAmbiente({ dados: dadosDeTeste })
	amb.avaliar('nuvem = { chamadas: [], quantidadeNaNuvem(set, n, q) { this.chamadas.push([set, n, q]) } }')
	return amb
}

test('marcar e desmarcar uma carta', () => {
	const amb = novo()
	assert.equal(amb.avaliar("alternar('sv01', '001')"), true)
	assert.equal(amb.avaliar("tenho('sv01', '001')"), true)
	assert.equal(amb.avaliar("quantidadeDe('sv01', '001')"), 1)
	assert.equal(amb.avaliar("alternar('sv01', '001')"), false)
	assert.equal(amb.avaliar("quantidadeDe('sv01', '001')"), 0)
})

test('quantidade: cópias extras guardam o número, desmarcar zera tudo', () => {
	const amb = novo()
	amb.avaliar("definirQuantidade('sv01', '001', 3)")
	assert.equal(amb.avaliar("quantidadeDe('sv01', '001')"), 3)
	assert.equal(amb.avaliar("tenho('sv01', '001')"), true)
	assert.deepEqual(amb.avaliar("JSON.parse(JSON.stringify(quantidadesComoObjeto()))"), { sv01: { '001': 3 } })
	amb.avaliar("alternar('sv01', '001')") // tem → não tem
	assert.equal(amb.avaliar("quantidadeDe('sv01', '001')"), 0)
	assert.deepEqual(amb.avaliar("JSON.parse(JSON.stringify(quantidadesComoObjeto()))"), {})
})

test('quantidade 1 não entra na tabela de quantidades; 0 tira da coleção; limite de 99', () => {
	const amb = novo()
	amb.avaliar("definirQuantidade('sv01', '001', 2)")
	amb.avaliar("definirQuantidade('sv01', '001', 1)")
	assert.deepEqual(amb.avaliar("JSON.parse(JSON.stringify(quantidadesComoObjeto()))"), {})
	assert.equal(amb.avaliar("quantidadeDe('sv01', '001')"), 1)
	amb.avaliar("definirQuantidade('sv01', '001', 0)")
	assert.equal(amb.avaliar("tenho('sv01', '001')"), false)
	assert.equal(amb.avaliar("definirQuantidade('sv01', '001', 500)"), 99)
	assert.equal(amb.avaliar("definirQuantidade('sv01', '001', -4)"), 0)
	assert.equal(amb.avaliar("definirQuantidade('sv01', '001', 'abc')"), 0)
})

test('cada mudança vai para a nuvem com a quantidade certa', () => {
	const amb = novo()
	amb.avaliar("definirQuantidade('sv01', '001', 2)")
	amb.avaliar("alternar('sv01', '002')")
	amb.avaliar("definirQuantidade('sv01', '001', 0)")
	assert.deepEqual(JSON.parse(JSON.stringify(amb.avaliar('nuvem.chamadas'))), [['sv01', '001', 2], ['sv01', '002', 1], ['sv01', '001', 0]])
})

test('salvar e carregar de novo mantém cartas e quantidades', () => {
	const amb = novo()
	amb.avaliar("definirQuantidade('sv01', '001', 4); alternar('sv02', '057')")
	amb.avaliar('colecao = {}; quantidades = {}; carregarColecao()')
	assert.equal(amb.avaliar("quantidadeDe('sv01', '001')"), 4)
	assert.equal(amb.avaliar("quantidadeDe('sv02', '057')"), 1)
})

test('dados antigos (sem quantidades) e dados estragados carregam sem quebrar', () => {
	const amb = novo()
	amb.armazenamento.set('colecao-tcg', JSON.stringify({ versao: 1, cartas: { sv01: ['001', '002'] } }))
	amb.avaliar('carregarColecao()')
	assert.equal(amb.avaliar("quantidadeDe('sv01', '002')"), 1)
	amb.armazenamento.set('colecao-tcg', '{isso não é json')
	amb.avaliar('carregarColecao()')
	assert.equal(amb.avaliar("tenho('sv01', '001')"), false)
})

test('quantidades inválidas ou de cartas que não tenho são ignoradas', () => {
	const amb = novo()
	const lido = amb.avaliar(`JSON.parse(JSON.stringify((() => {
		const r = lerColecaoSalva({ cartas: { a: ['1', '2'] }, quantidades: { a: { '1': 3, '2': 1, '3': 5, '4': 'x' }, b: { '1': 9 } } })
		return { cartas: Object.fromEntries(Object.entries(r.cartas).map(([k, v]) => [k, [...v]])), quantidades: r.quantidades }
	})()))`)
	assert.deepEqual(lido, { cartas: { a: ['1', '2'] }, quantidades: { a: { '1': 3 } } })
})

test('cartasRepetidas lista só o que passa de uma cópia', () => {
	const amb = novo()
	amb.avaliar("definirQuantidade('sv01', '001', 3); definirQuantidade('sv01', '002', 1); definirQuantidade('sv02', '057', 2)")
	const repetidas = amb.avaliar("cartasRepetidas().map(i => [i.set.id, i.carta.n, i.extras])")
	assert.deepEqual(JSON.parse(JSON.stringify(repetidas)), [['sv01', '001', 2], ['sv02', '057', 1]])
})
