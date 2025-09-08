import { hostRun, hasTauri } from "./host";

export async function listChangedFiles(base: string, ref: string): Promise<string[]> {
  if (!hasTauri) throw new Error("host-unavailable");
  // Use rename detection so refactors are surfaced; include deletions (D) to catch delete vs modify conflicts.
  const args = [
    "diff",
    "--name-only",
    "--find-renames",
    "--diff-filter=ACMRD",
    `${base}..${ref}`,
  ];
  const res = await hostRun("git", args, false);
  if (res.status !== 0) throw new Error(res.stderr || `git diff failed for ${ref}`);
  // De-duplicate filenames (some configs can repeat paths). Preserve input order.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of res.stdout.split("\n")) {
    const f = line.trim();
    if (!f) continue;
    if (!seen.has(f)) {
      seen.add(f);
      out.push(f);
    }
  }
  return out;
}

export function buildOverlapMatrix(
  refs: string[],
  filesByRef: Record<string, string[]>
): { matrix: number[][]; totals: number[]; order: string[] } {
  const n = refs.length;
  const sets = refs.map((r) => new Set(filesByRef[r] || []));
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const totals: number[] = sets.map((s) => s.size);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let c = 0;
      for (const f of sets[i]) if (sets[j].has(f)) c++;
      matrix[i][j] = matrix[j][i] = c;
    }
  }
  const remaining = new Set(refs);
  const order: string[] = [];
  while (remaining.size) {
    let best: string | null = null;
    let bestScore = Infinity;
    for (const r of remaining) {
      const i = refs.indexOf(r);
      let score = 0;
      for (const r2 of remaining) {
        if (r2 === r) continue;
        const j = refs.indexOf(r2);
        score += matrix[i][j];
      }
      if (score < bestScore) {
        best = r;
        bestScore = score;
      }
    }
    if (!best) break;
    order.push(best);
    remaining.delete(best);
  }
  return { matrix, totals, order };
}

export function matrixToCSV(refs: string[], matrix: number[][]): string {
  // CSV with simple quoting for refs (handle commas/spaces).
  const q = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const header = [q("ref"), ...refs.map(q)].join(",");
  const rows = refs.map((r, i) => [q(r), ...matrix[i]].join(","));
  return [header, ...rows].join("\n");
}

