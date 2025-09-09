const g = (globalThis as any);
export const hasTauri = typeof g.__TAURI__ !== "undefined";
export const HOST_BASE: string =
  (import.meta as any)?.env?.VITE_HOST_BASE || "http://127.0.0.1:7345";

/** Return "tauri" | "http" | null for UI. */
export function hostKind(): "tauri" | "http" | null {
  return hasTauri ? "tauri" : null;
}

export async function hasHost(): Promise<boolean> {
  if (hasTauri) return true;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 1500);
    const r = await fetch(HOST_BASE + "/healthz", { signal: ac.signal, cache: "no-store" });
    clearTimeout(t);
    return r.ok;
  } catch (e) {
    console.debug("Host health check failed:", HOST_BASE, e);
    return false;
  }
}

export async function hostRead(path: string): Promise<string> {
  if (hasTauri) {
    // @ts-ignore
    return await g.__TAURI__.invoke("read_text_rel", { rel: path });
  }
  const r = await fetch(`${HOST_BASE}/read_text_rel?path=${encodeURIComponent(path)}`);
  if (!r.ok) throw new Error(await r.text());
  return await r.text();
}

export async function hostRun(cmd: string, args: string[], dryRun = true) {
  if (hasTauri) {
    // @ts-ignore
    return await g.__TAURI__.invoke("run", { spec: { cmd, args, dry_run: dryRun } });
  }
  const r = await fetch(HOST_BASE + "/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ spec: { cmd, args, dry_run: dryRun } }),
  });
  if (!r.ok) throw new Error(await r.text());
  return await r.json();
}

// Small helper to re-probe on window focus:
export function onWindowFocusProbe(cb: (ok: boolean) => void) {
  async function probe() { cb(await hasHost()); }
  const handler = () => { void probe(); };
  window.addEventListener("focus", handler);
  // immediately try once
  void probe();
  return () => window.removeEventListener("focus", handler);
}
