/* global __dirname */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/screens/goals/GoalsScreen.tsx');
let content = fs.readFileSync(file, 'utf8');

let changed = false;

// 1. Replace import of COLORS
if (content.includes('COLORS')) {
  const relativePathMatch = content.match(
    /import\s+{([^}]*)}\s+from\s+['"]([^'"]+)utils\/constants['"]/,
  );
  if (relativePathMatch) {
    const imports = relativePathMatch[1];
    const basePath = relativePathMatch[2];

    let newImports = imports.replace(/COLORS\s*,?\s*/, '');
    if (newImports.trim() === '') {
      content = content.replace(relativePathMatch[0], '');
    } else {
      content = content.replace(relativePathMatch[1], newImports);
    }

    const useThemeImport = `import { useTheme } from '${basePath}hooks/useTheme';\nimport { useMemo } from 'react';\n`;
    if (!content.includes('useTheme')) {
      if (!content.includes("from 'react'")) {
        content = content.replace(
          /import {?[^{]+}?\s+from\s+['"][^'"]+['"];/,
          (match) => useThemeImport + match,
        );
      } else {
        content = content.replace(/import {?[^{]+}?\s+from\s+['"][^'"]+react['"];/, (match) => {
          if (match.includes('useMemo'))
            return match + '\n' + `import { useTheme } from '${basePath}hooks/useTheme';`;
          return (
            match.replace('{', '{ useMemo, ') +
            '\n' +
            `import { useTheme } from '${basePath}hooks/useTheme';`
          );
        });
      }
    }
    changed = true;
  }
}

// 2. Change StyleSheet.create to a function
if (content.match(/StyleSheet\.create\({[\s\S]*?COLORS/)) {
  content = content.replace(
    /const\s+styles\s*=\s*StyleSheet\.create\(/g,
    'const createStyles = (colors: any) => StyleSheet.create(',
  );

  // 3. Inject useMemo inside every component
  content = content.replace(
    /(export default function [a-zA-Z0-9_]+\([^)]*\)\s*{)/g,
    '$1\n  const { colors } = useTheme();\n  const styles = useMemo(() => createStyles(colors), [colors]);',
  );

  content = content.replace(
    /(const [a-zA-Z0-9_]+\s*=\s*\([^)]*\)\s*=>\s*{)/g,
    '$1\n  const { colors } = useTheme();\n  const styles = useMemo(() => createStyles(colors), [colors]);',
  );

  changed = true;
}

if (changed) {
  fs.writeFileSync(file, content, 'utf8');
  console.log('Updated: ' + file);
} else {
  console.log('No changes needed.');
}
