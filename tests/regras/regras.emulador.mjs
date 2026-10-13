// Testes das regras do Firestore (firestore.rules), rodados no emulador do Firebase.
// Uso (na raiz): npm run test:regras
// Não entram no `npm test` comum porque precisam do Java e do firebase-tools (instalados em tests/regras/).
import test, { before, after, beforeEach } from 'node:test'
import fs from 'node:fs'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp, arrayUnion, deleteField } from 'firebase/firestore'

let ambiente

before(async () => {
	ambiente = await initializeTestEnvironment({
		projectId: 'demo-ticards',
		firestore: { rules: fs.readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
	})
})
after(() => ambiente?.cleanup())
beforeEach(() => ambiente.clearFirestore())

const banco = uid => (uid ? ambiente.authenticatedContext(uid) : ambiente.unauthenticatedContext()).firestore()
const colecaoDe = (uid, dono = uid) => doc(banco(uid), 'colecoes', dono)

// O mesmo formato que o app grava (nuvem.js).
const documentoDoApp = () => ({
	cartas: { me01: ['001', '005'], sv01: ['057'] },
	quantidades: { me01: { '001': 3 } },
	desejos: { sv01: ['199'] },
	decks: { abcd1234: { nome: 'Meu deck', criado: 1700000000000, cartas: ['sv01|057|2'] } },
	colecoesEscondidas: ['swsh1'],
	semMasterSet: ['me02'],
	atualizadoEm: serverTimestamp(),
})

async function criarComoAdmin(uid, dados) {
	await ambiente.withSecurityRulesDisabled(contexto => setDoc(doc(contexto.firestore(), 'colecoes', uid), dados))
}

test('sem login não lê nem grava nada', async () => {
	await criarComoAdmin('ana', { cartas: {} })
	await assertFails(getDoc(colecaoDe(null, 'ana')))
	await assertFails(setDoc(colecaoDe(null, 'ana'), { cartas: {} }))
})

test('cada pessoa lê, cria, altera e apaga só o próprio documento', async () => {
	await assertSucceeds(setDoc(colecaoDe('ana'), documentoDoApp()))
	await assertSucceeds(getDoc(colecaoDe('ana')))
	await assertSucceeds(setDoc(colecaoDe('ana'), { cartas: { me01: arrayUnion('010') }, atualizadoEm: serverTimestamp() }, { merge: true }))
	await assertSucceeds(setDoc(colecaoDe('ana'), { quantidades: { me01: { '001': deleteField() } } }, { merge: true }))
	await assertSucceeds(updateDoc(colecaoDe('ana'), { semMasterSet: arrayUnion('me03') }))
	await assertSucceeds(deleteDoc(colecaoDe('ana')))
})

test('não dá para ler, alterar ou apagar o documento de outra pessoa', async () => {
	await criarComoAdmin('ana', documentoDoApp())
	await assertFails(getDoc(colecaoDe('beto', 'ana')))
	await assertFails(setDoc(colecaoDe('beto', 'ana'), { cartas: {} }, { merge: true }))
	await assertFails(deleteDoc(colecaoDe('beto', 'ana')))
	await assertFails(setDoc(colecaoDe('beto', 'novo'), { cartas: {} }))
})

test('não dá para listar as coleções nem usar outros caminhos', async () => {
	await criarComoAdmin('ana', documentoDoApp())
	await assertFails(getDocs(collection(banco('ana'), 'colecoes')))
	await assertFails(setDoc(doc(banco('ana'), 'outra', 'ana'), { x: 1 }))
	await assertFails(setDoc(doc(banco('ana'), 'colecoes', 'ana', 'sub', 'x'), { x: 1 }))
})

test('só os campos conhecidos são aceitos', async () => {
	await assertFails(setDoc(colecaoDe('ana'), { ...documentoDoApp(), admin: true }))
	await criarComoAdmin('ana', { cartas: {} })
	await assertFails(setDoc(colecaoDe('ana'), { lixo: 'x'.repeat(1000) }, { merge: true }))
})

test('os campos precisam ter o tipo certo', async () => {
	for (const errado of [
		{ cartas: ['me01'] },
		{ cartas: 'tudo' },
		{ quantidades: 5 },
		{ desejos: [] },
		{ decks: 'x' },
		{ colecoesEscondidas: { me01: true } },
		{ semMasterSet: 'me01' },
		{ atualizadoEm: 'ontem' },
	]) {
		await assertFails(setDoc(colecaoDe('ana'), errado), `deveria recusar ${JSON.stringify(errado)}`)
	}
})

test('limites de tamanho: muitas coleções, decks ou ids nas listas são recusados', async () => {
	const muitos = (n, valor) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`set${i}`, valor]))
	await assertSucceeds(setDoc(colecaoDe('ana'), { cartas: muitos(300, ['001']) }))
	await assertFails(setDoc(colecaoDe('ana'), { cartas: muitos(301, ['001']) }))
	await assertFails(setDoc(colecaoDe('ana'), { quantidades: muitos(301, { '001': 2 }) }))
	await assertFails(setDoc(colecaoDe('ana'), { desejos: muitos(301, ['001']) }))
	await assertFails(setDoc(colecaoDe('ana'), { decks: muitos(201, { nome: 'x', cartas: [] }) }))
	await assertFails(setDoc(colecaoDe('ana'), { colecoesEscondidas: Array.from({ length: 301 }, (_, i) => `s${i}`) }))
	await assertFails(setDoc(colecaoDe('ana'), { semMasterSet: Array.from({ length: 301 }, (_, i) => `s${i}`) }))
})
