import { describe, it, expect } from "vitest";
import { buildOverlapMatrix, matrixToCSV, parseUnifiedHunks, buildHunkOverlap } from "../src/lib/conflict";

describe("buildOverlapMatrix", () => {
  it("computes overlap and order", () => {
    const refs = ["A", "B", "C"];
    const files = {
      A: ["f1", "f2"],
      B: ["f2", "f3"],
      C: ["f4"],
    };
    const { matrix, totals, order } = buildOverlapMatrix(refs, files);
    expect(totals).toEqual([2, 2, 1]);
    expect(matrix[0][1]).toBe(1);
    expect(matrix[1][0]).toBe(1); // symmetry
    expect(matrix[1][2]).toBe(0);
    expect(order.length).toBe(3);
  });
  it("CSV output shape", () => {
    const refs = [`team/feat,A`, `bug "fix"`];
    const csv = matrixToCSV(refs, [
      [0, 2],
      [2, 0],
    ]);
    const [hdr, row1] = csv.split("\n");
    expect(hdr).toBe("\"ref\",\"team/feat,A\",\"bug \"\"fix\"\"\"");
    expect(row1.startsWith("\"team/feat,A\","));
  });

  it("parses unified=0 hunks (base ranges)", () => {
    const diff = `\n@@ -10,3 +10,3 @@\n@@ -42 +45 @@\n@@ -100,10 +200,12 @@\n`;
    const ranges = parseUnifiedHunks(diff);
    expect(ranges).toEqual([
      { start: 10, end: 12 },
      { start: 42, end: 42 },
      { start: 100, end: 109 },
    ]);
  });

  it("hunk overlap sums shared line ranges across refs", () => {
    const refs = ["A", "B"];
    const filesByRef = { A: ["f"], B: ["f"] };
    const hunks = {
      A: { f: [{ start: 10, end: 20 }] },
      B: { f: [{ start: 15, end: 18 }, { start: 100, end: 101 }] },
    };
    const { matrix } = buildHunkOverlap(refs, filesByRef, hunks);
    expect(matrix[0][1]).toBe(4); // 15..18 vs 10..20
    expect(matrix[1][0]).toBe(4);
  });
});

