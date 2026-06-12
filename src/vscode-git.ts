import * as vscode from 'vscode';

export interface GitExtension {
  readonly enabled: boolean;
  getAPI(version: 1): GitApi;
}

export interface GitApi {
  readonly repositories: GitRepository[];
  readonly onDidOpenRepository: vscode.Event<GitRepository>;
  openRepository(root: vscode.Uri): Promise<GitRepository | null>;
}

export interface GitRepository {
  readonly rootUri: vscode.Uri;
  readonly state: GitRepositoryState;
  status(): Promise<void>;
}

export interface GitRepositoryState {
  readonly worktrees: GitWorktree[];
}

export interface GitWorktree {
  readonly path: string;
  readonly main: boolean;
}

export async function getGitApi(output: vscode.OutputChannel): Promise<GitApi> {
  const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');

  if (!extension) {
    throw new Error('The built-in vscode.git extension is not available.');
  }

  const gitExtension = extension.isActive ? extension.exports : await extension.activate();

  if (!gitExtension.enabled) {
    throw new Error('The built-in vscode.git extension is disabled.');
  }

  output.appendLine('Connected to built-in vscode.git extension.');
  return gitExtension.getAPI(1);
}
