import { useMemo, useRef } from 'react'
import { LANG_NAMES, detect, highlight } from '../highlight.js'

export default function CodePanel({ open, code, onChange, onClose, onCopy, fontSize, onFontSize, onWidth, lang, onLang }) {
  const taRef = useRef(null)
  const hlRef = useRef(null)
  const auto = lang === 'auto'
  const active = useMemo(() => (auto ? detect(code) : lang), [auto, lang, code])
  const html = useMemo(() => highlight(code, active), [code, active])

  const onKeyDown = e => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const t = e.target
      t.setRangeText('    ', t.selectionStart, t.selectionEnd, 'end')
      onChange(t.value)
    }
  }
  const syncScroll = () => {
    hlRef.current.scrollTop = taRef.current.scrollTop
    hlRef.current.scrollLeft = taRef.current.scrollLeft
  }
  // drag the left edge of the panel to resize it; double-click the edge to reset
  const startResize = e => {
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    document.body.classList.add('resizing')
    const move = ev => onWidth(Math.round(Math.max(280, Math.min(900, innerWidth - 80, innerWidth - ev.clientX))))
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      document.body.classList.remove('resizing')
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  return (
    <aside className={'code' + (open ? ' open' : '')} aria-hidden={!open}>
      <div className="grip" onPointerDown={startResize} onDoubleClick={() => onWidth(380)} title="Drag to resize (double-click to reset)" />
      <header>
        <b>Code</b>
        <select value={lang} onChange={e => onLang(e.target.value)} title="Syntax highlighting language">
          <option value="auto">Auto ({LANG_NAMES[active]})</option>
          {Object.entries(LANG_NAMES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button onClick={() => onFontSize(Math.max(10, fontSize - 1))} title="Smaller text">A−</button>
        <button onClick={() => onFontSize(Math.min(28, fontSize + 1))} title="Larger text">A+</button>
        <button onClick={onCopy}>Copy</button>
        <button onClick={() => onChange('')}>Clear</button>
        <button onClick={onClose} aria-label="Close code panel">✕</button>
      </header>
      <div className="editor" style={{ '--cfs': fontSize + 'px' }}>
        <pre className="hl" ref={hlRef} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
        <textarea
          ref={taRef}
          className="ta"
          value={code}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="// write or paste your solution here. It saves automatically."
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onScroll={syncScroll}
        />
      </div>
    </aside>
  )
}
