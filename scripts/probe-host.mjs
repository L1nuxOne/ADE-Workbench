import { fetch } from "undici";
const base = process.env.ADE_PROBE_BASE || "http://127.0.0.1:7345";
try {
  const r = await fetch(base + "/healthz", { cache: "no-store" });
  if (!r.ok) throw new Error("bad status " + r.status);
  console.log("Host OK:", base);
} catch (e) {
  console.error("Host not reachable at", base, e);
  process.exit(1);
}
