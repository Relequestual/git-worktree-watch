# Git Worktree Refresh

Git Worktree Refresh helps VS Code notice Git worktrees that were created outside VS Code.

When a repository is open, the extension watches the repository's common Git directory for worktree metadata changes. When that metadata changes, it rescans known Git worktrees and asks VS Code's built-in Git extension to open any worktree repositories that are not already registered in Source Control.

## Features

- Watches `.git/worktrees` metadata for open repositories.
- Opens newly discovered worktrees through VS Code's built-in Git API.
- Provides a manual `Git Worktree Refresh: Rescan Worktrees` command.
- Logs decisions and failures to the `Git Worktree Refresh` output channel.

## Requirements

- VS Code with the built-in Git extension enabled.
- Git available on `PATH`.
- Local repositories must be trusted by VS Code workspace trust before VS Code can open them.

## Extension Settings

This extension contributes the following settings:

- `gitWorktreeRefresh.autoRefresh`: Enable or disable automatic metadata watching. Defaults to `true`.
- `gitWorktreeRefresh.debounceMs`: Delay before rescanning after metadata changes. Defaults to `750`.
- `gitWorktreeRefresh.showNotifications`: Show notifications for refresh events and failures. Defaults to `false`.

## Local Build And Install

Install dependencies:

```sh
pnpm install
```

Compile:

```sh
pnpm run compile
```

Package a local VSIX:

```sh
pnpm dlx @vscode/vsce package
```

Install the generated `.vsix` from VS Code:

```sh
code --install-extension git-worktree-refresh-0.0.1.vsix
```

Reload VS Code after installing.

## Manual Smoke Test

1. Open a Git repository in VS Code.
2. Confirm Source Control is enabled and the repository appears.
3. From an external terminal, create a worktree:

   ```sh
   git worktree add ../repo-feature-branch feature-branch
   ```

4. Open the Source Control Repositories list.
5. Confirm the new worktree appears without reloading the window.
6. If it does not appear, run `Git Worktree Refresh: Rescan Worktrees`.
7. Check `View: Toggle Output` -> `Git Worktree Refresh` for diagnostics.

## Known Issues

- The extension focuses on newly discovered worktrees. Removing worktrees may still rely on VS Code's built-in Git extension to dispose stale repositories.
- The extension does not edit `.code-workspace` files or add workspace folders.
- If VS Code rejects a repository because of workspace trust or Git safe-directory rules, this extension logs the failure but does not bypass that protection.
