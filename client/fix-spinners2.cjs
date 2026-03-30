const fs = require('fs');
const path = require('path');

const srcDir = 'D:/Desarrollos/React/RojoPlus/client/src/';

// Manual targeted fixes for remaining files
const FIXES = [
  // Single-line flex+spinner pattern (buffet files)
  {
    pattern: /<div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(?:primary|red-600)"><\/div><\/div>/g,
    replacement: '<LoadingSpinner />'
  },
  // animate-spin h-10, h-12 border-b-2 on single line
  {
    pattern: /<div className="animate-spin rounded-full h-(?:8|10|12) w-(?:8|10|12) border-b-2 border-(?:primary|red-600)[^"]*"><\/div>/g,
    replacement: '<LoadingSpinner />'
  },
  // animate-spin w-8 h-8 border-2 border-t-transparent (PartidoDetalle pattern)
  {
    pattern: /<div className="animate-spin w-8 h-8 border-2 border-(?:primary|red-600) border-t-transparent rounded-full"><\/div>/g,
    replacement: '<LoadingSpinner />'
  },
  // animate-spin h-12 w-12 border-4 border-primary border-t-transparent (self-closing)
  {
    pattern: /<div className="animate-spin h-\d+ w-\d+ border-4 border-(?:primary|red-600) border-t-transparent rounded-full[^"]*"(?:\s*\/>)/g,
    replacement: '<LoadingSpinner />'
  },
  // Loader icon (lucide) w-8 h-8 animate-spin (page-level only, not in buttons)
  {
    pattern: /<Loader className="w-8 h-8 animate-spin[^"]*"(?:\s*\/>)/g,
    replacement: '<LoadingSpinner />'
  },
  // ControlPWA pattern
  {
    pattern: /<div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"><\/div>/g,
    replacement: '<LoadingSpinner />'
  },
];

function getAllFiles(dir) {
  const files = [];
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f).split(path.sep).join('/');
    if (fs.statSync(full).isDirectory()) files.push(...getAllFiles(full));
    else if (f.endsWith('.jsx') || f.endsWith('.js')) files.push(full);
  });
  return files;
}

function getImportLine(fpath) {
  const rel = fpath.replace(srcDir, '');
  const depth = rel.split('/').length - 1;
  const dots = '../'.repeat(depth);
  return `import LoadingSpinner from '${dots}components/LoadingSpinner'`;
}

function addImport(content, importLine) {
  if (content.includes(importLine)) return content;
  const lines = content.split('\n');
  let lastImportIdx = -1;
  let insideMultiline = false;
  lines.forEach((line, i) => {
    if (insideMultiline) {
      if (line.includes('} from ')) insideMultiline = false;
      return;
    }
    if (line.startsWith('import ')) {
      if (line.trim() === 'import {' || (line.includes('import {') && !line.includes('} from '))) {
        insideMultiline = true;
      } else {
        lastImportIdx = i;
      }
    }
  });
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importLine);
  }
  return lines.join('\n');
}

const files = getAllFiles(srcDir);
let fixed = 0;

files.forEach(fpath => {
  let content = fs.readFileSync(fpath, 'utf8');
  if (!content.includes('animate-spin')) return;

  let original = content;
  FIXES.forEach(({ pattern, replacement }) => {
    content = content.replace(pattern, replacement);
  });

  if (content === original) return;

  if (!content.includes('import LoadingSpinner')) {
    content = addImport(content, getImportLine(fpath));
  }

  fs.writeFileSync(fpath, content, 'utf8');
  fixed++;
  console.log('FIXED: ' + fpath.replace(srcDir, ''));
});

console.log('\nTotal fixed: ' + fixed);
