'use strict'

/* =========================================================
   Minha Coleção TCG
   - data/cartas.json: lista de sets e cartas (gerada por scripts/gerar_dados.mjs)
   - localStorage: quais cartas eu tenho
   ========================================================= */

const CHAVE_COLECAO = 'colecao-tcg'
const CHAVE_TEMA = 'colecao-tcg-tema'
const CHAVE_SEM_MASTER = 'colecao-tcg-sem-master-set'
const IMAGENS = 'https://assets.tcgdex.net'

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

/* ---------- Coleção ---------- */
function carregarColecao() {
	colecao = {}
	try {
		const salvo = JSON.parse(ler(CHAVE_COLECAO) || '{}')
		for (const [set, numeros] of Object.entries(salvo.cartas || {})) {
			colecao[set] = new Set(numeros)
		}
	} catch { /* coleção vazia */ }
}

function colecaoComoObjeto() {
	const cartas = {}
	for (const [set, numeros] of Object.entries(colecao)) {
		if (numeros.size) cartas[set] = [...numeros]
	}
	return cartas
}

function salvarColecao() {
	const ok = gravar(CHAVE_COLECAO, JSON.stringify({ versao: 1, cartas: colecaoComoObjeto() }))
	if (!ok) avisar('Não foi possível salvar. O navegador está em modo privado?')
}

function tenho(setId, numero) {
	return colecao[setId]?.has(numero) || false
}

function alternar(setId, numero) {
	const numeros = colecao[setId] || (colecao[setId] = new Set())
	if (numeros.has(numero)) numeros.delete(numero)
	else numeros.add(numero)
	salvarColecao()
	nuvem?.marcarNaNuvem(setId, numero, numeros.has(numero))
	return numeros.has(numero)
}

/* ---------- Master set ---------- */
// Master set = todas as cartas do set, incluindo as especiais (secretas, numeradas acima
// do total oficial, ex.: 133/132). Vem ligado por padrão; a lista guarda os sets DESLIGADOS.
let semMasterSet = new Set()
try { semMasterSet = new Set(JSON.parse(ler(CHAVE_SEM_MASTER) || '[]')) } catch { /* padrão: todos ligados */ }

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

/* ---------- Imagens ---------- */
// Ordem: cópia publicada junto com o app (pasta img/) → TCGdex em português → TCGdex em inglês.
function fontesImagem(setId, arquivo) {
	return [
		`img/${setId}/${arquivo}`,
		`${IMAGENS}/pt/${dados.serie}/${setId}/${arquivo}`,
		`${IMAGENS}/en/${dados.serie}/${setId}/${arquivo}`,
	]
}

// Tenta cada endereço até um funcionar; se nenhum funcionar, chama semImagem().
function carregarEmOrdem(img, fontes, semImagem) {
	let i = 0
	img.onerror = () => {
		i++
		if (i < fontes.length) img.src = fontes[i]
		else semImagem()
	}
	img.hidden = false
	img.src = fontes[0]
}

// Imagem da carta; enquanto carrega (ou se não existir), aparece o nome da carta.
function carregarImagem(img, setId, numero, qualidade) {
	img.onload = () => img.parentElement.classList.add('com-imagem')
	img.parentElement.classList.remove('com-imagem')
	carregarEmOrdem(img, fontesImagem(setId, `${numero}/${qualidade}.webp`), () => { img.hidden = true })
}

