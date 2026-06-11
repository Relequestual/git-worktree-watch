import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'out/test/**/*.test.js',
	launchArgs: [
		'--user-data-dir=/tmp/gwt-refresh-user-data',
		'--extensions-dir=/tmp/gwt-refresh-extensions',
	],
});
