'use strict'

/* ---------- Tela: início (lista de sets) ---------- */
/* ---------- Aba: Coleções (lista de sets) ---------- */
let editandoColecoes = false

function telaColecoes() {
	editandoColecoes = false
	tela.innerHTML = `
		${htmlConvite()}
		<section class="resumo" id="resumo"></section>
		<button class="botao secundario" id="editar-colecoes"></button>
		<div id="conteudo"></div>`

	ligarConvite()
	$('#editar-colecoes').addEventListener('click', () => {
		editandoColecoes = !editandoColecoes
		desenharColecoes()
		if (!editandoColecoes) window.scrollTo(0, 0)
	})
	$('#conteudo').addEventListener('change', evento => {
		const caixa = evento.target.closest('input[data-escolher]')
		if (!caixa) return
		definirEscondidas([caixa.dataset.escolher], !caixa.checked)
		caixa.closest('.item-escolha').classList.toggle('escondida', !caixa.checked)
		atualizarContagemDasSeries()
	})
	$('#conteudo').addEventListener('click', evento => {
		const botao = evento.target.closest('button[data-serie]')
		if (!botao) return
		const ids = dados.sets.filter(set => set.serie === botao.dataset.serie).map(set => set.id)
		definirEscondidas(ids, botao.dataset.acao === 'nenhuma')
		desenharColecoes()
	})
	desenharColecoes()
}

// Na hora de escolher, mostra quantas coleções de cada série estão visíveis.
function atualizarContagemDasSeries() {
	for (const serie of dados.series) {
		const sets = dados.sets.filter(set => set.serie === serie.id)
		const el = document.querySelector(`[data-contagem-serie="${serie.id}"]`)
		if (el) el.textContent = `${sets.filter(colecaoVisivel).length} de ${sets.length} coleções escolhidas`
	}
}

// Convite para entrar na conta (some quando já está conectado).
function htmlConvite() {
	return `
		<button class="convite" id="convite" ${usuario || !nuvem ? 'hidden' : ''}>
			<span aria-hidden="true">☁️</span>
			<span><b>Sincronize o celular e o PC.</b> Toque aqui para entrar ou criar sua conta.</span>
		</button>`
}
function ligarConvite() { $('#convite').addEventListener('click', abrirMenu) }

function atualizarResumo() {
	let tem = 0, total = 0
	for (const set of setsVisiveis()) {
		const p = progresso(set)
		tem += p.tem
		total += p.total
	}
	const geral = { tem, total, pct: total ? Math.floor((tem / total) * 100) : 0 }
	$('#resumo').innerHTML = `
		<div class="resumo-linha"><strong>${geral.pct}%</strong><span>${tem} de ${total} cartas</span></div>
		${barraHtml(geral)}`
}

function desenharColecoes() {
	const conteudo = $('#conteudo')
	const itemDoSet = set => {
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
	}
	const itemDeEscolha = set => `
		<li><label class="item-set item-escolha${colecaoVisivel(set) ? '' : ' escondida'}">
			<span class="logo-set"><img alt="" data-logo="${escapar(set.id)}"><span hidden>${escapar(set.sigla || set.id)}</span></span>
			<span class="item-set-info"><b>${escapar(set.nome)}</b><small>${set.cartas.length} cartas · ${dataBr(set.lancamento)}</small></span>
			<input type="checkbox" class="interruptor" data-escolher="${escapar(set.id)}" ${colecaoVisivel(set) ? 'checked' : ''} aria-label="Acompanhar ${escapar(set.nome)}">
		</label></li>`

	$('#editar-colecoes').textContent = editandoColecoes ? '✓ Concluir' : 'Escolher coleções'
	$('#editar-colecoes').classList.toggle('secundario', !editandoColecoes)
	definirTopo('Coleções', editandoColecoes ? 'Escolha o que você coleciona' : `${setsVisiveis().length} de ${dados.sets.length} coleções`, false)
	atualizarResumo()

	if (editandoColecoes) {
		conteudo.innerHTML = `<p class="dica">Ligue só as coleções que você coleciona. As desligadas somem do app (da lista, da pesquisa e dos filtros), e o que você já marcou continua salvo.</p>` +
			dados.series.map(serie => {
				const sets = dados.sets.filter(set => set.serie === serie.id)
				return `<h2 class="titulo-serie linha-serie"><span>${escapar(serie.nome)}<small data-contagem-serie="${escapar(serie.id)}">${sets.filter(colecaoVisivel).length} de ${sets.length} coleções escolhidas</small></span>
					<span class="serie-acoes"><button data-serie="${escapar(serie.id)}" data-acao="todas">Todas</button><button data-serie="${escapar(serie.id)}" data-acao="nenhuma">Nenhuma</button></span></h2>
					<ul class="lista-sets">${sets.map(itemDeEscolha).join('')}</ul>`
			}).join('')
	} else {
		const series = dados.series.map(serie => ({ serie, sets: setsVisiveis().filter(set => set.serie === serie.id) })).filter(g => g.sets.length)
		conteudo.innerHTML = series.length ? series.map(({ serie, sets }) => {
			const soma = sets.reduce((t, set) => { const p = progresso(set); return { tem: t.tem + p.tem, total: t.total + p.total } }, { tem: 0, total: 0 })
			return `<h2 class="titulo-serie">${escapar(serie.nome)}<small>${soma.tem} de ${soma.total} cartas · ${sets.length} coleç${sets.length > 1 ? 'ões' : 'ão'}</small></h2>
				<ul class="lista-sets">${sets.map(itemDoSet).join('')}</ul>`
		}).join('') : '<p class="vazio">Nenhuma coleção escolhida. Toque em <b>Escolher coleções</b> para ligar as que você coleciona.</p>'
	}

	// Logo do set; se não houver, fica a sigla em texto.
	for (const img of conteudo.querySelectorAll('img[data-logo]')) {
		carregarEmOrdem(img, fontesImagem(img.dataset.logo, 'logo.webp'), () => {
			img.hidden = true
			img.nextElementSibling.hidden = false
		})
	}
}
