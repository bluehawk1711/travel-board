/** Scans backend/src for stray control characters that break the parser. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'D:/side-projects/Apps/travel-board/backend/src';

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

let found = 0;
for (const file of walk(ROOT)) {
  const bytes = readFileSync(file);
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i];
    if (b < 9 || (b > 13 && b < 32) || b === 127) {
      const line = bytes.subarray(0, i).filter((x) => x === 10).length + 1;
      console.log(`${file}:${line} byte=${b}`);
      found += 1;
      break;
    }
  }
}
console.log(found === 0 ? 'no control characters found' : `${found} file(s) affected`);

