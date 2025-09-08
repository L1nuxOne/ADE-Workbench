import { describe, it, expect, vi } from "vitest";
import { discoverFlows } from "../src/lib/flows";

declare const global: any;

describe("discoverFlows dev overrides", () => {
  it("prefers dev flows over bundled", async () => {
    const list = ["ade/flows/append-dod.yaml"];
    const yaml = `version: "0.2"\nid: append-dod\nname: override\nsteps:\n  - run: echo hi\n`;
    global.fetch = vi.fn(async (url: string) => {
      if (url === "/__flows/list") return { ok: true, json: async () => list } as any;
      if (url.startsWith("/__flows/read")) return { ok: true, text: async () => yaml } as any;
      return { ok: false } as any;
    });

    const flows = await discoverFlows();
    const f = flows.find((x) => x.id === "append-dod");
    expect(f?.name).toBe("override");
    expect(f?.source).toBe("ade");
  });

  it("falls back to bundled when dev endpoints missing", async () => {
    global.fetch = vi.fn(async () => ({ ok: false } as any));
    const flows = await discoverFlows();
    const f = flows.find((x) => x.id === "append-dod");
    expect(f?.source).toBe("bundled");
  });
});
