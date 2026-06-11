import * as path from 'node:path';
import * as vscode from 'vscode';

import { getCommonGitDir, listWorktrees, normalizeFsPath } from './git-cli';
import type { GitApi, GitRepository } from './vscode-git';

export class WorktreeRefreshService {
	private readonly disposables: vscode.Disposable[] = [];
	private readonly watcherDisposables = new Map<string, vscode.Disposable[]>();
	private rescanTimeout: ReturnType<typeof setTimeout> | undefined;

	constructor(
		private readonly gitApi: GitApi,
		private readonly output: vscode.OutputChannel,
	) {}

	async start(): Promise<void> {
		this.disposables.push(
			this.gitApi.onDidOpenRepository(repository => {
				this.registerRepositoryWatcher(repository).then(
					() => this.scheduleRescan(`repository opened: ${repository.rootUri.fsPath}`),
					error => this.log(`Failed to register watcher for ${repository.rootUri.fsPath}: ${formatError(error)}`),
				);
			}),
			vscode.workspace.onDidChangeConfiguration(event => {
				if (!event.affectsConfiguration('gitWorktreeRefresh')) {
					return;
				}

				this.log('Configuration changed; refreshing worktree metadata watchers.');
				this.refreshWatchers().then(
					() => this.scheduleRescan('configuration changed'),
					error => this.log(`Failed to refresh watchers after configuration change: ${formatError(error)}`),
				);
			}),
		);

		await this.refreshWatchers();
	}

	async rescanAllRepositories(reason: string): Promise<void> {
		const repositories = [...this.gitApi.repositories];
		this.log(`Rescanning ${repositories.length} repository/repositories. Reason: ${reason}.`);

		for (const repository of repositories) {
			await this.rescanRepository(repository);
		}
	}

	dispose(): void {
		if (this.rescanTimeout) {
			clearTimeout(this.rescanTimeout);
			this.rescanTimeout = undefined;
		}

		for (const disposables of this.watcherDisposables.values()) {
			disposeAll(disposables);
		}

		this.watcherDisposables.clear();
		disposeAll(this.disposables);
	}

	private async refreshWatchers(): Promise<void> {
		for (const disposables of this.watcherDisposables.values()) {
			disposeAll(disposables);
		}

		this.watcherDisposables.clear();

		if (!getAutoRefresh()) {
			this.log('Automatic worktree refresh is disabled.');
			return;
		}

		for (const repository of this.gitApi.repositories) {
			await this.registerRepositoryWatcher(repository);
		}
	}

	private async registerRepositoryWatcher(repository: GitRepository): Promise<void> {
		if (!getAutoRefresh()) {
			return;
		}

		const commonGitDir = normalizeFsPath(await getCommonGitDir(repository.rootUri.fsPath));

		if (this.watcherDisposables.has(commonGitDir)) {
			return;
		}

		const worktreesDirectoryWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(commonGitDir, 'worktrees'));
		const worktreeMetadataWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(commonGitDir, 'worktrees/**'));
		const watchers = [worktreesDirectoryWatcher, worktreeMetadataWatcher];
		const disposables: vscode.Disposable[] = [...watchers];

		for (const watcher of watchers) {
			watcher.onDidCreate(uri => this.scheduleRescan(`worktree metadata created: ${uri.fsPath}`), undefined, disposables);
			watcher.onDidChange(uri => this.scheduleRescan(`worktree metadata changed: ${uri.fsPath}`), undefined, disposables);
			watcher.onDidDelete(uri => this.scheduleRescan(`worktree metadata deleted: ${uri.fsPath}`), undefined, disposables);
		}

		this.watcherDisposables.set(commonGitDir, disposables);
		this.log(`Watching worktree metadata in ${commonGitDir}.`);
	}

	private scheduleRescan(reason: string): void {
		if (!getAutoRefresh()) {
			this.log(`Skipped scheduled rescan because automatic refresh is disabled. Reason: ${reason}.`);
			return;
		}

		if (this.rescanTimeout) {
			clearTimeout(this.rescanTimeout);
		}

		const debounceMs = getDebounceMs();
		this.log(`Scheduling rescan in ${debounceMs}ms. Reason: ${reason}.`);

		this.rescanTimeout = setTimeout(() => {
			this.rescanTimeout = undefined;
			this.rescanAllRepositories(reason).then(
				() => this.refreshWatchers(),
				error => this.log(`Scheduled rescan failed: ${formatError(error)}`),
			);
		}, debounceMs);
	}

	private async rescanRepository(repository: GitRepository): Promise<void> {
		const repositoryRoot = repository.rootUri.fsPath;

		try {
			const commonGitDir = await getCommonGitDir(repositoryRoot);
			this.log(`Repository ${repositoryRoot} uses common git dir ${commonGitDir}.`);

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

				this.log(`Opening discovered worktree ${worktreePath}.`);
				const openedRepository = await this.gitApi.openRepository(vscode.Uri.file(worktreePath));

				if (openedRepository) {
					openRepositoryRoots.add(normalizeFsPath(openedRepository.rootUri.fsPath));
					this.log(`Opened worktree repository ${openedRepository.rootUri.fsPath}.`);
					this.notify(`Opened worktree ${path.basename(openedRepository.rootUri.fsPath)}.`);
				} else {
					this.log(`VS Code Git API did not open ${worktreePath}.`);
				}
			}
		} catch (error) {
			const message = `Failed to rescan ${repositoryRoot}: ${formatError(error)}`;
			this.log(message);
			this.notify(message);
		}
	}

	private log(message: string): void {
		this.output.appendLine(message);
	}

	private notify(message: string): void {
		if (getShowNotifications()) {
			vscode.window.showInformationMessage(message);
		}
	}
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function getAutoRefresh(): boolean {
	return vscode.workspace.getConfiguration('gitWorktreeRefresh').get('autoRefresh', true);
}

function getDebounceMs(): number {
	return vscode.workspace.getConfiguration('gitWorktreeRefresh').get('debounceMs', 750);
}

function getShowNotifications(): boolean {
	return vscode.workspace.getConfiguration('gitWorktreeRefresh').get('showNotifications', false);
}

function disposeAll(disposables: vscode.Disposable[]): void {
	while (disposables.length > 0) {
		disposables.pop()?.dispose();
	}
}
