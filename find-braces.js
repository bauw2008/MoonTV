const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/play/page.tsx');
const content = fs.readFileSync(filePath, 'utf8');

// 检查括号匹配
let parentheses = 0;
let brackets = 0;
let braces = 0;
let lineNum = 1;
let colNum = 1;

for (let i = 0; i < content.length; i++) {
  const char = content[i];
  if (char === '(') parentheses++;
  else if (char === ')') parentheses--;
  else if (char === '[') brackets++;
  else if (char === ']') brackets--;
  else if (char === '{') braces++;
  else if (char === '}') braces--;

  if (braces > 0 && char === '{') {
    console.log(
      `第${lineNum}行，第${colNum}列: 发现左花括号 { (当前计数: ${braces})`
    );
  }
  if (braces > 0 && char === '}') {
    console.log(
      `第${lineNum}行，第${colNum}列: 发现右花括号 } (当前计数: ${braces})`
    );
  }

  if (char === '\n') {
    lineNum++;
    colNum = 1;
  } else {
    colNum++;
  }
}

console.log(`最终括号计数: ()=${parentheses}, []=${brackets}, {}=${braces}`);
