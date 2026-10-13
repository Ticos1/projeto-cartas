'use strict'

/* ---------- Aba: Escanear cartas ---------- */
// Ao abrir a aba, a câmera já aparece dentro dela com uma moldura no formato da carta. O app lê sozinho
// alguns quadros por segundo com um leitor de texto (Tesseract.js, baixado só na primeira vez), procura o
// número impresso (ex.: 057/198) e o nome e cruza com a lista de cartas (reconhecerCartas, em 23-reconhecer-logica.js).
// Quando reconhece, a carta aparece embaixo da câmera com as mesmas opções da carta grande: marcar como
// "tenho", quantidade, lista de desejos e comprar na Liga / MYP.
// "Tirar foto" e "Galeria" (seletor de arquivo) ficam de reserva quando a câmera ao vivo não está disponível.
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'
let leitor = null              // trabalhador do Tesseract, criado na primeira leitura
let preparandoLeitor = null
let lendoFoto = false
let resultadoEscaneado = null  // { set, n, outras: [{ set, n }] } carta mostrada embaixo da câmera

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

// Regiões da carta para o leitor: [x0, y0, x1, y1, largura, realce, modo]. A região é em frações da imagem;
// o modo é o do Tesseract (3 = página, 6 = bloco, 7 = linha, 11 = texto solto).
const LER_NUMERO = [0, 0.86, 0.6, 1, 2400, true, '11']        // canto de baixo à esquerda: onde fica o número
const LER_RODAPE = [0, 0.84, 1, 1, 2400, true, '11']          // rodapé inteiro (o número muda de lado em algumas cartas)
const LER_NOME = [0.05, 0.02, 0.8, 0.12, 1200, true, '7']     // faixa do nome

const lerRegiao = (trabalhador, foto, [x0, y0, x1, y1, largura, realce, modo]) =>
	lerTexto(trabalhador, recorteDaFoto(foto, x0, y0, x1, y1, largura, realce), modo)

// Foto (arquivo) → cartas prováveis. Primeiro lê o rodapé; se não ficar claro, tenta outras regiões.
async function reconhecerFoto(arquivo, aoProgresso) {
	aoProgresso('Carregando o leitor de texto… (só na primeira vez; precisa de internet)')
	const trabalhador = await prepararLeitor()
	const foto = await abrirImagemDaFoto(arquivo)
	aoProgresso('Lendo a carta…')
	// Cada leitura enxerga coisas diferentes (testado com cartas reais: nenhuma sozinha acerta sempre), então
	// tentamos várias, da mais certeira para a menos, e paramos quando número + total do set baterem com uma carta.
	const LEITURAS = [
		LER_NUMERO,
		[0, 0.86, 1, 1, 2400, true, '11'],
		LER_RODAPE,
		[0, 0.88, 1, 1, 2000, true, '6'],
		[0, 0, 1, 1, 1400, false, '3'],          // carta inteira (traz o nome)
		LER_NOME,
	]
	let texto = ''
	let achadas = []
	for (const leitura of LEITURAS) {
		texto += '\n' + await lerRegiao(trabalhador, foto, leitura)
		achadas = reconhecerCartas(texto)
		if (achadas.length && achadas[0].pontos >= 10) break
		aoProgresso('Lendo com mais cuidado…')
	}
	return { achadas, texto }
}

/* ----- Reconhecer pela imagem (banco de assinaturas) ----- */
// O banco (data/assinaturas.json + .bin, gerados na publicação) é baixado só na primeira vez que a aba abre
// e fica guardado no aparelho (sw.js). Sem ele, a câmera usa só o leitor de texto.
let bancoDeImagens = null
let carregandoBanco = null
let bancoFalhou = false

