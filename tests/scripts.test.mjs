import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { compararDados, descreverMudancas } from '../scripts/comparar_dados.mjs'
import { trocarVersao, versaoDe, subirVersao } from '../scripts/subir_versao.mjs'

const set = (id, ns) => ({ id, nome: `Set ${id}`, cartas: ns.map(n => ({ n, nome: `Carta ${n}` })) })
const base = { geradoEm: '2026-01-01', series: [], sets: [set('a', ['001', '002']), set('b', ['001'])] }

test('só a data mudou: considera iguais', () => {
	const r = compararDados(base, { ...base, geradoEm: '2026-02-02' })
	assert.equal(r.iguais, true)
	assert.equal(descreverMudancas(r), 'Nenhuma mudança nas cartas.')
})

test('set novo e cartas novas são contados e descritos', () => {
	const novo = { ...base, geradoEm: 'x', sets: [set('a', ['001', '002', '003']), set('b', ['001']), set('c', ['001', '002'])] }
	const r = compararDados(base, novo)
	assert.equal(r.iguais, false)
	assert.deepEqual(r.setsNovos, [{ id: 'c', nome: 'Set c', cartas: 2 }])
	assert.deepEqual(r.setsComCartasNovas, [{ id: 'a', nome: 'Set a', cartas: 1 }])
	assert.equal(r.cartasNovas, 3)
	const texto = descreverMudancas(r)
	assert.match(texto, /Total de cartas novas: 3/)
	assert.match(texto, /Coleções novas \(1\)/)
	assert.match(texto, /Set a.*\+1/)
})

test('set que saiu é avisado', () => {
	const r = compararDados(base, { ...base, sets: [base.sets[0]] })
	assert.deepEqual(r.setsRemovidos, [{ id: 'b', nome: 'Set b', cartas: 1 }])
	assert.match(descreverMudancas(r), /Coleções que saíram/)
})

test('sem arquivo antigo (primeira geração) não quebra', () => {
	assert.equal(compararDados(null, base).iguais, false)
})

test('troca o número da versão no sw.js e no 00-base.js', () => {
	const sw = trocarVersao("const VERSAO = 'v7'\nresto", /(const VERSAO = ')v(\d+)(')/, 8)
	assert.equal(sw, "const VERSAO = 'v8'\nresto")
	assert.throws(() => versaoDe('sem versão', /(const VERSAO = ')v(\d+)(')/))
})

test('subirVersao mexe nos dois arquivos e fica com a maior versão + 1', () => {
	const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'versao-'))
	fs.mkdirSync(path.join(pasta, 'js'))
	fs.writeFileSync(path.join(pasta, 'sw.js'), "const VERSAO = 'v43'\n")
	fs.writeFileSync(path.join(pasta, 'js/00-base.js'), "const VERSAO_APP = 'v41'\n")
	const nova = subirVersao(new URL(`file://${pasta}/`))
	assert.equal(nova, 44)
	assert.equal(fs.readFileSync(path.join(pasta, 'sw.js'), 'utf8'), "const VERSAO = 'v44'\n")
	assert.equal(fs.readFileSync(path.join(pasta, 'js/00-base.js'), 'utf8'), "const VERSAO_APP = 'v44'\n")
})

test('o repositório está com as duas versões iguais (sw.js e js/00-base.js)', () => {
	const sw = /const VERSAO = 'v(\d+)'/.exec(fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8'))[1]
	const base = /const VERSAO_APP = 'v(\d+)'/.exec(fs.readFileSync(new URL('../js/00-base.js', import.meta.url), 'utf8'))[1]
	assert.equal(sw, base)
})
