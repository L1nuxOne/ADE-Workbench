import React from "react";
import { discoverFlows, template, type DiscoveredFlow } from "../lib/flows";

export function FlowsPane() {
  const [flows, setFlows] = React.useState<DiscoveredFlow[]>([]);
  const [err, setErr] = React.useState<string>("");

  React.useEffect(() => {
    (async () => {
      try { setFlows(await discoverFlows()); }
      catch (e:any) { setErr(e.message || String(e)); }
    })();
  }, []);

  if (err) return <div className="p-3 text-red-600">Flows error: {err}</div>;

  return (
    <div style={{ padding: 12 }}>
      <h2>Flows</h2>
      {flows.map(f => (
        <div key={f.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginTop: 8 }}>
          <div style={{ fontWeight: 600 }}>{f.name}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{f.id} · {f.source} · {f.version}</div>
          <div style={{ marginTop: 8 }}>
            <button onClick={() => preview(f)} style={{ padding: "6px 10px" }}>
              Preview (defaults)
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function preview(f: DiscoveredFlow) {
  const vars: Record<string,string> = {};
  for (const inp of f.inputs || []) {
    if (inp.default !== undefined) vars[inp.key] = String(inp.default);
  }
  try {
    const cmds = f.steps.map(s => template(s.run, vars));
    alert(["Preview commands:", ...cmds].join("\n"));
  } catch (e:any) {
    alert(`Template error: ${e.message || e}`);
  }
}
