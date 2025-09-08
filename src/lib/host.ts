const g: any = typeof window !== "undefined" ? window : {};
export const hasTauri = typeof g.__TAURI__ !== "undefined";
const HOST_BASE: string = (import.meta as any)?.env?.VITE_HOST_BASE || "http://127.0.0.1:7345";

export async function hasHost(): Promise<boolean> {
  if (hasTauri) return true;
  try {
    const r = await fetch(HOST_BASE + "/healthz");
    return r.ok;
  } catch {
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
