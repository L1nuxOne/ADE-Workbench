import { hostRun, hasTauri } from "./host";

export type FileChange = {
  path: string;
  staged: boolean;
  status: string; // e.g., "M", "A", "D", "R", "C", "??"
  oldPath?: string; // for renames/copies
};

export async function gitStatus(): Promise<FileChange[]> {
  if (!hasTauri) throw new Error("host-unavailable");
  // porcelain=v1, NUL-delimited for safer parsing
  const res = await hostRun("git", ["status", "--porcelain=v1", "-z"], false);
  if (res.status !== 0) throw new Error(res.stderr || "git status failed");

  const out: FileChange[] = [];
  const chunks = res.stdout.split("\0"); // keep empties for indexing safety

  // Iterate over NUL chunks. Each record begins with "XY " + path.
  for (let i = 0; i < chunks.length; i++) {
    const rec = chunks[i];
    if (!rec) continue;
    if (rec.length < 3) continue; // must at least have XY + space

    const X = rec[0]; // index column
    const Y = rec[1]; // worktree column
    const sp = rec[2];
    if (sp !== " ") continue; // malformed

    // path1 lives after "XY "
    const path1 = rec.slice(3);
    let statusIndex = X;
    let statusWork = Y;

    // Rename/Copy: when X is R or C (score may be appended in v1)
    let isRenameOrCopy = X === "R" || X === "C";
    // In -z mode, git emits: "XY path1\0path2\0" (no " -> ")
    let path2: string | undefined;
    if (isRenameOrCopy) {
      const next = chunks[i + 1];
      if (next) {
        path2 = next;
        i++; // consume the extra path chunk
      }
    }

    // Untracked "??" is purely worktree; do not mark staged
    const isUntracked = X === "?" && Y === "?";

    // Emit rows:
    // 1) Index (staged) row if X is not space AND not untracked "?"
    if (X !== " " && !isUntracked) {
      const status = isRenameOrCopy ? (X as string) : X;
      const row: FileChange = {
        staged: true,
        status: String(status),
        path: isRenameOrCopy ? (path2 ?? path1) : path1,
        ...(isRenameOrCopy ? { oldPath: path1 } : {}),
      };
      out.push(row);
    }
    // 2) Worktree (unstaged) row if Y is not space
    if (Y !== " ") {
      const row: FileChange = {
        staged: false,
        status: String(isUntracked ? "??" : Y),
        path: path1, // worktree refers to current worktree path
      };
      out.push(row);
    }
  }
  return out;
}

export async function gitDiffFile(path: string, staged: boolean): Promise<string> {
  if (!hasTauri) throw new Error("host-unavailable");
  // Avoid user difftools and ensure plain patch
  const baseArgs = ["diff", "--no-color", "--no-ext-diff", "--unified=3"];
  const args = staged ? [...baseArgs, "--staged", "--", path] : [...baseArgs, "--", path];
  const res = await hostRun("git", args, false);
  if (res.status !== 0) {
    // If file is new and unstaged, diff may be empty; return stderr only if it’s meaningful
    return res.stdout || res.stderr || "";
  }
  return res.stdout || "";
}
