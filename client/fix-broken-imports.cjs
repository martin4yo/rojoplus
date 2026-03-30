const fs = require('fs');
const path = require('path');

const srcDir = 'D:/Desarrollos/React/RojoPlus/client/src/';

function getAllFiles(dir) {
  const files = [];
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f).split(path.sep).join('/');
    if (fs.statSync(full).isDirectory()) files.push(...getAllFiles(full));
    else if (f.endsWith('.jsx') || f.endsWith('.js')) files.push(full);
  });
  return files;
}

const files = getAllFiles(srcDir);
let fixed = 0;

files.forEach(fpath => {
  let content = fs.readFileSync(fpath, 'utf8');
  const lines = content.split('\n');
  let changed = false;

  for (let i = 0; i < lines.length - 1; i++) {
    // Pattern: line is exactly "import {" and next line is the misplaced LoadingSpinner import
    if (lines[i].trim() === 'import {' && lines[i+1].trim().startsWith('import LoadingSpinner from ')) {
      const spinnerLine = lines[i+1];
      // Remove the spinner line from position i+1
      lines.splice(i+1, 1);
      // Insert it before the "import {" at position i
      lines.splice(i, 0, spinnerLine);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(fpath, lines.join('\n'), 'utf8');
    fixed++;
    console.log('FIXED: ' + fpath.replace(srcDir, ''));
  }
});

console.log('\nTotal fixed: ' + fixed);
