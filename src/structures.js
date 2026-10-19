// Builds the elements for a data structure (array, matrix, tree, graph...).
// Returns a plain list of elements that share one group id (g) so they move together.
export const uid = () => Math.random().toString(36).slice(2, 9)

export function buildStructure(t, o, c, cur, measure) {
  const out = [], g = uid(), { n, m, base: b, edges, directed } = o, W = 56
  const A = (type, x, y, w, h, text, extra) => {
    const e = { id: uid(), stroke: cur.stroke, fill: cur.fill, sw: cur.sw, ff: cur.ff, type, x, y, w, h, text, g, ...extra }
    out.push(e); return e
  }
  const L = (cx, y, s) => {
    const e = { id: uid(), type: 'text', x: cx - measure(14, '' + s, cur.ff) / 2, y, text: '' + s, fs: 14, stroke: '#868e96', fill: 'transparent', sw: 2, ff: cur.ff, g }
    out.push(e); return e
  }
  const AR = (f, to, type = 'arrow') =>
    out.push({ id: uid(), type, from: f.id, to: to.id, x1: 0, y1: 0, x2: 0, y2: 0, stroke: cur.stroke, fill: 'transparent', sw: cur.sw, g })
  const row = k => [...Array(k)].map((_, i) => i)

  if (t === 'array' || t === 'queue') {
    const x0 = c.x - n * W / 2, y0 = c.y - W / 2, cs = row(n).map(i => A('rect', x0 + i * W, y0, W, W, ''))
    if (t === 'array') cs.forEach((_, i) => L(x0 + i * W + W / 2, y0 + W + 6, b + i))
    else { AR(L(x0 + W / 2, y0 - 56, 'front'), cs[0]); AR(L(x0 + (n - .5) * W, y0 - 56, 'rear'), cs[n - 1]) }
  } else if (t === 'stack') {
    const x0 = c.x - W / 2, y0 = c.y - n * W / 2, cs = row(n).map(i => A('rect', x0, y0 + i * W, W, W, ''))
    AR(L(x0 + W + 70, y0 + W / 2 - 8, 'top'), cs[0])
  } else if (t === 'matrix') {
    const s = 52, x0 = c.x - m * s / 2, y0 = c.y - n * s / 2
    row(n).forEach(i => row(m).forEach(j => A('rect', x0 + j * s, y0 + i * s, s, s, '')))
    row(m).forEach(j => L(x0 + j * s + s / 2, y0 - 22, b + j))
    row(n).forEach(i => L(x0 - 14, y0 + i * s + s / 2 - 8, b + i))
  } else if (t === 'linked') {
    const x0 = c.x - n * 60, y0 = c.y - 23, ns = row(n).map(i => A('rect', x0 + i * 120, y0, 70, 46, ''))
    ns.slice(1).forEach((q, i) => AR(ns[i], q))
    AR(L(x0 + 35, y0 - 56, 'head'), ns[0]); AR(ns[n - 1], L(x0 + n * 120 - 10, y0 + 13, 'null'))
  } else if (t === 'map') {
    const x0 = c.x - 100, y0 = c.y - (n + 1) * 20
    A('rect', x0, y0, 90, 40, 'key', { fill: '#dee2e6' }); A('rect', x0 + 90, y0, 110, 40, 'value', { fill: '#dee2e6' })
    row(n).forEach(i => { A('rect', x0, y0 + 40 + i * 40, 90, 40, ''); A('rect', x0 + 90, y0 + 40 + i * 40, 110, 40, '') })
  } else if (t === 'set') {
    const k = Math.ceil(Math.sqrt(n)), r = Math.ceil(n / k), w = k * 62, h = r * 62
    A('ellipse', c.x - w * .85, c.y - h * .85, w * 1.7, h * 1.7, '')
    row(n).forEach(i => A('ellipse', c.x - w / 2 + (i % k) * 62 + 7, c.y - h / 2 + Math.floor(i / k) * 62 + 7, 48, 48, ''))
  } else {
    const nd = (i, x, y) => A('ellipse', x - 23, y - 23, 46, 46, '' + (b + i))
    if (t === 'tree') {
      const D = Math.floor(Math.log2(n)), Wd = Math.pow(2, D) * 64
      const ns = row(n).map(i => {
        const l = Math.floor(Math.log2(i + 1)), p = i + 1 - Math.pow(2, l)
        return nd(i, c.x - Wd / 2 + (p + .5) * Wd / Math.pow(2, l), c.y - D * 45 + l * 90)
      })
      ns.forEach((q, i) => i && AR(ns[Math.floor((i - 1) / 2)], q, 'line'))
    } else {
      const r = Math.max(90, n * 24)
      const ns = row(n).map(i => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return nd(i, c.x + r * Math.cos(a), c.y + r * Math.sin(a)) })
      ;(edges || '').split(/[,;\n]+/).map(s => s.trim().split(/[\s\-–>]+/).map(Number))
        .filter(a => a.length >= 2 && a.every(v => !isNaN(v)))
        .forEach(([u, v]) => { if (ns[u - b] && ns[v - b] && u !== v) AR(ns[u - b], ns[v - b], directed ? 'arrow' : 'line') })
    }
  }
  return out
}
