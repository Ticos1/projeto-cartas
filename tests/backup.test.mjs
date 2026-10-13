import test from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, dadosDeTeste } from './ambiente.mjs'

const limpar = (amb, backup) => amb.avaliar(`JSON.parse(JSON.stringify(limparBackup(${JSON.stringify(backup)})))`)

test('backup: só passam sets e números que existem na lista de cartas', () => {
	const amb = criarAmbiente({ dados: dadosDeTeste })
	const r = limpar(amb, { cartas: { sv01: ['001', '057', '999', 57, '001'], inventado: ['001'], sv02: 'x' } })
	assert.deepEqual(r.cartas, { sv01: ['001', '057'] })
	assert.equal(r.descartadas, 4) // '999', 57 (número sem zeros não existe), set inventado e lista estragada
})

test('backup: quantidades só de cartas aceitas, de 2 a 99', () => {
	const amb = criarAmbiente({ dados: dadosDeTeste })
	const r = limpar(amb, {
		cartas: { sv01: ['001', '002', '057'] },
		quantidades: { sv01: { '001': 3, '002': 1000, '057': 1, '181': 4 }, inventado: { '001': 5 } },
	})
	assert.deepEqual(r.quantidades, { sv01: { '001': 3, '002': 99 } })
})

test('backup: desejos e decks são filtrados; ausentes continuam ausentes', () => {
	const amb = criarAmbiente({ dados: dadosDeTeste })
	const r = limpar(amb, {
		cartas: {},
		desejos: { sv01: ['199', '500'] },
		decks: {
			abcd1234: { nome: 'Meu deck', criado: 1, cartas: ['sv01|057|2', 'falso|001|4', 'sv01|999|1'] },
			'../ruim': { nome: 'x', cartas: [] },
		},
	})
	assert.deepEqual(r.desejos, { sv01: ['199'] })
	assert.deepEqual(r.decks, { abcd1234: { nome: 'Meu deck', criado: 1, cartas: ['sv01|057|2'] } })
	assert.equal(r.descartadas, 4)
	const semExtras = limpar(amb, { cartas: { sv01: ['001'] } })
	assert.equal(semExtras.desejos, undefined)
	assert.equal(semExtras.decks, undefined)
})

test('backup: formatos errados são recusados', () => {
	const amb = criarAmbiente({ dados: dadosDeTeste })
	for (const errado of [null, [], 'texto', {}, { cartas: [] }, { cartas: 'x' }]) {
		assert.throws(() => amb.avaliar(`limparBackup(${JSON.stringify(errado)})`), `deveria recusar ${JSON.stringify(errado)}`)
	}
})

test('backup: há um limite de tamanho do arquivo', () => {
	const amb = criarAmbiente({ dados: dadosDeTeste })
	assert.ok(amb.avaliar('BACKUP_TAMANHO_MAXIMO') <= 10 * 1024 * 1024)
})
