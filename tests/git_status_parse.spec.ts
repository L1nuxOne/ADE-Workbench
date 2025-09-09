import { describe, it, expect, vi } from "vitest";
import { HostClient } from "../src/lib/hostClient";
import { gitStatus, type FileChange } from "../src/lib/git";

function mockClient(stdout: string, status = 0, stderr = "") {
  const client = new HostClient();
  client.run = vi.fn().mockResolvedValue({ status, stdout, stderr }) as any;
  return client;
}

describe("git status -z parsing", () => {
  it("parses modified staged and worktree", async () => {
    // "M " index modified for a.txt  AND " M" worktree modified for b.txt
    const out = "M  a.txt\0 M b.txt\0";
    const client = mockClient(out);
    const rows = await gitStatus(client);
    expect(rows).toEqual<FileChange[]>([
      { staged: true,  status: "M", path: "a.txt" },
      { staged: false, status: "M", path: "b.txt" },
    ]);
  });

  it("handles staged rename (old -> new)", async () => {
    // X=R, Y=space; order old\0new
    const out = "R  src/old.txt\0src/new.txt\0";
    const client = mockClient(out);
    const rows = await gitStatus(client);
    expect(rows).toEqual<FileChange[]>([
      { staged: true, status: "R", path: "src/new.txt", oldPath: "src/old.txt" },
    ]);
  });

  it("handles unstaged rename (worktree)", async () => {
    // X=space, Y=R
    const out = " R src/old2.txt\0src/new2.txt\0";
    const client = mockClient(out);
    const rows = await gitStatus(client);
    expect(rows).toEqual<FileChange[]>([
      { staged: false, status: "R", path: "src/new2.txt", oldPath: "src/old2.txt" },
    ]);
  });

  it("handles both staged and unstaged rename on same path", async () => {
    const out = "RR src/old3.txt\0src/new3.txt\0";
    const client = mockClient(out);
    const rows = await gitStatus(client);
    expect(rows).toEqual<FileChange[]>([
      { staged: true,  status: "R", path: "src/new3.txt", oldPath: "src/old3.txt" },
      { staged: false, status: "R", path: "src/new3.txt", oldPath: "src/old3.txt" },
    ]);
  });

  it("handles copy (C)", async () => {
    const out = "C  src/original.txt\0src/copy.txt\0";
    const client = mockClient(out);
    const rows = await gitStatus(client);
    expect(rows).toEqual<FileChange[]>([
      { staged: true, status: "C", path: "src/copy.txt", oldPath: "src/original.txt" },
    ]);
  });
});

