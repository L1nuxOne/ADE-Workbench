import { hostRun, hasTauri } from "./host";

export type FileChange = {
  path: string;
  staged: boolean;
  status: string; // e.g., "M", "A", "D", "R", "C", "??"
  oldPath?: string; // for renames/copies
};

export async function gitStatus(): Promise<FileChange[]> {
  if (!hasTauri) throw new Error("host unavailable: Tauri host required");
  const res = await hostRun("git", ["status", "--porcelain=v1", "-z"], true);
  if (res.status !== 0) throw new Error(res.stderr || "git status failed");
  const out: FileChange[] = [];
  const chunks = res.stdout.split("\0"); // keep empties to index safely

  // Iterate NUL-delimited records of the form: "XY <path1>\0[<path2>\0]"
  // For renames/copies, Git short format shows "ORIG_PATH -> PATH" (old -> new);
  // in -z the arrow is dropped but order remains old\0new. See git-status docs.
  // https://git-scm.com/docs/git-status#_short_format
  for (let i = 0; i < chunks.length; i++) {
    const rec = chunks[i];
    if (!rec || rec.length < 3) continue; // need XY + space at least
    const X = rec[0]; // index column
    const Y = rec[1]; // worktree column
    const sp = rec[2];
    if (sp !== " ") continue; // malformed

    const path1 = rec.slice(3); // first path (old for R/C)
    const isIndexRC = X === "R" || X === "C";
    const isWorkRC  = Y === "R" || Y === "C";

    // If either side is R/C, a second path chunk follows this record.
    let path2: string | undefined;
    if (isIndexRC || isWorkRC) {
      const next = chunks[i + 1];
      if (next) {
        path2 = next; // second path (new for R/C)
        i++;          // consume extra path
      }
    }

    const isUntracked = X === "?" && Y === "?"; // purely worktree

    // Emit staged row (index side) when applicable
    if (X !== " " && !isUntracked) {
      const row: FileChange = {
        staged: true,
        status: String(X),
        path: isIndexRC ? (path2 ?? path1) : path1,
        ...(isIndexRC ? { oldPath: path1 } : {}),
      };
      out.push(row);
    }

    // Emit unstaged row (worktree side) when applicable
    if (Y !== " ") {
      const row: FileChange = {
        staged: false,
        status: String(isUntracked ? "??" : Y),
        path: isWorkRC ? (path2 ?? path1) : path1,
        ...(isWorkRC ? { oldPath: path1 } : {}),
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
