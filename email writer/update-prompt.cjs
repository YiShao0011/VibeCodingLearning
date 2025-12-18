const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

// 用正则查找并替换
const regex = /content:\s*systemPrompt\s*\|\|\s*`[\s\S]*?`(?=\s*[,\n}])/;
if (content.match(regex)) {
  content = content.replace(regex, 'content: systemPrompt || DEFAULT_SYSTEM_PROMPT');
  fs.writeFileSync('server.js', content, 'utf8');
  console.log('✓ Updated server.js successfully');
} else {
  console.log('✗ Pattern not found');
}