function carregarBancoDeImagens() {
	carregandoBanco ||= (async () => {
		const resposta = await fetch('data/assinaturas.json', { cache: 'no-cache' })
		if (!resposta.ok) throw new Error(`assinaturas.json: HTTP ${resposta.status}`)
		const info = await resposta.json()
		const lista = cartasEmOrdem()
		if (info.marca !== marcaDasCartas(lista)) throw new Error('assinaturas de outra lista de cartas')
		const arquivo = await fetch(`data/${info.arquivo}`)
		if (!arquivo.ok) throw new Error(`${info.arquivo}: HTTP ${arquivo.status}`)
		bancoDeImagens = montarBancoDeAssinaturas(new Int8Array(await arquivo.arrayBuffer()), info.escala, lista)
		bancoFalhou = false
		registrar('info', `Escanear: reconhecimento pela imagem pronto (${info.comImagem} cartas)`)
		return bancoDeImagens
	})().catch(erro => { carregandoBanco = null; bancoFalhou = true; throw erro })
	return carregandoBanco
}

/* ----- Câmera ao vivo dentro da aba ----- */
const CHAVE_CAMERA = 'colecao-tcg-camera'   // câmera escolhida pelo usuário (botão 🔄)
let fluxoDaCamera = null
let geracaoDaCamera = 0         // cada abertura ganha um número; uma abertura antiga que termina depois é descartada
let camerasTraseiras = []
let leiturasSemCarta = 0
let gemeasAnteriores = []       // cartas (chaves) vistas no quadro anterior
let ultimaReconhecida = ''      // última carta que a câmera reconheceu (só troca a carta mostrada quando muda)

const chaveDaCarta = ({ set, carta }) => `${set.id}|${carta.n}`
const esperar = ms => new Promise(resolve => setTimeout(resolve, ms))

function mensagemDaCamera(texto) {
	const aviso = $('#camera-aviso')
	if (aviso) aviso.textContent = texto
}

function fecharCamera() {
	geracaoDaCamera++
	fluxoDaCamera?.getTracks().forEach(faixa => faixa.stop())
	fluxoDaCamera = null
	const video = $('#camera-video')
	if (video) video.srcObject = null
	$('#camera-lanterna')?.setAttribute('hidden', '')
}
window.addEventListener('hashchange', fecharCamera)

// Ao sair do app (outra tela do celular), solta a câmera; ao voltar para a aba, abre de novo.
document.addEventListener('visibilitychange', () => {
	if (document.hidden) fecharCamera()
	else if (rotaAtual().aba === 'escanear' && $('#camera-video')) ligarCamera()
})

const VIDEO_BOM = { width: { ideal: 1920 }, height: { ideal: 1080 } }

// Câmeras de trás do aparelho. Os nomes só aparecem depois que a câmera foi liberada.
async function listarCamerasTraseiras() {
	const todas = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput')
	const traseiras = todas.filter(d => /back|rear|traseira|environment/i.test(d.label))
	return traseiras.length ? traseiras : todas
}

// A câmera principal costuma ser a de trás com o menor número no nome ("camera2 0, facing back");
// a grande-angular e a de zoom vêm depois e focam pior de perto.
function cameraPrincipal(cameras) {
	const numero = d => Number(/(\d+)/.exec(d.label)?.[1] ?? 99)
	return [...cameras].sort((a, b) => numero(a) - numero(b))[0]
}

