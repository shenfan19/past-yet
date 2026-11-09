// Safe expression compiler for LM-style formulas (Python-flavoured, no eval).
// Supports: numbers, names (dots allowed), + - * / % **, comparisons, and/or/not,
// `a if cond else b`, calls to the whitelisted functions below.
// Compile once, run many times: compile(src, known) -> (vars) => number.
// Unknown names throw at compile time, so a typo in YAML fails the build, not the run.

const FUNCS = {
  min: Math.min, max: Math.max, abs: Math.abs, exp: Math.exp, log: Math.log, sqrt: Math.sqrt,
  sin: Math.sin, cos: Math.cos, floor: Math.floor, round: Math.round,
  clamp: (x, lo, hi) => Math.min(hi, Math.max(lo, x)),
};

const KEYWORDS = new Set(['if', 'else', 'and', 'or', 'not', 'true', 'false']);

function tokenize(src) {
  const toks = [];
  const re = /\s*(?:(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_.]*)|(\*\*|<=|>=|==|!=|[-+*/%()<>,]))/y;
  let pos = 0;
  while (pos < src.length) {
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m) {
      if (/^\s*$/.test(src.slice(pos))) break;
      throw new Error(`表达式无法解析 @${pos}: ${src}`);
    }
    pos = re.lastIndex;
    if (m[1] !== undefined) toks.push({ t: 'num', v: Number(m[1]) });
    else if (m[2] !== undefined) toks.push(KEYWORDS.has(m[2]) ? { t: 'kw', v: m[2] } : { t: 'name', v: m[2] });
    else toks.push({ t: 'op', v: m[3] });
  }
  return toks;
}

export function compile(src, known, label = '') {
  const toks = tokenize(String(src));
  let i = 0;
  const peek = () => toks[i];
  const isOp = (v) => toks[i] && toks[i].t === 'op' && toks[i].v === v;
  const isKw = (v) => toks[i] && toks[i].t === 'kw' && toks[i].v === v;
  const fail = (msg) => { throw new Error(`${label} 表达式错误：${msg}\n  ${src}`); };

  function ternary() {
    const a = orExpr();
    if (isKw('if')) {
      i++;
      const c = orExpr();
      if (!isKw('else')) fail('缺少 else');
      i++;
      const b = ternary();
      return (v) => (c(v) ? a(v) : b(v));
    }
    return a;
  }
  function orExpr() {
    let a = andExpr();
    while (isKw('or')) { i++; const b = andExpr(); const l = a; a = (v) => (l(v) || b(v) ? 1 : 0); }
    return a;
  }
  function andExpr() {
    let a = notExpr();
    while (isKw('and')) { i++; const b = notExpr(); const l = a; a = (v) => (l(v) && b(v) ? 1 : 0); }
    return a;
  }
  function notExpr() {
    if (isKw('not')) { i++; const a = notExpr(); return (v) => (a(v) ? 0 : 1); }
    return cmp();
  }
  function cmp() {
    let a = add();
    const ops = ['<=', '>=', '==', '!=', '<', '>'];
    while (peek() && peek().t === 'op' && ops.includes(peek().v)) {
      const op = peek().v; i++;
      const b = add(); const l = a;
      a = (v) => {
        const x = l(v), y = b(v);
        return (op === '<=' ? x <= y : op === '>=' ? x >= y : op === '==' ? x === y : op === '!=' ? x !== y : op === '<' ? x < y : x > y) ? 1 : 0;
      };
    }
    return a;
  }
  function add() {
    let a = mul();
    while (isOp('+') || isOp('-')) {
      const op = peek().v; i++;
      const b = mul(); const l = a;
      a = op === '+' ? (v) => l(v) + b(v) : (v) => l(v) - b(v);
    }
    return a;
  }
  function mul() {
    let a = unary();
    while (isOp('*') || isOp('/') || isOp('%')) {
      const op = peek().v; i++;
      const b = unary(); const l = a;
      a = op === '*' ? (v) => l(v) * b(v) : op === '/' ? (v) => l(v) / b(v) : (v) => l(v) % b(v);
    }
    return a;
  }
  function unary() {
    if (isOp('-')) { i++; const a = unary(); return (v) => -a(v); }
    if (isOp('+')) { i++; return unary(); }
    return pow();
  }
  function pow() {
    const a = primary();
    if (isOp('**')) { i++; const b = unary(); return (v) => Math.pow(a(v), b(v)); }
    return a;
  }
  function primary() {
    const t = peek();
    if (!t) fail('表达式意外结束');
    i++;
    if (t.t === 'num') return () => t.v;
    if (t.t === 'kw' && (t.v === 'true' || t.v === 'false')) { const n = t.v === 'true' ? 1 : 0; return () => n; }
    if (t.t === 'op' && t.v === '(') {
      const e = ternary();
      if (!isOp(')')) fail('缺少右括号');
      i++;
      return e;
    }
    if (t.t === 'name') {
      if (isOp('(')) {
        const fn = FUNCS[t.v];
        if (!fn) fail('未知函数 ' + t.v);
        i++;
        const args = [];
        if (!isOp(')')) {
          args.push(ternary());
          while (isOp(',')) { i++; args.push(ternary()); }
        }
        if (!isOp(')')) fail('函数缺少右括号');
        i++;
        return (v) => fn(...args.map((a) => a(v)));
      }
      if (!known.has(t.v)) fail('未声明的变量 ' + t.v);
      const name = t.v;
      return (v) => v[name];
    }
    return fail('意外的符号 ' + t.v);
  }

  const f = ternary();
  if (i < toks.length) fail('多余的符号 ' + toks[i].v);
  return f;
}
