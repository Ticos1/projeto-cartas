// Baixa as imagens das cartas (e os logos dos sets) do TCGdex para a pasta img/.
// Prefere a imagem em português; se não existir, usa a inglesa.
//
// Uso: node scripts/baixar_imagens.mjs
// (roda automaticamente no GitHub Actions antes de publicar no GitHub Pages)

import fs from 'node:fs'
import path from 'node:path'

const RAIZ = new URL('..', import.meta.url).pathname
const dados = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/cartas.json'), 'utf8'))
const BASE = 'https://assets.tcgdex.net'
const SIMULTANEOS = 10

// Cada tarefa: um arquivo de destino e os endereços para tentar, em ordem.
const tarefas = []
for (const set of dados.sets) {
	const origem = idioma => `${BASE}/${idioma}/${set.serie}/${set.id}`
	tarefas.push({ set: set.id, tipo: 'logo', destino: `img/${set.id}/logo.webp`, urls: ['pt', 'en'].map(i => `${origem(i)}/logo.webp`) })
	for (const carta of set.cartas) {
		for (const qualidade of set.altaOnline ? ['low'] : ['low', 'high']) {
			tarefas.push({
				set: set.id,
				tipo: qualidade,
				destino: `img/${set.id}/${carta.n}/${qualidade}.webp`,
				urls: ['pt', 'en'].map(i => `${origem(i)}/${carta.n}/${qualidade}.webp`),
			})
		}
	}
}

// Devolve o arquivo, ou null se não existe (404), ou undefined se o servidor falhou.
async function baixar(url) {
	for (let tentativa = 1; tentativa <= 5; tentativa++) {
		try {
			const resposta = await fetch(url)
			if (resposta.status === 404) return null
			if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`)
			return Buffer.from(await resposta.arrayBuffer())
		} catch (erro) {
			if (tentativa === 5) { console.warn(`Falhou: ${url} (${erro.message})`); return undefined }
			await new Promise(r => setTimeout(r, 2000 * tentativa))
		}
	}
}

// Resultado por set: quantas imagens em português, em inglês e faltando.
const resumo = {}
async function executar(tarefa) {
	const r = resumo[tarefa.set] ||= { pt: 0, en: 0, falta: 0, faltando: [], erro: 0 }
	const destino = path.join(RAIZ, tarefa.destino)
	const marcador = destino + '.idioma'
	if (fs.existsSync(destino) && fs.existsSync(marcador)) {
		if (tarefa.tipo === 'low') r[fs.readFileSync(marcador, 'utf8')]++
		return
	}
	for (const [i, url] of tarefa.urls.entries()) {
		const conteudo = await baixar(url)
		// Servidor com problema: não usa a imagem inglesa no lugar; tenta de novo na próxima publicação.
		if (conteudo === undefined) { if (tarefa.tipo === 'low') r.erro++; return }
		if (conteudo === null) continue
		const idioma = i === 0 ? 'pt' : 'en'
		fs.mkdirSync(path.dirname(destino), { recursive: true })
		fs.writeFileSync(destino, conteudo)
		fs.writeFileSync(marcador, idioma)
		if (tarefa.tipo === 'low') r[idioma]++
		return
	}
	if (tarefa.tipo === 'low') { r.falta++; r.faltando.push(tarefa.destino.split('/')[2]) }
}

let proxima = 0
await Promise.all(Array.from({ length: SIMULTANEOS }, async () => {
	while (proxima < tarefas.length) await executar(tarefas[proxima++])
}))

const linhas = ['| Set | Imagem em PT | Em inglês | Sem imagem | Erro (tenta de novo depois) |', '|---|---|---|---|---|']
for (const set of dados.sets) {
	const r = resumo[set.id]
	const faltando = r.faltando.length ? ` (${r.faltando.slice(0, 15).join(', ')}${r.faltando.length > 15 ? '…' : ''})` : ''
	linhas.push(`| ${set.nome} (${set.id}) | ${r.pt} | ${r.en} | ${r.falta}${faltando} | ${r.erro} |`)
}
const tabela = linhas.join('\n')
console.log(tabela)
if (process.env.GITHUB_STEP_SUMMARY) {
	fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Imagens das cartas\n\n${tabela}\n`)
}
