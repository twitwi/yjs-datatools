import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import { SEP, EG_CONFIG_NOBOX } from './ybox'
import { parseHash } from './hash'

export const DEFAULT_LOCAL_STORAGE_KEY_FOR_WARNING = 'yjsapp:server' // used to detect if user forgot to change it

export function getOrAskConfig(LOCAL_STORAGE_KEY = DEFAULT_LOCAL_STORAGE_KEY_FOR_WARNING, saveToLocalStorage = true) {
  const ASK = Symbol('ask')

  let config: symbol | (string | symbol)[] = ASK
  //let default = [ASK, ASK, ASK]
  //let default = ['TODO.com', ASK, ASK]
  //let default = ['TODO.com', 'todo-doc', 'todo-tok-suffix'] // TODO: server, document name, token (if any)

  if (LOCAL_STORAGE_KEY ?? '' !== '') {
    if (LOCAL_STORAGE_KEY == DEFAULT_LOCAL_STORAGE_KEY_FOR_WARNING) {
      alert(
        'WARNING: Using default config\n\nPlease configure your app with a unique local storage key.\n\n(if not, two apps might reuse the same credentials to the same document (but treat this as different type!).',
      )
      alert("We recommend to use a unique key, e.g. 'yjsapp-<your-app-name>:server', but will let you continue now.")
    }
    const local = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (local) {
      config = local.split(SEP)
    }
  }

  if (config == ASK) {
    const v = prompt(`[${LOCAL_STORAGE_KEY}]\n\nEnter the doc description e.g.: ${EG_CONFIG_NOBOX}`)
    if (!v) {
      throw new Error('No config provided')
    }
    config = v.split(SEP)
    if (config.length < 3) {
      throw new Error('Invalid config provided')
    }
  }
  if (!Array.isArray(config)) {
    throw new Error('Invalid config provided')
  }
  if (config[0] == ASK) {
    const server = prompt('[${LOCAL_STORAGE_KEY}]\n\nEnter the server name, e.g.: todo.com')
    if (!server) {
      throw new Error('No server provided')
    }
    config[0] = server
  }
  if (config[1] == ASK) {
    const docname = prompt('[${LOCAL_STORAGE_KEY}]\n\nEnter the document name, e.g.: todo-doc')
    if (!docname) {
      throw new Error('No document name provided')
    }
    config[1] = docname
  }
  if (config[2] == ASK) {
    const token = prompt('[${LOCAL_STORAGE_KEY}]\n\nEnter the token, e.g.: todo-tok-suffix')
    if (!token) {
      throw new Error('No token provided')
    }
    config[2] = token
  }
  if (saveToLocalStorage) {
    localStorage.setItem(LOCAL_STORAGE_KEY, config.join(SEP))
  }
  return config as [string, string, string]
}

export type SetupYjsOptions = {
  websocket?: boolean
  indexeddb?: boolean
  idbKey?: string // default undefined for auto
  idbAwaitSync?: boolean
}
export const DEFAULT_SETUP_YJS_OPTIONS: SetupYjsOptions = {
  websocket: true,
  indexeddb: true,
  idbKey: undefined, // auto based on server/docname
  idbAwaitSync: true,
}

export async function synced(ret: ReturnType<typeof setupYjs>) {
  if (ret.idb) {
    await ret.idb.whenSynced
  }
  return ret
}

export async function connected(ret: ReturnType<typeof setupYjs>) {
  if (ret.ws) {
    await new Promise<void>((resolve) => {
      if (ret.ws!.wsconnected) {
        resolve()
      } else {
        ret.ws!.once('sync', () => resolve())
      }
    })
  }
  return ret
}

export async function syncedAndConnected(ret: ReturnType<typeof setupYjs>) {
  await synced(ret)
  await connected(ret)
  return ret
}

export function setupYjs(server: string, docname: string, token: string, options: SetupYjsOptions = {}) {
  const { websocket, indexeddb, idbKey: _idbKey } = Object.assign({}, DEFAULT_SETUP_YJS_OPTIONS, options)
  let idbKey = _idbKey
  const ydoc = new Y.Doc()
  let ws = undefined as undefined | WebsocketProvider
  if (websocket) {
    ws = new WebsocketProvider(server.includes('://') ? server : `wss://${server}`, `${docname}?t=${token}`, ydoc)
  }
  let idb = undefined as undefined | IndexeddbPersistence
  if (indexeddb) {
    if (!idbKey) {
      idbKey = `yjs::${server}::${docname}`
    }
    idb = new IndexeddbPersistence(idbKey, ydoc)
  } else {
    idbKey = undefined // to indicate no idb, even if passed a key
  }
  return { ydoc, server, docname, token, idbKey, ws, idb }
}

export function setupYjsByConfig(config: string, options: SetupYjsOptions = {}) {
  const { server, repo, token } = parseHash(config)
  return setupYjs(server, repo, token, options)
}

export function setupYjsAsk(lsKey?: string, saveToLocalStorage: boolean = true, options: SetupYjsOptions = {}) {
  const [server, docname, token] = getOrAskConfig(lsKey, saveToLocalStorage)
  return setupYjs(server, docname, token, options)
}
