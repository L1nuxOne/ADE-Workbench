export type HostStatus = "tauri" | "http" | "down";
export type HostConfig = { version: string; base: string; capabilities: Record<string, boolean> };

const g: any = typeof window !== "undefined" ? window : globalThis;

async function tryBase(base: string): Promise<HostConfig | null> {
  try {
    const r = await fetch(base + "/.well-known/ade.json", { cache: "no-store" });
    if (r.ok) return await r.json();
    const h = await fetch(base + "/healthz");
    return h.ok ? { version: "unknown", base, capabilities: { run: true, fs: true, git: true, gh: true } } : null;
  } catch {
    return null;
  }
}

export class HostClient {
  status: HostStatus = "down";
  base = "";
  caps: Record<string, boolean> = {};

  async discover(): Promise<HostStatus> {
    if (g.__TAURI__) { this.status = "tauri"; return this.status; }
    const url = new URL(location.href);
    const param = url.searchParams.get("host");
    const candidates = param ? [param] : [
      "http://localhost:7345",
      "http://127.0.0.1:7345",
      "http://wsl.localhost:7345",
    ];
    for (const b of candidates) {
      const cfg = await tryBase(b);
      if (cfg) {
        this.status = "http";
        this.base = new URL(cfg.base || b).origin;
        this.caps = cfg.capabilities || {};
        return this.status;
      }
    }
    this.status = "down";
    return this.status;
  }

  async ensure(): Promise<HostStatus> {
    return this.status === "down" ? this.discover() : this.status;
  }

  async read(rel: string): Promise<string> {
    if (this.status === "tauri") return await g.__TAURI__.invoke("read_text_rel", { rel });
    if (this.status === "http" && this.base) {
      const r = await fetch(`${this.base}/read_text_rel?path=${encodeURIComponent(rel)}`);
      if (!r.ok) throw new Error(await r.text());
      return await r.text();
    }
    throw new Error("host-down");
  }

  async run(cmd: string, args: string[], dryRun = true): Promise<any> {
    if (this.status === "tauri") return await g.__TAURI__.invoke("run", { spec: { cmd, args, dry_run: dryRun } });
    if (this.status === "http" && this.base) {
      const r = await fetch(`${this.base}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spec: { cmd, args, dry_run: dryRun } }),
      });
      if (!r.ok) throw new Error(await r.text());
      return await r.json();
    }
    throw new Error("host-down");
  }
}
