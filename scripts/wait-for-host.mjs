import { fetch } from "undici";
import { setTimeout as sleep } from "node:timers/promises";

const argv = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.split("=");
    return [k.replace(/^--/, ""), v ?? true];
  })
);

const base = process.env.ADE_PROBE_BASE || argv.base || "http://127.0.0.1:7345";
const timeoutMs = Number(process.env.ADE_PROBE_TIMEOUT_MS || argv.timeout || 120000);
const intervalMs = Number(argv.interval || 1000);

const start = Date.now();
let attempt = 0;

while (Date.now() - start < timeoutMs) {
  attempt++;
  try {
    const r = await fetch(base + "/healthz", { cache: "no-store" });
    if (r.ok) {
      console.log(`Host ready at ${base} after ${attempt} attempt(s).`);
      process.exit(0);
    }
  } catch { /* not ready yet */ }
  await sleep(intervalMs);
}

console.error(`Host not ready after ${timeoutMs}ms at ${base}`);
process.exit(1);
