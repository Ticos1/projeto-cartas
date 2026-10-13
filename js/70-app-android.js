'use strict'

/* ---------- App Android: aviso de versão nova ---------- */
// O APK se identifica como "ColecaoTCG-Android/N". Se houver um APK mais novo
// em Releases no GitHub, mostra um aviso para baixar.
const LINK_APK = 'https://github.com/Ticos1/projeto-cartas/releases/latest/download/colecao-tcg.apk'
const CHAVE_VERSAO = 'colecao-tcg-apk-mais-novo'
const VALIDADE_CONSULTA = 15 * 60 * 1000   // consulta o GitHub no máximo a cada 15 minutos

const versaoInstaladaDoApk = () => Number(navigator.userAgent.match(/ColecaoTCG-Android\/(\d+)/)?.[1]) || 0

// Pergunta ao GitHub qual é o APK mais novo. Devolve o número (ex.: 3) ou 0 se não deu.
async function versaoMaisNovaDoApk(ignorarGuardado = false) {
	let info = null
	try { info = JSON.parse(ler(CHAVE_VERSAO) || 'null') } catch { /* sem cache */ }
	if (!ignorarGuardado && info && Date.now() - info.quando < VALIDADE_CONSULTA) return info.versao
	try {
		const resposta = await fetch('https://api.github.com/repos/Ticos1/projeto-cartas/releases/latest', { cache: 'no-store' })
		if (!resposta.ok) return 0
		const release = await resposta.json()
		const versao = Number(String(release.tag_name).split('.')[1]) || 0
		if (versao) gravar(CHAVE_VERSAO, JSON.stringify({ quando: Date.now(), versao }))
		return versao
	} catch {
		return 0
	}
}

async function verificarVersaoDoApp() {
	const instalada = versaoInstaladaDoApk()
	if (!instalada) return
	const maisNova = await versaoMaisNovaDoApk()
	if (maisNova > instalada) mostrarAvisoDeVersao(maisNova)
}

// Cada versão tem o arquivo com nome próprio (colecao-tcg-1.3.apk), para não esbarrar em
// um download antigo com o mesmo nome. Sem saber a versão, usa o link "sempre o mais novo".
const linkApk = versao => versao
	? `https://github.com/Ticos1/projeto-cartas/releases/download/v1.${versao}/colecao-tcg-1.${versao}.apk`
	: LINK_APK
function baixarApk(versao) { location.href = linkApk(versao) }

function mostrarAvisoDeVersao(versao) {
	if ($('#aviso-versao')) return
	const aviso = document.createElement('button')
	aviso.id = 'aviso-versao'
	aviso.className = 'convite novidade'
	aviso.innerHTML = `<span aria-hidden="true">📲</span><span id="aviso-versao-texto"><b>Nova versão do app (1.${versao}).</b> Toque para atualizar.</span>`
	aviso.addEventListener('click', () => atualizarApp(versao))
	document.body.insertBefore(aviso, tela)
}

/* Atualização feita pelo próprio app (peça nativa "Atualizador" do APK):
   baixa com o gerenciador de downloads do Android e abre o instalador.
   Em APKs antigos ou no navegador essa peça não existe e cai no link de download. */
const atualizadorNativo = () => window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins?.Atualizador || null : null
let atualizacao = null            // { versao, nome, fase: 'baixando' | 'baixado' } enquanto atualiza
let aguardandoPermissao = false   // o usuário foi à tela do Android permitir instalar apps
let ouvintesPostos = false

function mostrarEstadoApk(texto) {
	if ($('#apk-texto')) $('#apk-texto').textContent = texto
	if ($('#aviso-versao-texto')) $('#aviso-versao-texto').textContent = texto
}

async function prepararOuvintes(atualizador) {
	if (ouvintesPostos) return
	ouvintesPostos = true
	await atualizador.addListener('progresso', evento => {
		if (atualizacao?.fase === 'baixando') mostrarEstadoApk(`Baixando a atualização… ${evento.percentual}%`)
	})
	await atualizador.addListener('baixado', () => {
		if (!atualizacao) return
		atualizacao.fase = 'baixado'
		instalarBaixado()
	})
	await atualizador.addListener('erro', evento => {
		atualizacao = null
		mostrarEstadoApk(`${evento.mensagem || 'Não consegui baixar.'} Verifique a internet e toque para tentar de novo.`)
	})
}

async function atualizarApp(versao) {
	const atualizador = atualizadorNativo()
	if (!atualizador) { baixarApk(versao); return }
	if (atualizacao?.fase === 'baixando') return
	if (atualizacao?.fase === 'baixado') { instalarBaixado(); return }   // tocou de novo: reabre o instalador
	atualizacao = { versao, nome: `colecao-tcg-1.${versao}.apk`, fase: 'baixando' }
	mostrarEstadoApk('Baixando a atualização…')
	try {
		await prepararOuvintes(atualizador)
		await atualizador.baixar({ url: linkApk(versao), nome: atualizacao.nome })
	} catch {
		atualizacao = null
		mostrarEstadoApk('Não consegui começar o download. Toque para tentar de novo.')
	}
}

async function instalarBaixado() {
	const atualizador = atualizadorNativo()
	if (!atualizador || !atualizacao) return
	try {
		const { permitido } = await atualizador.podeInstalar()
		if (!permitido) {
			// O Android exige que o usuário permita, uma vez, que este app instale outros apps.
			aguardandoPermissao = true
			mostrarEstadoApk('Quase lá: ligue "Permitir desta fonte" para o Ticards e volte para este app.')
			await atualizador.pedirPermissao()
			return
		}
		mostrarEstadoApk('Abrindo o instalador… toque em "Instalar".')
		await atualizador.instalar({ nome: atualizacao.nome })
	} catch {
		mostrarEstadoApk('Não consegui abrir o instalador. Abra a notificação de download concluído.')
	}
}

// Voltou da tela de permissão do Android: continua a instalação.
document.addEventListener('visibilitychange', () => {
	if (document.visibilityState === 'visible' && aguardandoPermissao) {
		aguardandoPermissao = false
		instalarBaixado()
	}
})

// Seção "App Android" do menu: mostra a versão instalada e deixa procurar atualização.
function configurarSecaoApk() {
	const texto = $('#apk-texto'), botao = $('#apk-botao')
	if (!texto || !botao) return
	const instalada = versaoInstaladaDoApk()
	botao.hidden = false
	if (!instalada) {
		texto.textContent = 'Você está usando pelo navegador. Para ter o app instalado no Android, baixe o APK.'
		botao.textContent = 'Baixar app Android'
		botao.onclick = () => baixarApk()
		return
	}
	texto.textContent = `Versão instalada: 1.${instalada}`
	botao.textContent = 'Procurar atualização'
	botao.onclick = async () => {
		botao.disabled = true
		texto.textContent = 'Procurando…'
		const maisNova = await versaoMaisNovaDoApk(true)
		botao.disabled = false
		if (!maisNova) {
			texto.textContent = `Versão instalada: 1.${instalada}. Não consegui consultar agora; verifique a internet.`
		} else if (maisNova > instalada) {
			texto.textContent = `Versão instalada: 1.${instalada}. Nova versão disponível: 1.${maisNova}.`
			botao.textContent = atualizadorNativo() ? 'Atualizar agora' : `Baixar versão 1.${maisNova}`
			botao.onclick = () => atualizarApp(maisNova)
			mostrarAvisoDeVersao(maisNova)
		} else {
			texto.textContent = `Versão instalada: 1.${instalada}. Você já está na versão mais nova.`
		}
	}
}
