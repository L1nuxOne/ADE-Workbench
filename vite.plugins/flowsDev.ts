import { Plugin } from "vite";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOTS = ["ade/flows", "kit/flows"]; // read-only, YAML only

async function listYaml(dir: string): Promise<string[]> {
  const abs = path.resolve(process.cwd(), dir);
  try {
    const items = await fs.readdir(abs, { withFileTypes: true });
    return items
      .filter((e) => e.isFile() && e.name.endsWith(".yaml"))
      .map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

export function flowsDevPlugin(): Plugin {
  return {
    name: "flows-dev-plugin",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();
        // List all flow files under known roots
        if (req.url === "/__flows/list") {
          const all: string[] = [];
          for (const d of ROOTS) all.push(...(await listYaml(d)));
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(all));
          return;
        }
        // Read a specific file
        if (req.url.startsWith("/__flows/read?path=")) {
          const q = new URL(req.url, "http://local");
          const rel = q.searchParams.get("path") || "";
          const absPath = path.resolve(process.cwd(), rel);
          // Security: ensure absPath is under one of the allowed roots after normalization.
          const isUnderAllowed = ROOTS.some((r) => {
            const rootAbs = path.resolve(process.cwd(), r);
            const relToRoot = path.relative(rootAbs, absPath);
            return relToRoot && !relToRoot.startsWith("..") && !path.isAbsolute(relToRoot);
          });
          if (!isUnderAllowed) {
            res.statusCode = 400;
            res.end("invalid path");
            return;
          }
          try {
            const raw = await fs.readFile(absPath, "utf-8");
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end(raw);
          } catch (e: any) {
            res.statusCode = 404;
            res.end(String(e?.message ?? "not found"));
          }
          return;
        }
        next();
      });
    },
  };
}
