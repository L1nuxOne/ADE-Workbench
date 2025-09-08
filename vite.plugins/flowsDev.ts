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
          // Restrict to allowed roots to avoid arbitrary FS read
          if (!ROOTS.some((r) => rel.startsWith(r + "/"))) {
            res.statusCode = 400;
            res.end("invalid path");
            return;
          }
          try {
            const abs = path.resolve(process.cwd(), rel);
            const raw = await fs.readFile(abs, "utf-8");
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
