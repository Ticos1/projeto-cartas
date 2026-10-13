import test from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, dadosDeTeste } from './ambiente.mjs'

function novo() {
	const amb = criarAmbiente({ dados: dadosDeTeste })
	amb.avaliar('nuvem = { quantidadeNaNuvem() {}, marcarDesejoNaNuvem() {} }')
	return amb
}

test('"procuro" são os desejos que ainda não tenho', () => {
	const amb = novo()
	amb.avaliar("alternarDesejo('sv01', '002'); alternarDesejo('sv01', '001'); alternar('sv01', '001')")
	const lista = amb.avaliar("cartasProcuradas().map(i => i.set.id + '|' + i.carta.n)")
	assert.deepEqual(JSON.parse(JSON.stringify(lista)), ['sv01|002'])
})

test('texto de troca tem as duas listas, com quantidades e sigla do set', () => {
	const amb = novo()
	amb.avaliar("definirQuantidade('sv01', '001', 3); alternarDesejo('sv01', '002')")
	const texto = amb.avaliar('textoDeTroca(cartasRepetidas(), cartasProcuradas())')
	assert.match(texto, /🔁 Trocas · Ticards/)
	assert.match(texto, /📤 Tenho para trocar \(2\):\n2x Pikachu · SVI 001\/198/)
	assert.match(texto, /📥 Procuro \(1\):\n1x Mewtwo ex · SVI 002\/198/)
})

test('texto de troca só com uma das listas, ou vazio', () => {
	const amb = novo()
	assert.match(amb.avaliar('textoDeTroca([], [])'), /Nada para trocar ainda/)
	amb.avaliar("definirQuantidade('sv02', '057', 2)")
	const texto = amb.avaliar('textoDeTroca(cartasRepetidas(), [])')
	assert.match(texto, /1x Pikachu · PAL 057\/193/)
	assert.doesNotMatch(texto, /Procuro/)
})
