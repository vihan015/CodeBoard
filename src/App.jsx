import { useCallback, useEffect, useRef, useState } from 'react'
import { createEngine } from './engine.js'
import Toolbar from './components/Toolbar.jsx'
import PropsPanel from './components/PropsPanel.jsx'
import StructureMenu from './components/StructureMenu.jsx'
import CodePanel from './components/CodePanel.jsx'
import ContextMenu from './components/ContextMenu.jsx'

const download = (blob, name) => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
const ls = {
  get: k => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch { /* storage full or blocked */ } },
}

export default function App() {
  const canvasRef = useRef(null)
  const fileRef = useRef(null)
  const eng = useRef(null)
  const toastTimer = useRef(null)

  const [ui, setUi] = useState({ tool: 'select', lock: true, cur: { stroke: '#1e1e1e', fill: 'transparent', sw: 2 }, sel: { stroke: '#1e1e1e', fill: 'transparent', sw: 2, ff: 'sans' }, zoom: 1 })
  const [dark, setDark] = useState(() => {
    const s = ls.get('dsb.theme')
    return s ? s === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [codeOpen, setCodeOpen] = useState(() => !!ls.get('dsb.codeopen') && innerWidth > 820)
  const [code, setCode] = useState(() => ls.get('dsb.code') || '')
  const [codeFs, setCodeFs] = useState(() => +ls.get('dsb.codefs') || 13)
  const [codeW, setCodeW] = useState(() => +ls.get('dsb.codew') || 380)
  const [codeLang, setCodeLang] = useState(() => ls.get('dsb.codelang') || 'auto')
  const [menu, setMenu] = useState(null) // 'ds' | 'help' | null
  const [ctxMenu, setCtxMenu] = useState(null) // right-click menu
  const [toastMsg, setToastMsg] = useState('')
  const [armClear, setArmClear] = useState(false)

  const toast = useCallback(msg => {
    setToastMsg(msg); clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(''), 2400)
  }, [])

  useEffect(() => {
    const e = createEngine(canvasRef.current, { onState: setUi, toast, onCanvasDown: () => { setMenu(null); setCtxMenu(null) }, onContext: m => { setMenu(null); setCtxMenu(m) } })
    eng.current = e
    return () => { e.destroy(); eng.current = null }
  }, [toast])

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    ls.set('dsb.theme', dark ? 'dark' : 'light')
    eng.current?.setTheme(dark)
  }, [dark])
  useEffect(() => { ls.set('dsb.code', code) }, [code])
  useEffect(() => { ls.set('dsb.codefs', codeFs) }, [codeFs])
  useEffect(() => { ls.set('dsb.codew', codeW) }, [codeW])
  useEffect(() => { ls.set('dsb.codelang', codeLang) }, [codeLang])
  useEffect(() => { ls.set('dsb.codeopen', codeOpen ? '1' : '') }, [codeOpen])

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(code); toast('Code copied') } catch { toast('Could not copy. Select the text and press Ctrl+C.') }
  }
  const exportPng = async () => {
    const blob = await eng.current.exportPng()
    if (!blob) return toast('Nothing to export yet')
    download(blob, 'dsa-board.png')
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); toast('PNG saved and copied') } catch { toast('PNG saved') }
  }
  const saveBoard = () => download(new Blob([JSON.stringify({ v: 1, ...eng.current.getScene(), code })], { type: 'application/json' }), 'dsa-board.json')
  const openBoard = async e => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    if (f.type.startsWith('image/')) return eng.current.addImage(f)
    try {
      const d = JSON.parse(await f.text())
      eng.current.loadScene(d)
      if (d.code != null) setCode(d.code)
      toast('Board loaded')
    } catch { toast('That file is not a saved board') }
  }
  const clearBoard = () => {
    if (!armClear) { setArmClear(true); setTimeout(() => setArmClear(false), 2200); return }
    setArmClear(false); eng.current.clear()
  }
  const pick = kind => () => { fileRef.current.accept = kind; fileRef.current.click() }
  const toggle = name => e => { e.stopPropagation(); setMenu(m => (m === name ? null : name)) }

  return (
    <div className={codeOpen ? 'app code-open' : 'app'} style={{ '--cw': codeW + 'px' }}>
      <canvas ref={canvasRef} className="board" />

      <Toolbar
        tool={ui.tool} lock={ui.lock}
        onTool={t => eng.current.setTool(t)}
        onLock={() => eng.current.setLock(!ui.lock)}
        onImage={pick('image/*')}
      />

      <div className="acts isl">
        <button onClick={toggle('ds')} title="Insert a data structure">▦ Structures</button>
        <button onClick={() => setCodeOpen(o => !o)} title="Code panel">&lt;/&gt; Code</button>
        <button onClick={() => setDark(d => !d)} title="Dark mode">{dark ? '☀' : '☾'}</button>
        <button onClick={toggle('help')} title="Shortcuts and tips">?</button>
        <button onClick={saveBoard} title="Save board as a .json file">⬇</button>
        <button onClick={pick('.json,application/json')} title="Open a saved .json board">⬆</button>
        <button onClick={exportPng} title="Export board as PNG">⧉</button>
        <button onClick={clearBoard} title="Clear board">{armClear ? 'Sure?' : '🗑'}</button>
      </div>

      {menu === 'ds' && <StructureMenu onInsert={(t, o) => { eng.current.insert(t, o); setMenu(null) }} />}
      {menu === 'help' && (
        <div className="pop isl help" onPointerDown={e => e.stopPropagation()}>
          <b>Shortcuts and tips</b>
          <div>
            • <b>Type on the board:</b> double-click or double-tap any empty spot<br />
            • <b>Edit a cell or shape label:</b> double-click it<br />
            • <b>V H R D O A L P T E</b> select, pan, rectangle, diamond, ellipse, arrow, line, pen, text, eraser<br />
            • <b>Q</b> toggles keeping the tool active after drawing (on by default); <b>Esc</b> or <b>V</b> goes back to Select<br />
            • <b>Resize anything:</b> select it and drag the square handles (hold Shift on a corner to keep proportions). Text and cell labels scale with it<br />
            • <b>Resize the code panel:</b> drag its left edge, double-click the edge to reset<br />
            • <b>Select an arrow or line</b> and drag either end to move just that end; it snaps onto shapes<br />
            • <b>N</b> sticky note (type right after placing it)<br />
            • <b>Right-click</b> an element for cut, copy, paste, copy as PNG, copy/paste styles, layer order, flip, duplicate, lock and delete<br />
            • <b>Ctrl+Z / Ctrl+Shift+Z</b> undo / redo<br />
            • <b>Ctrl+D</b> duplicate, <b>Ctrl+A</b> select all<br />
            • <b>Space + drag</b> pans, <b>scroll</b> pans, <b>Ctrl+scroll</b> zooms<br />
            • <b>Delete</b> removes the selection<br />
            • <b>Ctrl+V</b> pastes an image or text<br />
            • Pick the pen, then any color: that is your brush color
          </div>
        </div>
      )}

      {ctxMenu && <ContextMenu menu={ctxMenu} onClose={() => setCtxMenu(null)} onAction={n => { setCtxMenu(null); eng.current.action(n) }} />}

      <PropsPanel tool={ui.tool} sel={ui.sel} onProp={(k, v) => eng.current.setProp(k, v)} />

      <div className="zoom isl">
        <button onClick={() => eng.current.undo()} title="Undo (Ctrl+Z)">↶</button>
        <button onClick={() => eng.current.redo()} title="Redo (Ctrl+Shift+Z)">↷</button>
        <button onClick={() => eng.current.zoomBy(1 / 1.2)} title="Zoom out">−</button>
        <span>{Math.round(ui.zoom * 100)}%</span>
        <button onClick={() => eng.current.zoomBy(1.2)} title="Zoom in">+</button>
      </div>

      <CodePanel open={codeOpen} code={code} onChange={setCode} onClose={() => setCodeOpen(false)} onCopy={copyCode}
        fontSize={codeFs} onFontSize={setCodeFs} onWidth={setCodeW} lang={codeLang} onLang={setCodeLang} />
      <input ref={fileRef} type="file" hidden onChange={openBoard} />
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  )
}
