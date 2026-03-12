/* global __dirname */
const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach((file) => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      if (!dirFile.includes('node_modules') && !dirFile.includes('.expo')) {
        filelist = walkSync(dirFile, filelist);
      }
    } else {
      if (dirFile.endsWith('.tsx') || dirFile.endsWith('.ts')) {
        filelist.push(dirFile);
      }
    }
  });
  return filelist;
};

const srcFiles = walkSync(path.join(__dirname, '../src'));
const appFiles = walkSync(path.join(__dirname, '../app'));
const allFiles = [...srcFiles, ...appFiles];

let filesChanged = 0;

for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf8');

  if (!content.includes('COLORS')) continue;
  if (file.endsWith('constants.ts') || file.endsWith('useTheme.ts')) continue;

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
          // just add useTheme
          const justUseThemeImport = `import { useTheme } from '${basePath}hooks/useTheme';\n`;
          content = content.replace(
            /import {?[^{]+}?\s+from\s+['"][^'"]+['"];/,
            (match) => justUseThemeImport + match,
          );
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
    // We look for export default function Name() {
    content = content.replace(
      /(export default function [a-zA-Z0-9_]+\([^)]*\)\s*{)/g,
      '$1\n  const { colors } = useTheme();\n  const styles = useMemo(() => createStyles(colors), [colors]);',
    );

    // Also handle const Component = () => {
    content = content.replace(
      /(const [a-zA-Z0-9_]+\s*=\s*\([^)]*\)\s*=>\s*{)/g,
      '$1\n  const { colors } = useTheme();\n  const styles = useMemo(() => createStyles(colors), [colors]);',
    );

    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    filesChanged++;
    console.log('Updated: ' + file);
  }
}

console.log('Refactoring done. Files changed: ' + filesChanged);
