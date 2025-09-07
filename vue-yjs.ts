
import { YDoc, YMap, YArray, YText } from './ytools'
import { isY, isYMap, isYArray, isYText } from './ytools'

import { customRef, ref, type Ref } from 'vue'
import { useDebounceFn, watchDeep } from '@vueuse/core'
import * as JsYaml from 'js-yaml'

const unimplemented = new Set<string|symbol>('concat reverse'.split(' '))
export function proxyYArray(o: YArray<YAny>, ydoc: YDoc): SAny[] {
  ////o.observe((event) => {
  const proxy =  new Proxy(o, {
    get(target, prop) {
      if (prop === Symbol.iterator) {
        return function* () {
          for (let i = 0; i < target.length; i++) {
            const v = target.get(i)
            yield proxyY(v, ydoc)
          }
        }
      }
      if (prop === 'length') {
        return target.length
      }
      if (prop === 'push') {
        return (...items: SAny[]) => (proxy as unknown as SAny[]).splice(target.length, 0, ...items)
      }
      if (prop === 'unshift') {
        return (...items: SAny[]) => (proxy as unknown as SAny[]).splice(0, 0, ...items)
      }
      if (prop === 'pop') {
        return () => (proxy as unknown as SAny[]).splice(target.length - 1, 1)[0]
      }
      if (prop === 'shift') {
        return () => (proxy as unknown as SAny[]).splice(0, 1)[0]
      }
      if (prop === 'splice') {
        return (start: number, deleteCount?: number, ...items: SAny[]) => {
          const res = [] as SAny[]
          for (let i = start; i < (deleteCount ? start + deleteCount : target.length); i++) {
            const v = target.get(i)
            res.push(fromY(v)!)
          }
          ydoc.transact(() => {
            deleteCount = deleteCount ?? 0
            if (deleteCount > 0) {
              target.delete(start, deleteCount)
            }
            if (items.length > 0) {
              target.insert(start, items.map(toY))
            }
          })
          return res
        }
      }
      if (typeof prop === 'string' && !isNaN(Number(prop))) {
        return proxyY(target.get(Number(prop)), ydoc)
      }
      if (unimplemented.has(prop)) {
        throw new Error('Cannot get property ' + String(prop) + ' on YArray')
      }
      return Reflect.get(target, prop)
    },
    set(target, prop, value) {
      if (typeof prop === 'string' && !isNaN(Number(prop))) {
        if (isY(value)) {
          value = fromY(value)
        }
        ydoc.transact(() => {
          const index = Number(prop)
          if (index < target.length) {
            target.delete(index, 1)
            target.insert(index, [toY(value)])
          } else if (index === target.length) {
            target.insert(target.length, [toY(value)])
          }
        })
        return true
      }
      throw new Error('Cannot set property ' + String(prop) + ' on YArray')
      ////return Reflect.set(target, prop, value)
    },
  })
  return proxy as unknown as SAny[]
}

export function proxyYMap(o: YMap<YAny>, ydoc: YDoc) {
  ////o.observe((event) => {
  return new Proxy(o, {
    ownKeys(target) {
      return Array.from(target.keys())
    },
    getOwnPropertyDescriptor(target, p) {
      if (typeof p === 'string' && target.has(p)) {
        return {
          configurable: true,
          enumerable: true,
          value: proxyY(target.get(p), ydoc),
          writable: true,
        }
      }
      return undefined
    },
    get(target, prop) {
      if (prop === Symbol.iterator) {
        // objects are not iterable
        console.warn('YMap proxy is considered an object, not iterable, use Object.entries()')
        return undefined
      }
      if (typeof prop === 'string' && target.has(prop)) {
        const v = target.get(prop)
        return proxyY(v, ydoc)
      }
      return Reflect.get(target, prop)
    },
    set(target, prop, value) {
      if (isY(value)) {
        value = fromY(value)
      }
      if (typeof prop === 'string') {
        target.set(prop, toY(value))
        return true
      }
      throw new Error('Cannot set property ' + String(prop) + ' on YMap')
      //return Reflect.set(target, prop, value)
    },
  }) as unknown as { [key: string]: SAny }
}

