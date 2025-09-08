import React from "react";
import { discoverFlows, template, type DiscoveredFlow } from "../lib/flows";
import { loadFlowVars, saveFlowVars } from "../lib/flowInputs";

export function FlowsPane() {
  const [flows, setFlows] = React.useState<DiscoveredFlow[]>([]);
  const [err, setErr] = React.useState<string>("");

  React.useEffect(() => {
    (async () => {
      try {
        setFlows(await discoverFlows());
      } catch (e: any) {
        setErr(e.message || String(e));
      }
    })();
  }, []);

  if (err) return <div className="p-3 text-red-600">Flows error: {err}</div>;

  return (
    <div style={{ padding: 12 }}>
      <h2>Flows</h2>
      {flows.map((f) => (
        <FlowCard key={f.id} flow={f} />
      ))}
    </div>
  );
}

function FlowCard({ flow }: { flow: DiscoveredFlow }) {
  const defaults = React.useMemo(
    () => Object.fromEntries((flow.inputs ?? []).map((i) => [i.key, i.default ?? ""])),
    [flow]
  );
  const [vars, setVars] = React.useState(() => loadFlowVars(flow.id, defaults));
  const [preview, setPreview] = React.useState<string>("");
  const [errs, setErrs] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  function onChange(key: string, value: string) {
    const next = { ...vars, [key]: value };
    setVars(next);
    saveFlowVars(flow.id, next);
  }

  function onPreview() {
    for (const inp of flow.inputs ?? []) {
      if (inp.required && !String(vars[inp.key] ?? "").trim()) {
        setErrs(`Missing required input: ${inp.label || inp.key}`);
        setPreview("");
        return;
      }
    }
    try {
      const lines: string[] = [];
      for (const p of flow.pre ?? []) lines.push(`# pre-check: ${p.check}`);
      lines.push("# (not executed in preview)");
      for (const step of flow.steps) lines.push(template(step.run, vars));
      setPreview(lines.join("\n"));
      setErrs(null);
      saveFlowVars(flow.id, vars);
    } catch (e: any) {
      setErrs(e?.message ?? String(e));
      setPreview("");
    }
  }

  function onCopy() {
    navigator.clipboard.writeText(preview).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    });
  }

  const missing: Record<string, boolean> = {};
  for (const inp of flow.inputs ?? []) {
    if (inp.required && !String(vars[inp.key] ?? "").trim()) missing[inp.key] = true;
  }

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginTop: 8 }}>
      <div style={{ fontWeight: 600 }}>{flow.name}</div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>
        {flow.id} · {flow.source} · {flow.version}
      </div>
      {flow.inputs?.length ? (
        <div style={{ marginTop: 8 }}>
          {flow.inputs.map((inp) => (
            <div key={inp.key} style={{ marginTop: 4 }}>
              <label>
                {inp.label}
                {inp.required ? <span style={{ color: "red", marginLeft: 4 }}>*</span> : null}
              </label>
              {inp.choices ? (
                <select
                  value={vars[inp.key] ?? ""}
                  onChange={(e) => onChange(inp.key, e.target.value)}
                  style={{ marginLeft: 8 }}
                >
                  <option value=""></option>
                  {inp.choices.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={vars[inp.key] ?? ""}
                  onChange={(e) => onChange(inp.key, e.target.value)}
                  style={{ marginLeft: 8 }}
                />
              )}
              {missing[inp.key] && (
                <span style={{ color: "red", marginLeft: 8 }}>required</span>
              )}
            </div>
          ))}
        </div>
      ) : null}
      {errs && <div style={{ color: "red", marginTop: 8 }}>{errs}</div>}
      <div style={{ marginTop: 8 }}>
        <button onClick={onPreview} disabled={Object.keys(missing).length > 0} style={{ padding: "6px 10px" }}>
          Preview
        </button>
        {preview && (
          <button onClick={onCopy} style={{ padding: "6px 10px", marginLeft: 8 }}>
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      {preview && (
        <pre
          style={{ marginTop: 8, background: "#f5f5f5", padding: 8, whiteSpace: "pre-wrap" }}
        >
          {preview}
        </pre>
      )}
    </div>
  );
}
