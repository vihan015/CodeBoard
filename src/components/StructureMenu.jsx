import { useState } from 'react'

const TYPES = [
  ['array', 'Array'], ['matrix', 'Matrix'], ['linked', 'Linked list'], ['stack', 'Stack'], ['queue', 'Queue'],
  ['tree', 'Binary tree'], ['graph', 'Graph'], ['map', 'Map'], ['set', 'Set'],
]

export default function StructureMenu({ onInsert }) {
  const [t, setT] = useState('array')
  const [n, setN] = useState(6)
  const [m, setM] = useState(6)
  const [base, setBase] = useState(0)
  const [edges, setEdges] = useState('')
  const [directed, setDirected] = useState(false)

  const sizeLabel = t === 'matrix' || t === 'map' ? 'Rows' : t === 'tree' || t === 'graph' ? 'Nodes' : 'Size'
  const clamp = (v, max) => Math.max(1, Math.min(max, +v || 1))
  const submit = () => onInsert(t, { n: clamp(n, 200), m: clamp(m, 50), base, edges, directed })

  return (
    <div className="pop isl" onPointerDown={e => e.stopPropagation()}>
      <label>Type
        <select value={t} onChange={e => setT(e.target.value)}>
          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label>{sizeLabel}
        <input type="number" min="1" max="200" value={n} onChange={e => setN(e.target.value)} />
      </label>
      {t === 'matrix' && (
        <label>Cols
          <input type="number" min="1" max="50" value={m} onChange={e => setM(e.target.value)} />
        </label>
      )}
      {['array', 'matrix', 'tree', 'graph'].includes(t) && (
        <label>Index from
          <select value={base} onChange={e => setBase(+e.target.value)}>
            <option value={0}>0</option>
            <option value={1}>1</option>
          </select>
        </label>
      )}
      {t === 'graph' && (
        <>
          <label>Edges
            <input value={edges} placeholder="1-2, 2-3, 3-1" onChange={e => setEdges(e.target.value)} />
          </label>
          <label>Directed
            <input type="checkbox" style={{ width: 'auto' }} checked={directed} onChange={e => setDirected(e.target.checked)} />
          </label>
        </>
      )}
      <button className="primary" onClick={submit}>Insert on board</button>
    </div>
  )
}
