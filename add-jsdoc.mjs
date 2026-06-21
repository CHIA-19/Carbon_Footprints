import fs from 'fs';
import path from 'path';

const dir = 'src/scripts';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

files.forEach(f => {
  const p = path.join(dir, f);
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  const out = [];
  
  for(let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/^(export )?function /)) {
      if (i > 0 && !lines[i-1].match(/\*\//)) {
        out.push('/**');
        out.push(' * @description Internal function');
        out.push(' * @internal');
        out.push(' */');
      }
    }
    out.push(line);
  }
  fs.writeFileSync(p, out.join('\n'));
});
console.log('Done adding JSDoc!');
