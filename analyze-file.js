const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/play/page.tsx');
const content = fs.readFileSync(filePath, 'utf8');

// 查找所有的函数定义
const functionMatches = content.match(/function\s+\w+\([^)]*\)\s*{/g);
console.log('找到的函数:', functionMatches);

// 查找所有的export default function
const exportMatches = content.match(
  /export default function\s+\w+\([^)]*\)\s*{/g
);
console.log('导出的函数:', exportMatches);

// 统计括号
let openBraces = 0;
let closeBraces = 0;
for (let char of content) {
  if (char === '{') openBraces++;
  else if (char === '}') closeBraces++;
}
console.log(
  `\n括号统计: {=${openBraces}, }=${closeBraces}, 差值=${
    openBraces - closeBraces
  }`
);

// 查找最后几个非空行
const lines = content.split('\n');
const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
console.log('\n文件最后10个非空行:');
for (
  let i = Math.max(0, nonEmptyLines.length - 10);
  i < nonEmptyLines.length;
  i++
) {
  console.log(nonEmptyLines[i]);
}
