import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import { EG_CONFIG_NOBOX } from './ybox'
import { parseHash } from './hash'
export type ParsedConfig = ReturnType<typeof parseHash>


export const DEFAULT_LOCAL_STORAGE_KEY_FOR_WARNING = 'yjsapp:server' // used to detect if user forgot to change it

export function getOrAskConfig(LOCAL_STORAGE_KEY = DEFAULT_LOCAL_STORAGE_KEY_FOR_WARNING, saveToLocalStorage = true) {

  const ASK = Symbol('ask')
  let config = ASK as typeof ASK | ParsedConfig
  let configStr = undefined as string | undefined

  if (LOCAL_STORAGE_KEY ?? '' !== '') {
    if (LOCAL_STORAGE_KEY == DEFAULT_LOCAL_STORAGE_KEY_FOR_WARNING) {
      alert(
        'WARNING: Using default config\n\nPlease configure your app with a unique local storage key.\n\n(if not, two apps might reuse the same credentials to the same document (but treat this as different type!).',
      )
      alert("We recommend to use a unique key, e.g. 'yjsapp-<your-app-name>:server', but will let you continue now.")
    }
    const local = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (local) {
      config = parseHash(local)
      configStr = local
    }
  }

  if (config == ASK) {
    const v = prompt(`[${LOCAL_STORAGE_KEY}]\n\nEnter the doc description e.g.: ${EG_CONFIG_NOBOX}`)
    if (!v) {
      throw new Error('No config provided')
    }
    config = parseHash(v)
    configStr = v
  }

  if (saveToLocalStorage && configStr) {
    localStorage.setItem(LOCAL_STORAGE_KEY, configStr)
  }

  return config
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

export function setupYjs(parsed: ParsedConfig, options: SetupYjsOptions = {}) {
  console.log(parsed)
  const { server, docname, token } = parsed
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
  return { ydoc, server, docname, token, parsed, idbKey, ws, idb }
}

export function setupYjsByConfig(config: string, options: SetupYjsOptions = {}) {
  const parsed = parseHash(config)
  return setupYjs(parsed, options)
}

export function setupYjsAsk(lsKey?: string, saveToLocalStorage: boolean = true, options: SetupYjsOptions = {}) {
  const parsed = getOrAskConfig(lsKey, saveToLocalStorage)
  console.log('setupYjsAsk', { lsKey, saveToLocalStorage, options }, parsed)
  if (!parsed) {
    throw new Error('No config')
  }
  return setupYjs(parsed, options)
}
