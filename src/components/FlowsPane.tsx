import React from "react";
import { discoverFlows, template, type DiscoveredFlow } from "../lib/flows";
import { loadFlowVars, saveFlowVars } from "../lib/flowInputs";
import { parseCommand } from "../lib/cmd";
import { hasHost, hostRun } from "../lib/host";

export function FlowsPane() {
  const [flows, setFlows] = React.useState<DiscoveredFlow[]>([]);
  const [err, setErr] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      setFlows(await discoverFlows());
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    reload();
  }, []);

  if (err) return <div className="p-3 text-red-600">Flows error: {err}</div>;

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <h2>Flows</h2>
        <button onClick={reload} disabled={loading} style={{ padding: "4px 10px" }}>
          {loading ? "Reload…" : "Reload"}
        </button>
      </div>
      {flows.map((f) => (
        <FlowCard key={f.id} flow={f} />
      ))}
    </div>
  );
}

function FlowCard({ flow }: { flow: DiscoveredFlow }) {
  // Only seed inputs that actually have defaults; do NOT inject empty strings.
  const defaults = React.useMemo(
    () =>
      Object.fromEntries(
        (flow.inputs ?? [])
          .filter((i) => i.default !== undefined)
          .map((i) => [i.key, String(i.default)])
      ),
    [flow]
  );
  const [vars, setVars] = React.useState(() => loadFlowVars(flow.id, defaults));
  const [preview, setPreview] = React.useState<string>("");
  const [cmds, setCmds] = React.useState<string[]>([]);
  const [logs, setLogs] = React.useState<Record<number, string>>({});
  const [errs, setErrs] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const timeoutRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function onChange(key: string, value: string) {
    const next = { ...vars, [key]: value };
    setVars(next);
    saveFlowVars(flow.id, next);
  }

  function onPreview() {
    try {
      const lines: string[] = [];
      for (const p of flow.pre ?? []) lines.push(`# pre-check: ${p.check}`);
      lines.push("# (not executed in preview)");
      const cmdLines: string[] = [];
      for (const step of flow.steps) {
        const cmd = template(step.run, vars);
        lines.push(cmd);
        cmdLines.push(cmd);
      }
      setPreview(lines.join("\n"));
      setCmds(cmdLines);
      setErrs(null);
    } catch (e: any) {
      setErrs(e?.message ?? String(e));
      setPreview("");
      setCmds([]);
    }
  }

  function onCopy() {
    navigator.clipboard
      .writeText(preview)
      .then(() => {
        setCopied(true);
        timeoutRef.current = window.setTimeout(() => setCopied(false), 1000);
      })
      .catch((err) => setErrs(`Failed to copy: ${err?.message ?? String(err)}`));
  }

  async function onRun(idx: number) {
    const cmd = cmds[idx];
    const parts = parseCommand(cmd.trim());
    if (!parts.length) {
      setErrs("Empty command");
      return;
    }
    const ok = await hasHost();
    if (!ok) {
      setErrs("Host unavailable");
      return;
    }
    try {
      const res = await hostRun(parts[0], parts.slice(1), true);
      setLogs((prev) => ({
        ...prev,
        [idx]: (res.stdout || "") + (res.stderr ? `\nERR:\n${res.stderr}` : ""),
      }));
    } catch (e: any) {
      setLogs((prev) => ({
        ...prev,
        [idx]: `error: ${e?.message ?? String(e)}`,
      }));
    }
  }

  const missing: Record<string, boolean> = React.useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const inp of flow.inputs ?? []) {
      const v = (vars[inp.key] ?? "").trim();
      if (inp.required && !v) m[inp.key] = true;
    }
    return m;
  }, [flow.inputs, vars]);

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
      {cmds.map((c, i) => (
        <div key={i} style={{ marginTop: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <code>{c}</code>
            <button onClick={() => onRun(i)} style={{ padding: "4px 6px" }}>
              Run (dry-run)
            </button>
          </div>
          {logs[i] && (
            <pre
              style={{ marginTop: 4, background: "#f5f5f5", padding: 8, whiteSpace: "pre-wrap" }}
            >
              {logs[i]}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
