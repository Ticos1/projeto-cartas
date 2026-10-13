'use strict'

/* ---------- Imagens ---------- */
// Ordem: cópia publicada junto com o app (pasta img/) → TCGdex em português → TCGdex em inglês.
// Sets "altaOnline" (séries antigas) não guardam a imagem grande no site: ela vem direto do TCGdex.
function fontesImagem(setId, arquivo) {
	const set = dados.sets.find(s => s.id === setId)
	const fontes = [
		`${IMAGENS}/pt/${set?.serie}/${setId}/${arquivo}`,
		`${IMAGENS}/en/${set?.serie}/${setId}/${arquivo}`,
	]
	if (set?.altaOnline && arquivo.endsWith('/high.webp')) return fontes
	return [`img/${setId}/${arquivo}`, ...fontes]
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
	return set.oficiais && /^\d+$/.test(carta.n) ? `${carta.n.padStart(3, '0')}/${String(set.oficiais).padStart(3, '0')}` : carta.n
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
	$('#abrir-gaveta').hidden = comVoltar
	document.title = `${titulo} · Ticards`
}
