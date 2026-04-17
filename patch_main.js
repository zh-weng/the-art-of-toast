import fs from 'fs';
const file = 'main.js';
let content = fs.readFileSync(file, 'utf-8');
content = content.replace(
  /glass0 = new Glass\(pos0, engine, document\.querySelector\('#glass0'\), false, config\)/,
  "glass0 = new Glass(pos0, engine, document.querySelector('#glass0'), true, config)"
);
content = content.replace(
  /glass1 = new Glass\(pos1, engine, document\.querySelector\('#glass1'\), true,  config\)/,
  "glass1 = new Glass(pos1, engine, document.querySelector('#glass1'), false,  config)"
);
fs.writeFileSync(file, content);
