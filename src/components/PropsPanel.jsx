import { FAM, FONT_LIST } from '../fonts.js'

const STROKES = ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00', '#9c36b5', '#0c8599', '#868e96']
const FILLS = ['transparent', '#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99', '#eebefa', '#99e9f2', '#dee2e6']
const CHECKER = 'repeating-conic-gradient(#bbb 0 25%,#fff 0 50%) 0 0/8px 8px'

function Swatches({ list, value, onPick }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'
  return (
    <div className="row">
      {list.map(c => (
        <button
          key={c}
          className={'sw' + (c === value ? ' on' : '')}
          style={{ background: c === 'transparent' ? CHECKER : c }}
          title={c === 'transparent' ? 'No fill' : c}
          onClick={() => onPick(c)}
        />
      ))}
      <input type="color" title="Any color" value={hex} onChange={e => onPick(e.target.value)} />
    </div>
  )
}

export default function PropsPanel({ tool, sel, onProp }) {
  const pen = tool === 'pen'
  return (
    <div className="props isl">
      <h6>{pen ? 'Brush color' : 'Stroke'}</h6>
      <Swatches list={STROKES} value={sel.stroke} onPick={c => onProp('stroke', c)} />
      {!pen && (
        <>
          <h6>Fill</h6>
          <Swatches list={FILLS} value={sel.fill} onPick={c => onProp('fill', c)} />
        </>
      )}
      <h6>{pen ? 'Brush size' : 'Stroke width'}</h6>
      <div className="row">
        {[1, 2, 4].map(w => (
          <button key={w} className={'wb' + (sel.sw === w ? ' on' : '')} onClick={() => onProp('sw', w)}>
            <i style={{ height: w }} />
          </button>
        ))}
      </div>
      <h6>Font</h6>
      <div className="row">
        {FONT_LIST.map(([id, name]) => (
          <button key={id} className={'fb' + (sel.ff === id ? ' on' : '')} title={name} style={{ fontFamily: FAM[id] }} onClick={() => onProp('ff', id)}>
            Aa
          </button>
        ))}
      </div>
    </div>
  )
}
