import * as vscode from 'vscode';

import { getGitApi } from './vscode-git';
import { WorktreeRefreshService } from './worktree-refresh-service';

const output = vscode.window.createOutputChannel('Git Worktree Refresh');

export async function activate(context: vscode.ExtensionContext) {
  output.appendLine('Activating Git Worktree Refresh.');
  let refreshService: WorktreeRefreshService | undefined;

  const rescanCommand = vscode.commands.registerCommand('git-worktree-refresh.rescan', async () => {
    refreshService ??= new WorktreeRefreshService(await getGitApi(output), output);
    await refreshService.rescanAllRepositories('manual command');
  });

  const showOutputCommand = vscode.commands.registerCommand(
    'git-worktree-refresh.showOutput',
    () => {
      output.show();
    }
  );

  context.subscriptions.push(output, rescanCommand, showOutputCommand);

  try {
    const gitApi = await getGitApi(output);
    output.appendLine(
      `Initial Git API connection succeeded with ${gitApi.repositories.length} open repository/repositories.`
    );
    refreshService = new WorktreeRefreshService(gitApi, output);
    context.subscriptions.push(refreshService);
    await refreshService.start();
    await refreshService.rescanAllRepositories('activation');
  } catch (error) {
    output.appendLine(`Initial Git API connection failed: ${formatError(error)}`);
  }
}

export function deactivate() {}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
