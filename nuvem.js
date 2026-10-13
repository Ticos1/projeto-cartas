// Login e sincronização da coleção na nuvem (Firebase).
// O app funciona sem isto: se a internet ou o Firebase falharem, a coleção continua
// salva no aparelho.
//
// No Firebase, cada usuário tem um documento colecoes/{id-do-usuário}:
//   { cartas: { me01: ['001', '005'], ... }, quantidades, desejos, decks, colecoesEscondidas, semMasterSet, atualizadoEm }
// O formato e os limites desse documento ficam em firestore.rules (testado em tests/regras/).

import { juntar, juntarQuantidades } from './sincronia.js'

// O Firebase vem do próprio site (lib/, copiado por scripts/copiar_bibliotecas.mjs), não da gstatic.com.
// A pasta leva a versão no nome (bibliotecas/package.json); os testes conferem que batem.
const SDK = new URL('./lib/firebase-11.10.0', import.meta.url).href

// App Check (reCAPTCHA v3): só deixa o app de verdade usar o Firebase, não scripts com a apiKey.
// Chave do site criada em https://www.google.com/recaptcha/admin (tipo "reCAPTCHA v3", domínio ticos1.github.io)
// e registrada no Firebase (App Check → Apps). Vazia = App Check desligado.
const APP_CHECK_CHAVE_SITE = ''

// Mínimo de caracteres da senha ao criar a conta (o padrão do Firebase é 6). A mesma regra deve estar na
// política de senha do Firebase (Authentication → Configurações → Política de senha), que vale também fora do app.
export const SENHA_MINIMA = 8

const firebaseConfig = {
	apiKey: 'AIzaSyB145m5SRB0N4g8J_W1lOOuyt_SnCu7kNo',
	authDomain: 'colecao-tcg-3bd8b.firebaseapp.com',
	projectId: 'colecao-tcg-3bd8b',
	storageBucket: 'colecao-tcg-3bd8b.firebasestorage.app',
	messagingSenderId: '516383772607',
	appId: '1:516383772607:web:4a041e8009758076939b0a',
}

const [appSdk, authSdk, dbSdk] = await Promise.all([
	import(`${SDK}/firebase-app.js`),
	import(`${SDK}/firebase-auth.js`),
	import(`${SDK}/firebase-firestore.js`),
])