/* ---------- Ajudantes ---------- */
function semAcento(texto) {
	return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function numeroExibido(set, carta) {
	return set.oficiais && /^\d+$/.test(carta.n) ? `${carta.n}/${String(set.oficiais).padStart(3, '0')}` : carta.n
}

function dataBr(iso) {
	const [ano, mes, dia] = iso.split('-')
	return `${dia}/${mes}/${ano}`
}

function escapar(texto) {
	return String(texto).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// A busca aceita nome ("pikachu") ou número ("25", "025" ou "25/132").
function combina(carta, busca) {
	if (!busca) return true
	const numeroBuscado = busca.split('/')[0].trim()
	if (/^\d+$/.test(numeroBuscado)) {
		return parseInt(carta.n, 10) === parseInt(numeroBuscado, 10)
	}
	return semAcento(carta.nome).includes(busca) || semAcento(carta.n) === busca
}

let temporizadorAviso
function avisar(mensagem) {
	const aviso = $('#aviso')
	aviso.textContent = mensagem
	aviso.classList.add('visivel')
	clearTimeout(temporizadorAviso)
	temporizadorAviso = setTimeout(() => aviso.classList.remove('visivel'), 2600)
}

function barraHtml(p) {
	return `<div class="barra${p.pct === 100 ? ' completa' : ''}"><span style="width:${(p.tem / p.total) * 100}%"></span></div>`
}

function definirTopo(titulo, subtitulo, comVoltar) {
	$('#titulo').textContent = titulo
	$('#subtitulo').textContent = subtitulo
	$('#voltar').hidden = !comVoltar
	document.title = comVoltar ? `${titulo} · Minha Coleção TCG` : 'Minha Coleção TCG'
}

/* ---------- Cartas na grade ---------- */
const ICONE_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'

function criarCarta(set, carta, mostrarSet) {
	const botao = document.createElement('button')
	botao.className = 'carta' + (tenho(set.id, carta.n) ? ' tenho' : '')
	botao.dataset.set = set.id
	botao.dataset.n = carta.n
	botao.setAttribute('aria-pressed', tenho(set.id, carta.n))
	botao.innerHTML = `
		<div class="carta-img">
			<span class="sem-imagem">${escapar(carta.nome)}</span>
			<img alt="${escapar(carta.nome)}" loading="lazy" decoding="async">
			<span class="selo">${ICONE_CHECK}</span>
		</div>
		<span class="carta-legenda"><b>${escapar(carta.nome)}</b>${escapar(mostrarSet ? `${set.nome} · ${carta.n}` : numeroExibido(set, carta))}</span>`
	carregarImagem(botao.querySelector('img'), set.id, carta.n, 'low')
	return botao
}

function atualizarCarta(botao) {
	const marcada = tenho(botao.dataset.set, botao.dataset.n)
	botao.classList.toggle('tenho', marcada)
	botao.setAttribute('aria-pressed', marcada)
}

function montarGrade(itens, mostrarSet) {
	const grade = document.createElement('div')
	grade.className = 'grade'
	for (const { set, carta } of itens) grade.appendChild(criarCarta(set, carta, mostrarSet))
	return grade
}

// Toque = marcar/desmarcar.  Toque longo = ver a carta grande.
let toqueLongo = null
let foiToqueLongo = false

tela.addEventListener('pointerdown', evento => {
	const botao = evento.target.closest('.carta')
	if (!botao) return
	foiToqueLongo = false
	const inicio = { x: evento.clientX, y: evento.clientY }
	clearTimeout(toqueLongo?.timer)
	toqueLongo = {
		inicio,
		timer: setTimeout(() => {
			foiToqueLongo = true
			abrirZoom(botao)
		}, 450),
	}
})

tela.addEventListener('pointermove', evento => {
	if (!toqueLongo) return
	const { x, y } = toqueLongo.inicio
	if (Math.abs(evento.clientX - x) > 10 || Math.abs(evento.clientY - y) > 10) clearTimeout(toqueLongo.timer)
})

for (const tipo of ['pointerup', 'pointercancel', 'pointerleave']) {
	tela.addEventListener(tipo, () => clearTimeout(toqueLongo?.timer))
}

tela.addEventListener('contextmenu', evento => {
	if (evento.target.closest('.carta')) evento.preventDefault()
})

tela.addEventListener('click', evento => {
	const botao = evento.target.closest('.carta')
	if (!botao) return
	if (foiToqueLongo) { foiToqueLongo = false; return }
	alternar(botao.dataset.set, botao.dataset.n)
	atualizarCarta(botao)
	atualizarProgressoNaTela()
})

/* ---------- Tela: carta ampliada ---------- */
let cartaAberta = null

function abrirZoom(botao) {
	const set = dados.sets.find(s => s.id === botao.dataset.set)
	const carta = set.cartas.find(c => c.n === botao.dataset.n)
	cartaAberta = botao
	carregarImagem($('#zoom-img'), set.id, carta.n, 'high')
	$('#zoom-img').alt = carta.nome
	$('#zoom-nome').textContent = carta.nome
	$('#zoom-info').textContent = [set.nome, numeroExibido(set, carta), carta.raridade].filter(Boolean).join(' · ')
	atualizarBotaoZoom()
	$('#zoom').hidden = false
}

function atualizarBotaoZoom() {
	const marcada = tenho(cartaAberta.dataset.set, cartaAberta.dataset.n)
	$('#zoom-marcar').textContent = marcada ? '✓ Tenho esta carta (desmarcar)' : 'Marcar como "tenho"'
	$('#zoom-marcar').classList.toggle('secundario', marcada)
}

$('#zoom-marcar').addEventListener('click', evento => {
	evento.stopPropagation()
	alternar(cartaAberta.dataset.set, cartaAberta.dataset.n)
	atualizarCarta(cartaAberta)
	atualizarBotaoZoom()
	atualizarProgressoNaTela()
})

$('#zoom').addEventListener('click', evento => {
	if (evento.target.id !== 'zoom-marcar') $('#zoom').hidden = true
})

/* ---------- Tela: início (lista de sets) ---------- */
function telaInicio() {
	definirTopo('Minha Coleção', 'Série Megaevolução', false)
	const busca = buscas.inicio || ''

	tela.innerHTML = `
		<button class="convite" id="convite" ${usuario || !nuvem ? 'hidden' : ''}>
			<span aria-hidden="true">☁️</span>
			<span><b>Sincronize o celular e o PC.</b> Toque aqui para entrar ou criar sua conta.</span>
		</button>
		<section class="resumo" id="resumo"></section>
		<input class="busca" id="busca" type="search" placeholder="Buscar carta em todos os sets (nome ou nº)" value="${escapar(busca)}" autocomplete="off" enterkeyhint="search">
		<div id="conteudo"></div>`

	atualizarResumo()
	$('#convite').addEventListener('click', abrirMenu)

	const campo = $('#busca')
	campo.addEventListener('input', () => {
		buscas.inicio = campo.value
		desenharInicio()
	})
	desenharInicio()
}

function atualizarResumo() {
	let tem = 0, total = 0
	for (const set of dados.sets) {
		const p = progresso(set)
		tem += p.tem
		total += p.total
	}
	const geral = { tem, total, pct: Math.floor((tem / total) * 100) }
	$('#resumo').innerHTML = `
		<div class="resumo-linha"><strong>${geral.pct}%</strong><span>${tem} de ${total} cartas</span></div>
		${barraHtml(geral)}`
}

function desenharInicio() {
	const conteudo = $('#conteudo')
	const busca = semAcento((buscas.inicio || '').trim())

	if (busca) {
		const itens = []
		for (const set of dados.sets) {
			for (const carta of cartasDoSet(set)) if (combina(carta, busca)) itens.push({ set, carta })
		}
		conteudo.innerHTML = itens.length
			? `<h2 class="titulo-secao">${itens.length} carta${itens.length > 1 ? 's' : ''} encontrada${itens.length > 1 ? 's' : ''}</h2>`
			: '<p class="vazio">Nenhuma carta encontrada.</p>'
		if (itens.length) conteudo.appendChild(montarGrade(itens.slice(0, 200), true))
		return
	}

	conteudo.innerHTML = `<ul class="lista-sets">${dados.sets.map(set => {
		const p = progresso(set)
		return `
			<li><a class="item-set" href="#/set/${encodeURIComponent(set.id)}" data-set="${escapar(set.id)}">
				<span class="logo-set"><img alt="" data-logo="${escapar(set.id)}"><span hidden>${escapar(set.sigla || set.id)}</span></span>
				<span class="item-set-info">
					<b>${escapar(set.nome)}</b>
					<small>${p.tem} de ${p.total}${temCartasEspeciais(set) && !masterSetLigado(set) ? ' · sem especiais' : ''} · ${dataBr(set.lancamento)}</small>
					${barraHtml(p)}
				</span>
				<span class="pct${p.pct === 100 ? ' completa' : ''}">${p.pct}%</span>
			</a></li>`
	}).join('')}</ul>`

	// Logo do set; se não houver, fica a sigla em texto.
	for (const img of conteudo.querySelectorAll('img[data-logo]')) {
		carregarEmOrdem(img, fontesImagem(img.dataset.logo, 'logo.webp'), () => {
			img.hidden = true
			img.nextElementSibling.hidden = false
		})
	}
}

/* ---------- Tela: um set (grade de cartas) ---------- */
function telaSet(setId) {
	const set = dados.sets.find(s => s.id === setId)
	if (!set) { location.hash = '#/'; return }

	filtros[set.id] ||= 'todas'
	const busca = buscas[set.id] || ''

	definirTopo(set.nome, '', true)
	tela.innerHTML = `
		<section class="resumo" id="resumo-set"></section>
		<input class="busca" id="busca" type="search" placeholder="Buscar por nome ou número" value="${escapar(busca)}" autocomplete="off" enterkeyhint="search">
		${temCartasEspeciais(set) ? `
		<button class="opcao-master" id="master-set" role="switch">
			<span class="opcao-texto">
				<b>Master set</b>
				<small id="master-set-dica"></small>
			</span>
			<span class="chave" aria-hidden="true"></span>
		</button>` : ''}
		<div class="segmentos" id="filtro">
			<button data-filtro="todas">Todas</button>
			<button data-filtro="faltam">Faltam</button>
			<button data-filtro="tenho">Tenho</button>
		</div>
		<div id="conteudo"></div>`

	atualizarProgressoNaTela()

	const campo = $('#busca')
	campo.addEventListener('input', () => {
		buscas[set.id] = campo.value
		desenharGradeSet(set)
	})

	$('#master-set')?.addEventListener('click', () => {
		definirMasterSet(set, !masterSetLigado(set))
		desenharGradeSet(set)
		atualizarProgressoNaTela()
	})

	$('#filtro').addEventListener('click', evento => {
		const botao = evento.target.closest('button')
		if (!botao) return
		filtros[set.id] = botao.dataset.filtro
		desenharGradeSet(set)
	})

	desenharGradeSet(set)
}

function desenharGradeSet(set) {
	const filtro = filtros[set.id]
	for (const botao of document.querySelectorAll('#filtro button')) {
		botao.classList.toggle('ativo', botao.dataset.filtro === filtro)
	}

	const busca = semAcento((buscas[set.id] || '').trim())
	const master = $('#master-set')
	if (master) {
		const ligado = masterSetLigado(set)
		const normais = set.cartas.filter(c => cartaNormal(set, c)).length
		master.setAttribute('aria-checked', ligado)
		$('#master-set-dica').textContent = ligado
			? `Todas as ${set.cartas.length} cartas, com as ${set.cartas.length - normais} especiais`
			: `Só as ${normais} cartas da numeração normal`
	}

	const itens = cartasDoSet(set)
		.filter(carta => {
			if (filtro === 'faltam' && tenho(set.id, carta.n)) return false
			if (filtro === 'tenho' && !tenho(set.id, carta.n)) return false
			return combina(carta, busca)
		})
		.map(carta => ({ set, carta }))

	const conteudo = $('#conteudo')
	conteudo.innerHTML = ''
	if (itens.length) {
		conteudo.appendChild(montarGrade(itens, false))
	} else {
		const mensagem = busca ? 'Nenhuma carta encontrada.'
			: filtro === 'faltam' ? 'Parabéns! Você completou este set. 🎉'
			: filtro === 'tenho' ? 'Você ainda não marcou nenhuma carta deste set. Toque numa carta para marcar.'
			: 'Nenhuma carta.'
		conteudo.innerHTML = `<p class="vazio">${mensagem}</p>`
	}
}

// Atualiza números e barras depois de marcar uma carta (sem redesenhar a grade).
function atualizarProgressoNaTela() {
	if ($('#resumo')) atualizarResumo()
	const resumoSet = $('#resumo-set')
	if (resumoSet) {
		const set = dados.sets.find(s => s.id === rotaAtual().setId)
		const p = progresso(set)
		resumoSet.innerHTML = `
			<div class="resumo-linha"><strong>${p.pct}%</strong><span>${p.tem} de ${p.total} cartas · faltam ${p.total - p.tem}</span></div>
			${barraHtml(p)}`
	}
}

/* ---------- Navegação (endereços com #) ---------- */
function rotaAtual() {
	const partes = location.hash.replace(/^#\/?/, '').split('/')
	return partes[0] === 'set' ? { setId: decodeURIComponent(partes[1] || '') } : {}
}

function navegar() {
	$('#zoom').hidden = true
	const { setId } = rotaAtual()
	if (setId) telaSet(setId)
	else telaInicio()
	window.scrollTo(0, 0)
}

window.addEventListener('hashchange', navegar)

// Se o app foi aberto direto num set, "voltar" leva para o início em vez de sair do app.
let navegouDentroDoApp = false
window.addEventListener('hashchange', () => { navegouDentroDoApp = true })

$('#voltar').addEventListener('click', () => {
	if (navegouDentroDoApp) history.back()
	else location.hash = '#/'
})

/* ---------- Menu: backup e tema ---------- */
function abrirMenu() {
	marcarTemaNoMenu()
	$('#menu').hidden = false
}
$('#abrir-menu').addEventListener('click', abrirMenu)
$('#status-nuvem').addEventListener('click', abrirMenu)
$('#fechar-menu').addEventListener('click', () => { $('#menu').hidden = true })
$('#menu').addEventListener('click', evento => {
	if (evento.target.id === 'menu') $('#menu').hidden = true
})

$('#exportar').addEventListener('click', async () => {
	const cartas = colecaoComoObjeto()
	const quantidade = Object.values(cartas).reduce((soma, lista) => soma + lista.length, 0)
	const backup = { app: 'minha-colecao-tcg', versao: 1, exportadoEm: new Date().toISOString(), cartas }
	const nome = `colecao-tcg-${new Date().toISOString().slice(0, 10)}.json`
	const texto = JSON.stringify(backup, null, 1)

	// Dentro do app Android: salva o arquivo e abre o menu de compartilhar do Android.
	const nativo = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins
	if (nativo?.Filesystem && nativo?.Share) {
		try {
			const { uri } = await nativo.Filesystem.writeFile({ path: nome, data: texto, directory: 'CACHE', encoding: 'utf8' })
			await nativo.Share.share({ title: 'Backup da coleção', files: [uri] })
			avisar(`Backup com ${quantidade} cartas exportado.`)
		} catch (erro) {
			if (!/cancel/i.test(erro?.message || '')) avisar('Não foi possível exportar o backup.')
		}
		return
	}

	const arquivo = new File([texto], nome, { type: 'application/json' })

	// No celular, abre o menu de compartilhar (salvar no Drive, mandar no WhatsApp...).
	if (navigator.canShare?.({ files: [arquivo] })) {
		try {
			await navigator.share({ files: [arquivo], title: 'Backup da coleção' })
			avisar(`Backup com ${quantidade} cartas exportado.`)
			return
		} catch (erro) {
			if (erro.name === 'AbortError') return
		}
	}
	const link = document.createElement('a')
	link.href = URL.createObjectURL(arquivo)
	link.download = nome
	link.click()
	setTimeout(() => URL.revokeObjectURL(link.href), 1000)
	avisar(`Backup com ${quantidade} cartas baixado.`)
})

$('#importar').addEventListener('click', () => $('#arquivo-backup').click())

$('#arquivo-backup').addEventListener('change', async evento => {
	const arquivo = evento.target.files[0]
	evento.target.value = ''
	if (!arquivo) return
	try {
		const backup = JSON.parse(await arquivo.text())
		if (!backup || typeof backup.cartas !== 'object') throw new Error('formato')
		const novas = {}
		let quantidade = 0
		for (const [set, numeros] of Object.entries(backup.cartas)) {
			if (!Array.isArray(numeros)) continue
			novas[set] = new Set(numeros.map(String))
			quantidade += novas[set].size
		}
		const atuais = Object.values(colecao).reduce((soma, s) => soma + s.size, 0)
		const ondeSubstitui = usuario ? ' (no aparelho e na sua conta)' : ''
		if (!confirm(`Substituir sua coleção atual${ondeSubstitui} (${atuais} cartas) pelo backup (${quantidade} cartas)?`)) return
		colecao = novas
		salvarColecao()
		nuvem?.substituirNaNuvem(colecaoComoObjeto())
		$('#menu').hidden = true
		navegar()
		avisar(`Backup importado: ${quantidade} cartas.`)
	} catch {
		avisar('Esse arquivo não parece ser um backup válido.')
	}
})

function aplicarTema(tema) {
	if (tema === 'claro' || tema === 'escuro') document.documentElement.dataset.tema = tema
	else delete document.documentElement.dataset.tema
	// Cor da barra do sistema no celular
	const escuro = tema === 'escuro' || (tema !== 'claro' && matchMedia('(prefers-color-scheme: dark)').matches)
	for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
		meta.content = escuro ? '#14161c' : '#f4f5f8'
	}
}

function marcarTemaNoMenu() {
	const atual = ler(CHAVE_TEMA) || 'auto'
	for (const botao of document.querySelectorAll('#tema button')) {
		botao.classList.toggle('ativo', botao.dataset.tema === atual)
	}
}

$('#tema').addEventListener('click', evento => {
	const botao = evento.target.closest('button')
	if (!botao) return
	gravar(CHAVE_TEMA, botao.dataset.tema)
	aplicarTema(botao.dataset.tema)
	marcarTemaNoMenu()
})

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => aplicarTema(ler(CHAVE_TEMA) || 'auto'))

/* ---------- Conta e sincronização ---------- */
const TEXTO_STATUS = {
	sincronizado: '✅ Tudo sincronizado.',
	sincronizando: '🔄 Sincronizando…',
	offline: '📴 Sem internet. As mudanças serão enviadas quando a conexão voltar.',
	desconectado: '',
}

function mostrarStatus(status) {
	$('#status-nuvem').dataset.status = status
	$('#status-nuvem').title = TEXTO_STATUS[status] || 'Entrar na conta'
	$('#conta-status').textContent = TEXTO_STATUS[status]
}

function mostrarUsuario(novo) {
	const entrou = !usuario && novo
	usuario = novo
	$('#conta-carregando').hidden = true
	$('#conta-desconectado').hidden = !!usuario
	$('#conta-conectado').hidden = !usuario
	$('#conta-email').textContent = usuario?.email || ''
	if ($('#convite')) $('#convite').hidden = !!usuario
	if (entrou && !$('#menu').hidden) {
		$('#menu').hidden = true
		avisar(`Conectado como ${usuario.email}`)
	}
}

// Chegou a coleção da nuvem (de outro aparelho, ou a junção do primeiro login).
function receberColecao(cartas, semMaster = []) {
	const mudouMaster = semMaster.length !== semMasterSet.size || semMaster.some(id => !semMasterSet.has(id))
	if (mudouMaster) {
		semMasterSet = new Set(semMaster)
		gravar(CHAVE_SEM_MASTER, JSON.stringify(semMaster))
		const { setId } = rotaAtual()
		if (setId) desenharGradeSet(dados.sets.find(s => s.id === setId))
	}
	colecao = {}
	for (const [set, numeros] of Object.entries(cartas)) colecao[set] = new Set(numeros)
	salvarColecao()
	// Atualiza a tela sem perder a rolagem nem o que foi digitado na busca.
	for (const botao of document.querySelectorAll('.carta')) atualizarCarta(botao)
	if (!$('#zoom').hidden && cartaAberta) atualizarBotaoZoom()
	if (!rotaAtual().setId && !(buscas.inicio || '').trim()) desenharInicio()
	atualizarProgressoNaTela()
}

async function carregarNuvem() {
	try {
		nuvem = await import('./nuvem.js')
	} catch (erro) {
		console.warn('Login indisponível:', erro)
		$('#conta-carregando').hidden = true
		$('#conta-indisponivel').hidden = false
		return
	}
	nuvem.iniciarNuvem({
		colecaoLocal: colecaoComoObjeto,
		semMasterSetLocal: () => [...semMasterSet],
		aoMudarUsuario: mostrarUsuario,
		aoReceberColecao: receberColecao,
		aoMudarStatus: mostrarStatus,
	})
	if (!usuario && $('#convite')) $('#convite').hidden = false
}

// Trava os botões enquanto espera a resposta do Firebase.
async function acaoDeConta(acao) {
	const botoes = document.querySelectorAll('#form-login button')
	$('#login-erro').textContent = ''
	botoes.forEach(b => { b.disabled = true })
	try {
		await acao()
	} catch (erro) {
		$('#login-erro').textContent = nuvem.mensagemDeErro(erro)
	} finally {
		botoes.forEach(b => { b.disabled = false })
	}
}

const emailDigitado = () => $('#login-email').value.trim()

$('#form-login').addEventListener('submit', evento => {
	evento.preventDefault()
	acaoDeConta(() => nuvem.entrar(emailDigitado(), $('#login-senha').value))
})

$('#botao-criar').addEventListener('click', () => {
	if (!$('#form-login').reportValidity()) return
	acaoDeConta(() => nuvem.criarConta(emailDigitado(), $('#login-senha').value))
})

$('#botao-esqueci').addEventListener('click', () => {
	if (!emailDigitado()) {
		$('#login-erro').textContent = 'Digite seu e-mail acima e toque de novo em "Esqueci minha senha".'
		return
	}
	acaoDeConta(async () => {
		await nuvem.recuperarSenha(emailDigitado())
		avisar('Enviamos um e-mail para você criar uma nova senha.')
	})
})

$('#botao-sair').addEventListener('click', async () => {
	await nuvem.sair()
	avisar('Você saiu da conta. A coleção continua salva neste aparelho.')
})

/* ---------- App Android: aviso de versão nova ---------- */
// O APK se identifica como "ColecaoTCG-Android/N". Se houver um APK mais novo
// em Releases no GitHub, mostra um aviso para baixar.
const LINK_APK = 'https://github.com/Ticos1/projeto-cartas/releases/latest/download/colecao-tcg.apk'
const CHAVE_VERSAO = 'colecao-tcg-ultima-versao-apk'

async function verificarVersaoDoApp() {
	const instalada = Number(navigator.userAgent.match(/ColecaoTCG-Android\/(\d+)/)?.[1])
	if (!instalada) return

	// Consulta o GitHub no máximo a cada 6 horas.
	let info = null
	try { info = JSON.parse(ler(CHAVE_VERSAO) || 'null') } catch { /* sem cache */ }
	if (!info || Date.now() - info.quando > 6 * 3600 * 1000) {
		try {
			const resposta = await fetch('https://api.github.com/repos/Ticos1/projeto-cartas/releases/latest')
			const release = await resposta.json()
			info = { quando: Date.now(), versao: Number(String(release.tag_name).split('.')[1]) || 0 }
			gravar(CHAVE_VERSAO, JSON.stringify(info))
		} catch { return }
	}
	if (info.versao > instalada) mostrarAvisoDeVersao(info.versao)
}

function mostrarAvisoDeVersao(versao) {
	if ($('#aviso-versao')) return
	const aviso = document.createElement('button')
	aviso.id = 'aviso-versao'
	aviso.className = 'convite novidade'
	aviso.innerHTML = `<span aria-hidden="true">📲</span><span><b>Nova versão do app (1.${versao}).</b> Toque para baixar e instalar.</span>`
	aviso.addEventListener('click', () => { location.href = LINK_APK })
	document.body.insertBefore(aviso, tela)
}

/* ---------- Início ---------- */
async function iniciar() {
	aplicarTema(ler(CHAVE_TEMA) || 'auto')
	carregarColecao()
	try {
		const resposta = await fetch('data/cartas.json')
		dados = await resposta.json()
	} catch {
		tela.innerHTML = '<p class="vazio">Não foi possível carregar a lista de cartas. Verifique a internet e tente de novo.</p>'
		return
	}
	navegar()
	carregarNuvem()
	verificarVersaoDoApp()

	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register('sw.js').catch(() => { /* app funciona sem modo offline */ })
	}
}

iniciar()
