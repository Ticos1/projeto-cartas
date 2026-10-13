'use strict'

/* ---------- Aba: Escanear cartas ---------- */
// O usuário fotografa a carta (câmera do aparelho ou galeria); um leitor de texto (Tesseract.js,
// baixado só na primeira vez) lê o número e o nome; o app sugere as cartas prováveis
// (reconhecerCartas, em 23-reconhecer-logica.js) e cada toque em "+1" soma uma cópia.
// Dois jeitos de obter a imagem: a câmera ao vivo com uma moldura para encaixar a carta (o recorte
// sai sempre igual, e é o que lê melhor) ou uma foto do seletor de arquivo (app da câmera / galeria),
// que serve de reserva quando a câmera ao vivo não está disponível ou foi negada.
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'
let leitor = null              // trabalhador do Tesseract, criado na primeira foto
let preparandoLeitor = null
let sessaoEscaneada = []       // [{ set, n }] cartas somadas nesta visita à aba (para desfazer)
let lendoFoto = false

function carregarScript(url) {
	return new Promise((resolve, reject) => {
		const script = document.createElement('script')
		script.src = url
		script.onload = resolve
		script.onerror = () => reject(new Error('Não foi possível baixar o leitor de texto.'))
		document.head.appendChild(script)
	})
}

function prepararLeitor() {
	preparandoLeitor ||= (async () => {
		if (!window.Tesseract) await carregarScript(TESSERACT_URL)
		leitor = await window.Tesseract.createWorker('eng')
		return leitor
	})().catch(erro => { preparandoLeitor = null; throw erro })
	return preparandoLeitor
}

async function encerrarLeitor() {
	const atual = leitor
	leitor = null
	preparandoLeitor = null
	try { await atual?.terminate() } catch { /* já encerrado */ }
}
window.addEventListener('hashchange', () => { if (rotaAtual().aba !== 'escanear') encerrarLeitor() })

async function abrirImagemDaFoto(arquivo) {
	try { return await createImageBitmap(arquivo, { imageOrientation: 'from-image' }) } catch { /* tenta pelo <img> */ }
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(arquivo)
		const img = new Image()
		img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
		img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível abrir a foto.')) }
		img.src = url
	})
}

// Recorta uma região (frações de 0 a 1) e reduz/amplia para a largura pedida; `realce` deixa em tons de cinza com mais contraste.
function recorteDaFoto(img, x0, y0, x1, y1, larguraAlvo, realce) {
	const canvas = document.createElement('canvas')
	const largura = img.width * (x1 - x0)
	const altura = img.height * (y1 - y0)
	const escala = larguraAlvo / largura
	canvas.width = Math.max(1, Math.round(largura * escala))
	canvas.height = Math.max(1, Math.round(altura * escala))
	const g = canvas.getContext('2d')
	if (realce) g.filter = 'grayscale(1) contrast(1.4)'
	g.drawImage(img, img.width * x0, img.height * y0, largura, altura, 0, 0, canvas.width, canvas.height)
	return canvas
}

async function lerTexto(trabalhador, imagem, modo) {
	await trabalhador.setParameters({ tessedit_pageseg_mode: modo })
	const { data } = await trabalhador.recognize(imagem)
	return data.text
}

// Foto → cartas prováveis. Primeiro lê a foto inteira; se não ficar claro, lê também o rodapé (número) e o topo (nome).
async function reconhecerFoto(origem, aoProgresso) {
	aoProgresso('Carregando o leitor de texto… (só na primeira vez; precisa de internet)')
	const trabalhador = await prepararLeitor()
	const foto = origem instanceof Blob ? await abrirImagemDaFoto(origem) : origem   // arquivo da foto ou quadro da câmera
	aoProgresso('Lendo a carta…')
	let texto = await lerTexto(trabalhador, recorteDaFoto(foto, 0, 0, 1, 1, 1400, false), '3')   // o leitor lê melhor com letras grandes: amplia fotos pequenas
	let achadas = reconhecerCartas(texto)
	if (!achadas.length || achadas[0].pontos < 10) {
		aoProgresso('Lendo com mais cuidado…')
		texto += '\n' + await lerTexto(trabalhador, recorteDaFoto(foto, 0, 0.9, 1, 1, 1800, true), '6')
		texto += '\n' + await lerTexto(trabalhador, recorteDaFoto(foto, 0.05, 0.02, 0.8, 0.12, 1200, true), '7')
		achadas = reconhecerCartas(texto)
	}
	return { achadas, texto }
}

/* ----- Câmera ao vivo com moldura ----- */
const PROPORCAO_CARTA = 600 / 825   // largura / altura da carta
let fluxoDaCamera = null

function fecharCamera() {
	fluxoDaCamera?.getTracks().forEach(faixa => faixa.stop())
	fluxoDaCamera = null
	const caixa = $('#camera')
	if (caixa) { caixa.hidden = true; $('#camera-video').srcObject = null }
}
window.addEventListener('hashchange', fecharCamera)

