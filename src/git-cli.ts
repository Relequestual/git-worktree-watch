import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface WorktreeEntry {
  readonly path: string;
  readonly bare: boolean;
  readonly detached: boolean;
}

export async function getCommonGitDir(repositoryRoot: string): Promise<string> {
  const { stdout } = await execGit(repositoryRoot, [
    'rev-parse',
    '--path-format=absolute',
    '--git-common-dir',
  ]);
  return stdout.trim();
}

export async function listWorktrees(repositoryRoot: string): Promise<WorktreeEntry[]> {
  const { stdout } = await execGit(repositoryRoot, ['worktree', 'list', '--porcelain']);
  return parseWorktreeList(stdout);
}

function parseWorktreeList(output: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  let current: MutableWorktreeEntry | undefined;

  for (const line of output.split(/\r?\n/)) {
    if (line.length === 0) {
      if (current?.path) {
        entries.push({
          path: current.path,
          bare: current.bare ?? false,
          detached: current.detached ?? false,
        });
      }
      current = undefined;
      continue;
    }

    if (line.startsWith('worktree ')) {
      if (current?.path) {
        entries.push({
          path: current.path,
          bare: current.bare ?? false,
          detached: current.detached ?? false,
        });
      }
      current = { path: line.substring('worktree '.length), bare: false, detached: false };
      continue;
    }

    if (!current) {
      continue;
    }

    if (line === 'bare') {
      current.bare = true;
    } else if (line === 'detached') {
      current.detached = true;
    }
  }

  if (current?.path) {
    entries.push({
      path: current.path,
      bare: current.bare ?? false,
      detached: current.detached ?? false,
    });
  }

  return entries;
}

interface MutableWorktreeEntry {
  path?: string;
  bare?: boolean;
  detached?: boolean;
}

async function execGit(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });

  return { stdout, stderr };
}

export function normalizeFsPath(fsPath: string): string {
  return path.resolve(fsPath).normalize();
}
