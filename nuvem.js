// Login e sincronização da coleção na nuvem (Firebase).
// O app funciona sem isto: se a internet ou o Firebase falharem, a coleção continua
// salva no aparelho.
//
// No Firebase, cada usuário tem um documento colecoes/{id-do-usuário}:
//   { cartas: { me01: ['001', '005'], ... }, atualizadoEm }

const SDK = 'https://www.gstatic.com/firebasejs/11.10.0'

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
	'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
	'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Use "Entrar".',
	'auth/invalid-credential': 'E-mail ou senha incorretos.',
	'auth/wrong-password': 'E-mail ou senha incorretos.',
	'auth/user-not-found': 'E-mail ou senha incorretos.',
	'auth/too-many-requests': 'Muitas tentativas. Espere alguns minutos e tente de novo.',
	'auth/network-request-failed': 'Sem internet. Conecte-se e tente de novo.',
	'auth/requires-recent-login': 'Por segurança, saia e entre de novo na conta antes de excluir.',
}

export function mensagemDeErro(erro) {
	return MENSAGENS[erro?.code] || 'Não deu certo. Tente de novo.'
}

function juntar(a = {}, b = {}) {
	const resultado = {}
	for (const set of new Set([...Object.keys(a), ...Object.keys(b)])) {
		const numeros = [...new Set([...(a[set] || []), ...(b[set] || [])])]
		if (numeros.length) resultado[set] = numeros
	}
	return resultado
}

// opcoes: { colecaoLocal(), aoMudarUsuario(usuario), aoReceberColecao(cartas, semMasterSet), aoMudarStatus(status) }
// status: 'desconectado' | 'sincronizando' | 'sincronizado' | 'offline'
export function iniciarNuvem(opcoes) {
	avisos = opcoes
	authSdk.onAuthStateChanged(auth, async usuario => {
		pararDeOuvir?.()
		pararDeOuvir = null
		documento = null
		avisos.aoMudarUsuario(usuario ? { email: usuario.email } : null)
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
					const desejosUnidos = juntar(atual.data()?.desejos, opcoes.desejosLocal?.())
				const semMaster = [...new Set([...(atual.data()?.semMasterSet || []), ...(opcoes.semMasterSetLocal?.() || [])])]
				await dbSdk.setDoc(documento, { cartas: unido, desejos: desejosUnidos, colecoesEscondidas: escondidasUnidas, semMasterSet: semMaster, atualizadoEm: dbSdk.serverTimestamp() }, { merge: true })
				try { localStorage.setItem(chaveJuntou, '1') } catch { /* sem localStorage */ }
			} catch (erro) {
				console.warn('Não foi possível juntar com a nuvem agora:', erro)
			}
		}

		pararDeOuvir = dbSdk.onSnapshot(documento, { includeMetadataChanges: true }, foto => {
			if (foto.exists()) avisos.aoReceberColecao(foto.data().cartas || {}, foto.data().semMasterSet || [], foto.data().desejos || {}, foto.data().colecoesEscondidas || [])
			const pendente = foto.metadata.hasPendingWrites
			avisos.aoMudarStatus(pendente ? 'sincronizando' : foto.metadata.fromCache ? 'offline' : 'sincronizado')
		}, erro => {
			console.warn('Erro na sincronização:', erro)
			avisos.aoMudarStatus('offline')
		})
	})
}

export const entrar = (email, senha) => authSdk.signInWithEmailAndPassword(auth, email, senha)
export const criarConta = (email, senha) => authSdk.createUserWithEmailAndPassword(auth, email, senha)
export const recuperarSenha = email => authSdk.sendPasswordResetEmail(auth, email)
// Ao sair, a próxima entrada neste aparelho junta de novo o que for marcado enquanto deslogado.
export async function sair() {
	const uid = auth.currentUser?.uid
	await authSdk.signOut(auth)
	try { localStorage.removeItem(`colecao-tcg-juntou-${uid}`) } catch { /* sem localStorage */ }
}

// Marca/desmarca uma carta na nuvem. Só altera aquela carta, então dois aparelhos
// marcando cartas diferentes ao mesmo tempo não apagam um ao outro.
export function marcarNaNuvem(setId, numero, tem) {
	if (!documento) return
	const operacao = tem ? dbSdk.arrayUnion(numero) : dbSdk.arrayRemove(numero)
	dbSdk.setDoc(documento, { cartas: { [setId]: operacao }, atualizadoEm: dbSdk.serverTimestamp() }, { merge: true })
		.catch(erro => console.warn('Falha ao salvar na nuvem:', erro))
}

// Usado ao importar um backup: troca a coleção inteira.
export function substituirNaNuvem(cartas, desejos) {
	if (!documento) return
	const dados = { cartas, atualizadoEm: dbSdk.serverTimestamp() }
	if (desejos) dados.desejos = desejos
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
