import * as path from 'node:path';
import * as vscode from 'vscode';

import { getCommonGitDir, listWorktrees, normalizeFsPath } from './git-cli';
import type { GitApi, GitRepository } from './vscode-git';

export class WorktreeRefreshService {
	constructor(
		private readonly gitApi: GitApi,
		private readonly output: vscode.OutputChannel,
	) {}

	async rescanAllRepositories(reason: string): Promise<void> {
		const repositories = [...this.gitApi.repositories];
		this.output.appendLine(`Rescanning ${repositories.length} repository/repositories. Reason: ${reason}.`);

		for (const repository of repositories) {
			await this.rescanRepository(repository);
		}
	}

	private async rescanRepository(repository: GitRepository): Promise<void> {
		const repositoryRoot = repository.rootUri.fsPath;

		try {
			const commonGitDir = await getCommonGitDir(repositoryRoot);
			this.output.appendLine(`Repository ${repositoryRoot} uses common git dir ${commonGitDir}.`);

			await repository.status();
			const worktrees = await listWorktrees(repositoryRoot);
			const openRepositoryRoots = new Set(this.gitApi.repositories.map(repo => normalizeFsPath(repo.rootUri.fsPath)));

			for (const worktree of worktrees) {
				if (worktree.bare) {
					continue;
				}

				const worktreePath = normalizeFsPath(worktree.path);

				if (openRepositoryRoots.has(worktreePath)) {
					continue;
				}

				if (path.basename(worktreePath) === '.git') {
					continue;
				}

				this.output.appendLine(`Opening discovered worktree ${worktreePath}.`);
				const openedRepository = await this.gitApi.openRepository(vscode.Uri.file(worktreePath));

				if (openedRepository) {
					openRepositoryRoots.add(normalizeFsPath(openedRepository.rootUri.fsPath));
					this.output.appendLine(`Opened worktree repository ${openedRepository.rootUri.fsPath}.`);
				} else {
					this.output.appendLine(`VS Code Git API did not open ${worktreePath}.`);
				}
			}
		} catch (error) {
			this.output.appendLine(`Failed to rescan ${repositoryRoot}: ${formatError(error)}`);
		}
	}
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
