import { hostRun } from "./host";

/** List changed files for ref vs base, with rename detection; include deletions. */
export async function listChangedFiles(base: string, ref: string): Promise<string[]> {
  const args = ["diff", "--name-only", "--find-renames", "--diff-filter=ACMRD", `${base}..${ref}`];
  const res = await hostRun("git", args, false);
  if (res.status !== 0) throw new Error(res.stderr || `git diff failed for ${ref}`);
  // De-duplicate and preserve order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of res.stdout.split("\n")) {
    const f = line.trim();
    if (!f || seen.has(f)) continue;
    seen.add(f);
    out.push(f);
  }
  return out;
}

/** Parse @@ hunk headers from a --unified=0 diff. Use the '-' (base) side for cross-ref comparison. */
export function parseUnifiedHunks(diffText: string): Array<{ start: number; end: number }> {
  // @@ -a,b +c,d @@  (b or d may be omitted, which implies 1)
  const re = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/gm;
  const ranges: Array<{ start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(diffText))) {
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : 1;
    if (b <= 0) continue; // nothing changed on base side (e.g., pure insertion)
    const start = a;
    const end = a + b - 1; // inclusive
    ranges.push({ start, end });
  }
  return ranges;
}

/** Get base-relative hunk ranges for a single file under ref vs base. */
export async function listHunks(base: string, ref: string, file: string) {
  const args = [
    "diff",
    "--unified=0",
    "--no-color",
    "--no-ext-diff",
    `${base}..${ref}`,
    "--",
    file,
  ];
  const res = await hostRun("git", args, false);
  if (res.status !== 0) return []; // treat failures as no hunks (we’ll degrade gracefully)
  return parseUnifiedHunks(res.stdout);
}

/** File-level overlap matrix and greedy low-conflict order. */
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

/** Hunk-level overlap: sum of overlapping base-line lengths across shared files. */
export function buildHunkOverlap(
  refs: string[],
  filesByRef: Record<string, string[]>,
  hunks: Record<string, Record<string, Array<{ start: number; end: number }>>>
): {
  matrix: number[][];
  totals: number[];
  hotPairs: Array<{ a: string; b: string; score: number }>;
} {
  const n = refs.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const totals = Array(n).fill(0);

  const overlapLen = (A: { start: number; end: number }, B: { start: number; end: number }) =>
    Math.max(0, Math.min(A.end, B.end) - Math.max(A.start, B.start) + 1);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let score = 0;
      const ri = refs[i],
        rj = refs[j];
      const filesI = new Set(filesByRef[ri] || []);
      const filesJ = new Set(filesByRef[rj] || []);
      for (const f of filesI) {
        if (!filesJ.has(f)) continue;
        const hi = hunks[ri]?.[f] || [];
        const hj = hunks[rj]?.[f] || [];
        for (const a of hi) for (const b of hj) score += overlapLen(a, b);
      }
      matrix[i][j] = matrix[j][i] = score;
    }
  }
  for (let i = 0; i < n; i++) totals[i] = matrix[i].reduce((s, x) => s + x, 0);

  const hotPairs: Array<{ a: string; b: string; score: number }> = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (matrix[i][j] > 0) hotPairs.push({ a: refs[i], b: refs[j], score: matrix[i][j] });
    }
  }
  hotPairs.sort((x, y) => y.score - x.score);
  return { matrix, totals, hotPairs };
}

/** CSV export with quoting. */
export function matrixToCSV(refs: string[], matrix: number[][]): string {
  const q = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const header = [q("ref"), ...refs.map(q)].join(",");
  const rows = refs.map((r, i) => [q(r), ...matrix[i]].join(","));
  return [header, ...rows].join("\n");
}

