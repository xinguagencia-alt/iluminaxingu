import type { SolicitacaoPendente } from './types'

const DB_NAME = 'iluminaxingu-offline'
const DB_VERSION = 1
export const STORE = 'solicitacoes_pendentes'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB nao suportado neste navegador'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id_local' })
      }
    }

    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      resolve(db)
    }

    request.onerror = () => {
      dbPromise = null
      reject(request.error || new Error('Falha ao abrir o banco local'))
    }

    request.onblocked = () => {
      dbPromise = null
      reject(new Error('Banco local bloqueado por outra aba'))
    }
  })

  return dbPromise
}

function transacao(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDb().then(
    (db) => db.transaction(STORE, mode).objectStore(STORE)
  )
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function salvarPendente(item: SolicitacaoPendente): Promise<void> {
  const store = await transacao('readwrite')
  await promisify(store.put(item))
}

export async function listarPendentes(): Promise<SolicitacaoPendente[]> {
  const store = await transacao('readonly')
  const itens = await promisify(store.getAll())
  return (itens as SolicitacaoPendente[]).sort((a, b) => a.criado_em - b.criado_em)
}

export async function removerPendente(idLocal: string): Promise<void> {
  const store = await transacao('readwrite')
  await promisify(store.delete(idLocal))
}

export async function contarPendentes(): Promise<number> {
  const store = await transacao('readonly')
  const total = await promisify(store.count())
  return total
}
