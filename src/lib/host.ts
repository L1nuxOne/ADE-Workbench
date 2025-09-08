const g: any = typeof window !== "undefined" ? window : {};
export const hasTauri = typeof g.__TAURI__ !== "undefined";

export async function hostRead(path: string): Promise<string> {
  if (!hasTauri) throw new Error("host-unavailable");
  return await g.__TAURI__.invoke("read_text_rel", { rel: path });
}

export async function hostRun(cmd: string, args: string[], dryRun = true) {
  if (!hasTauri) throw new Error("host-unavailable");
  return await g.__TAURI__.invoke("run", { spec: { cmd, args, dryRun } });
}