async function ligarCamera() {
	fecharCamera()
	const geracao = geracaoDaCamera
	const caixa = $('#camera')
	if (!navigator.mediaDevices?.getUserMedia) {
		caixa.classList.add('sem-camera')
		mensagemDaCamera('Este aparelho não deixa abrir a câmera aqui. Use "Tirar foto" ou "Galeria" abaixo.')
		return
	}
	mensagemDaCamera('Abrindo a câmera…')
	carregarBancoDeImagens().then(() => {
		if (geracao !== geracaoDaCamera) return
		if (!ultimaReconhecida) mensagemDaCamera('Coloque a carta na moldura')
		// O leitor de texto (para desempatar reimpressões) carrega depois, para não disputar o celular com a câmera.
		setTimeout(() => { if (geracao === geracaoDaCamera) prepararLeitor().catch(() => {}) }, 2500)
	}, erro => registrar('aviso', 'Escanear: sem reconhecimento pela imagem', textoDe(erro)))
	let fluxo
	try {
		const salva = ler(CHAVE_CAMERA)
		try {
			fluxo = await navigator.mediaDevices.getUserMedia({ video: salva ? { deviceId: { exact: salva }, ...VIDEO_BOM } : { facingMode: { ideal: 'environment' }, ...VIDEO_BOM }, audio: false })
		} catch (erro) {
			if (!salva || erro?.name === 'NotAllowedError') throw erro
			fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, ...VIDEO_BOM }, audio: false })
		}
		// Primeira vez: troca para a câmera principal (o aparelho às vezes entrega a grande-angular).
		camerasTraseiras = await listarCamerasTraseiras()
		const atual = fluxo.getVideoTracks()[0].getSettings().deviceId
		const principal = cameraPrincipal(camerasTraseiras)
		if (!salva && principal && principal.deviceId && principal.deviceId !== atual) {
			fluxo.getTracks().forEach(faixa => faixa.stop())
			fluxo = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: principal.deviceId }, ...VIDEO_BOM }, audio: false })
		}
	} catch (erro) {
		fluxo?.getTracks().forEach(faixa => faixa.stop())
		if (geracao !== geracaoDaCamera) return
		registrar('aviso', 'Câmera ao vivo indisponível', textoDe(erro))
		caixa.classList.add('sem-camera')
		mensagemDaCamera(erro?.name === 'NotAllowedError'
			? 'A câmera não foi liberada. Libere nas permissões do app (ou atualize o app) e toque em "Tentar de novo", ou use "Tirar foto" / "Galeria".'
			: 'Não consegui abrir a câmera. Toque em "Tentar de novo" ou use "Tirar foto" / "Galeria".')
		$('#camera-tentar').hidden = false
		return
	}
	if (geracao !== geracaoDaCamera || !$('#camera-video')) { fluxo.getTracks().forEach(faixa => faixa.stop()); return }
	fluxoDaCamera = fluxo
	caixa.classList.remove('sem-camera')
	$('#camera-tentar').hidden = true
	$('#camera-trocar').hidden = camerasTraseiras.length < 2
	const faixa = fluxo.getVideoTracks()[0]
	// Foco contínuo (quando o aparelho deixa) ajuda a ver a carta de perto.
	try { await faixa.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }) } catch { /* sem controle de foco */ }
	if (faixa.getCapabilities?.().torch) $('#camera-lanterna').hidden = false
	const { width, height } = faixa.getSettings()
	registrar('info', `Câmera: ${faixa.label || 'sem nome'} (${width}×${height})`, camerasTraseiras.map(d => d.label).join(' | '))
	const video = $('#camera-video')
	video.srcObject = fluxo
	video.play().catch(() => {})
	mensagemDaCamera(bancoDeImagens || bancoFalhou ? 'Coloque a carta na moldura' : 'Preparando o reconhecimento… (só na primeira vez; precisa de internet)')
	varrerCamera(geracao)
}

// Botão 🔄: passa para a próxima câmera de trás (fica guardada para as próximas vezes).
async function trocarCamera() {
	if (camerasTraseiras.length < 2) return
	const atual = fluxoDaCamera?.getVideoTracks()[0]?.getSettings().deviceId
	const i = camerasTraseiras.findIndex(d => d.deviceId === atual)
	const proxima = camerasTraseiras[(i + 1) % camerasTraseiras.length]
	gravar(CHAVE_CAMERA, proxima.deviceId)
	avisar(`Câmera ${(i + 1) % camerasTraseiras.length + 1} de ${camerasTraseiras.length}`)
	await ligarCamera()
}

