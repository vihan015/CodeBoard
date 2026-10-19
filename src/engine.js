// Canvas whiteboard engine. Plain JS (no React) so drawing stays fast;
// React talks to it through the returned API and the onState callback.
import { uid, buildStructure } from './structures.js'
import { FAM } from './fonts.js'

const SH = ['rect', 'ellipse', 'diamond'], RS = [...SH, 'image'], SB = [...RS, 'text', 'note']
const BOX = [...SH, 'note', 'image'], LBL = [...SH, 'note', 'text'] // BOX: has x/y/w/h, LBL: can hold text
const fam = e => FAM[e.ff] || FAM.sans
// notes: darker tint in dark mode, word wrap inside the note
const shade = c => { const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c); if (!m) return c; return '#' + [1, 2, 3].map(i => Math.round(parseInt(m[i], 16) * .32).toString(16).padStart(2, '0')).join('') }
function wrapText(c, s, maxW) {
  const out = []
  s.split('\n').forEach(par => {
    let line = ''
    par.split(' ').forEach(w => { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { out.push(line); line = w } else line = t })
    out.push(line)
  })
  return out
}
const KEY = 'dsb.scene'

export function createEngine(cv, { onState, toast, onCanvasDown, onContext }) {
  const ctx = cv.getContext('2d')
  let els = [], sel = new Set(), V = { x: 0, y: 0, z: 1 }, tool = 'select', lock = true
  let cur = { stroke: '#1e1e1e', fill: 'transparent', sw: 2, ff: 'sans' }
  let hist = [], fut = [], IMG = {}, IC = {}, drag = null, mq = null, hv = null
  let space = false, dark = false, ed = null, lt = null, st, ct, clipEls = [], pasteN = 0, styleClip = null

  try {
    const sv = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (sv) { els = sv.els || []; V = sv.V || V; IMG = sv.IMG || {}; cur = sv.cur || cur; cur.ff = cur.ff || 'sans'; lock = sv.lock !== false }
  } catch { /* ignore corrupted storage */ }

  const S = () => els.filter(e => sel.has(e.id))
  const byId = id => id && els.find(e => e.id === id)
  const measure = (fs, s, ff) => { ctx.font = `${fs}px ${FAM[ff] || FAM.sans}`; return ctx.measureText(s).width }
  const center = () => ({ x: (innerWidth / 2 - V.x) / V.z, y: (innerHeight / 2 - V.y) / V.z })

  function emit() {
    const s0 = S()[0], f = s0 || cur
    onState({ tool, lock, cur: { ...cur }, sel: { stroke: f.stroke || cur.stroke, fill: f.fill || cur.fill, sw: f.sw || cur.sw, ff: s0 ? s0.ff || 'sans' : cur.ff }, zoom: V.z })
  }
  function save(now) {
    clearTimeout(st)
    const f = () => {
      const used = {}; els.forEach(e => e.k && (used[e.k] = IMG[e.k]))
      try { localStorage.setItem(KEY, JSON.stringify({ els, V, IMG: used, cur, lock })) }
      catch { toast('Browser storage is full. Remove some images or save the board as a file.') }
    }
    now ? f() : (st = setTimeout(f, 250))
  }
  const snap = () => JSON.stringify(els)
  function commit() {
    const s = snap()
    if (hist[hist.length - 1] !== s) { hist.push(s); if (hist.length > 60) hist.shift(); fut = [] }
    save()
  }
  const commitSoon = () => { clearTimeout(ct); ct = setTimeout(commit, 400) }
  function undo() { if (hist.length < 2) return; fut.push(hist.pop()); els = JSON.parse(hist[hist.length - 1]); sel.clear(); emit(); draw(); save() }
  function redo() { if (!fut.length) return; const s = fut.pop(); hist.push(s); els = JSON.parse(s); sel.clear(); emit(); draw(); save() }
  const col = c => dark && c === '#1e1e1e' ? '#e8e8ec' : c

  /* ---------- geometry ---------- */
  function img(k) {
    if (!IC[k] && IMG[k]) { const i = new Image(); i.onload = draw; i.src = IMG[k]; IC[k] = i }
    return IC[k]
  }
  function bb(e) {
    if (e.type === 'text') {
      ctx.font = `${e.fs}px ${fam(e)}`
      const L = e.text.split('\n')
      return { x: e.x, y: e.y, w: Math.max(10, ...L.map(l => ctx.measureText(l).width)), h: L.length * e.fs * 1.3 }
    }
    if (e.type === 'arrow' || e.type === 'line') {
      const [a, b] = ends(e)
      return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }
    }
    if (e.type === 'pen') {
      const X = e.pts.map(p => p[0]), Y = e.pts.map(p => p[1]), x = Math.min(...X), y = Math.min(...Y)
      return { x, y, w: Math.max(...X) - x, h: Math.max(...Y) - y }
    }
    return { x: Math.min(e.x, e.x + e.w), y: Math.min(e.y, e.y + e.h), w: Math.abs(e.w), h: Math.abs(e.h) }
  }
  function clip(s, t) {
    const b = bb(s), cx = b.x + b.w / 2, cy = b.y + b.h / 2, dx = t.x - cx, dy = t.y - cy
    if (!dx && !dy) return { x: cx, y: cy }
    const hw = b.w / 2, hh = b.h / 2
    let k
    if (s.type === 'ellipse') k = 1 / Math.hypot(dx / hw, dy / hh)
    else if (s.type === 'diamond') k = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh)
    else k = Math.min(hw / Math.abs(dx), hh / Math.abs(dy))
    k = Math.min(k, 1)
    return { x: cx + dx * k, y: cy + dy * k }
  }
  function ends(e) {
    const A = byId(e.from), B = byId(e.to)
    const c = s => { const b = bb(s); return { x: b.x + b.w / 2, y: b.y + b.h / 2 } }
    const pa = A ? c(A) : { x: e.x1, y: e.y1 }, pb = B ? c(B) : { x: e.x2, y: e.y2 }
    return [A ? clip(A, pb) : pa, B ? clip(B, pa) : pb]
  }
  function bake(e) { const [a, b] = ends(e); Object.assign(e, { x1: a.x, y1: a.y, x2: b.x, y2: b.y, from: null, to: null }) }
  function dseg(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy
    let t = l ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l : 0
    t = Math.max(0, Math.min(1, t))
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
  }
  function hit(e, p) {
    if (e.type === 'line' || e.type === 'arrow') { const [a, b] = ends(e); return dseg(p, a, b) < 6 / V.z + e.sw }
    if (e.type === 'pen') {
      for (let i = 1; i < e.pts.length; i++)
        if (dseg(p, { x: e.pts[i - 1][0], y: e.pts[i - 1][1] }, { x: e.pts[i][0], y: e.pts[i][1] }) < 6 / V.z + e.sw) return true
      return false
    }
    const b = bb(e), dx = p.x - b.x - b.w / 2, dy = p.y - b.y - b.h / 2, hw = b.w / 2 + 2, hh = b.h / 2 + 2
    if (e.type === 'ellipse') return (dx / hw) ** 2 + (dy / hh) ** 2 <= 1
    if (e.type === 'diamond') return Math.abs(dx) / hw + Math.abs(dy) / hh <= 1
    return Math.abs(dx) <= hw && Math.abs(dy) <= hh
  }
  // smallest element under the pointer wins, so small cells beat big containers
  function top(p, f, incl) {
    let best = null, ba = 1e18
    for (const e of els) {
      if (f && !f(e)) continue
      if (e.locked && !incl) continue
      if (hit(e, p)) { const b = bb(e), a = b.w * b.h; if (a <= ba) { ba = a; best = e } }
    }
    return best
  }
  function mv(e, dx, dy) {
    if (e.pts) e.pts.forEach(p => { p[0] += dx; p[1] += dy })
    else if (e.x1 !== undefined) { e.x1 += dx; e.x2 += dx; e.y1 += dy; e.y2 += dy }
    else { e.x += dx; e.y += dy }
  }
  function del(list) {
    const ids = new Set(list.map(e => e.id))
    els.filter(e => !ids.has(e.id) && ((e.from && ids.has(e.from)) || (e.to && ids.has(e.to)))).forEach(bake)
    els = els.filter(e => !ids.has(e.id))
    sel = new Set([...sel].filter(i => !ids.has(i)))
  }

  /* ---------- rendering ---------- */
  function txt(c, s, x, y, fs, color, centered, ff) {
    c.font = `${fs}px ${ff || FAM.sans}`; c.fillStyle = color
    const L = s.split('\n'), h = fs * 1.3
    c.textAlign = centered ? 'center' : 'left'; c.textBaseline = 'middle'
    const y0 = centered ? y - (L.length - 1) * h / 2 : y + h / 2
    L.forEach((l, i) => c.fillText(l, x, y0 + i * h))
  }
  function drawEl(c, e) {
    c.lineWidth = e.sw || 2; c.strokeStyle = col(e.stroke); c.lineCap = c.lineJoin = 'round'; c.fillStyle = e.fill || 'transparent'
    const b = e.type !== 'pen' && bb(e)
    if (SH.includes(e.type)) {
      c.beginPath()
      if (e.type === 'rect') { c.roundRect ? c.roundRect(b.x, b.y, b.w, b.h, 6) : c.rect(b.x, b.y, b.w, b.h) }
      else if (e.type === 'ellipse') c.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, 7)
      else { c.moveTo(b.x + b.w / 2, b.y); c.lineTo(b.x + b.w, b.y + b.h / 2); c.lineTo(b.x + b.w / 2, b.y + b.h); c.lineTo(b.x, b.y + b.h / 2); c.closePath() }
      if (e.fill && e.fill !== 'transparent') c.fill()
      c.stroke()
      if (e.text && !e.ed) txt(c, e.text, b.x + b.w / 2, b.y + b.h / 2, e.fs || 18, dark && e.fill && e.fill !== 'transparent' ? '#1e1e1e' : col(e.stroke), true, fam(e))
    } else if (e.type === 'note') {
      const fs = e.fs || 20, pad = 14
      c.save(); c.shadowColor = 'rgba(0,0,0,.28)'; c.shadowBlur = 12; c.shadowOffsetY = 3
      c.fillStyle = dark ? shade(e.fill) : e.fill; c.beginPath()
      c.roundRect ? c.roundRect(b.x, b.y, b.w, b.h, 10) : c.rect(b.x, b.y, b.w, b.h)
      c.fill(); c.restore()
      if (e.text && !e.ed) {
        c.font = `${fs}px ${fam(e)}`; c.fillStyle = dark ? '#ece9e0' : '#1e1e1e'; c.textAlign = 'left'; c.textBaseline = 'top'
        wrapText(c, e.text, b.w - 2 * pad).forEach((l, i) => { if (pad + (i + 1) * fs * 1.3 <= b.h - 22) c.fillText(l, b.x + pad, b.y + pad + i * fs * 1.3) })
      }
      c.font = `${Math.max(9, fs * .65)}px ${FAM.sans}`; c.fillStyle = dark ? '#b9b5a8' : '#5c5a52'; c.textAlign = 'right'; c.textBaseline = 'bottom'
      c.fillText(e.d || '', b.x + b.w - pad, b.y + b.h - 10)
    } else if (e.type === 'text') { if (!e.ed) txt(c, e.text, e.x, e.y, e.fs, col(e.stroke), false, fam(e)) }
    else if (e.type === 'image') { const i = img(e.k); if (i && i.complete) { c.save(); c.translate(b.x + b.w / 2, b.y + b.h / 2); c.scale(e.fx ? -1 : 1, e.fy ? -1 : 1); c.drawImage(i, -b.w / 2, -b.h / 2, b.w, b.h); c.restore() } }
    else if (e.type === 'pen') {
      // smooth curve: quadratic segments through the midpoints of the recorded points
      const p = e.pts
      c.beginPath(); c.moveTo(p[0][0], p[0][1])
      if (p.length < 3) { p.slice(1).forEach(q => c.lineTo(q[0], q[1])); if (p.length === 1) c.lineTo(p[0][0] + .1, p[0][1]) }
      else {
        for (let i = 1; i < p.length - 1; i++) c.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2)
        c.lineTo(p[p.length - 1][0], p[p.length - 1][1])
      }
      c.stroke()
    } else {
      const [a, d] = ends(e)
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(d.x, d.y); c.stroke()
      if (e.type === 'arrow') {
        const t = Math.atan2(d.y - a.y, d.x - a.x), s = 9 + c.lineWidth * 2
        c.beginPath(); c.moveTo(d.x - s * Math.cos(t - .4), d.y - s * Math.sin(t - .4)); c.lineTo(d.x, d.y); c.lineTo(d.x - s * Math.cos(t + .4), d.y - s * Math.sin(t + .4)); c.stroke()
      }
    }
  }
  function paint(c, vx, vy, z, W, H, ui, list = els) {
    c.imageSmoothingQuality = 'high'
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = dark ? '#121212' : '#ffffff'; c.fillRect(0, 0, W, H)
    c.setTransform(z, 0, 0, z, vx, vy)
    list.forEach(e => drawEl(c, e))
    if (!ui) return
    const u = 1 / V.z, ac = dark ? '#a8a5ff' : '#6965db'
    c.strokeStyle = ac; c.fillStyle = ac; c.lineWidth = 1.5 * u
    if (hv) { const e = byId(hv); if (e) { const b = bb(e); c.lineWidth = 3 * u; c.strokeRect(b.x - 4 * u, b.y - 4 * u, b.w + 8 * u, b.h + 8 * u); c.lineWidth = 1.5 * u } }
    S().forEach(e => {
      if (e.type === 'arrow' || e.type === 'line') ends(e).forEach(p => {
        c.beginPath(); c.arc(p.x, p.y, 6 * u, 0, 7); c.fill()
        c.strokeStyle = dark ? '#121212' : '#fff'; c.lineWidth = 2 * u; c.stroke(); c.strokeStyle = ac; c.lineWidth = 1.5 * u
      })
    })
    const hs = handleList(), sb = selBox()
    if (hs.length && sb) {
      const p = 6 * u
      c.setLineDash([5 * u, 4 * u]); c.strokeRect(sb.x - p, sb.y - p, sb.w + 2 * p, sb.h + 2 * p); c.setLineDash([])
      c.fillStyle = dark ? '#121212' : '#fff'
      hs.forEach(o => { c.beginPath(); c.rect(o.x - 4.5 * u, o.y - 4.5 * u, 9 * u, 9 * u); c.fill(); c.stroke() })
      c.fillStyle = ac
    }
    if (mq) { c.globalAlpha = .12; c.fillRect(mq.x, mq.y, mq.w, mq.h); c.globalAlpha = 1; c.strokeRect(mq.x, mq.y, mq.w, mq.h) }
  }
  // canvas pixels are matched to its real on-screen size so nothing gets resampled (no blur)
  function draw() { const d = cv.width / (cv.clientWidth || innerWidth); paint(ctx, d * V.x, d * V.y, d * V.z, cv.width, cv.height, true) }
  function resize() {
    const d = devicePixelRatio || 1
    cv.width = Math.round((cv.clientWidth || innerWidth) * d); cv.height = Math.round((cv.clientHeight || innerHeight) * d)
    draw()
  }

  /* ---------- tools ---------- */
  const curFor = t => t === 'select' ? 'default' : t === 'hand' ? 'grab' : t === 'text' ? 'text' : t === 'eraser' ? 'cell' : 'crosshair'
  function setTool(t) {
    closeEd(); tool = t; if (t !== 'select') sel.clear()
    cv.style.cursor = curFor(t)
    emit(); draw()
  }
  function setProp(k, v) {
    cur[k] = v
    S().forEach(e => { if (k === 'fill' && !(SH.includes(e.type) || e.type === 'note')) return; if (k === 'ff' && !LBL.includes(e.type)) return; e[k] = v })
    emit(); draw(); commitSoon()
  }

  /* ---------- pointer ---------- */
  const P = ev => { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left - V.x) / V.z, y: (ev.clientY - r.top - V.y) / V.z } }
  const newText = (p, s = '') => ({ id: uid(), type: 'text', x: p.x, y: p.y, text: s, fs: 20, stroke: cur.stroke, fill: 'transparent', sw: 2, ff: cur.ff })
  function finish(e) { sel = lock ? new Set() : new Set([e.id]); if (!lock) setTool('select') }
  function erase(p) { const t = top(p); if (t) { del([t]); draw() } }

  /* ---- resize handles: work on any selection (shapes, text, pen, images, whole structures) ---- */
  const HCUR = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }
  function selBox() {
    const L = S(); if (!L.length) return null
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    L.forEach(e => { const b = bb(e); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h) })
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  }
  function handleList() {
    const L = S()
    if (!L.length || (L.length === 1 && (L[0].type === 'arrow' || L[0].type === 'line'))) return []
    const b = selBox(), p = 6 / V.z, x = b.x - p, y = b.y - p, w = b.w + 2 * p, h = b.h + 2 * p
    const out = [{ h: 'nw', x, y }, { h: 'ne', x: x + w, y }, { h: 'se', x: x + w, y: y + h }, { h: 'sw', x, y: y + h }]
    if (w * V.z > 70) out.push({ h: 'n', x: x + w / 2, y }, { h: 's', x: x + w / 2, y: y + h })
    if (h * V.z > 70) out.push({ h: 'e', x: x + w, y: y + h / 2 }, { h: 'w', x, y: y + h / 2 })
    return out
  }
  const handleAt = p => handleList().find(o => Math.hypot(p.x - o.x, p.y - o.y) < 10 / V.z)
  function startResize(hd) {
    const L = S()
    L.forEach(e => { if (BOX.includes(e.type)) Object.assign(e, bb(e)) })
    drag = { k: 'gr', h: hd.h, box: selBox(), o: L.map(e => JSON.parse(JSON.stringify(e))) }
  }

  function onDown(ev) {
    if (ev.button > 1) return
    onCanvasDown(); closeEd(); cv.setPointerCapture(ev.pointerId)
    const p = P(ev)
    if (tool === 'hand' || space || ev.button === 1) { drag = { k: 'pan', sx: ev.clientX, sy: ev.clientY, vx: V.x, vy: V.y }; return }
    const base = { id: uid(), stroke: cur.stroke, fill: cur.fill, sw: cur.sw, ff: cur.ff }
    if (tool === 'select') {
      const one = sel.size === 1 && S()[0]
      if (one && (one.type === 'arrow' || one.type === 'line')) {
        // grab an end point: drag it alone, and it re-attaches to whatever shape it lands on
        const [a, b] = ends(one)
        const w = Math.hypot(p.x - a.x, p.y - a.y) < 12 / V.z ? 1 : Math.hypot(p.x - b.x, p.y - b.y) < 12 / V.z ? 2 : 0
        if (w) { Object.assign(one, { x1: a.x, y1: a.y, x2: b.x, y2: b.y }); drag = { k: 'ep', e: one, w }; return }
      }
      const hd = handleAt(p)
      if (hd) { startResize(hd); return }
      const t = top(p)
      if (t) {
        const ids = (t.g ? els.filter(x => x.g === t.g) : [t]).map(x => x.id)
        if (ev.shiftKey) ids.every(i => sel.has(i)) ? ids.forEach(i => sel.delete(i)) : ids.forEach(i => sel.add(i))
        else if (!sel.has(t.id)) sel = new Set(ids)
        S().forEach(e => { if ((e.type === 'arrow' || e.type === 'line') && ((e.from && !sel.has(e.from)) || (e.to && !sel.has(e.to)))) bake(e) })
        drag = { k: 'mv', p }
      } else { if (!ev.shiftKey) sel = new Set(); drag = { k: 'mq', p } }
      emit(); draw(); return
    }
    if (SH.includes(tool) || tool === 'note') {
      const e = { ...base, type: tool, x: p.x, y: p.y, w: 0, h: 0, text: '' }
      if (tool === 'note') { e.fill = cur.fill === 'transparent' ? '#ffec99' : cur.fill; e.d = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }
      els.push(e); drag = { k: 'dr', e, p }
    }
    else if (tool === 'arrow' || tool === 'line') {
      const s = top(p, x => SB.includes(x.type))
      const e = { ...base, fill: 'transparent', type: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y, from: s ? s.id : null, to: null }
      els.push(e); drag = { k: 'ar', e }
    } else if (tool === 'pen') { const e = { ...base, fill: 'transparent', type: 'pen', pts: [[p.x, p.y]] }; els.push(e); drag = { k: 'pen', e } }
    else if (tool === 'text') drag = { k: 'tx', p }
    else if (tool === 'eraser') { drag = { k: 'er' }; erase(p) }
    draw()
  }
  function onMove(ev) {
    if (!drag) {
      if (tool !== 'select') return
      const one = sel.size === 1 && S()[0], q = P(ev); let cs = 'default'
      if (one && (one.type === 'arrow' || one.type === 'line')) { const [a, b] = ends(one); if (Math.hypot(q.x - a.x, q.y - a.y) < 12 / V.z || Math.hypot(q.x - b.x, q.y - b.y) < 12 / V.z) cs = 'pointer' }
      else { const hd = handleAt(q); if (hd) cs = HCUR[hd.h] }
      if (cv.style.cursor !== cs) cv.style.cursor = cs
      return
    }
    const p = P(ev), d = drag
    if (d.k === 'pan') { V.x = d.vx + ev.clientX - d.sx; V.y = d.vy + ev.clientY - d.sy }
    else if (d.k === 'mv') { const dx = p.x - d.p.x, dy = p.y - d.p.y; S().forEach(e => mv(e, dx, dy)); d.p = p; d.m = 1 }
    else if (d.k === 'ep') {
      const e = d.e, other = d.w === 1 ? e.to : e.from
      const s = top(p, x => SB.includes(x.type) && x.id !== other), id = s ? s.id : null
      if (d.w === 1) { e.x1 = p.x; e.y1 = p.y; e.from = id } else { e.x2 = p.x; e.y2 = p.y; e.to = id }
      hv = id
    }
    else if (d.k === 'gr') {
      const { box: b, h } = d, corner = h.length === 2
      const ax = h.includes('w') ? b.x + b.w : b.x, ay = h.includes('n') ? b.y + b.h : b.y
      let sx = h.includes('e') ? (p.x - ax) / (b.w || 1) : h.includes('w') ? (ax - p.x) / (b.w || 1) : 1
      let sy = h.includes('s') ? (p.y - ay) / (b.h || 1) : h.includes('n') ? (ay - p.y) / (b.h || 1) : 1
      if (b.w < 1) sx = 1
      if (b.h < 1) sy = 1
      // corners keep proportions with Shift, or when only text is selected
      if (corner && (ev.shiftKey || d.o.every(o => o.type === 'text'))) sx = sy = (sx + sy) / 2
      sx = Math.max(.05, sx); sy = Math.max(.05, sy)
      const fk = corner ? (sx + sy) / 2 : h === 'e' || h === 'w' ? sx : sy
      const X = v => ax + (v - ax) * sx, Y = v => ay + (v - ay) * sy
      d.o.forEach(o => {
        const e = byId(o.id); if (!e) return
        if (o.pts) e.pts = o.pts.map(q => [X(q[0]), Y(q[1])])
        else if (o.x1 !== undefined) { e.x1 = X(o.x1); e.y1 = Y(o.y1); e.x2 = X(o.x2); e.y2 = Y(o.y2) }
        else { e.x = X(o.x); e.y = Y(o.y); if (o.type !== 'text') { e.w = o.w * sx; e.h = o.h * sy } }
        if (LBL.includes(o.type)) e.fs = Math.max(6, Math.min(400, (o.fs || (o.type === 'text' || o.type === 'note' ? 20 : 18)) * fk))
      })
    }
    else if (d.k === 'dr') {
      let w = p.x - d.p.x, h = p.y - d.p.y
      if (ev.shiftKey) { const s = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * s; h = Math.sign(h || 1) * s }
      d.e.w = w; d.e.h = h
    } else if (d.k === 'ar') {
      const e = d.e; e.x2 = p.x; e.y2 = p.y
      const s = top(p, x => SB.includes(x.type) && x.id !== e.from)
      e.to = s ? s.id : null; hv = e.to
    } else if (d.k === 'pen') {
      const evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : []
      for (const x of evs.length ? evs : [ev]) {
        const q = P(x), l = d.e.pts[d.e.pts.length - 1]
        if (Math.hypot(q.x - l[0], q.y - l[1]) * V.z > 1.5) d.e.pts.push([q.x, q.y])
      }
    }
    else if (d.k === 'er') erase(p)
    else if (d.k === 'mq') {
      mq = { x: Math.min(d.p.x, p.x), y: Math.min(d.p.y, p.y), w: Math.abs(p.x - d.p.x), h: Math.abs(p.y - d.p.y) }; sel = new Set()
      els.forEach(e => {
        if (e.locked) return
        const b = bb(e)
        if (b.x < mq.x + mq.w && b.x + b.w > mq.x && b.y < mq.y + mq.h && b.y + b.h > mq.y)
          (e.g ? els.filter(x => x.g === e.g) : [e]).forEach(x => sel.add(x.id))
      })
    }
    draw()
  }
  function onUp() {
    if (!drag) return
    const d = drag, small = !(mq && (mq.w > 4 || mq.h > 4))
    drag = null; mq = null; hv = null
    // double click / double tap: edit a label, or type on empty space
    if (tool === 'select' && ((d.k === 'mv' && !d.m) || (d.k === 'mq' && small))) {
      const n = Date.now(), p = d.p
      if (lt && n - lt.t < 400 && Math.hypot(p.x - lt.x, p.y - lt.y) * V.z < 30) {
        lt = null
        const t = top(p)
        if (t && LBL.includes(t.type)) editText(t)
        else if (!t) editText(newText(p), true)
        emit(); draw(); return
      }
      lt = { t: n, x: p.x, y: p.y }
    }
    if (d.k === 'pan') save()
    else if (d.k === 'dr') {
      const e = d.e
      if (Math.abs(e.w) < 5 && Math.abs(e.h) < 5) { e.w = e.type === 'note' ? 200 : 110; e.h = e.type === 'note' ? 200 : 70; e.x -= e.w / 2; e.y -= e.h / 2 }
      Object.assign(e, bb(e)); finish(e); commit(); if (e.type === 'note') editText(e)
    } else if (d.k === 'ar') {
      const e = d.e, [a, b] = ends(e)
      if (Math.hypot(a.x - b.x, a.y - b.y) < 8) del([e]); else finish(e)
      commit()
    } else if (d.k === 'pen') { finish(d.e); commit() }
    else if (d.k === 'tx') editText(newText(d.p), true)
    else if (d.k === 'mv') { if (d.m) commit() }
    else if (d.k === 'gr' || d.k === 'er' || d.k === 'ep') commit()
    emit(); draw()
  }
  function zoomAt(cx, cy, f) {
    const r = cv.getBoundingClientRect(), x = cx - r.left, y = cy - r.top, z = Math.min(4, Math.max(.1, V.z * f))
    f = z / V.z; V.x = x - (x - V.x) * f; V.y = y - (y - V.y) * f; V.z = z
    emit(); draw(); save()
  }
  function onWheel(ev) {
    ev.preventDefault()
    if (ev.ctrlKey || ev.metaKey) zoomAt(ev.clientX, ev.clientY, Math.exp(-ev.deltaY * .01))
    else { V.x -= ev.deltaX; V.y -= ev.deltaY; draw(); save() }
  }

  /* ---------- text editing (a real textarea floated over the canvas) ---------- */
  function editText(e, isNew) {
    closeEd()
    const b = bb(e), z = V.z, fs = (e.fs || (e.type === 'note' ? 20 : 18)) * z, t = document.createElement('textarea')
    t.className = 'ed'; t.value = e.text || ''
    const x = b.x * z + V.x, y = b.y * z + V.y, lh = fs * 1.3
    const s = { fontSize: fs + 'px', fontFamily: fam(e), height: lh + 'px' }
    if (e.type === 'note') {
      const pd = 14 * z
      Object.assign(s, { left: x + pd + 'px', top: y + pd + 'px', width: b.w * z - 2 * pd + 'px', height: Math.max(lh, b.h * z - pd - 26 * z) + 'px', textAlign: 'left', border: 'none', overflow: 'auto', background: dark ? shade(e.fill) : e.fill, color: dark ? '#ece9e0' : '#1e1e1e' })
    } else if (e.type === 'text') Object.assign(s, { left: x + 'px', top: y + 'px', minWidth: '60px', width: Math.max(60, b.w * z + 20) + 'px' })
    else { const w = Math.max(b.w * z - 8, 90); Object.assign(s, { left: x + b.w * z / 2 - w / 2 + 'px', top: y + b.h * z / 2 - lh / 2 + 'px', width: w + 'px', textAlign: 'center' }) }
    Object.assign(t.style, s)
    document.body.append(t); e.ed = 1; ed = { e, t, isNew }
    const fit = () => { if (e.type === 'note') return; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }
    t.oninput = fit
    t.onkeydown = k => {
      k.stopPropagation()
      if (k.key === 'Enter' && !k.shiftKey) { k.preventDefault(); t.blur() }
      if (k.key === 'Escape') { ed.cancel = 1; t.blur() }
    }
    t.onblur = closeEd
    draw(); setTimeout(() => { t.focus(); t.select(); fit() }, 0)
  }
  function closeEd() {
    if (!ed) return
    const { e, t, isNew, cancel } = ed; ed = null
    const v = t.value; t.remove(); delete e.ed
    if (!cancel) e.text = v
    if (e.type === 'text' && !e.text.trim()) els = els.filter(x => x !== e)
    else if (isNew && !els.includes(e)) els.push(e)
    if (e.type === 'text' && isNew && tool === 'select' && els.includes(e)) sel = new Set([e.id])
    commit(); emit(); draw()
  }

  /* ---------- images, paste, drop ---------- */
  function addImage(f) {
    const r = new FileReader()
    r.onload = () => {
      const im = new Image()
      im.onload = () => {
        const k = uid(), s = Math.min(1, 480 / Math.max(im.width, im.height)), w = im.width * s, h = im.height * s, c = center()
        IMG[k] = r.result; IC[k] = im
        const e = { id: uid(), type: 'image', k, x: c.x - w / 2, y: c.y - h / 2, w, h, stroke: cur.stroke, fill: 'transparent', sw: 2 }
        els.push(e); sel = new Set([e.id]); commit(); emit(); draw()
      }
      im.src = r.result
    }
    r.readAsDataURL(f)
  }
  function onPaste(ev) {
    if (/INPUT|TEXTAREA/.test(ev.target.tagName)) return
    const cd = ev.clipboardData
    if (clipEls.length && (cd.getData('text/plain') || '').startsWith('dsb:')) { pasteEls(); ev.preventDefault(); return }
    const f = [...cd.items].find(i => i.type.startsWith('image/'))
    if (f) { addImage(f.getAsFile()); ev.preventDefault() }
    else { const s = cd.getData('text/plain'); if (s) { const e = newText(center(), s); e.fs = 16; els.push(e); sel = new Set([e.id]); commit(); emit(); draw() } }
  }
  const onDragOver = e => e.preventDefault()
  function onDrop(e) { e.preventDefault(); [...e.dataTransfer.files].filter(f => f.type.startsWith('image/')).forEach(addImage) }

  /* ---------- keyboard ---------- */
  /* ---------- clipboard, styles, order, flip, lock, context menu ---------- */
  const group = t => (t.g ? els.filter(x => x.g === t.g) : [t]).map(x => x.id)
  function snapshotSel() {
    const L = S(), ids = new Set(L.map(e => e.id))
    return L.map(e => {
      const c = JSON.parse(JSON.stringify(e))
      if (e.type === 'arrow' || e.type === 'line') { const [a, b] = ends(e); Object.assign(c, { x1: a.x, y1: a.y, x2: b.x, y2: b.y, from: ids.has(e.from) ? e.from : null, to: ids.has(e.to) ? e.to : null }) }
      return c
    })
  }
  function instantiate(list, off) {
    const m = {}, gm = {}
    list.forEach(e => { m[e.id] = uid(); if (e.g) gm[e.g] = gm[e.g] || uid() })
    return list.map(e => {
      const c = JSON.parse(JSON.stringify(e)); c.id = m[e.id]; if (c.g) c.g = gm[c.g]
      if (c.from) c.from = m[c.from] || null
      if (c.to) c.to = m[c.to] || null
      delete c.locked; delete c.ed
      mv(c, off, off); return c
    })
  }
  function addAndSelect(n) {
    els.push(...n); tool = 'select'; cv.style.cursor = curFor('select'); sel = new Set(n.map(c => c.id)); commit(); emit(); draw()
  }
  function dup() { const s0 = snapshotSel(); if (s0.length) addAndSelect(instantiate(s0, 24)) }
  function copySel() {
    if (!sel.size) return
    clipEls = snapshotSel(); pasteN = 0
    try { navigator.clipboard.writeText('dsb:' + uid()).catch(() => {}) } catch { /* clipboard unavailable */ }
    toast('Copied')
  }
  function pasteEls() { if (clipEls.length) { pasteN++; addAndSelect(instantiate(clipEls, 24 * pasteN)) } }
  async function pasteMenu() {
    try {
      const items = await navigator.clipboard.read()
      for (const it of items) { const t = it.types.find(x => x.startsWith('image/')); if (t) { addImage(await it.getType(t)); return } }
      const txt2 = await navigator.clipboard.readText()
      if (txt2 && !txt2.startsWith('dsb:')) { const e = newText(center(), txt2); e.fs = 16; els.push(e); sel = new Set([e.id]); commit(); emit(); draw(); return }
    } catch { /* permission denied: fall back to the internal clipboard */ }
    if (clipEls.length) pasteEls(); else toast('Nothing to paste. Try Ctrl+V.')
  }
  function deleteSel() { del(S().filter(e => !e.locked)); commit(); emit(); draw() }
  function cutSel() { copySel(); deleteSel() }
  function copyStyles() { const f = S()[0]; if (f) { styleClip = { stroke: f.stroke, fill: f.fill, sw: f.sw, ff: f.ff || 'sans' }; toast('Styles copied') } }
  function pasteStyles() {
    if (!styleClip) return toast('Copy styles first')
    S().forEach(e => {
      e.stroke = styleClip.stroke; e.sw = styleClip.sw
      if (LBL.includes(e.type)) e.ff = styleClip.ff
      if (SH.includes(e.type) || e.type === 'note') e.fill = styleClip.fill
    })
    commit(); emit(); draw()
  }
  function reorder(mode) {
    const set = new Set(S().map(e => e.id)); if (!set.size) return
    if (mode === 'front') els = [...els.filter(e => !set.has(e.id)), ...els.filter(e => set.has(e.id))]
    else if (mode === 'back') els = [...els.filter(e => set.has(e.id)), ...els.filter(e => !set.has(e.id))]
    else if (mode === 'forward') { for (let i = els.length - 2; i >= 0; i--) if (set.has(els[i].id) && !set.has(els[i + 1].id)) [els[i], els[i + 1]] = [els[i + 1], els[i]] }
    else { for (let i = 1; i < els.length; i++) if (set.has(els[i].id) && !set.has(els[i - 1].id)) [els[i], els[i - 1]] = [els[i - 1], els[i]] }
    commit(); draw()
  }
  function flip(axis) {
    const b = selBox(); if (!b) return
    const hz = axis === 'h', cx = b.x + b.w / 2, cy = b.y + b.h / 2, M = v => hz ? 2 * cx - v : 2 * cy - v
    S().forEach(e => {
      if (e.pts) e.pts = e.pts.map(q => hz ? [M(q[0]), q[1]] : [q[0], M(q[1])])
      else if (e.x1 !== undefined) { if (hz) { e.x1 = M(e.x1); e.x2 = M(e.x2) } else { e.y1 = M(e.y1); e.y2 = M(e.y2) } }
      else {
        const q = bb(e)
        e.x = hz ? 2 * cx - q.x - q.w : q.x; e.y = hz ? q.y : 2 * cy - q.y - q.h
        if (e.type !== 'text') { e.w = q.w; e.h = q.h }
        if (e.type === 'image') { const k = hz ? 'fx' : 'fy'; e[k] = !e[k] }
      }
    })
    commit(); draw()
  }
  function toggleLock() {
    const L = S(); if (!L.length) return
    const un = L.every(e => e.locked)
    L.forEach(e => { if (un) delete e.locked; else e.locked = true })
    if (!un) sel.clear()
    commit(); emit(); draw()
  }
  async function makePng(list) {
    if (!list.length) return null
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    list.forEach(e => { const b = bb(e); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h) })
    const pd = 30, z = 2, W = (x1 - x0 + 2 * pd) * z, H = (y1 - y0 + 2 * pd) * z, o = document.createElement('canvas')
    o.width = W; o.height = H
    paint(o.getContext('2d'), (pd - x0) * z, (pd - y0) * z, z, W, H, false, list)
    return new Promise(r => o.toBlob(r))
  }
  async function copyPngSel() {
    const blob = await makePng(sel.size ? S() : els)
    if (!blob) return toast('Nothing to copy')
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); toast('Copied as PNG') } catch { toast('The browser blocked clipboard access') }
  }
  function onCtx(ev) {
    ev.preventDefault(); closeEd()
    const t = top(P(ev), null, true); let locked = false
    if (t) { if (t.locked) { sel = new Set(group(t)); locked = true } else if (!sel.has(t.id)) sel = new Set(group(t)) }
    else sel = new Set()
    emit(); draw()
    onContext({ x: ev.clientX, y: ev.clientY, hasSel: sel.size > 0, locked, canStyle: !!styleClip })
  }
  function onKey(ev) {
    if (/INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return
    const k = ev.key.toLowerCase(), m = ev.ctrlKey || ev.metaKey
    if (ev.shiftKey && ev.altKey && ev.code === 'KeyC') { copyPngSel(); ev.preventDefault(); return }
    if (m && k === 'z') { ev.shiftKey ? redo() : undo(); ev.preventDefault(); return }
    if (m && k === 'y') { redo(); return }
    if (m && k === 'a') { sel = new Set(els.filter(e => !e.locked).map(e => e.id)); emit(); draw(); ev.preventDefault(); return }
    if (m && k === 'd') { dup(); ev.preventDefault(); return }
    if (m && ev.code === 'KeyC' && !ev.shiftKey && sel.size) { ev.altKey ? copyStyles() : copySel(); ev.preventDefault(); return }
    if (m && ev.code === 'KeyX' && sel.size) { cutSel(); ev.preventDefault(); return }
    if (m && ev.altKey && ev.code === 'KeyV') { pasteStyles(); ev.preventDefault(); return }
    if (m && ev.code === 'BracketLeft') { reorder(ev.shiftKey ? 'back' : 'backward'); ev.preventDefault(); return }
    if (m && ev.code === 'BracketRight') { reorder(ev.shiftKey ? 'front' : 'forward'); ev.preventDefault(); return }
    if (m && ev.shiftKey && ev.code === 'KeyL') { toggleLock(); ev.preventDefault(); return }
    if (m) return
    if (k === ' ') { space = true; cv.style.cursor = 'grab'; ev.preventDefault(); return }
    if (k === 'delete' || k === 'backspace') { deleteSel(); return }
    if (k === 'escape') { sel.clear(); setTool('select'); return }
    if (k === 'q') { lock = !lock; emit(); save(); return }
    if (ev.shiftKey && (k === 'h' || k === 'v')) { flip(k); return }
    const T = { n: 'note', v: 'select', h: 'hand', r: 'rect', d: 'diamond', o: 'ellipse', a: 'arrow', l: 'line', p: 'pen', t: 'text', e: 'eraser' }
    if (T[k]) setTool(T[k])
  }
  function onKeyUp(e) { if (e.key === ' ' && space) { space = false; cv.style.cursor = curFor(tool) } }

  /* ---------- wire up ---------- */
  cv.addEventListener('pointerdown', onDown)
  cv.addEventListener('pointermove', onMove)
  cv.addEventListener('pointerup', onUp)
  cv.addEventListener('wheel', onWheel, { passive: false })
  cv.addEventListener('contextmenu', onCtx)
  addEventListener('resize', resize)
  const ro = new ResizeObserver(resize); ro.observe(cv)
  addEventListener('paste', onPaste)
  addEventListener('dragover', onDragOver)
  addEventListener('drop', onDrop)
  addEventListener('keydown', onKey)
  addEventListener('keyup', onKeyUp)
  hist = [snap()]; resize(); emit()
  // canvas text needs the web fonts loaded first; redraw once they are ready
  ;['20px Caveat', '16px Lora', '14px "JetBrains Mono"'].forEach(f => document.fonts && document.fonts.load(f).then(draw).catch(() => {}))

  return {
    setTool, setProp, undo, redo, addImage,
    setLock: v => { lock = v; emit(); save() },
    setTheme: v => { dark = v; draw() },
    zoomBy: f => zoomAt(innerWidth / 2, innerHeight / 2, f),
    clear: () => { els = []; sel.clear(); commit(); emit(); draw() },
    insert(type, opts) {
      const list = buildStructure(type, opts, center(), cur, measure)
      els.push(...list); sel = new Set(list.map(e => e.id)); tool = 'select'
      commit(); emit(); draw()
    },
    getScene() { const used = {}; els.forEach(e => e.k && (used[e.k] = IMG[e.k])); return { els, IMG: used } },
    loadScene(d) { els = d.els || []; IMG = d.IMG || {}; IC = {}; sel.clear(); commit(); emit(); draw() },
    exportPng: () => makePng(els),
    action(n) {
      const sa = () => { sel = new Set(els.filter(e => !e.locked).map(e => e.id)) }
      const map = { cut: cutSel, copy: copySel, paste: pasteMenu, copyPng: copyPngSel, copyStyles, pasteStyles, backward: () => reorder('backward'), forward: () => reorder('forward'), back: () => reorder('back'), front: () => reorder('front'), flipH: () => flip('h'), flipV: () => flip('v'), duplicate: dup, lock: toggleLock, unlock: toggleLock, delete: deleteSel, selectAll: sa }
      if (map[n]) map[n]()
      emit(); draw()
    },
    destroy() {
      closeEd(); save(true); clearTimeout(ct)
      cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove)
      cv.removeEventListener('pointerup', onUp); cv.removeEventListener('wheel', onWheel); cv.removeEventListener('contextmenu', onCtx)
      ro.disconnect(); removeEventListener('resize', resize); removeEventListener('paste', onPaste)
      removeEventListener('dragover', onDragOver); removeEventListener('drop', onDrop)
      removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp)
    },
  }
}
