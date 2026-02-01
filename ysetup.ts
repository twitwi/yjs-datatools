import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import { EG_CONFIG_NOBOX } from './ybox'
import { parseHash } from './hash'
import { ref, watch } from 'vue'
import { getY } from './ytools'
export type ParsedConfig = ReturnType<typeof parseHash>


export const DEFAULT_LOCAL_STORAGE_KEY_FOR_WARNING = 'yjsapp:server' // used to detect if user forgot to change it

export async function EMPTY_ON_MOVED_HANDLER(newDocumentPath: string, comment: string) {
  return true
}
export async function DEFAULT_ON_MOVED_HANDLER(newDocumentPath: string, comment: string) {
  const continueEditing = confirm(`The document has moved to a new document path:\n--- --- ---\n${newDocumentPath}\n--- --- ---\nYou might be editing a deprecated document.\n\nPress OK to continue editing the new document.`)
  return continueEditing
}

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
}
export const DEFAULT_SETUP_YJS_OPTIONS: SetupYjsOptions = {
  websocket: true,
  indexeddb: true,
  idbKey: undefined, // auto based on server/docname
}

export async function synced(ret: ReturnType<typeof setupYjs>) {
  if (ret.idb) {
    await ret.idb.whenSynced
  }
  return ret
}

export async function connected(ret: ReturnType<typeof setupYjs>, onMovedHandler = DEFAULT_ON_MOVED_HANDLER) {
  if (ret.ws) {
    await new Promise<void>(async (resolve) => {
      watch(ret.wsStatus, async (newStatus) => {
        if (newStatus === 'connected') {
          setTimeout(async () => {
            const rootKeys = [...ret.ydoc.getMap().keys()]
            if (rootKeys.includes('meta-301-moved')) {
              const moved = getY(ret.ydoc, 'meta-301-moved')
              if (typeof moved !== 'string') {
                alert('Warning: meta-301-moved is not a string!')
              } else {
                console.log('moved', moved)
                if (moved && moved !== '') {
                  const [newDocumentPath, ...rest] = moved.split(/\n/)
                  const continueEditing = await onMovedHandler(newDocumentPath, rest.join('\n'))
                  if (!continueEditing) {
                    ret.ws!.disconnect()
                    throw new Error('Document moved, editing aborted by user')
                  }
                }
                resolve()
              }
            }
          }, 100)
        }
      })
    })
  }
  return ret
}

export async function syncedAndConnected(ret: ReturnType<typeof setupYjs>, onMovedHandler = DEFAULT_ON_MOVED_HANDLER) {
  await synced(ret)
  await connected(ret, onMovedHandler)
  return ret
}

export function setupYjs(parsed: ParsedConfig, options: SetupYjsOptions = {}) {
  console.log("PARSED", parsed)
  const { server, docname, token } = parsed
  const { websocket, indexeddb, idbKey: _idbKey } = Object.assign({}, DEFAULT_SETUP_YJS_OPTIONS, options)
  let idbKey = _idbKey
  const ydoc = new Y.Doc()
  const wsConnected = ref(false)
  const wsStatus = ref('init')
  let ws = undefined as undefined | WebsocketProvider
  if (websocket) {
    ws = new WebsocketProvider(server.includes('://') ? server : `wss://${server}`, `${docname}?t=${token}`, ydoc)
    ws.on('status', (st) => setTimeout(() => {
      console.log('WS STATUS', st.status)
      wsStatus.value = st.status
      wsConnected.value = st.status === 'connected'
    }, 1))

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
  return { ydoc, server, docname, token, parsed, idbKey, ws, wsStatus, wsConnected, idb }
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