export function fromY(o: YAny | undefined): SAny | undefined {
  if (o === undefined || typeof o === 'number' || o === null) {
    return o
  }
  return o.toJSON()
}
export function toY(o: SAny): YAny {
  if (o === undefined || typeof o === 'number' || o === null) {
    return o
  }
  if (Array.isArray(o)) {
    const ya = new YArray<YAny>()
    ya.insert(0, o.map(toY))
    return ya
  }

  if (typeof o === 'object') {
    const ym = new YMap<YAny>()
    for (const k of Object.getOwnPropertyNames(o)) {
      if (k === 'client') { // DETECT ERRORS... remove when stable (because here we prevent using client as a genuine key)
        throw new Error('toY: skipping client key')
      }
      ym.set(k, toY(o[k]))
    }
    return ym
  }
  if (typeof o === 'string') {
    return new YText(o)
  }
  throw new Error('Unsupported type for toY: ' + typeof o)
}

export function proxyY(o: YAny | undefined, ydoc: YDoc): SAny | undefined {
  if (o === undefined || typeof o === 'number') {
    return o
  }
  if (isYMap(o)) {
    return proxyYMap(o as YMap<YAny>, ydoc)
  } else if (isYArray(o)) {
    return proxyYArray(o as YArray<YAny>, ydoc)
  } else if (isYText(o)) {
    return (o as YText).toString()
  }
  throw new Error('Unsupported Y type: ' + className(o))
}

export function yjsRef<T>(ydoc: YDoc, path: string) {
  const parts = path.split('/').filter(p => p)
  if (parts.length === 0) {
    throw new Error('Invalid path for yjsRef: ' + path)
  }
  return customRef((track, trigger) => {
    const obj = (() => {
      const p = [...parts]
      let o = ydoc.getMap(p.shift()) as YAny | undefined
      while (o && p.length > 0) {
        const k = p.shift()!
        if (isYArray(o) && !isNaN(Number(k))) {
          const i = Number(k)
          o = (o as YArray<YAny>).get(i)
        } else if (isYMap(o)) {
          o = o.get(k)
        } else {
          throw new Error('Invalid path for yjsRef: ' + path + ' at ' + k + ' of type ' + className(o))
        }
        if (o === undefined || (!isYMap(o) && !isYArray(o))) {
          console.error('Path not found in yjsRef: ' + path)
          return undefined
        }
      }
      return o as YMap<YAny> | YArray<YAny> | undefined
    })()
    if (!obj) {
      console.error('Path not found in yjsRef: ' + path)
      return {
        get() {
          return [] as T[]
        },
        set() {
          throw new Error('Cannot set yjsRef directly')
        },
      }
    }
    const trig = useDebounceFn(trigger, 1)
    obj.observeDeep(() => {
      ////console.log('%%%%%%%%%% YJS observeDeep', events)
      trig()
    })
    let prox = proxyY(obj, ydoc) as T[]
    return {
      get() {
        track()
        // each access creates a proxy and so parses everything!
        prox = proxyY(obj, ydoc) as T[]
        return prox
      },
      set(v) {
        prox.splice(0, prox.length, ...v)
        trig()
      },
    }
  }) as Ref<T>
}

export function wrapYamlYText<T>(ytext: YText) {
  const status = ref('init' as 'init' | 'ok' | 'error' | 'parsing' | 'saving' | 'saved')
  const data = ref(null as T | null)
  function parse() {
    status.value = 'parsing'
    try {
      const raw = ytext.toJSON()
      if (!raw) throw new Error('Empty raw')
      const parsed = JsYaml.load(ytext.toJSON()) as T
      if (!parsed) throw new Error('Empty parsed')
      data.value = parsed
      status.value = 'ok'
    } catch (e) {
      status.value = 'error'
      throw e
    }
  }
  function save() {
    status.value = 'saving'
    const serialized = JsYaml.dump(data.value)
    ytext.doc!.transact(() => {
      status.value = 'saving'
      ytext.delete(0, ytext.length)
      ytext.insert(0, serialized)
      //ytext.delete(serialized.length, ytext.length)
      status.value = 'saved'
    })
  }
  ytext.observe(() => {
    parse()
  })
  watchDeep(data, () => {
    if (JSON.stringify(JsYaml.load(ytext.toJSON())) === JSON.stringify(data.value)) {
      return
    }
    save()
  })
  parse()
  return {
    data,
    ytext,
    status,
    save,
  }
}
