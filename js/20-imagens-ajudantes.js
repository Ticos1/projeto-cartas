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

// Imagem da carta; enquanto carrega aparece um esqueleto animado e, se não existir, o nome da carta.
function carregarImagem(img, setId, numero, qualidade) {
	const caixa = img.parentElement
	img.onload = () => { caixa.classList.add('com-imagem'); caixa.classList.remove('carregando') }
	caixa.classList.remove('com-imagem')
	caixa.classList.add('carregando')
	carregarEmOrdem(img, fontesImagem(setId, `${numero}/${qualidade}.webp`), () => { img.hidden = true; caixa.classList.remove('carregando') })
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

// Fala o texto no leitor de tela (TalkBack, VoiceOver), sem mostrar nada na tela.
// Limpa antes e escreve logo depois para o mesmo texto ser anunciado de novo (ex.: marcar duas cartas iguais).
let temporizadorAnuncio
function anunciar(mensagem) {
	const regiao = $('#anuncio-leitor')
	if (!regiao) return
	regiao.textContent = ''
	clearTimeout(temporizadorAnuncio)
	temporizadorAnuncio = setTimeout(() => { regiao.textContent = mensagem }, 60)
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

/* ---------- Diálogo do app (no lugar de confirm/prompt/alert do navegador) ---------- */
// Os nativos não seguem o tema e ficam feios no app Android. Devolve uma promessa:
//  - confirmação: true (confirmou) ou false
//  - com `campo`: o texto digitado, ou null se cancelou
//  - com `cancelar: null`: só um botão (aviso), resolve com true
// Opções: { titulo, texto, confirmar, cancelar, perigo, campo: { valor, placeholder, max } }
let respostaDoDialogo = null

function perguntar({ titulo = '', texto = '', confirmar = 'OK', cancelar = 'Cancelar', perigo = false, campo = null } = {}) {
	if (respostaDoDialogo) fecharDialogo(campo ? null : false)
	prepararDialogo()
	$('#dialogo-titulo').textContent = titulo
	$('#dialogo-texto').textContent = texto
	$('#dialogo-texto').hidden = !texto
	const entrada = $('#dialogo-campo')
	entrada.hidden = !campo
	entrada.value = campo?.valor || ''
	entrada.placeholder = campo?.placeholder || ''
	if (campo?.max) entrada.maxLength = campo.max
	else entrada.removeAttribute('maxlength')
	$('#dialogo-ok').textContent = confirmar
	$('#dialogo-ok').classList.toggle('perigo', perigo)
	$('#dialogo-cancelar').textContent = cancelar || ''
	$('#dialogo-cancelar').hidden = !cancelar
	$('#dialogo').hidden = false
	registrarSobreposicao()
	if (!semAnimacao()) {
		$('#dialogo').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 })
		$('#dialogo-form').animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: 'ease-out' })
	}
	if (campo) { entrada.focus(); entrada.select() } else $('#dialogo-ok').focus()
	return new Promise(resolver => {
		respostaDoDialogo = { resolver, comCampo: !!campo, soAviso: !cancelar }
	})
}

// Fecha o diálogo e entrega a resposta. Quando o fechamento não veio do voltar do celular,
// espera o app tirar a entrada do histórico antes de responder: assim quem perguntou pode
// navegar (ex.: history.back() depois de excluir) sem as duas voltas se atropelarem.
function fecharDialogo(resposta, veioDoHistorico = false) {
	const pendente = respostaDoDialogo
	if (!pendente) return
	respostaDoDialogo = null
	$('#dialogo').hidden = true
	if (pendente.soAviso) resposta = true
	if (veioDoHistorico) { pendente.resolver(resposta); return }
	liberarSobreposicao()
	let respondeu = false
	const responder = () => {
		if (respondeu) return
		respondeu = true
		window.removeEventListener('popstate', responder)
		pendente.resolver(resposta)
	}
	window.addEventListener('popstate', responder)
	setTimeout(responder, 350)
}

function cancelarDialogo(veioDoHistorico = false) {
	fecharDialogo(respostaDoDialogo?.comCampo ? null : false, veioDoHistorico)
}

let dialogoPreparado = false
function prepararDialogo() {
	if (dialogoPreparado) return
	dialogoPreparado = true
	$('#dialogo-form').addEventListener('submit', evento => {
		evento.preventDefault()
		fecharDialogo(respostaDoDialogo?.comCampo ? $('#dialogo-campo').value : true)
	})
	$('#dialogo-cancelar').addEventListener('click', () => cancelarDialogo())
	$('#dialogo').addEventListener('click', evento => {
		if (evento.target.id === 'dialogo') cancelarDialogo()
	})
	$('#dialogo').addEventListener('keydown', evento => {
		if (evento.key === 'Escape') { evento.preventDefault(); cancelarDialogo() }
	})
}
