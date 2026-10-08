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

// Séries (pasta dentro de data/ do banco), na ordem em que aparecem no app.
// sets: lista de pastas de set; ou 'todos' para pegar todos os sets da série (em ordem de lançamento).
// altaOnline: não guarda a imagem grande no site (só a pequena); a grande vem direto do TCGdex. Poupa espaço no GitHub Pages.
// ultimos: ids de sets que ficam no fim da série (promos e extras).
const SERIES = [
	{ pasta: 'Mega Evolution', sets: [
		'Mega Evolution',
		'Phantasmal Flames',
		'Ascended Heroes',
		'Perfect Order',
		'Chaos Rising',
		'Pitch Black',
		'30th Celebration',
		'30th Classic Collection',
		'MEP Black Star Promos',
	] },
	{ pasta: 'Scarlet & Violet', sets: 'todos', altaOnline: true, ultimos: ['svp', 'sve', 'mfb'] },
	{ pasta: 'Sword & Shield', sets: 'todos', altaOnline: true, ultimos: ['swshp', 'fut2020', 'cel25', 'cel25cc'] },
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
	// Escarlate e Violeta
	'Hyper rare': 'Rara Hiper',
	'Shiny rare': 'Rara Brilhante',
	'Shiny Ultra Rare': 'Ultra Rara Brilhante',
	'ACE SPEC Rare': 'ACE SPEC',
	'Black White Rare': 'Rara Preto e Branco',
	// Espada e Escudo
	'Secret Rare': 'Rara Secreta',
	'Holo Rare': 'Rara Holo',
	'Holo Rare V': 'Rara Holo V',
	'Holo Rare VMAX': 'Rara Holo VMAX',
	'Holo Rare VSTAR': 'Rara Holo VSTAR',
	'Classic Collection': 'Coleção Clássica',
	'Radiant Rare': 'Rara Radiante',
	'Shiny rare V': 'Rara Brilhante V',
	'Shiny rare VMAX': 'Rara Brilhante VMAX',
	'Amazing Rare': 'Rara Incrível',
	'Full Art Trainer': 'Treinador Arte Completa',
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
const saida = { geradoEm: new Date().toISOString().slice(0, 10), series: [], sets: [] }
const desconhecidas = new Set()

for (const def of SERIES) {
	const pastaSerie = path.join(base, 'data', def.pasta)
	const serie = lerTs(path.join(base, 'data', def.pasta + '.ts'))
	saida.series.push({ id: serie.id, nome: serie.name.pt || serie.name.en })

	const lidos = (def.sets === 'todos'
		? fs.readdirSync(pastaSerie).filter(f => f.endsWith('.ts')).map(f => f.slice(0, -3))
		: def.sets
	).map(nomePasta => ({ nomePasta, set: lerTs(path.join(pastaSerie, nomePasta + '.ts')) }))
	if (def.sets === 'todos') {
		const fim = id => { const i = (def.ultimos || []).indexOf(id); return i < 0 ? -1 : i }
		lidos.sort((a, b) => (fim(a.set.id) >= 0) - (fim(b.set.id) >= 0) || a.set.releaseDate.localeCompare(b.set.releaseDate) || a.set.id.localeCompare(b.set.id))
	}

	for (const { nomePasta, set } of lidos) {
		const pastaCartas = path.join(pastaSerie, nomePasta)
		if (!fs.existsSync(pastaCartas)) continue
		const arquivos = fs.readdirSync(pastaCartas).filter(f => f.endsWith('.ts'))
		const cartas = arquivos
			.map(f => {
				const localId = f.slice(0, -3)
				const c = lerTs(path.join(pastaCartas, f))
				const n = c.name || {}
				if (c.rarity && !(c.rarity in RARIDADES)) desconhecidas.add(c.rarity)
				return {
					n: localId,
					nome: n.pt || n['pt-br'] || n.en,
					raridade: RARIDADES[c.rarity] ?? c.rarity ?? '',
				}
			})
			.sort((a, b) => ordenarNumero(a.n, b.n))
		if (!cartas.length) continue

		saida.sets.push({
			id: set.id,
			serie: serie.id,
			nome: (set.name.pt || set.name.en).trim(),
			sigla: set.abbreviations?.official || '',
			lancamento: set.releaseDate,
			oficiais: set.cardCount?.official || 0,
			...(def.altaOnline ? { altaOnline: true } : {}),
			cartas,
		})
		console.log(`${set.id.padEnd(10)} ${String(cartas.length).padStart(4)} cartas  ${set.name.pt || set.name.en}`)
	}
}
if (desconhecidas.size) console.warn('Raridades sem tradução:', [...desconhecidas])

const destino = new URL('../data/cartas.json', import.meta.url)
fs.mkdirSync(new URL('.', destino), { recursive: true })
fs.writeFileSync(destino, JSON.stringify(saida))
console.log('Gerado:', destino.pathname, `(${saida.sets.length} sets)`)