async function alternarLanterna() {
	const faixa = fluxoDaCamera?.getVideoTracks()[0]
	if (!faixa) return
	const ligada = !faixa.getSettings().torch
	try {
		await faixa.applyConstraints({ advanced: [{ torch: ligada }] })
		$('#camera-lanterna').setAttribute('aria-pressed', ligada)
	} catch { avisar('Não foi possível ligar a lanterna.') }
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

// Recorte do vídeo (a moldura com folga) em tamanho real, para o leitor de texto.
function quadroDaCamera(folga) {
	const video = $('#camera-video')
	if (!video?.videoWidth || video.paused) return null
	const { x, y, largura, altura } = regiaoDaMoldura(video, $('#camera-moldura'), folga)
	if (largura < 50 || altura < 50) return null
	const quadro = document.createElement('canvas')
	quadro.width = Math.round(largura)
	quadro.height = Math.round(altura)
	quadro.getContext('2d').drawImage(video, x, y, largura, altura, 0, 0, quadro.width, quadro.height)
	return quadro
}

// O recorte para a imagem pega a moldura com 12% de folga em volta; dentro dele, a moldura em si ocupa esta região.
const FOLGA_DA_IMAGEM = 0.12
const MOLDURA_NO_RECORTE = (() => { const m = FOLGA_DA_IMAGEM / (1 + 2 * FOLGA_DA_IMAGEM); return { x0: m, y0: m, x1: 1 - m, y1: 1 - m } })()

// Recorte da moldura já reduzido para 200 px de altura, direto do vídeo (o reconhecimento pela imagem não precisa
// de mais). O canvas é sempre o mesmo: criar um por quadro gasta memória e deixa o celular lento.
const telaPequena = document.createElement('canvas')
function pixelsDaMoldura(folga, altura = 200) {
	const video = $('#camera-video')
	if (!video?.videoWidth || video.paused) return null
	const r = regiaoDaMoldura(video, $('#camera-moldura'), folga)
	if (r.largura < 50 || r.altura < 50) return null
	const largura = Math.max(1, Math.round(r.largura * altura / r.altura))
	if (telaPequena.width !== largura || telaPequena.height !== altura) { telaPequena.width = largura; telaPequena.height = altura }
	const g = telaPequena.getContext('2d', { willReadFrequently: true })
	g.imageSmoothingQuality = 'high'
	g.drawImage(video, r.x, r.y, r.largura, r.altura, 0, 0, largura, altura)
	return { pixels: g.getImageData(0, 0, largura, altura).data, largura, altura }
}

function recortarRegiao(canvas, { x0, y0, x1, y1 }) {
	const saida = document.createElement('canvas')
	saida.width = Math.max(1, Math.round((x1 - x0) * canvas.width))
	saida.height = Math.max(1, Math.round((y1 - y0) * canvas.height))
	saida.getContext('2d').drawImage(canvas, x0 * canvas.width, y0 * canvas.height, saida.width, saida.height, 0, 0, saida.width, saida.height)
	return saida
}

// Lê um quadro da câmera só com o leitor de texto: o número primeiro; se achar, o nome para confirmar.
async function lerQuadro(trabalhador, quadro) {
	let texto = await lerRegiao(trabalhador, quadro, LER_NUMERO)
	let achadas = reconhecerCartas(texto)
	if (!achadas.length || achadas[0].pontos < 10) {
		texto += '\n' + await lerRegiao(trabalhador, quadro, LER_RODAPE)
		achadas = reconhecerCartas(texto)
	}
	if (!achadas.length || achadas[0].pontos < 10) return { achadas: [], texto }
	texto += '\n' + await lerRegiao(trabalhador, quadro, LER_NOME)
	return { achadas: reconhecerCartas(texto), texto }
}

// O leitor de texto (1 a 3 s por leitura no celular) roda em segundo plano, uma leitura por vez: o laço da
// câmera nunca fica esperando por ele, então o reconhecimento pela imagem continua a cada quadro.
let leituraDeTexto = null
function lerEmSegundoPlano(tarefa) {
	if (leituraDeTexto) return
	if (!leitor) { prepararLeitor().catch(erro => registrar('aviso', 'Escanear: leitor de texto indisponível', textoDe(erro))); return }
	leituraDeTexto = tarefa(leitor)
		.catch(erro => registrar('aviso', 'Escanear: falha ao ler o texto de um quadro', textoDe(erro)))
		.finally(() => { leituraDeTexto = null })
}

// Cartas com a mesma arte (reimpressões): qual delas o número lido apontou, por grupo. Assim o texto é lido
// uma vez por carta, e não a cada quadro.
const desempates = new Map()
const chaveDoGrupo = gemeas => gemeas.map(chaveDaCarta).sort().join(' ')

// Laço da câmera: enquanto esta abertura da câmera durar (mesma `geracao`), olha um quadro e repete.
// Pela imagem leva uma fração de segundo; o leitor de texto só entra (em segundo plano) para desempatar
// cartas com a mesma arte ou quando a imagem não basta.
async function varrerCamera(geracao) {
	const ativa = () => geracao === geracaoDaCamera
	while (ativa()) {
		if (bancoFalhou && !bancoDeImagens && !leitor) mensagemDaCamera('Preparando o leitor de texto… (só na primeira vez; precisa de internet)')
		try {
			if (!lendoFoto) cicloDaCamera(ativa)
		} catch (erro) {
			registrar('aviso', 'Escanear: falha ao ler um quadro', textoDe(erro))
		}
		await esperar(bancoDeImagens ? 60 : 300)
	}
}

function cicloDaCamera(ativa) {
	if (!bancoDeImagens) {
		// Sem o banco de imagens (ainda baixando, ou falhou): só o leitor de texto, se o banco falhou.
		if (bancoFalhou) lerTextoDaCamera(ativa)
		return
	}
	const quadro = pixelsDaMoldura(FOLGA_DA_IMAGEM)
	if (!quadro) return
	const resultado = reconhecerPorImagem(quadro.pixels, quadro.largura, quadro.altura, bancoDeImagens, 5, [MOLDURA_NO_RECORTE])
	const escolha = escolherPelaImagem(resultado, bancoDeImagens)
	if (!escolha) {
		gemeasAnteriores = []
		leiturasSemCarta++
		if (leiturasSemCarta >= 25) mensagemDaCamera('Encaixe a carta inteira na moldura, de frente e sem reflexo')
		// De vez em quando, o leitor de texto tenta pelo número (em segundo plano).
		if (leiturasSemCarta % 10 === 9) lerTextoDaCamera(ativa)
		return
	}
	const chaves = escolha.gemeas.map(chaveDaCarta)
	let principal = escolha.carta
	if (escolha.gemeas.length > 1) {
		// Mesma arte em mais de uma carta: o número impresso desempata. Enquanto não foi lido, vale a da imagem.
		const grupo = chaveDoGrupo(escolha.gemeas)
		const decidida = desempates.get(grupo)
		if (decidida) principal = escolha.gemeas.find(g => chaveDaCarta(g) === decidida) || principal
		else desempatarPeloNumero(ativa, escolha, grupo)
	}
	// Nota alta vale na hora; perto do limite, a carta precisa aparecer em dois quadros seguidos.
	const confirmada = principal.pontos >= 0.7 || gemeasAnteriores.includes(chaveDaCarta(principal))
	gemeasAnteriores = chaves
	if (!confirmada) return
	apresentar([principal, ...resultado.filter(r => r !== principal)], `imagem ${principal.pontos.toFixed(2)}`, '')
}

// Lê o rodapé da carta (na região onde a imagem a achou) para saber qual das gêmeas é.
function desempatarPeloNumero(ativa, escolha, grupo) {
	lerEmSegundoPlano(async trabalhador => {
		const quadro = quadroDaCamera(FOLGA_DA_IMAGEM)
		if (!quadro) return
		const texto = await lerRegiao(trabalhador, recortarRegiao(quadro, escolha.carta.regiao), LER_RODAPE)
		if (!ativa()) return
		const pelasLetras = reconhecerCartas(texto).filter(r => r.pontos >= 10).map(chaveDaCarta)
		const certa = escolha.gemeas.find(g => pelasLetras.includes(chaveDaCarta(g)))
		if (!certa) return
		desempates.set(grupo, chaveDaCarta(certa))
		// Se a carta mostrada é deste grupo e o número aponta outra, troca.
		if (resultadoEscaneado && grupo.split(' ').includes(`${resultadoEscaneado.set}|${resultadoEscaneado.n}`) && chaveDaCarta(certa) !== ultimaReconhecida) {
			apresentar([certa, ...escolha.gemeas.filter(g => g !== certa)], 'texto (desempate)', texto)
		}
	})
}

// Sem resposta pela imagem: o leitor de texto procura o número e o nome (em segundo plano).
function lerTextoDaCamera(ativa) {
	lerEmSegundoPlano(async trabalhador => {
		const quadro = quadroDaCamera(0.06)
		if (!quadro) return
		const lido = await lerQuadro(trabalhador, quadro)
		if (!ativa() || !lido.achadas.length || lido.achadas[0].pontos < 16) return
		apresentar(lido.achadas, 'texto', lido.texto)
	})
}

function apresentar(achadas, como, texto) {
	leiturasSemCarta = 0
	mensagemDaCamera('Carta reconhecida ✓')
	const chave = chaveDaCarta(achadas[0])
	if (chave === ultimaReconhecida) return
	ultimaReconhecida = chave
	registrar('info', `Escanear (${como}): ${achadas[0].carta.nome}`, texto.replace(/\s+/g, ' ').slice(0, 300))
	navigator.vibrate?.(40)
	mostrarResultado(achadas)
}

/* ----- Tela ----- */
const ICONE_LINK_FORA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>'

function telaEscanear() {
	definirTopo('Escanear cartas', '', false)
	fecharCamera()
	ultimaReconhecida = ''
	gemeasAnteriores = []
	leiturasSemCarta = 0
	tela.innerHTML = `
		<div class="escanear">
			<div class="camera" id="camera">
				<video id="camera-video" playsinline muted autoplay></video>
				<div class="camera-moldura" id="camera-moldura"></div>
				<p class="camera-aviso" id="camera-aviso" role="status"></p>
				<button class="camera-botao camera-trocar" id="camera-trocar" aria-label="Trocar de câmera" hidden>🔄</button>
				<button class="camera-botao camera-lanterna" id="camera-lanterna" aria-pressed="false" aria-label="Lanterna" hidden>💡</button>
				<button class="botao camera-tentar" id="camera-tentar" hidden>Tentar de novo</button>
			</div>
			<p class="dica escanear-dica">Coloque <b>uma carta por vez</b> na moldura, de frente e sem reflexo. A carta aparece aqui embaixo quando for reconhecida.</p>
			<p class="dica" id="escanear-status" role="status"></p>
			<div id="escanear-resultado"></div>
			<div class="escanear-botoes">
				<label class="botao secundario" for="foto-camera">Tirar foto</label>
				<label class="botao secundario" for="foto-galeria">Galeria</label>
			</div>
			<input id="foto-camera" type="file" accept="image/*" capture="environment" hidden>
			<input id="foto-galeria" type="file" accept="image/*" hidden>
			<h2 class="titulo-secao">Ou procure à mão</h2>
			<input class="busca" id="escanear-busca" type="search" placeholder="Nome ou número da carta" autocomplete="off" enterkeyhint="search">
			<ul class="lista-deck" id="escanear-busca-resultados"></ul>
		</div>`
	$('#camera-tentar').addEventListener('click', ligarCamera)
	$('#camera-lanterna').addEventListener('click', alternarLanterna)
	$('#camera-trocar').addEventListener('click', trocarCamera)
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
	desenharResultado()
	ligarCamera()
}

async function processarFoto(arquivo) {
	if (lendoFoto) return
	lendoFoto = true
	const status = $('#escanear-status')
	try {
		const { achadas, texto } = await reconhecerFoto(arquivo, mensagem => { if (status) status.textContent = mensagem })
		registrar('info', `Escanear (foto): ${achadas.length} sugestão(ões)`, texto.replace(/\s+/g, ' ').slice(0, 300))
		if (!$('#escanear-status')) return   // saiu da aba enquanto lia
		if (!achadas.length) {
			$('#escanear-status').textContent = 'Não consegui identificar a carta. Tente de novo com mais luz e a carta bem de frente, ou procure à mão abaixo.'
			return
		}
		$('#escanear-status').textContent = ''
		mostrarResultado(achadas)
	} catch (erro) {
		registrar('erro', 'Falha ao escanear a carta', textoDe(erro))
		if ($('#escanear-status')) $('#escanear-status').textContent = 'Não foi possível ler a foto agora. Confira a internet (o leitor é baixado na primeira vez) ou procure à mão abaixo.'
	} finally {
		lendoFoto = false
	}
}

// Mostra a carta mais provável embaixo da câmera; as outras sugestões ficam em "Não é essa?".
function mostrarResultado(achadas) {
	const [primeira, ...outras] = achadas
	resultadoEscaneado = { set: primeira.set.id, n: primeira.carta.n, outras: outras.map(({ set, carta }) => ({ set: set.id, n: carta.n })) }
	desenharResultado()
}

function cartaDe(setId, n) {
	const set = dados.sets.find(s => s.id === setId)
	return { set, carta: set?.cartas.find(c => c.n === n) }
}

// Mesmas opções da carta grande: marcar "tenho", quantidade, lista de desejos e comprar (só para quem não tem).
function desenharResultado() {
	const caixa = $('#escanear-resultado')
	if (!caixa) return
	const { set, carta } = resultadoEscaneado ? cartaDe(resultadoEscaneado.set, resultadoEscaneado.n) : {}
	if (!carta) { caixa.innerHTML = ''; return }
	const copias = quantidadeDe(set.id, carta.n)
	const quer = desejada(set.id, carta.n)
	const liga = linkLiga(set, carta)
	const outras = resultadoEscaneado.outras.map(({ set: s, n }) => cartaDe(s, n)).filter(o => o.carta)
	caixa.innerHTML = `
		<div class="escanear-resultado">
			<div class="escanear-carta">
				<span class="item-liga-img escanear-img" data-set="${escapar(set.id)}" data-n="${escapar(carta.n)}"><img alt=""></span>
				<div class="escanear-texto">
					<b>${escapar(carta.nome)}</b>
					<small>${escapar([set.nome, numeroExibido(set, carta), carta.raridade].filter(Boolean).join(' · '))}</small>
					<span class="${copias ? 'escanear-tem' : 'escanear-falta'}">${copias ? `✓ Você tem esta carta${copias > 1 ? ` (×${copias})` : ''}` : 'Você não tem esta carta'}</span>
				</div>
				<button class="escanear-estrela" data-escanear="desejo" aria-pressed="${quer}" aria-label="${quer ? 'Tirar da lista de desejos' : 'Adicionar à lista de desejos'}">★</button>
			</div>
			<button class="botao${copias ? ' secundario' : ''}" data-escanear="marcar">${copias ? 'Desmarcar' : 'Marcar como "tenho"'}</button>
			${copias ? `<div class="zoom-qtd">
				<span>Quantas cópias você tem</span>
				<span class="qtd">
					<button class="qtd-botao" data-escanear="menos" aria-label="Tirar uma cópia">−</button>
					<b>${copias}</b>
					<button class="qtd-botao" data-qtd="1" data-escanear="mais" aria-label="Pôr mais uma cópia"${copias >= MAX_COPIAS ? ' disabled' : ''}>+</button>
				</span>
			</div>` : `<p class="zoom-lojas-titulo">Comprar em:</p>
			<div class="zoom-lojas">
				<a class="botao comprar" href="${escapar(liga.url)}" target="_blank" rel="noopener noreferrer"><span>Liga Pokémon</span>${ICONE_LINK_FORA}</a>
				<a class="botao comprar" href="${escapar(linkMyp(carta))}" target="_blank" rel="noopener noreferrer"><span>MYP Cards</span>${ICONE_LINK_FORA}</a>
			</div>
			${liga.exato ? `<a class="link" href="${escapar(liga.busca)}" target="_blank" rel="noopener noreferrer">Não abriu a carta certa? Buscar pelo nome na Liga</a>` : ''}`}
			${outras.length ? `<p class="dica escanear-outras-titulo">Não é essa? Toque na certa:</p>
			<ul class="lista-deck">${outras.map(({ set: s, carta: c }) => linhaDeEscanear(s, c)).join('')}</ul>` : ''}
		</div>`
	carregarImagem(caixa.querySelector('.escanear-img img'), set.id, carta.n, 'low')
	carregarMiniaturas(caixa)
}

function linhaDeEscanear(set, carta) {
	const atual = quantidadeDe(set.id, carta.n)
	return `<li class="item-deck">
		<span class="item-liga-img" data-set="${escapar(set.id)}" data-n="${escapar(carta.n)}"><img alt="" loading="lazy"></span>
		<span class="item-liga-texto"><b>${escapar(carta.nome)}</b><small>${escapar([set.sigla || set.nome, numeroExibido(set, carta), carta.raridade].filter(Boolean).join(' · '))}</small>
			<small class="${atual ? 'deck-tenho' : 'deck-falta'}">${atual ? `Você tem ${atual}` : 'Você não tem'}</small></span>
		<button class="botao secundario item-liga-abrir" data-escanear="ver" data-set="${escapar(set.id)}" data-n="${escapar(carta.n)}">Ver</button>
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

// Botões da carta reconhecida e "Ver" nas listas (um ouvinte só, para a tela inteira).
tela.addEventListener('click', evento => {
	const botao = evento.target.closest('button[data-escanear]')
	if (!botao || rotaAtual().aba !== 'escanear') return
	const acao = botao.dataset.escanear
	if (acao === 'ver') {
		// Troca a carta mostrada; a que estava vira uma das sugestões.
		const { set, n } = botao.dataset
		const anterior = resultadoEscaneado ? [{ set: resultadoEscaneado.set, n: resultadoEscaneado.n }, ...resultadoEscaneado.outras] : []
		resultadoEscaneado = { set, n, outras: anterior.filter(o => o.set !== set || o.n !== n) }
		desenharResultado()
		$('#escanear-resultado').scrollIntoView({ behavior: 'smooth', block: 'nearest' })
		return
	}
	if (!resultadoEscaneado) return
	const { set, n } = resultadoEscaneado
	const { carta } = cartaDe(set, n)
	if (acao === 'marcar') {
		const marcada = alternar(set, n)
		avisar(marcada ? `${carta.nome}: marcada como "tenho" ✓` : `${carta.nome}: desmarcada`)
	} else if (acao === 'mais' || acao === 'menos') {
		definirQuantidade(set, n, quantidadeDe(set, n) + (acao === 'mais' ? 1 : -1))
	} else if (acao === 'desejo') {
		avisar(alternarDesejo(set, n) ? 'Adicionada à lista de desejos ★' : 'Tirada da lista de desejos')
	}
	desenharResultado()
	desenharBuscaEscanear()
})
