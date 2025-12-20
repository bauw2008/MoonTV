const fs = require('fs');
const content = fs.readFileSync('src/app/page.tsx', 'utf8');
const lines = content.split('\n');

let count = 0;

for (let i = 0; i <= 264; i++) {
  const line = lines[i];
  const cleaned = line
    .replace(/'[^']*'/g, '""')
    .replace(/`[^`]*`/g, '""')
    .replace(/\/\/.*/g, '');

  for (const ch of cleaned) {
    if (ch === '{') count++;
    if (ch === '}') count--;
  }
}

console.log(`Brace count at line 265 (before return): ${count}`);
console.log('Expected: 1 (inside HomeClient function)');
console.log(`Difference: ${count - 1}`);
