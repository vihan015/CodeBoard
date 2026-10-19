import { Hand, MousePointer2} from 'lucide-react'
const TOOLS = [
  ['select', MousePointer2, 'Select (V)'],
  ['hand', Hand, 'Pan (H or hold Space)'],
  null,
  ['rect', '▭', 'Rectangle (R)'],
  ['diamond', '◇', 'Diamond (D)'],
  ['ellipse', '◯', 'Ellipse (O)'],
  ['arrow', '→', 'Arrow, connects to shapes (A)'],
  ['line', '／', 'Line (L)'],
  ['pen', '✎', 'Draw (P)'],
  ['text', 'A', 'Text (T)'],
  ['note', '🗒', 'Note (N)'],
  ['eraser', '⌫', 'Eraser (E)'],
  null,
]

export default function Toolbar({ tool, lock, onTool, onLock, onImage }) {
  return (
    <div className="tools isl">
      {TOOLS.map((t, i) => {
        if (!t) {
          return <div key={i} className="sep" />
        }

        const [id, icon, tooltip] = t
        const Icon = typeof icon !== 'string' ? icon : null

        return (
          <button
            key={id}
            className={tool === id ? 'on' : ''}
            title={tooltip}
            onClick={() => onTool(id)}
          >
            {Icon ? <Icon size={18} strokeWidth={1.8} /> : icon}
          </button>
        )
      })}

      <button
        title="Insert image (or paste with Ctrl+V)"
        onClick={onImage}
      >
        🖼
      </button>

      <button
        className={lock ? 'on' : ''}
        title="Keep tool active after drawing (Q)"
        onClick={onLock}
      >
        {lock ? '🔒' : '🔓'}
      </button>
    </div>
  )
}