import { describe, it, expect } from "vitest";
import { buildOverlapMatrix, matrixToCSV } from "../src/lib/conflict";

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
    expect(matrix[1][2]).toBe(0);
    expect(order.length).toBe(3);
  });
  it("CSV output shape", () => {
    const refs = ["X", "Y"];
    const csv = matrixToCSV(refs, [
      [0, 2],
      [2, 0],
    ]);
    expect(csv.split("\n")[0]).toBe("ref,X,Y");
  });
});

