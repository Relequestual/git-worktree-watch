import { defineConfig } from '@vscode/test-cli';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const testDataRoot = mkdtempSync('/tmp/gwtr-');
process.once('exit', () => {
  rmSync(testDataRoot, { force: true, recursive: true });
});

export default defineConfig({
  files: 'out/test/**/*.test.js',
  launchArgs: [
    `--user-data-dir=${join(testDataRoot, 'user-data')}`,
    `--extensions-dir=${join(testDataRoot, 'extensions')}`,
  ],
});
