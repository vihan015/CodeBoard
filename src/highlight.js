// Tiny dependency-free syntax highlighter for C++, Python, Java and JavaScript.
// Output is HTML with every piece of user text escaped.
const words = s => new Set(s.split(' '))
const R = (...rs) => new RegExp(rs.map(r => '(' + r.source + ')').join('|'), 'gm')

const CLINE = /\/\/.*|\/\*[\s\S]*?(?:\*\/|$)/, PYLINE = /#.*/
const CSTR = /"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/
const PYSTR = /"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/
const JSSTR = /`(?:\\[\s\S]|[^`\\])*`?|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/
const NUM = /\b(?:0[xX][\da-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?)[uUlLfF]*\b/
const WORD = /[A-Za-z_]\w*/
const PRE = /^[ \t]*#[ \t]*\w+/, NOPRE = /(?!)/

const LANGS = {
  cpp: {
    re: R(CLINE, CSTR, NUM, WORD, PRE),
    kw: words('if else for while do switch case break continue return goto using namespace template typename class struct enum union public private protected virtual static const constexpr inline new delete try catch throw operator typedef this nullptr true false sizeof default override final explicit noexcept mutable volatile auto register extern friend'),
    ty: words('int long short char bool float double void unsigned signed size_t string vector map set multiset multimap unordered_map unordered_set pair queue stack deque list priority_queue array bitset tuple ll ull i64 u64 int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t cin cout cerr endl'),
  },
  python: {
    re: R(PYLINE, PYSTR, NUM, WORD, NOPRE),
    kw: words('def class if elif else for while return import from as in is not and or pass break continue lambda with try except finally raise yield global nonlocal assert del None True False async await self'),
    ty: words('int str float list dict set tuple bool bytes range len print input map filter sorted enumerate zip min max sum abs reversed any all'),
  },
  java: {
    re: R(CLINE, CSTR, NUM, WORD, NOPRE),
    kw: words('if else for while do switch case break continue return new class interface extends implements public private protected static final abstract void try catch finally throw throws import package this super null true false instanceof default enum synchronized var'),
    ty: words('int long short byte char boolean float double String Integer Long Double Boolean List ArrayList LinkedList Map HashMap TreeMap Set HashSet TreeSet Queue Deque ArrayDeque PriorityQueue Stack Arrays Collections Math System Scanner BufferedReader StringBuilder Object'),
  },
  js: {
    re: R(CLINE, JSSTR, NUM, WORD, NOPRE),
    kw: words('if else for while do switch case break continue return new class extends function const let var import export from default try catch finally throw this super null undefined true false typeof instanceof in of async await yield static get set void delete'),
    ty: words('Array Object Map Set String Number Boolean Math JSON Promise Date console BigInt Symbol Infinity NaN'),
  },
}

export const LANG_NAMES = { cpp: 'C++', python: 'Python', java: 'Java', js: 'JavaScript' }

export function detect(code) {
  if (/#include|std::|\bcout\b|\bcin\b|vector<|int\s+main/.test(code)) return 'cpp'
  if (/public\s+(static|class)|System\.out/.test(code)) return 'java'
  if (/^\s*(def|class)\s.*:\s*$/m.test(code) || /^\s*(import|from)\s+\w[\w.]*(\s+import\s.*)?$/m.test(code) || /\belif\b|\bprint\(/.test(code)) return 'python'
  if (/\bfunction\b|\bconst\b|\blet\b|=>|console\./.test(code)) return 'js'
  return 'cpp'
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function highlight(code, lang) {
  const L = LANGS[lang] || LANGS.cpp, re = L.re
  re.lastIndex = 0
  let out = '', last = 0, m
  while ((m = re.exec(code))) {
    const t = m[0]
    if (!t) { re.lastIndex++; continue }
    out += esc(code.slice(last, m.index))
    let cls = null
    if (m[1] !== undefined) cls = 'c'
    else if (m[2] !== undefined) cls = 's'
    else if (m[3] !== undefined) cls = 'n'
    else if (m[5] !== undefined) cls = 'k'
    else if (m[4] !== undefined) {
      if (L.kw.has(t)) cls = 'k'
      else if (L.ty.has(t) || ((lang === 'java' || lang === 'js') && /^[A-Z]\w*$/.test(t))) cls = 't'
      else if (code[re.lastIndex] === '(') cls = 'f'
    }
    out += cls ? `<span class="tk-${cls}">${esc(t)}</span>` : esc(t)
    last = re.lastIndex
  }
  return out + esc(code.slice(last)) + '\n' // trailing newline keeps the last line aligned with the textarea
}
