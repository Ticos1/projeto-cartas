'use strict'

/* ---------- Coleção ---------- */
// colecao = quais cartas tenho. quantidades = só as cartas com 2 ou mais cópias: { idDoSet: { número: quantidade } }.
// Quem tem 1 cópia não aparece em quantidades (assim backups e versões antigas do app continuam valendo).
const MAX_COPIAS = 99
let quantidades = {}

// Lê o conteúdo salvo ({ cartas, quantidades }) e devolve as duas estruturas. Funciona com dados antigos (sem quantidades).
function lerColecaoSalva(salvo) {
	const cartas = {}
	const copias = {}
	for (const [set, numeros] of Object.entries(salvo?.cartas || {})) {
		if (Array.isArray(numeros)) cartas[set] = new Set(numeros.map(String))
	}
	for (const [set, porNumero] of Object.entries(salvo?.quantidades || {})) {
		if (!cartas[set] || typeof porNumero !== 'object' || !porNumero) continue
		for (const [n, q] of Object.entries(porNumero)) {
			const qtd = Math.min(MAX_COPIAS, Math.floor(Number(q)))
			if (cartas[set].has(n) && qtd >= 2) (copias[set] || (copias[set] = {}))[n] = qtd
		}
	}
	return { cartas, quantidades: copias }
}

function carregarColecao() {
	colecao = {}
	quantidades = {}
	try {
		const lido = lerColecaoSalva(JSON.parse(ler(CHAVE_COLECAO) || '{}'))
		colecao = lido.cartas
		quantidades = lido.quantidades
	} catch { /* coleção vazia */ }
}

function colecaoComoObjeto() {
	const cartas = {}
	for (const [set, numeros] of Object.entries(colecao)) {
		if (numeros.size) cartas[set] = [...numeros]
	}
	return cartas
}

function quantidadesComoObjeto() {
	const copias = {}
	for (const [set, porNumero] of Object.entries(quantidades)) {
		const validas = Object.entries(porNumero).filter(([n, q]) => q >= 2 && colecao[set]?.has(n))
		if (validas.length) copias[set] = Object.fromEntries(validas)
	}
	return copias
}

function salvarColecao() {
	const ok = gravar(CHAVE_COLECAO, JSON.stringify({ versao: 2, cartas: colecaoComoObjeto(), quantidades: quantidadesComoObjeto() }))
	if (!ok) avisar('Não foi possível salvar. O navegador está em modo privado?')
}

/* ---------- Lista de desejos ---------- */
let desejos = {}   // { idDoSet: Set(['001', ...]) }
function carregarDesejos() {
	desejos = {}
	try {
		for (const [set, numeros] of Object.entries(JSON.parse(ler(CHAVE_DESEJOS) || '{}'))) desejos[set] = new Set(numeros)
	} catch { /* lista vazia */ }
}
function desejosComoObjeto() {
	const lista = {}
	for (const [set, numeros] of Object.entries(desejos)) if (numeros.size) lista[set] = [...numeros]
	return lista
}
function salvarDesejos() { gravar(CHAVE_DESEJOS, JSON.stringify(desejosComoObjeto())) }
const desejada = (setId, numero) => desejos[setId]?.has(numero) || false
function alternarDesejo(setId, numero) {
	const numeros = desejos[setId] || (desejos[setId] = new Set())
	if (numeros.has(numero)) numeros.delete(numero)
	else numeros.add(numero)
	salvarDesejos()
	nuvem?.marcarDesejoNaNuvem(setId, numero, numeros.has(numero))
	return numeros.has(numero)
}

function tenho(setId, numero) {
	return colecao[setId]?.has(numero) || false
}

// Quantas cópias tenho: 0 se não tenho, 1 se marquei só uma, ou o número guardado em quantidades.
function quantidadeDe(setId, numero) {
	return tenho(setId, numero) ? (quantidades[setId]?.[numero] || 1) : 0
}

// Define quantas cópias tenho (0 = tirar da coleção). Devolve o valor aplicado.
function definirQuantidade(setId, numero, quantidade) {
	const qtd = Math.max(0, Math.min(MAX_COPIAS, Math.floor(Number(quantidade) || 0)))
	const numeros = colecao[setId] || (colecao[setId] = new Set())
	if (qtd) numeros.add(numero)
	else numeros.delete(numero)
	if (qtd >= 2) (quantidades[setId] || (quantidades[setId] = {}))[numero] = qtd
	else if (quantidades[setId]) {
		delete quantidades[setId][numero]
		if (!Object.keys(quantidades[setId]).length) delete quantidades[setId]
	}
	salvarColecao()
	nuvem?.quantidadeNaNuvem(setId, numero, qtd)
	return qtd
}

// Toque na carta: tenho ↔ não tenho (ao desmarcar, as cópias extras também saem).
function alternar(setId, numero) {
	return definirQuantidade(setId, numero, tenho(setId, numero) ? 0 : 1) > 0
}

