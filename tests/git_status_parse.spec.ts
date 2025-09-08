import { describe, it, expect, vi } from "vitest";

vi.mock("../src/lib/host", () => ({
  hasTauri: true,
  hostRun: vi.fn(),
}));

import { gitStatus } from "../src/lib/git";
import { hostRun } from "../src/lib/host";

function runParse(stdout: string) {
  (hostRun as any).mockResolvedValue({ status: 0, stdout, stderr: "" });
  return gitStatus();
}

describe("git status -z parser", () => {
  it("parses unstaged modify ( ' M' )", async () => {
    const rows = await runParse(" M file.txt\0");
    expect(rows).toEqual([{ path: "file.txt", staged: false, status: "M" }]);
  });
  it("parses staged modify ( 'M ' )", async () => {
    const rows = await runParse("M  lib.ts\0");
    expect(rows).toEqual([{ path: "lib.ts", staged: true, status: "M" }]);
  });
  it("emits both rows when both columns set ( 'MM' )", async () => {
    const rows = await runParse("MM both.txt\0");
    expect(rows).toEqual([
      { path: "both.txt", staged: true, status: "M" },
      { path: "both.txt", staged: false, status: "M" },
    ]);
  });
  it("treats untracked '??' as unstaged", async () => {
    const rows = await runParse("?? newfile\0");
    expect(rows).toEqual([{ path: "newfile", staged: false, status: "??" }]);
  });
  it("parses staged rename with new path (R)", async () => {
    const rows = await runParse("R  oldname\0newname\0");
    expect(rows).toEqual([{ path: "newname", oldPath: "oldname", staged: true, status: "R" }]);
  });
  it("parses staged copy with new path (C)", async () => {
    const rows = await runParse("C  src/a.ts\0src/b.ts\0");
    expect(rows).toEqual([{ path: "src/b.ts", oldPath: "src/a.ts", staged: true, status: "C" }]);
  });
  it("handles delete staged (D )", async () => {
    const rows = await runParse("D  gone.txt\0");
    expect(rows).toEqual([{ path: "gone.txt", staged: true, status: "D" }]);
  });
});
