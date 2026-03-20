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

const allFiles = [
  ...walkSync(path.join(__dirname, '../src')),
  ...walkSync(path.join(__dirname, '../app')),
];
const matches = [];

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (
    content.includes('COLORS.') &&
    !file.endsWith('constants.ts') &&
    !file.endsWith('useTheme.ts')
  ) {
    matches.push(file);
  }
}

fs.writeFileSync(path.join(__dirname, '../colors_files.txt'), matches.join('\n'));
console.log('Done');
