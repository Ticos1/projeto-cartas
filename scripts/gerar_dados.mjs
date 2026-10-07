// Gera data/cartas.json a partir do banco de dados do TCGdex (github.com/tcgdex/cards-database).
//
// Uso:
//   git clone --depth 1 https://github.com/tcgdex/cards-database
//   node scripts/gerar_dados.mjs caminho/para/cards-database
//
// Para adicionar ou remover sets, edite a lista SETS abaixo.

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

// Pasta do set dentro de data/Mega Evolution, na ordem em que aparecem no app.
const SERIE = 'Mega Evolution'
const SETS = [
	'Mega Evolution',
	'Phantasmal Flames',
	'Ascended Heroes',
	'Perfect Order',
	'Chaos Rising',
	'Pitch Black',
	'30th Celebration',
	'30th Classic Collection',
	'MEP Black Star Promos',
]

const RARIDADES = {
	'Common': 'Comum',
	'Uncommon': 'Incomum',
	'Rare': 'Rara',
	'Double rare': 'Rara Dupla',
	'Ultra Rare': 'Ultra Rara',
	'Illustration rare': 'Rara Ilustrada',
	'Special illustration rare': 'Rara Ilustrada Especial',
	'Mega Hyper Rare': 'Mega Rara Hiper',
	'Mega Attack Rare': 'Rara Mega Ataque',
	'Futuristic Rare': 'Rara Futurista',
	'Pikachu Rare': 'Rara Pikachu',
	'RGB Rare': 'Rara RGB',
	'Promo': 'Promo',
	'None': '',
}

// Os arquivos do banco são TypeScript simples: removemos imports e tipos e executamos.
// O que vem de um import (o set ou a série) não é usado, então vira "undefined".
function lerTs(arquivo) {
	let codigo = fs.readFileSync(arquivo, 'utf8')
		.replace(/^import \{.*$/gm, '')
		.replace(/^import (\w+) from .*$/gm, 'var $1')
		.replace(/const (\w+)\s*:\s*\w+\s*=/, 'const $1 =')
		.replace(/export default (\w+)/, 'module.exports = $1')
	const contexto = { module: { exports: null } }
	vm.runInNewContext(codigo, contexto, { filename: arquivo })
	return contexto.module.exports
}

function ordenarNumero(a, b) {
	const na = parseInt(a, 10), nb = parseInt(b, 10)
	if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb
	if (isNaN(na) !== isNaN(nb)) return isNaN(na) ? 1 : -1
	return a.localeCompare(b)
}

const base = process.argv[2]
if (!base) {
	console.error('Informe o caminho do cards-database. Ex.: node scripts/gerar_dados.mjs ../cards-database')
	process.exit(1)
}
const pastaSerie = path.join(base, 'data', SERIE)
const serie = lerTs(path.join(base, 'data', SERIE + '.ts'))

const saida = { geradoEm: new Date().toISOString().slice(0, 10), serie: serie.id, sets: [] }

for (const nomePasta of SETS) {
	const set = lerTs(path.join(pastaSerie, nomePasta + '.ts'))
	const pastaCartas = path.join(pastaSerie, nomePasta)
	const arquivos = fs.readdirSync(pastaCartas).filter(f => f.endsWith('.ts'))
	const cartas = arquivos
		.map(f => {
			const localId = f.slice(0, -3)
			const c = lerTs(path.join(pastaCartas, f))
			const n = c.name || {}
			return {
				n: localId,
				nome: n.pt || n['pt-br'] || n.en,
				raridade: RARIDADES[c.rarity] ?? c.rarity ?? '',
			}
		})
		.sort((a, b) => ordenarNumero(a.n, b.n))

	saida.sets.push({
		id: set.id,
		nome: set.name.pt || set.name.en,
		sigla: set.abbreviations?.official || '',
		lancamento: set.releaseDate,
		oficiais: set.cardCount?.official || 0,
		cartas,
	})
	console.log(`${set.id.padEnd(8)} ${String(cartas.length).padStart(4)} cartas  ${set.name.pt}`)
}

const destino = new URL('../data/cartas.json', import.meta.url)
fs.mkdirSync(new URL('.', destino), { recursive: true })
fs.writeFileSync(destino, JSON.stringify(saida))
console.log('Gerado:', destino.pathname)
