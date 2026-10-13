'use strict'

/* ---------- Tela: um set (grade de cartas) ---------- */
function telaSet(setId) {
	const set = dados.sets.find(s => s.id === setId)
	if (!set) { location.hash = '#/colecoes'; return }

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
