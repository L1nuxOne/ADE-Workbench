import { describe, it, expect, vi } from "vitest";
import { HostClient } from "../src/lib/hostClient";
import { gitStatus } from "../src/lib/git";
import { listOpenPRs } from "../src/lib/gh";
import { listChangedFiles } from "../src/lib/conflict";

describe("host-lite compatibility", () => {
  it("libs route via hostRun without requiring Tauri", async () => {
    const client = new HostClient();
    client.status = "http";
    client.base = "http://127.0.0.1:7345";

    const responses = [
      { status: 0, stdout: "", stderr: "" },
      { status: 0, stdout: "[]", stderr: "" },
      { status: 0, stdout: "", stderr: "" }
    ];
    const fetchMock = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => responses.shift(),
      text: async () => ""
    }));
    (globalThis as any).fetch = fetchMock;

    await expect(gitStatus(client)).resolves.toEqual([]);
    await expect(listOpenPRs(client)).resolves.toEqual([]);
    await expect(listChangedFiles(client, "base", "ref")).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalled();
  });
});
