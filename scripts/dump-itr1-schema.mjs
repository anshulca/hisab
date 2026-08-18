import fs from 'node:fs';

const file = process.argv[2];
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const itrRoot = data.ITR && (data.ITR.ITR1 ?? data.ITR.ITR3 ?? data.ITR.ITR4);

function summarize(obj, depth, prefix, maxKeys) {
  if (depth > 3) return;
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const keys = Object.keys(v).slice(0, maxKeys ?? 14);
      const brief = keys
        .map((x) => {
          const val = v[x];
          if (typeof val === 'number') return `${x}=num`;
          if (Array.isArray(val)) return `${x}=arr(${val.length})`;
          if (val && typeof val === 'object') return `${x}=obj`;
          if (val === true || val === false) return `${x}=bool`;
          return `${x}`;
        })
        .join(', ');
      console.log(`${prefix}${k}: { ${brief} }`);
      summarize(v, depth + 1, prefix + '  ', 10);
    } else if (Array.isArray(v)) {
      const first = v[0];
      const inner =
        first && typeof first === 'object' && !Array.isArray(first)
          ? ` [{${Object.keys(first).slice(0, 12).join(',')}}]`
          : ` [${v.length}]`;
      console.log(`${prefix}${k}: arr${inner}`);
      if (first && typeof first === 'object') summarize([first][0], depth + 1, prefix + '    ', 8);
    } else {
      const s = String(v);
      if (v === null) console.log(`${prefix}${k}: null`);
      else if (typeof v === 'boolean') console.log(`${prefix}${k}: bool=${v}`);
      else if (!Number.isNaN(Number(s)) && s !== '') console.log(`${prefix}${k}: ${s}`);
      else console.log(`${prefix}${k}: "${s.length > 44 ? s.slice(0, 44) + '…' : s}"`);
    }
  }
}

summarize(itrRoot, 0, '');