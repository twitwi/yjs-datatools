
export const SEP = '::'
export const TAGSEP = ','

const EG: Record<string, string> = {
  localhost: 'ws://localhost:1234::TEST/overtypst::TEST_overtypst',
  otherwise: '44.heeere.com::test-codyjs::test-codyjs_devmodeofthedead::test.typ',
  viewonly: '44.heeere.com::test-codyjs::test-codyjs_read::test.typ::readonly',
  oldlocalhost: 'ws://localhost:1234::TEST/overtypst//test.typ::TEST_overtypst',
  oldotherwise: '44.heeere.com::test-codyjs//test.typ::test-codyjs_devmodeofthedead',
  oldviewonly: '44.heeere.com::test-codyjs//test.typ::test-codyjs_read:::',
  oldoldv1: '43.heeere.com::file1.typ',
}
// IDEAS:
// - receive the Map
// - allow simple "variables", i.e. subpart replacement, e.g.
//   "localhost": "(dev)::TEST/overtypst::TEST_overtypst"
//   "(dev)": "ws://localhost:1234"
export function expandHash(hash: string): string {
  let defaultConfig = EG.default
  const gt = globalThis as unknown as Record<'window', any> // ok outside browser
  if (gt.window !== undefined) {
    defaultConfig = gt.window.location.hostname === 'localhost' ? EG.localhost : EG.otherwise
  }
  const h = hash.replace(/^#\/?/, '') || defaultConfig
  return EG[h] ?? h
}

export function parseHash(h: string): { server: string; docname: string; token: string; path: string; tags: string[] } {
  const parts = h.split(SEP)
  if (parts.length < 2) throw new Error('Invalid hash format')
  const [server, docname, token, pathRaw = '', tagsStr = ''] = parts
  if (!server || !docname) throw new Error('Invalid hash format')
  const path = pathRaw.replace(/^\//, '')
  const tags = tagsStr
    ? tagsStr
        .split(TAGSEP)
        .map((t) => t.trim())
        .filter((t) => t)
    : []
  return { server, docname, token, path, tags }
}
