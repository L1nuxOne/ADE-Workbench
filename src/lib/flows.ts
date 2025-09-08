import { z } from "zod";
import YAML from "yaml";
import { hostRead, hasTauri } from "./host";

export const FlowInput = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  default: z.string().optional(),
  required: z.boolean().optional(),
  choices: z.array(z.string()).optional(),
});
export const FlowPre = z.object({
  check: z.string().min(1),
  fail: z.string().min(1),
});
export const FlowStep = z.object({
  run: z.string().min(1),
  label: z.string().optional(),
  shell: z.enum(["bash","sh","pwsh"]).optional(),
});
export const Flow = z.object({
  version: z.literal("0.2"),
  id: z.string().min(1),
  name: z.string().min(1),
  dryRunDefault: z.boolean().default(true),
  env: z.record(z.string()).optional(),
  inputs: z.array(FlowInput).default([]),
  pre: z.array(FlowPre).default([]),
  steps: z.array(FlowStep).min(1),
});
export type Flow = z.infer<typeof Flow>;

export type DiscoveredFlow = Flow & { source: "bundled" | "ade" | "kit"; path: string };

async function devList(): Promise<string[]> {
  const r = await fetch("/__flows/list");
  if (!r.ok) throw new Error("dev-list-failed");
  return await r.json();
}
async function devRead(p: string): Promise<string> {
  const r = await fetch(`/__flows/read?path=${encodeURIComponent(p)}`);
  if (!r.ok) throw new Error(`dev-read-failed: ${p}`);
  return await r.text();
}

// bundled via Vite (works without Tauri) — use query '?raw' (new API)
const bundledGlobs = import.meta.glob("../flows/*.yaml", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;
function loadBundled(): DiscoveredFlow[] {
  const out: DiscoveredFlow[] = [];
  for (const [p, raw] of Object.entries(bundledGlobs)) {
    const data = YAML.parse(raw as unknown as string);
    const parsed = Flow.parse(data); // throws with clear message
    out.push({ ...parsed, source: "bundled", path: p });
  }
  return out;
}

export async function discoverFlows(): Promise<DiscoveredFlow[]> {
  const bundled = loadBundled();

  let adeDev: DiscoveredFlow[] = [];
  let kitDev: DiscoveredFlow[] = [];
  if (import.meta.env.DEV) {
    try {
      const files = await devList();
      for (const f of files) {
        try {
          const raw = await devRead(f);
          const parsed = Flow.parse(YAML.parse(raw));
          const item: DiscoveredFlow = {
            ...parsed,
            source: f.startsWith("ade/") ? "ade" : "kit",
            path: f,
          };
          if (item.source === "ade") adeDev.push(item); else kitDev.push(item);
        } catch (e) {
          console.error(`Invalid flow ${f}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch (e) {
      // dev endpoints absent → ignore, but keep a breadcrumb for debugging
      console.debug("Dev flow endpoints unavailable; using fallback sources.", e);
    }
  }

  // Try repo-local overrides via host bridge
  let adeFs: DiscoveredFlow[] = [];
  let kitFs: DiscoveredFlow[] = [];
  if (hasTauri) {
    for (const dir of ["ade/flows", "kit/flows"]) {
      try {
        const manifestRaw = await hostRead(`${dir}/manifest.json`);
        const files: string[] = JSON.parse(manifestRaw);
        const flows: DiscoveredFlow[] = [];
        for (const f of files) {
          const path = `${dir}/${f}`;
          try {
            const raw = await hostRead(path);
            const parsed = Flow.parse(YAML.parse(raw));
            flows.push({
              ...parsed,
              source: dir.startsWith("ade") ? "ade" : "kit",
              path,
            });
          } catch (e) {
            console.error(`Invalid flow ${path}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        if (dir.startsWith("ade")) adeFs = flows; else kitFs = flows;
      } catch {
        // manifest missing or unreadable → ignore
      }
    }
  }

  // Priority: adeDev > adeFs > kitDev > kitFs > bundled (last-wins)
  const byId = new Map<string, DiscoveredFlow>();
  for (const arr of [bundled, kitFs, kitDev, adeFs, adeDev]) {
    for (const f of arr) byId.set(f.id, f);
  }
  return Array.from(byId.values());
}

// strict variable substitution (no filters yet)
export function template(cmd: string, vars: Record<string, string>): string {
  return cmd.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in vars)) throw new Error(`missing var: ${k}`);
    return String(vars[k]);
  });
}
