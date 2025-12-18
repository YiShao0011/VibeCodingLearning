const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

// 正则替换：找到 systemPrompt || ` 和对应的结束 `
const pattern = /content:\s*systemPrompt\s*\|\|\s*`[\s\S]*?`(?=\s*[,\n}])/;
const match = content.match(pattern);

if (match) {
  content = content.replace(pattern, 'content: systemPrompt || DEFAULT_SYSTEM_PROMPT');
  fs.writeFileSync('server.js', content, 'utf8');
  console.log('Updated server.js successfully');
} else {
  console.log('Pattern not found');
}
