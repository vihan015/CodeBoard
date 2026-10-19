import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const SEP = '-'
const FULL = [
  ['cut', 'Cut', 'Ctrl+X'], ['copy', 'Copy', 'Ctrl+C'], ['paste', 'Paste', 'Ctrl+V'], SEP,
  ['copyPng', 'Copy to clipboard as PNG', 'Shift+Alt+C'], SEP,
  ['copyStyles', 'Copy styles', 'Ctrl+Alt+C'], ['pasteStyles', 'Paste styles', 'Ctrl+Alt+V'], SEP,
  ['backward', 'Send backward', 'Ctrl+['], ['forward', 'Bring forward', 'Ctrl+]'],
  ['back', 'Send to back', 'Ctrl+Shift+['], ['front', 'Bring to front', 'Ctrl+Shift+]'], SEP,
  ['flipH', 'Flip horizontal', 'Shift+H'], ['flipV', 'Flip vertical', 'Shift+V'], SEP,
  ['duplicate', 'Duplicate', 'Ctrl+D'], ['lock', 'Lock', 'Ctrl+Shift+L'], SEP,
  ['delete', 'Delete', 'Delete', 'danger'],
]
const EMPTY = [['paste', 'Paste', 'Ctrl+V'], ['selectAll', 'Select all', 'Ctrl+A']]
const LOCKED = [['unlock', 'Unlock', 'Ctrl+Shift+L']]

export default function ContextMenu({ menu, onAction, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ x: menu.x, y: menu.y })
  const items = menu.locked ? LOCKED : menu.hasSel ? FULL : EMPTY

  // keep the menu inside the window
  useLayoutEffect(() => {
    const r = ref.current.getBoundingClientRect()
    setPos({ x: Math.max(8, Math.min(menu.x, innerWidth - r.width - 8)), y: Math.max(8, Math.min(menu.y, innerHeight - r.height - 8)) })
  }, [menu])

  useEffect(() => {
    const down = e => { if (!ref.current.contains(e.target)) onClose() }
    const key = e => { if (e.key === 'Escape') onClose() }
    addEventListener('pointerdown', down, true)
    addEventListener('keydown', key)
    addEventListener('resize', onClose)
    addEventListener('wheel', onClose, { passive: true })
    return () => {
      removeEventListener('pointerdown', down, true)
      removeEventListener('keydown', key)
      removeEventListener('resize', onClose)
      removeEventListener('wheel', onClose)
    }
  }, [onClose])

  return (
    <div ref={ref} className="ctx isl" style={{ left: pos.x, top: pos.y }} role="menu" onContextMenu={e => e.preventDefault()}>
      {items.map((it, i) =>
        it === SEP ? (
          <div key={i} className="ctx-sep" />
        ) : (
          <button key={it[0]} role="menuitem" className={it[3] || ''} disabled={it[0] === 'pasteStyles' && !menu.canStyle} onClick={() => onAction(it[0])}>
            <span>{it[1]}</span><kbd>{it[2]}</kbd>
          </button>
        )
      )}
    </div>
  )
}
