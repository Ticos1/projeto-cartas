// Carrega os arquivos de js/ (scripts comuns do navegador, que dividem as mesmas variáveis globais)
// dentro de um contexto do Node, com um navegador "de mentira" mínimo, para testar a lógica sem tela.
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

export const cartasReais = JSON.parse(fs.readFileSync(path.join(raiz, 'data/cartas.json'), 'utf8'))

// Arquivos que não mexem na tela (podem rodar sem DOM).
const ARQUIVOS = ['00-base', '10-modelo', '20-imagens-ajudantes', '21-trocas-logica', '22-importar-deck-logica', '23-reconhecer-logica', '24-imagem-logica']

export function criarAmbiente({ dados } = {}) {
	const armazenamento = new Map()
	const avisos = []
	const contexto = {
		window: { addEventListener() {} },
		document: { querySelector: () => null, title: '' },
		localStorage: {
			getItem: chave => (armazenamento.has(chave) ? armazenamento.get(chave) : null),
			setItem: (chave, valor) => { armazenamento.set(chave, String(valor)) },
			removeItem: chave => { armazenamento.delete(chave) },
		},
		console: { log() {}, warn() {}, error() {} },
		setTimeout: () => 0,
		clearTimeout() {},
		Date, Math, JSON, Set, Map, Object, Array, Number, String, RegExp, Error, Promise,
		Float32Array, Float64Array, Uint8Array, Int8Array,
		avisos,
	}
	vm.createContext(contexto)
	for (const nome of ARQUIVOS) {
		vm.runInContext(fs.readFileSync(path.join(raiz, 'js', `${nome}.js`), 'utf8'), contexto, { filename: `js/${nome}.js` })
	}
	// `avisar` fica no mesmo contexto; aqui só guardamos o texto para os testes conferirem.
	vm.runInContext('avisar = mensagem => avisos.push(mensagem)', contexto)
	const ambiente = {
		armazenamento,
		avisos,
		// Roda um trecho de código dentro do contexto (as variáveis `let`/`const` dos scripts só existem lá).
		avaliar: codigo => vm.runInContext(codigo, contexto),
		definirDados: novos => { contexto.__dados = novos; vm.runInContext('dados = __dados', contexto) },
	}
	if (dados) ambiente.definirDados(dados)
	return ambiente
}

// Lista pequena e fixa de cartas, para os testes não dependerem do data/cartas.json real.
export const dadosDeTeste = {
	series: [{ id: 'sv', nome: 'Escarlate e Violeta' }],
	sets: [
		{ id: 'sv01', serie: 'sv', nome: 'Escarlate e Violeta', sigla: 'SVI', lancamento: '2023-03-31', oficiais: 198, cartas: [
			{ n: '001', nome: 'Pikachu', raridade: 'Comum', t: 'P' },
			{ n: '002', nome: 'Mewtwo ex', raridade: 'Rara Dupla', t: 'P' },
			{ n: '057', nome: 'Pikachu ex', raridade: 'Rara Dupla', t: 'P' },
			{ n: '199', nome: 'Pikachu ex', raridade: 'Rara Ilustrada Especial', t: 'P' },
			{ n: '181', nome: "Ordens do Chefe", raridade: 'Rara', t: 'T' },
		] },
		{ id: 'sv02', serie: 'sv', nome: 'Evoluções em Paldea', sigla: 'PAL', lancamento: '2023-06-09', oficiais: 193, cartas: [
			{ n: '001', nome: 'Bulbasaur', raridade: 'Comum', t: 'P' },
			{ n: '057', nome: 'Pikachu', raridade: 'Comum', t: 'P' },
		] },
		{ id: 'swsh9tg', serie: 'sv', nome: 'Astros Cintilantes Galeria de Treinador', sigla: 'BRS:TG', lancamento: '2022-02-25', oficiais: 30, cartas: [
			{ n: 'TG01', nome: 'Flareon', raridade: 'Rara', t: 'P' },
		] },
		{ id: 'sve', serie: 'sv', nome: 'Energia', sigla: 'SVE', lancamento: '2023-03-31', oficiais: 24, cartas: [
			{ n: '002', nome: 'Energia de Fogo', raridade: 'Comum', t: 'EB' },
		] },
	],
}
