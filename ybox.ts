import * as Y from 'yjs'
import type { YAny } from './ytools'

export const SEP = '::'
export const EG_CONFIG_NOBOX = `todo.com${SEP}doc${SEP}token${SEP}sub/folder`
export const EG_CONFIG_BOX = `todo.com${SEP}doc${SEP}token${SEP}sub/folder/@/path`
export const ROOT_ID = 'root:' // for boxes

//export function getYMap(doc: Y.Doc, path: string, create: boolean = false): any {
//}

export function getYText(doc: Y.Doc, path: string, create: boolean = false): Y.Text {
  const steps = path.split('/').filter((s) => s)
  if (steps.length === 0) throw new Error('Path cannot be empty')
  if (steps.length === 1) {
    const k = steps[0]
    return doc.getText(k)
  }
  let p = doc.getMap() // doc.getMap(steps.shift())
  while (steps.length > 1) {
    const k = steps.shift()!
    if (k === '@') {
      return getYTextInBox(p, steps.join('/'), create)
    }
    if (!p.has(k) && create) {
      p.set(k, new Y.Map())
    }
    p = p.get(k) as Y.Map<unknown>
  }
  const k = steps.shift()!
  if (!p.has(k) && create) {
    p.set(k, new Y.Text())
  }
  return p.get(k) as Y.Text
}

export function getYBoxFor(doc: Y.Doc, path: string): Y.Map<any> | undefined {
  const steps = path.split('/').filter((s) => s)
  if (steps.length < 2) throw new Error('Path must have at least two segments for box')
  let p = doc.getMap()//steps.shift())
  while (steps.length > 0) {
    const k = steps.shift()!
    if (k === '@') {
      return p
    }
    p = p.get(k) as Y.Map<unknown>
  }
  return undefined
}

export function getYTextInBox(box: Y.Map<unknown>, path: string, create: boolean = false): Y.Text {
  const steps = path.split('/').filter((s) => s)
  if (steps.length === 0) throw new Error('Path cannot be empty')
  if (!box.has(ROOT_ID)) {
    throw new Error('Box does not have root')
  }
  const root = box.get(ROOT_ID)
  let p = root as Y.Map<unknown>
  let pid = ROOT_ID
  while (steps.length > (create ? 1 : 0)) {
    const k = steps.shift()!
    if (p.get('type') !== 'directory') {
      throw new Error(`Path ${path} is not a directory (at ${k})`)
    }
    const children = p.get('children') as Y.Map<string>
    const subk = children.get(k)
    if (!subk) {
      throw new Error(`Path ${path} does not exist (at ${k})`)
    }
    p = box.get(subk) as Y.Map<unknown>
    pid = subk
  }
  if (create) {
    const k = steps.shift()!
    if (p.get('type') !== 'directory') {
      throw new Error(`(create) Last path ${path} is not a directory (at ${k})`)
    }
    const children = p.get('children') as Y.Map<string>
    const subk = children.get(k)
    if (!subk) {
      const newId = _generateId()
      if (children.has(newId)) {
        throw new Error(`Generated id ${newId} already exists in children, retry`) // very unlikely
      }
      const newTextFile = new Y.Map<YAny>()
      newTextFile.set('type', 'text')
      newTextFile.set('parent', pid)
      newTextFile.set('ctime', Date.now())
      newTextFile.set('mtime', Date.now())
      const content = new Y.Text()
      newTextFile.set('content', content)
      children.set(k, newId)
      box.set(newId, newTextFile)
      return content
    } else {
      throw new Error(`Path ${path} already exists (at ${k})`)
    }
  } else {
    if (p.get('type') !== 'text') {
      throw new Error(`Path ${path} is not a text`)
    }
    return p.get('content') as Y.Text
  }
}

export function _generateId(): string {
  return "id:" + Math.random().toString(36).slice(2, 10);
  // or: return crypto.randomUUID();
}
