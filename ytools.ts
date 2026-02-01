import { Doc as YDoc, Map as YMap, Array as YArray, Text as YText } from 'yjs'
export { YDoc, YMap, YArray, YText }

export type YAny = YMap<YAny> | YArray<YAny> | YText | string | number
export type SAny = number | string | SAny[] | { [key: string]: SAny }

export function className(o: YAny | SAny | undefined): string {
  return o ? Object.getPrototypeOf(o)?.constructor?.name ?? typeof o : typeof o
}
/*
export const classNames = {
  YMap: className(new YMap()),
  YArray: className(new YArray()),
  YText: className(new YText('')),
}
*/
export function isY(o: YAny | SAny | undefined): o is YAny {
  return o instanceof YMap || o instanceof YArray || o instanceof YText
}
export function isYArray(o: YAny): o is YArray<YAny> {
  return o instanceof YArray
}
export function isYMap(o: YAny): o is YMap<YAny> {
  return o instanceof YMap
}
export function isYText(o: YAny): o is YText {
  return o instanceof YText
}

export function getY(doc: YDoc, path: string): YAny | string | number| undefined {
  const steps = path.split('/').filter((s) => s)
  let p = doc.getMap() as YAny //doc.getMap(steps.shift()) as YAny
  while (steps.length > 0) {
    const k = steps.shift()!
    if (p === undefined) {
      return undefined
    }
    if (isYMap(p)) {
      if (!p.has(k)) {
        return undefined
      }
      const o = p.get(k)
      if (typeof o === 'string' && steps.length === 0) {
        return o
      }
      if (typeof o === 'number' && steps.length === 0) {
        return o
      }
      if (o === undefined) {
        return undefined
      }
      if (!isY(o)) {
        return undefined
      }
      p = o as YAny
    } else if (isYArray(p)) {
      if (isNaN(Number(k))) {
        return undefined
      }
      const i = Number(k)
      if (i < 0 || i >= p.length) {
        return undefined
      }
      const o = p.get(i)
      if (!isY(o)) {
        return undefined
      }
      p = o
    }
  }
  return p
}

