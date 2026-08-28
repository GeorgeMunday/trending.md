const fs = require('fs');
const path = require('path');

const readmePath = path.join(__dirname, '..', '..', 'README.md');
let content = fs.readFileSync(readmePath, 'utf8');

const marker = /(<!-- update-count -->)(\d+)/;

if (marker.test(content)) {
  content = content.replace(marker, (_, tag, num) => `${tag}${parseInt(num, 10) + 1}`);
} else {
  content = `<!-- update-count -->1\n\n${content}`;
}

fs.writeFileSync(readmePath, content);
console.log('README updated.');