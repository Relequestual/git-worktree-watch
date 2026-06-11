import * as vscode from 'vscode';

import { getGitApi } from './vscode-git';

const output = vscode.window.createOutputChannel('Git Worktree Refresh');

export async function activate(context: vscode.ExtensionContext) {
	output.appendLine('Activating Git Worktree Refresh.');

	const rescanCommand = vscode.commands.registerCommand('git-worktree-refresh.rescan', async () => {
		const gitApi = await getGitApi(output);
		output.appendLine(`Connected to VS Code Git API with ${gitApi.repositories.length} open repository/repositories.`);
	});

	const showOutputCommand = vscode.commands.registerCommand('git-worktree-refresh.showOutput', () => {
		output.show();
	});

	context.subscriptions.push(output, rescanCommand, showOutputCommand);

	try {
		const gitApi = await getGitApi(output);
		output.appendLine(`Initial Git API connection succeeded with ${gitApi.repositories.length} open repository/repositories.`);
	} catch (error) {
		output.appendLine(`Initial Git API connection failed: ${formatError(error)}`);
	}
}

export function deactivate() {}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