async function abrirCamera() {
	const status = $('#escanear-status')
	if (!navigator.mediaDevices?.getUserMedia) {
		status.textContent = 'Este aparelho não deixa abrir a câmera ao vivo aqui. Use "Tirar foto" ou "Galeria".'
		return
	}
	try {
		fluxoDaCamera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
	} catch (erro) {
		registrar('aviso', 'Câmera ao vivo indisponível', textoDe(erro))
		status.textContent = erro?.name === 'NotAllowedError'
			? 'A câmera não foi liberada. Libere nas permissões do app (ou atualize o app) ou use "Tirar foto" / "Galeria".'
			: 'Não consegui abrir a câmera. Use "Tirar foto" ou "Galeria".'
		return
	}
	status.textContent = ''
	const video = $('#camera-video')
	video.srcObject = fluxoDaCamera
	$('#camera').hidden = false
	video.play().catch(() => {})
}

// Região do vídeo (em pixels do vídeo) que está dentro da moldura, com uma folga em volta.
function regiaoDaMoldura(video, moldura, folga = 0.06) {
	const caixa = video.getBoundingClientRect()
	const m = moldura.getBoundingClientRect()
	const escala = Math.max(caixa.width / video.videoWidth, caixa.height / video.videoHeight)   // object-fit: cover
	const sobraX = (caixa.width - video.videoWidth * escala) / 2
	const sobraY = (caixa.height - video.videoHeight * escala) / 2
	const paraVideoX = x => (x - caixa.left - sobraX) / escala
	const paraVideoY = y => (y - caixa.top - sobraY) / escala
	const folgaX = m.width * folga, folgaY = m.height * folga
	const x0 = Math.max(0, paraVideoX(m.left - folgaX)), y0 = Math.max(0, paraVideoY(m.top - folgaY))
	const x1 = Math.min(video.videoWidth, paraVideoX(m.right + folgaX)), y1 = Math.min(video.videoHeight, paraVideoY(m.bottom + folgaY))
	return { x: x0, y: y0, largura: x1 - x0, altura: y1 - y0 }
}

async function lerDaCamera() {
	if (lendoFoto) return
	const video = $('#camera-video')
	if (!video.videoWidth) return
	const { x, y, largura, altura } = regiaoDaMoldura(video, $('#camera-moldura'))
	const quadro = document.createElement('canvas')
	quadro.width = Math.round(largura)
	quadro.height = Math.round(altura)
	quadro.getContext('2d').drawImage(video, x, y, largura, altura, 0, 0, quadro.width, quadro.height)
	fecharCamera()
	await processarFoto(quadro)
}

function telaEscanear() {
	definirTopo('Escanear cartas', '', false)
	tela.innerHTML = `
		<div class="escanear">
			<p class="dica">Fotografe <b>uma carta por vez</b>, de frente, bem iluminada e ocupando a moldura toda. O app lê o número (ex.: 057/198) e o nome e sugere a carta. Cada toque em <b>+1</b> soma uma cópia à sua coleção.</p>
			<div class="escanear-botoes">
				<button class="botao" id="abrir-camera">📷 Abrir a câmera</button>
				<label class="botao secundario" for="foto-camera">Tirar foto</label>
				<label class="botao secundario" for="foto-galeria">Galeria</label>
			</div>
			<input id="foto-camera" type="file" accept="image/*" capture="environment" hidden>
			<input id="foto-galeria" type="file" accept="image/*" hidden>
			<p class="dica" id="escanear-status" role="status"></p>
			<ul class="lista-deck" id="escanear-sugestoes"></ul>
			<h2 class="titulo-secao">Ou procure à mão</h2>
			<input class="busca" id="escanear-busca" type="search" placeholder="Nome ou número da carta" autocomplete="off" enterkeyhint="search">
			<ul class="lista-deck" id="escanear-busca-resultados"></ul>
			<div id="escanear-sessao"></div>
		</div>
		<div class="camera" id="camera" hidden>
			<video id="camera-video" playsinline muted autoplay></video>
			<div class="camera-moldura" id="camera-moldura"></div>
			<p class="camera-dica">Encaixe a carta na moldura, sem reflexo, e toque em <b>Ler carta</b></p>
			<div class="camera-botoes">
				<button class="botao" id="camera-ler">Ler carta</button>
				<button class="botao secundario" id="camera-fechar">Fechar</button>
			</div>
		</div>`
	$('#abrir-camera').addEventListener('click', abrirCamera)
	$('#camera-ler').addEventListener('click', lerDaCamera)
	$('#camera-fechar').addEventListener('click', fecharCamera)
	for (const entrada of [$('#foto-camera'), $('#foto-galeria')]) {
		entrada.addEventListener('change', async evento => {
			const arquivo = evento.target.files[0]
			evento.target.value = ''
			if (arquivo) await processarFoto(arquivo)
		})
	}
	let espera = 0
	$('#escanear-busca').addEventListener('input', () => {
		clearTimeout(espera)
		espera = setTimeout(desenharBuscaEscanear, 150)
	})
	desenharSessaoEscaneada()
}

