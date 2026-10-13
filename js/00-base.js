'use strict'

/* =========================================================
   Minha Coleção TCG
   - data/cartas.json: lista de sets e cartas (gerada por scripts/gerar_dados.mjs)
   - localStorage: quais cartas eu tenho
   ========================================================= */

const CHAVE_COLECAO = 'colecao-tcg'
const CHAVE_DESEJOS = 'colecao-tcg-desejos'
const CHAVE_ESCONDIDAS = 'colecao-tcg-colecoes-escondidas'
const CHAVE_DECKS = 'colecao-tcg-decks'
const CHAVE_LIGA_ABERTAS = 'colecao-tcg-liga-abertas'
const CHAVE_TEMA = 'colecao-tcg-tema'
const CHAVE_SEM_MASTER = 'colecao-tcg-sem-master-set'
const CHAVE_PALETA = 'colecao-tcg-paleta'
const CHAVE_COR = 'colecao-tcg-cor-destaque'
const CHAVE_LOGS = 'colecao-tcg-logs'
const CHAVE_DICA_SEGURAR = 'colecao-tcg-dica-segurar'   // já viu (ou já usou) o "segure a carta"
const IMAGENS = 'https://assets.tcgdex.net'
const VERSAO_APP = 'v53'   // mantenha igual à VERSAO do sw.js

let dados = null              // conteúdo de data/cartas.json
let colecao = {}              // { idDoSet: Set(['001', '002', ...]) }
let nuvem = null              // módulo nuvem.js (login e sincronização), quando disponível
let usuario = null            // { email } de quem está logado
const filtros = {}            // filtro escolhido em cada set: 'todas' | 'faltam' | 'tenho'
const buscas = {}             // texto da busca em cada tela

const $ = seletor => document.querySelector(seletor)
const tela = $('#tela')

/* ---------- Armazenamento seguro (localStorage pode falhar em modo privado) ---------- */
function ler(chave) {
	try { return localStorage.getItem(chave) } catch { return null }
}
function gravar(chave, valor) {
	try { localStorage.setItem(chave, valor); return true } catch { return false }
}

/* ---------- Logs: registro de erros e eventos do app (ficam só neste aparelho) ---------- */
const MAX_LOGS = 300
let logs = []
try { logs = JSON.parse(ler(CHAVE_LOGS) || '[]') } catch { logs = [] }
let gravacaoDosLogs = 0

function textoDe(valor) {
	if (valor instanceof Error) return `${valor.name}: ${valor.message}`
	if (typeof valor === 'object' && valor !== null) { try { return JSON.stringify(valor) } catch { return String(valor) } }
	return String(valor)
}

// nivel: 'info' | 'aviso' | 'erro'
function registrar(nivel, mensagem, detalhe = '') {
	logs.push({ t: Date.now(), n: nivel, m: textoDe(mensagem).slice(0, 400), d: textoDe(detalhe).slice(0, 800) })
	if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS)
	clearTimeout(gravacaoDosLogs)
	gravacaoDosLogs = setTimeout(() => gravar(CHAVE_LOGS, JSON.stringify(logs)), 400)
	if (typeof atualizarListaLogs === 'function') atualizarListaLogs()
}

// Erros que o navegador não trata e avisos/erros que o próprio código escreve no console.
window.addEventListener('error', evento => registrar('erro', evento.message || 'Erro de script', evento.filename ? `${evento.filename.split('/').pop()}:${evento.lineno}:${evento.colno}` : ''))
window.addEventListener('unhandledrejection', evento => registrar('erro', `Promessa rejeitada: ${textoDe(evento.reason?.message || evento.reason)}`))
for (const [metodo, nivel] of [['warn', 'aviso'], ['error', 'erro']]) {
	const original = console[metodo].bind(console)
	console[metodo] = (...argumentos) => { registrar(nivel, argumentos.map(textoDe).join(' ')); original(...argumentos) }
}
