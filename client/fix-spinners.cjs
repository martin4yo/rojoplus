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

// Containers that hold a large spinner as their only meaningful content
// These full blocks should be replaced with <LoadingSpinner />
// Pattern: outer div (flex center / text-center) containing only a large spinner div
const FULL_BLOCK_PATTERNS = [
  // <div className="flex ... justify-center ...h-XX"><div className="animate-spin ... h-12 ..."></div></div>
  // Matches multiline
  /<div className="(?:[^"]*?)(?:flex[^"]*justify-center|justify-center[^"]*flex)[^"]*">\s*<div className="[^"]*animate-spin[^"]*\b(?:h-8|h-10|h-12|h-16)\b[^"]*"><\/div>\s*<\/div>/gs,
  /<div className="(?:[^"]*?)(?:flex[^"]*justify-center|justify-center[^"]*flex)[^"]*">\s*<div className="[^"]*\b(?:h-8|h-10|h-12|h-16)\b[^"]*animate-spin[^"]*"><\/div>\s*<\/div>/gs,
  // <div className="... min-h-screen ... flex ... justify-center ..."><div className="text-center"><div ... animate-spin h-16 ...></div><p>...</p></div></div>
  // Too complex - handle separately below
];

// Just the large spinner div standalone (these appear inside a parent that is NOT justify-center)
// We'll replace the spinner div itself, keeping whatever container wraps it
const SPINNER_DIV_PATTERNS = [
  // <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-*"></div>
  /<div className="(?:inline-block )?animate-spin rounded-full (?:h-\d+ w-\d+ )border-b-2 border-(?:red-600|primary|gray-400)[^"]*"><\/div>/g,
  // <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-* mx-auto mb-4"></div>
  /<div className="(?:inline-block )?animate-spin rounded-full (?:h-\d+ w-\d+ )(?:[a-z-]+ )*border-b-2 border-(?:red-600|primary|gray-400)[^"]*"><\/div>/g,
  // <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full ..." />
  /<div className="animate-spin (?:h-\d+ w-\d+ )border-4 border-(?:primary|red-600)[^"]*rounded-full[^"]*"(?:\s*\/>| ><\/div>)/g,
  /<div className="animate-spin (?:h-\d+ w-\d+ )?(?:rounded-full )?border-4 border-(?:primary|red-600)[^"]*"(?:\s*\/>| ><\/div>)/g,
  // <RefreshCw className="w-8 h-8 animate-spin text-red-600" />  — page level only (not in buttons)
  /<RefreshCw className="w-8 h-8 (?:text-red-600|text-gray-400) animate-spin"(?:\s*\/>| ><\/RefreshCw>)/g,
  /<RefreshCw className="w-8 h-8 animate-spin (?:text-red-600|text-gray-400)"(?:\s*\/>| ><\/RefreshCw>)/g,
];

function addImport(content, importLine) {
  if (content.includes(importLine)) return content;
  const lines = content.split('\n');
  // Find last complete import line (not inside a multiline import block)
  // Track if we're inside a multiline import
  let lastImportIdx = -1;
  let insideMultiline = false;
  lines.forEach((line, i) => {
    if (insideMultiline) {
      if (line.includes('} from ')) insideMultiline = false;
      return;
    }
    if (line.startsWith('import ')) {
      // Check if this opens a multiline block
      if (line.trim() === 'import {') {
        insideMultiline = true;
      } else if (line.includes('import {') && !line.includes('} from ')) {
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

function getImportLine(fpath) {
  const rel = fpath.replace(srcDir, '');
  const depth = rel.split('/').length - 1;
  const dots = '../'.repeat(depth);
  return `import LoadingSpinner from '${dots}components/LoadingSpinner'`;
}

const files = getAllFiles(srcDir);
let fixed = 0;

// Files to skip (components that should keep their inline spinners)
const SKIP = [
  'components/Button.jsx',
  'components/SearchInput.jsx',
  'components/InstallAppButton.jsx',
  'components/PlanPagosModal.jsx',
  'components/chat/',
  'components/buffet/ClienteSelector.jsx',
  'components/buffet/TicketPreview.jsx',
];

files.forEach(fpath => {
  const rel = fpath.replace(srcDir, '');

  // Skip component files that intentionally have inline spinners
  if (SKIP.some(s => rel.includes(s))) return;

  let content = fs.readFileSync(fpath, 'utf8');

  // Only process files that have large animate-spin (h-8, h-10, h-12, h-16)
  if (!/animate-spin/.test(content)) return;
  if (!/(h-8|h-10|h-12|h-16)/.test(content)) return;

  let original = content;

  // Replace full container blocks first
  content = content.replace(
    /<div className="(?:[^"]*\s)?(?:flex\s+[^"]*\s+justify-center|justify-center\s[^"]*flex|text-center)[^"]*">\s*\n\s*<div className="[^"]*animate-spin[^"]*\b(?:h-8|h-10|h-12|h-16)\b[^"]*"(?:\s*><\/div>|\s*\/>)\s*\n\s*<\/div>/g,
    '<LoadingSpinner />'
  );

  // Replace full container with spinner + text (text-center py-X with spinner and p tag)
  content = content.replace(
    /<div className="[^"]*text-center[^"]*">\s*\n\s*<div className="[^"]*animate-spin[^"]*\b(?:h-8|h-10|h-12|h-16)\b[^"]*"(?:\s*><\/div>|\s*\/>)\s*\n\s*<p[^>]*>[^<]*<\/p>\s*\n\s*<\/div>/g,
    '<LoadingSpinner />'
  );

  // Replace just the large spinner div (when inside min-h-screen or similar wrappers we can't easily unwrap)
  // Replace the standalone spinner div - any large one
  content = content.replace(
    /<div className="(?:inline-block\s+)?(?:animate-spin\s+|[^"]*\s)animate-spin[^"]*\b(?:h-8|h-10|h-12|h-16)\b[^"]*"(?:\s*><\/div>|\s*\/>)/g,
    (match) => {
      // Skip if it's a small spinner inside a button (border-white typically)
      if (match.includes('border-white')) return match;
      if (match.includes('border-t-transparent') && (match.includes('h-4') || match.includes('h-5') || match.includes('h-3'))) return match;
      return '<LoadingSpinner />';
    }
  );

  // RefreshCw page-level spinners (h-8)
  content = content.replace(
    /<RefreshCw[^/]*className="w-8 h-8[^"]*animate-spin[^"]*"[^/]*\/>/g,
    '<LoadingSpinner />'
  );
  content = content.replace(
    /<RefreshCw[^/]*className="[^"]*animate-spin[^"]*w-8 h-8[^"]*"[^/]*\/>/g,
    '<LoadingSpinner />'
  );

  if (content === original) return;

  // Add import if needed
  if (!content.includes('import LoadingSpinner')) {
    content = addImport(content, getImportLine(fpath));
  }

  fs.writeFileSync(fpath, content, 'utf8');
  fixed++;
  console.log('FIXED: ' + rel);
});

console.log('\nTotal fixed: ' + fixed);
