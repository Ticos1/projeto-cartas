import test from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, dadosDeTeste, cartasReais } from './ambiente.mjs'

const amb = criarAmbiente({ dados: dadosDeTeste })
amb.avaliar('nuvem = null')
const importar = texto => JSON.parse(JSON.stringify((amb.definirDados(dadosDeTeste), amb.avaliar(`importarListaDeDeck(${JSON.stringify(texto)})`))))
const linha = texto => JSON.parse(JSON.stringify(amb.avaliar(`lerLinhaDeDeck(${JSON.stringify(texto)})`)))

test('lê linhas no formato do Pokémon TCG Live', () => {
	assert.deepEqual(linha('4 Pikachu ex SVI 57'), { qtd: 4, nome: 'Pikachu ex', sigla: 'SVI', numero: '57', bruto: 'Pikachu ex SVI 57' })
	assert.deepEqual(linha('* 2 Flareon BRS:TG TG01'), { qtd: 2, nome: 'Flareon', sigla: 'BRS:TG', numero: 'TG01', bruto: 'Flareon BRS:TG TG01' })
	assert.equal(linha('3x Mewtwo ex SVI 002/198').numero, '002')
})

test('cabeçalhos, totais e linhas vazias são ignorados', () => {
	for (const l of ['Pokémon: 12', 'Trainer (30)', 'Energy: 18', 'Total Cards: 60', '', '   ', 'Meu deck']) assert.equal(linha(l), null)
})

test('acha a carta pela sigla e pelo número, com ou sem zeros à esquerda', () => {
	const r = importar('4 Pikachu ex SVI 57\n2 Pikachu PAL 057\n1 Flareon BRS TG1\n3 Basic Fire Energy SVE 2')
	assert.deepEqual(r.cartas, { 'sv01|057': 4, 'sv02|057': 2, 'swsh9tg|TG01': 1, 'sve|002': 3 })
	assert.deepEqual(r.naoAchadas, [])
	assert.equal(r.total, 10)
})

test('a lista que o próprio app copia pode ser importada de volta', () => {
	const texto = 'Meu deck\n\nPokémon: 4\n4 Pikachu SVI 1\n\nTreinador: 2\n2 Ordens do Chefe SVI 181\n\nTotal de cartas: 6\n'
	const r = importar(texto)
	assert.deepEqual(r.cartas, { 'sv01|001': 4, 'sv01|181': 2 })
})

test('sem sigla ou com sigla errada, tenta pelo nome (sem acento e sem maiúsculas)', () => {
	const r = importar('1 ordens do chefe\n2 Bulbasaur XXX 99')
	assert.deepEqual(r.cartas, { 'sv01|181': 1, 'sv02|001': 2 })
})

test('pelo nome, prefere a carta que o usuário já tem; senão a mais nova', () => {
	assert.deepEqual(importar('1 Pikachu').cartas, { 'sv02|057': 1 })
	amb.avaliar("alternar('sv01', '001')")
	assert.deepEqual(importar('1 Pikachu').cartas, { 'sv01|001': 1 })
})

test('cartas desconhecidas voltam na lista de não achadas, sem derrubar o resto', () => {
	const r = importar('4 Pikachu ex SVI 57\n1 Carta Que Não Existe ZZZ 999')
	assert.deepEqual(r.cartas, { 'sv01|057': 4 })
	assert.deepEqual(r.naoAchadas, ['1 Carta Que Não Existe ZZZ 999'])
})

test('a mesma carta em duas linhas soma, limitada a 60', () => {
	assert.deepEqual(importar('2 Pikachu ex SVI 57\n3 Pikachu ex SVI 057').cartas, { 'sv01|057': 5 })
	assert.deepEqual(importar('40 Pikachu ex SVI 57\n40 Pikachu ex SVI 57').cartas, { 'sv01|057': 60 })
})

test('com os dados reais: uma lista de Escarlate e Violeta sai inteira', () => {
	const real = criarAmbiente({ dados: cartasReais })
	real.avaliar('nuvem = null')
	const r = JSON.parse(JSON.stringify(real.avaliar(`importarListaDeDeck(${JSON.stringify('4 Pikachu ex SVI 57\n4 Nest Ball SVI 181\n12 Basic Lightning Energy SVE 4')})`)))
	assert.equal(r.naoAchadas.length, 0)
	assert.equal(Object.keys(r.cartas).length, 3)
})

const compartilhado = recebido => JSON.parse(JSON.stringify(amb.avaliar(`entenderCompartilhado(${JSON.stringify(recebido)})`)))

test('compartilhado: um backup do app (.json) vai para a importação de backup', () => {
	const backup = JSON.stringify({ app: 'minha-colecao-tcg', versao: 2, cartas: { sv01: ['001'] } })
	assert.deepEqual(compartilhado({ arquivos: [{ nome: 'colecao-tcg-2026-10-14.json', conteudo: backup }] }), { tipo: 'backup', texto: backup })
})

test('compartilhado: um arquivo de texto com a lista vira deck, com o nome do arquivo', () => {
	const r = compartilhado({ arquivos: [{ nome: 'deck_do_pikachu.txt', conteudo: 'Pokémon: 4\n4 Pikachu ex SVI 57' }] })
	assert.equal(r.tipo, 'deck')
	assert.equal(r.nome, 'deck do pikachu')
	assert.match(r.texto, /4 Pikachu ex SVI 57/)
})

test('compartilhado: mensagem de texto (WhatsApp) com a lista vira deck, com o título', () => {
	assert.deepEqual(compartilhado({ titulo: 'Deck do João', texto: '4 Pikachu ex SVI 57\n2 Ordens do Chefe SVI 181' }), { tipo: 'deck', texto: '4 Pikachu ex SVI 57\n2 Ordens do Chefe SVI 181', nome: 'Deck do João' })
})

test('compartilhado: texto sem cartas, JSON que não é backup ou nada', () => {
	assert.deepEqual(compartilhado({ texto: 'oi, tudo bem?' }), { tipo: 'nada' })
	assert.deepEqual(compartilhado({ arquivos: [{ nome: 'x.json', conteudo: '{"outra":"coisa"}' }] }), { tipo: 'nada' })
	assert.deepEqual(compartilhado({ arquivos: [{ nome: 'x.json', conteudo: '{quebrado' }] }), { tipo: 'nada' })
	assert.deepEqual(compartilhado({}), { tipo: 'nada' })
})