const app = appSdk.initializeApp(firebaseConfig)
if (APP_CHECK_CHAVE_SITE) {
	try {
		// No computador de quem desenvolve (localhost), usa um token de depuração (aparece no console;
		// cadastre em App Check → Apps → Gerenciar tokens de depuração).
		if (['localhost', '127.0.0.1'].includes(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true
		const appCheckSdk = await import(`${SDK}/firebase-app-check.js`)
		appCheckSdk.initializeAppCheck(app, {
			provider: new appCheckSdk.ReCaptchaV3Provider(APP_CHECK_CHAVE_SITE),
			isTokenAutoRefreshEnabled: true,
		})
	} catch (erro) {
		console.warn('App Check indisponível:', erro)
	}
}
const auth = authSdk.getAuth(app)
auth.languageCode = 'pt-BR'

// Cache no aparelho: marcar cartas sem internet e enviar quando a conexão voltar.
let db
try {
	db = dbSdk.initializeFirestore(app, {
		localCache: dbSdk.persistentLocalCache({ tabManager: dbSdk.persistentMultipleTabManager() }),
	})
} catch {
	db = dbSdk.getFirestore(app)
}

let documento = null       // referência ao documento do usuário logado
let pararDeOuvir = null
let avisos = {}

const MENSAGENS = {
	'auth/invalid-email': 'E-mail inválido.',
	'auth/missing-email': 'Digite o e-mail.',
	'auth/missing-password': 'Digite a senha.',
	'auth/weak-password': `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`,
	'auth/password-does-not-meet-requirements': `A senha não segue as regras: use pelo menos ${SENHA_MINIMA} caracteres, com letras e números. Se a sua senha antiga for mais curta, toque em "Esqueci minha senha" para criar uma nova.`,
	'auth/firebase-app-check-token-is-invalid': 'O app não conseguiu se identificar. Recarregue a página e tente de novo.',
	'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Use "Entrar".',
	'auth/invalid-credential': 'E-mail ou senha incorretos.',
	'auth/wrong-password': 'E-mail ou senha incorretos.',
	'auth/user-not-found': 'E-mail ou senha incorretos.',
	'auth/too-many-requests': 'Muitas tentativas. Espere alguns minutos e tente de novo.',
	'auth/network-request-failed': 'Sem internet. Conecte-se e tente de novo.',
	'auth/requires-recent-login': 'Por segurança, saia e entre de novo na conta antes de excluir.',
}

export function mensagemDeErro(erro) {
	return erro?.mensagem || MENSAGENS[erro?.code] || 'Não deu certo. Tente de novo.'
}

// opcoes: { colecaoLocal(), aoMudarUsuario(usuario), aoReceberColecao(cartas, semMasterSet), aoMudarStatus(status) }
// status: 'desconectado' | 'sincronizando' | 'sincronizado' | 'offline'
export function iniciarNuvem(opcoes) {
	avisos = opcoes
	authSdk.onAuthStateChanged(auth, async usuario => {
		pararDeOuvir?.()
		pararDeOuvir = null
		documento = null
		avisos.aoMudarUsuario(usuario ? { email: usuario.email, verificado: usuario.emailVerified } : null)
		if (!usuario) { avisos.aoMudarStatus('desconectado'); return }

		avisos.aoMudarStatus('sincronizando')
		documento = dbSdk.doc(db, 'colecoes', usuario.uid)

		// No primeiro login neste aparelho, junta o que já estava marcado aqui com a nuvem.
		const chaveJuntou = `colecao-tcg-juntou-${usuario.uid}`
		let jaJuntou = false
		try { jaJuntou = localStorage.getItem(chaveJuntou) === '1' } catch { /* sem localStorage */ }
		if (!jaJuntou) {
			try {
				const atual = await dbSdk.getDoc(documento)
				const unido = juntar(atual.data()?.cartas, opcoes.colecaoLocal())
					const escondidasUnidas = [...new Set([...(atual.data()?.colecoesEscondidas || []), ...(opcoes.escondidasLocal?.() || [])])]
					const decksUnidos = { ...(atual.data()?.decks || {}), ...(opcoes.decksLocal?.() || {}) }
					const desejosUnidos = juntar(atual.data()?.desejos, opcoes.desejosLocal?.())
				const semMaster = [...new Set([...(atual.data()?.semMasterSet || []), ...(opcoes.semMasterSetLocal?.() || [])])]
				const quantidadesUnidas = juntarQuantidades(atual.data()?.quantidades, opcoes.quantidadesLocal?.())
				await dbSdk.setDoc(documento, { cartas: unido, quantidades: quantidadesUnidas, desejos: desejosUnidos, decks: decksUnidos, colecoesEscondidas: escondidasUnidas, semMasterSet: semMaster, atualizadoEm: dbSdk.serverTimestamp() }, { merge: true })
				try { localStorage.setItem(chaveJuntou, '1') } catch { /* sem localStorage */ }
			} catch (erro) {
				console.warn('Não foi possível juntar com a nuvem agora:', erro)
			}
		}

		pararDeOuvir = dbSdk.onSnapshot(documento, { includeMetadataChanges: true }, foto => {
			if (foto.exists()) avisos.aoReceberColecao(foto.data().cartas || {}, foto.data().semMasterSet || [], foto.data().desejos || {}, foto.data().colecoesEscondidas || [], foto.data().decks || {}, foto.data().quantidades || {})
			const pendente = foto.metadata.hasPendingWrites
			avisos.aoMudarStatus(pendente ? 'sincronizando' : foto.metadata.fromCache ? 'offline' : 'sincronizado')
		}, erro => {
			console.warn('Erro na sincronização:', erro)
			avisos.aoMudarStatus('offline')
		})
	})
}

export const entrar = (email, senha) => authSdk.signInWithEmailAndPassword(auth, email, senha)

// Regras da senha nova: o mínimo do app, mais a política de senha do Firebase (se estiver configurada).
// Devolve o texto do problema ou '' se a senha serve.
export async function problemaNaSenha(senha) {
	if (senha.length < SENHA_MINIMA) return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`
	if (!/[a-zA-Z\u00C0-\u024F]/.test(senha) || !/\d/.test(senha)) return 'Use letras e números na senha.'
	try {
		const estado = await authSdk.validatePassword(auth, senha)
		if (!estado.isValid) {
			const faltas = []
			if (estado.meetsMinPasswordLength === false) faltas.push(`pelo menos ${estado.passwordPolicy.customStrengthOptions.minPasswordLength} caracteres`)
			if (estado.containsLowercaseLetter === false) faltas.push('uma letra minúscula')
			if (estado.containsUppercaseLetter === false) faltas.push('uma letra maiúscula')
			if (estado.containsNumericCharacter === false) faltas.push('um número')
			if (estado.containsNonAlphanumericCharacter === false) faltas.push('um símbolo (ex.: ! ? @)')
			return `A senha precisa ter ${faltas.join(', ') || 'mais caracteres'}.`
		}
	} catch { /* sem internet ou sem política: vale a regra do app; o Firebase confere de novo ao criar */ }
	return ''
}

// Cria a conta e já manda o e-mail de confirmação do endereço.
export async function criarConta(email, senha) {
	const problema = await problemaNaSenha(senha)
	if (problema) throw Object.assign(new Error(problema), { code: 'app/senha-fraca', mensagem: problema })
	const { user } = await authSdk.createUserWithEmailAndPassword(auth, email, senha)
	try { await authSdk.sendEmailVerification(user) } catch (erro) { console.warn('Não foi possível enviar a confirmação de e-mail:', erro) }
}

// Confirmação do e-mail (opcional): reenviar e conferir se a pessoa já clicou no link.
export async function reenviarConfirmacao() {
	if (!auth.currentUser) throw new Error('sem usuário')
	await authSdk.sendEmailVerification(auth.currentUser)
}
export async function emailConfirmado() {
	if (!auth.currentUser) return false
	await authSdk.reload(auth.currentUser)
	return auth.currentUser.emailVerified
}
export const recuperarSenha = email => authSdk.sendPasswordResetEmail(auth, email)
// Ao sair, a próxima entrada neste aparelho junta de novo o que for marcado enquanto deslogado.
export async function sair() {
	const uid = auth.currentUser?.uid
	await authSdk.signOut(auth)
	try { localStorage.removeItem(`colecao-tcg-juntou-${uid}`) } catch { /* sem localStorage */ }
}

// Grava quantas cópias da carta existem (0 = não tenho). Só altera aquela carta, então dois aparelhos
// marcando cartas diferentes ao mesmo tempo não apagam um ao outro. A lista "cartas" continua sendo a
// lista de quem tenho (versões antigas do app só leem ela); "quantidades" guarda só as cartas com 2 ou mais.
export function quantidadeNaNuvem(setId, numero, quantidade) {
	if (!documento) return
	dbSdk.setDoc(documento, {
		cartas: { [setId]: quantidade > 0 ? dbSdk.arrayUnion(numero) : dbSdk.arrayRemove(numero) },
		quantidades: { [setId]: { [numero]: quantidade >= 2 ? quantidade : dbSdk.deleteField() } },
		atualizadoEm: dbSdk.serverTimestamp(),
	}, { merge: true }).catch(erro => console.warn('Falha ao salvar na nuvem:', erro))
}

// Usado ao importar um backup: troca a coleção inteira.
export function substituirNaNuvem(cartas, desejos, decks, quantidades) {
	if (!documento) return
	const dados = { cartas, quantidades: quantidades || {}, atualizadoEm: dbSdk.serverTimestamp() }
	if (desejos) dados.desejos = desejos
	if (decks) dados.decks = decks
	dbSdk.setDoc(documento, dados, { mergeFields: Object.keys(dados) })
		.catch(erro => console.warn('Falha ao salvar na nuvem:', erro))
}

// Liga/desliga o master set de um set. Guardamos a lista dos sets com master set DESLIGADO
// (o padrão é ligado), para valer igual no celular e no PC.
export function masterSetNaNuvem(setId, ativo) {
	if (!documento) return
	const operacao = ativo ? dbSdk.arrayRemove(setId) : dbSdk.arrayUnion(setId)
	dbSdk.setDoc(documento, { semMasterSet: operacao }, { merge: true })
		.catch(erro => console.warn('Falha ao salvar na nuvem:', erro))
}

// Lista de desejos: igual às cartas marcadas, só altera aquela carta.
export function marcarDesejoNaNuvem(setId, numero, quer) {
	if (!documento) return
	const operacao = quer ? dbSdk.arrayUnion(numero) : dbSdk.arrayRemove(numero)
	dbSdk.setDoc(documento, { desejos: { [setId]: operacao }, atualizadoEm: dbSdk.serverTimestamp() }, { merge: true })
		.catch(erro => console.warn('Falha ao salvar na nuvem:', erro))
}

// Coleções escondidas (as que o usuário não coleciona): lista de ids do set.
export function escondidasNaNuvem(ids, esconder) {
	if (!documento || !ids.length) return
	const operacao = esconder ? dbSdk.arrayUnion(...ids) : dbSdk.arrayRemove(...ids)
	dbSdk.setDoc(documento, { colecoesEscondidas: operacao }, { merge: true })
		.catch(erro => console.warn('Falha ao salvar na nuvem:', erro))
}

// Exclui a conta: confirma a senha, apaga o documento da coleção na nuvem e depois a conta.
export async function excluirConta(senha) {
	const usuario = auth.currentUser
	if (!usuario) throw new Error('sem usuário')
	await authSdk.reauthenticateWithCredential(usuario, authSdk.EmailAuthProvider.credential(usuario.email, senha))
	const uid = usuario.uid
	pararDeOuvir?.()
	pararDeOuvir = null
	await dbSdk.deleteDoc(dbSdk.doc(db, 'colecoes', uid))
	documento = null
	await authSdk.deleteUser(usuario)
	try { localStorage.removeItem(`colecao-tcg-juntou-${uid}`) } catch { /* sem localStorage */ }
}

// Decks: grava só o deck que mudou (null = excluir).
export function deckNaNuvem(id, deck) {
	if (!documento) return
	dbSdk.setDoc(documento, { decks: { [id]: deck ?? dbSdk.deleteField() }, atualizadoEm: dbSdk.serverTimestamp() }, { merge: true })
		.catch(erro => console.warn('Falha ao salvar na nuvem:', erro))
}
