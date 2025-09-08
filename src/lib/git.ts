import { hostRun, hasTauri } from "./host";

export type FileChange = {
  path: string;
  staged: boolean;
  status: string; // e.g., "M", "A", "D", "R...", "??"
};

export async function gitStatus(): Promise<FileChange[]> {
  if (!hasTauri) throw new Error("host-unavailable");
  // porcelain=v1, NUL-delimited for safer parsing
  const res = await hostRun("git", ["status", "--porcelain=v1", "-z"], false);
  if (res.status !== 0) throw new Error(res.stderr || "git status failed");

  const out: FileChange[] = [];
  const chunks = res.stdout.split("\0").filter(Boolean);
  for (const entry of chunks) {
    // entry is like: "XY path" (or rename: "R100 old -> new")
    const x = entry.slice(0, 1); // index status
    const y = entry.slice(1, 2); // worktree status
    const rest = entry.slice(3); // path or rename form
    let staged = false,
      status = "";
    if (x !== " ") {
      staged = true;
      status = x;
    } else if (y !== " ") {
      staged = false;
      status = y;
    }
    // handle rename form "R... old -> new"
    let path = rest;
    const renameSep = " -> ";
    if (rest.includes(renameSep)) {
      const parts = rest.split(renameSep);
      path = parts[1]; // show the new path
      status = "R";
    }
    out.push({ path, staged, status });
  }
  return out;
}

export async function gitDiffFile(path: string, staged: boolean): Promise<string> {
  if (!hasTauri) throw new Error("host-unavailable");
  const baseArgs = ["diff", "--no-color", "--unified=3"];
  const args = staged ? [...baseArgs, "--staged", "--", path] : [...baseArgs, "--", path];
  const res = await hostRun("git", args, false);
  if (res.status !== 0) {
    // If file is new and unstaged, diff may be empty; return stderr only if it’s meaningful
    return res.stdout || res.stderr || "";
  }
  return res.stdout || "";
}
