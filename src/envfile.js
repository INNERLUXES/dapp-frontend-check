// An env file, as the dotenv convention writes one: a line NAME=value, with an optional export in front, a value in
// single, double or back quotes or bare, and # starting a comment on a line of its own or after a bare value. Nothing is
// expanded and nothing is run. Each entry keeps the offset of its name and of its value, so a finding has a line and a
// column. A line that is none of these is passed over.

const LINE = /^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_.-]*)[ \t]*=[ \t]*(.*)$/;

// The entries of an env file: [{ name, value, nameAt, valueAt }].
export function parseEnv(text) {
  const out = [];
  let at = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  while (at < text.length) {
    let end = at;
    while (end < text.length && text[end] !== '\n' && text[end] !== '\r') end += 1;
    const line = text.slice(at, end);
    const m = LINE.exec(line);
    if (m) {
      const nameAt = at + line.indexOf(m[1]);
      let raw = m[2];
      let valueAt = at + line.length - raw.length;
      let value;
      const q = raw[0];
      if (q === '"' || q === "'" || q === '`') {
        const close = raw.indexOf(q, 1);
        value = close < 0 ? raw.slice(1) : raw.slice(1, close);
        valueAt += 1;
      } else {
        const hash = raw.search(/[ \t]#/);
        if (hash >= 0) raw = raw.slice(0, hash);
        value = raw.trimEnd();
      }
      out.push({ name: m[1], value, nameAt, valueAt });
    }
    at = end;
    if (text[at] === '\r' && text[at + 1] === '\n') at += 2;
    else if (at < text.length) at += 1;
  }
  return out;
}