// Cartas com cópias sobrando (para trocar): todas as que tenho em 2 ou mais cópias, com quantas sobram (cópias − 1).
function cartasRepetidas() {
	const itens = []
	for (const set of dados.sets) {
		for (const carta of set.cartas) {
			const extras = quantidadeDe(set.id, carta.n) - 1
			if (extras > 0) itens.push({ set, carta, extras })
		}
	}
	return itens
}

/* ---------- Master set ---------- */
// Master set = todas as cartas do set, incluindo as especiais (secretas, numeradas acima
// do total oficial, ex.: 133/132). Vem ligado por padrão; a lista guarda os sets DESLIGADOS.
let semMasterSet = new Set()
try { semMasterSet = new Set(JSON.parse(ler(CHAVE_SEM_MASTER) || '[]')) } catch { /* padrão: todos ligados */ }

/* ---------- Decks ---------- */
// decks = { id: { nome, criado, cartas: { 'set|n': quantidade } } }
// Na nuvem e no backup cada deck vai como { nome, criado, cartas: ['set|n|quantidade', ...] }.
let decks = {}
function deckDaNuvem(d) {
	const cartas = {}
	for (const item of Array.isArray(d?.cartas) ? d.cartas : []) {
		const [set, n, qtd] = String(item).split('|')
		if (set && n && Number(qtd) > 0) cartas[`${set}|${n}`] = Math.min(Number(qtd), 60)
	}
	return { nome: String(d?.nome || 'Deck sem nome').slice(0, 60), criado: Number(d?.criado) || Date.now(), cartas }
}
const deckParaNuvem = d => ({ nome: d.nome, criado: d.criado, cartas: Object.entries(d.cartas).map(([chave, qtd]) => `${chave}|${qtd}`) })
function decksDeObjeto(objeto) {
	const resultado = {}
	for (const [id, d] of Object.entries(objeto || {})) if (/^[a-z0-9]{4,30}$/.test(id)) resultado[id] = deckDaNuvem(d)
	return resultado
}
const decksParaNuvem = () => Object.fromEntries(Object.entries(decks).map(([id, d]) => [id, deckParaNuvem(d)]))
try { decks = decksDeObjeto(JSON.parse(ler(CHAVE_DECKS) || '{}')) } catch { decks = {} }

// Salva no aparelho e, com conta, na nuvem (só o deck que mudou; null = excluído).
function salvarDeck(id) {
	gravar(CHAVE_DECKS, JSON.stringify(decksParaNuvem()))
	nuvem?.deckNaNuvem(id, decks[id] ? deckParaNuvem(decks[id]) : null)
}

/* ---------- Coleções escondidas ---------- */
// O usuário escolhe quais coleções acompanha. As escondidas somem de Coleções, da Pesquisa e dos filtros
// (a lista de desejos continua mostrando as cartas que ele desejou). O que já foi marcado não se perde.
let escondidas = new Set()
try { escondidas = new Set(JSON.parse(ler(CHAVE_ESCONDIDAS) || '[]')) } catch { /* todas visíveis */ }
const colecaoVisivel = set => !escondidas.has(set.id)
const setsVisiveis = () => dados.sets.filter(colecaoVisivel)

function definirEscondidas(ids, esconder) {
	for (const id of ids) { if (esconder) escondidas.add(id); else escondidas.delete(id) }
	gravar(CHAVE_ESCONDIDAS, JSON.stringify([...escondidas]))
	nuvem?.escondidasNaNuvem(ids, esconder)
	if (pesquisa.set && escondidas.has(pesquisa.set)) pesquisa.set = ''
}

function cartaNormal(set, carta) {
	return /^\d+$/.test(carta.n) && parseInt(carta.n, 10) <= set.oficiais
}

// Só mostra o botão de master set quando o set tem cartas normais e especiais.
function temCartasEspeciais(set) {
	return set.oficiais > 0 && set.cartas.some(c => !cartaNormal(set, c))
}

function masterSetLigado(set) {
	return !semMasterSet.has(set.id)
}

// Cartas que contam para o set, conforme o master set está ligado ou não.
function cartasDoSet(set) {
	if (masterSetLigado(set) || !temCartasEspeciais(set)) return set.cartas
	return set.cartas.filter(c => cartaNormal(set, c))
}

function definirMasterSet(set, ligado) {
	if (ligado) semMasterSet.delete(set.id)
	else semMasterSet.add(set.id)
	gravar(CHAVE_SEM_MASTER, JSON.stringify([...semMasterSet]))
	nuvem?.masterSetNaNuvem(set.id, ligado)
}

function progresso(set) {
	const numeros = colecao[set.id]
	const cartas = cartasDoSet(set)
	const tem = numeros ? cartas.filter(c => numeros.has(c.n)).length : 0
	return { tem, total: cartas.length, pct: Math.floor((tem / cartas.length) * 100) }
}
