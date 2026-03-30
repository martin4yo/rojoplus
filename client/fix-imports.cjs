const fs = require('fs');
const path = require('path');

const adminDir = 'D:/Desarrollos/React/RojoPlus/client/src/pages/admin';
const srcDir   = 'D:/Desarrollos/React/RojoPlus/client/src/';

function getAllFiles(dir) {
  const files = [];
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f).split(path.sep).join('/');
    if (fs.statSync(full).isDirectory()) files.push(...getAllFiles(full));
    else if (f.endsWith('.jsx') || f.endsWith('.js')) files.push(full);
  });
  return files;
}

const files = getAllFiles(adminDir);
let fixed = 0;

files.forEach(fpath => {
  let content = fs.readFileSync(fpath, 'utf8');

  // Only process files that USE LoadingSpinner but DON'T import it
  if (!content.includes('<LoadingSpinner')) return;
  if (content.includes("import LoadingSpinner")) return;

  // Calculate relative path from this file to src/
  const rel = fpath.replace(srcDir, ''); // e.g. "pages/admin/buffet/BuffetMesas.jsx"
  const depth = rel.split('/').length - 1; // number of folders deep from src/
  const dots = '../'.repeat(depth);
  const importLine = "import LoadingSpinner from '" + dots + "components/LoadingSpinner'";

  // Insert after the last import line
  const lines = content.split('\n');
  let lastImportIdx = -1;
  lines.forEach((line, i) => {
    if (line.startsWith('import ')) lastImportIdx = i;
  });

  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importLine);
    fs.writeFileSync(fpath, lines.join('\n'), 'utf8');
    fixed++;
    console.log('FIXED: ' + fpath.replace(adminDir + '/', ''));
  }
});

console.log('\nTotal fixed: ' + fixed);