async function processarFoto(origem) {
	if (lendoFoto) return
	lendoFoto = true
	const status = $('#escanear-status')
	const sugestoes = $('#escanear-sugestoes')
	sugestoes.innerHTML = ''
	try {
		const { achadas, texto } = await reconhecerFoto(origem, mensagem => { if (status) status.textContent = mensagem })
		registrar('info', `Escanear: ${achadas.length} sugestão(ões)`, texto.replace(/\s+/g, ' ').slice(0, 300))
		if (!$('#escanear-status')) return   // saiu da aba enquanto lia
		if (!achadas.length) {
			$('#escanear-status').textContent = 'Não consegui identificar a carta. Tente de novo com mais luz e a carta bem de frente, ou procure à mão abaixo.'
			return
		}
		$('#escanear-status').textContent = achadas.length > 1 ? 'Qual é a sua carta? Toque em +1 na certa:' : 'Achei esta carta:'
		$('#escanear-sugestoes').innerHTML = achadas.map(({ set, carta }) => linhaDeEscanear(set, carta)).join('')
		carregarMiniaturas($('#escanear-sugestoes'))
	} catch (erro) {
		registrar('erro', 'Falha ao escanear a carta', textoDe(erro))
		if ($('#escanear-status')) $('#escanear-status').textContent = 'Não foi possível ler a foto agora. Confira a internet (o leitor é baixado na primeira vez) ou procure à mão abaixo.'
	} finally {
		lendoFoto = false
	}
}

function linhaDeEscanear(set, carta) {
	const atual = quantidadeDe(set.id, carta.n)
	return `<li class="item-deck">
		<span class="item-liga-img" data-set="${escapar(set.id)}" data-n="${escapar(carta.n)}"><img alt="" loading="lazy"></span>
		<span class="item-liga-texto"><b>${escapar(carta.nome)}</b><small>${escapar([set.sigla || set.nome, numeroExibido(set, carta), carta.raridade].filter(Boolean).join(' · '))}</small>
			<small class="${atual ? 'deck-tenho' : 'deck-falta'}">${atual ? `Você tem ${atual}` : 'Você não tem'}</small></span>
		<button class="botao item-liga-abrir" data-escanear="mais" data-set="${escapar(set.id)}" data-n="${escapar(carta.n)}">+1</button>
	</li>`
}

function desenharBuscaEscanear() {
	const lista = $('#escanear-busca-resultados')
	if (!lista) return
	const texto = semAcento($('#escanear-busca').value.trim())
	if (!texto) { lista.innerHTML = ''; return }
	const achadas = []
	for (const set of dados.sets) for (const carta of set.cartas) if (combina(carta, texto)) achadas.push({ set, carta })
	lista.innerHTML = achadas.length
		? achadas.slice(0, 10).map(({ set, carta }) => linhaDeEscanear(set, carta)).join('') + (achadas.length > 10 ? `<li class="dica">Mostrando 10 de ${achadas.length}. Digite mais para filtrar.</li>` : '')
		: '<li class="vazio">Nenhuma carta encontrada.</li>'
	carregarMiniaturas(lista)
}

function desenharSessaoEscaneada() {
	const caixa = $('#escanear-sessao')
	if (!caixa) return
	if (!sessaoEscaneada.length) { caixa.innerHTML = ''; return }
	const total = sessaoEscaneada.length
	caixa.innerHTML = `<h2 class="titulo-secao">Somadas agora (${total})</h2>
		<ul class="lista-deck">${sessaoEscaneada.map(({ set, n }, i) => {
			const dadosSet = dados.sets.find(s => s.id === set)
			const carta = dadosSet.cartas.find(c => c.n === n)
			return `<li class="item-deck">
				<span class="item-liga-texto"><b>${escapar(carta.nome)}</b><small>${escapar([dadosSet.sigla || dadosSet.nome, numeroExibido(dadosSet, carta)].join(' · '))} · agora ×${quantidadeDe(set, n)}</small></span>
				<button class="botao secundario item-liga-abrir" data-escanear="desfazer" data-i="${i}">Desfazer</button>
			</li>`
		}).reverse().join('')}</ul>`
}

// Botões "+1" e "Desfazer" (um ouvinte só, para a tela inteira).
tela.addEventListener('click', evento => {
	const botao = evento.target.closest('button[data-escanear]')
	if (!botao || rotaAtual().aba !== 'escanear') return
	if (botao.dataset.escanear === 'mais') {
		const { set, n } = botao.dataset
		const nova = definirQuantidade(set, n, quantidadeDe(set, n) + 1)
		sessaoEscaneada.push({ set, n })
		const carta = dados.sets.find(s => s.id === set).cartas.find(c => c.n === n)
		avisar(`${carta.nome}: agora você tem ${nova}`)
		$('#escanear-sugestoes').innerHTML = ''
		$('#escanear-status').textContent = ''
		desenharBuscaEscanear()
	} else {
		const [{ set, n }] = sessaoEscaneada.splice(Number(botao.dataset.i), 1)
		definirQuantidade(set, n, quantidadeDe(set, n) - 1)
	}
	desenharSessaoEscaneada()
})
