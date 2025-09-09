import React from "react";
import { hasHost } from "../lib/host";
import { listOpenPRs, type PR } from "../lib/gh";
import { seedMergeTrainRefs } from "../lib/flowLaunch";

export function PRPane() {
  const [prs, setPrs] = React.useState<PR[]>([]);
  const [sel, setSel] = React.useState<Record<number, boolean>>({});
  const [err, setErr] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  const [hostOk, setHostOk] = React.useState(false);
  React.useEffect(() => { hasHost().then(setHostOk); }, []);
  const load = React.useCallback(async () => {
    const ok = await hasHost();
    setHostOk(ok);
    if (!ok) { setErr("Host unavailable — start host-lite (`npm run host:lite`) or Tauri."); return; }
    setLoading(true);
    try { setPrs(await listOpenPRs()); setErr(""); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [hostOk]);

  React.useEffect(() => { load(); }, [load]);

  const selectedRefs = React.useMemo(() => {
    const picked = prs.filter(p => sel[p.number]);
    // Prefer branch refs; fallback to PR numbers
    if (picked.length) return picked.map(p => p.headRefName || String(p.number)).join(" ");
    return "";
  }, [prs, sel]);

  function toggle(n: number) {
    setSel(s => ({ ...s, [n]: !s[n] }));
  }

  function copyRefs() {
    if (!selectedRefs) return;
    navigator.clipboard.writeText(selectedRefs).catch(e => setErr(`Copy failed: ${e}`));
  }

  function sendToMergeTrain() {
    if (!selectedRefs) return;
    seedMergeTrainRefs(selectedRefs);
    // lightweight toast:
    alert(`Seeded merge-train refs:\n${selectedRefs}\nOpen the Flows pane → Merge Train → Preview/Run.`);
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <h2>PRs</h2>
        <button onClick={load} disabled={loading} style={{ padding: "4px 10px" }}>
          {loading ? "Reload…" : "Reload"}
        </button>
      </div>
      {err && <div style={{ color: "#b00", marginTop: 6 }}>{err}</div>}

      {hostOk && prs.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {prs.map(p => (
            <label key={p.number} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 4px" }}>
              <input type="checkbox" checked={!!sel[p.number]} onChange={() => toggle(p.number)} />
              <span style={{ fontWeight: 600 }}>#{p.number}</span>
              <span>{p.title}</span>
              <span style={{ fontSize: 12, opacity: 0.7, marginLeft: "auto" }}>{p.headRefName}</span>
            </label>
          ))}
        </div>
      )}

      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button onClick={copyRefs} disabled={!selectedRefs}>Copy refs</button>
        <button onClick={sendToMergeTrain} disabled={!selectedRefs}>Send to Merge Train</button>
      </div>

      {!hostOk && (
        <ManualFallback />
      )}
    </div>
  );
}

function ManualFallback() {
  const [raw, setRaw] = React.useState("");
  const refs = raw.trim().replace(/\s+/g, " ");
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 6 }}>
        Host is unavailable. Paste PR numbers or branch names (space-separated).
      </div>
      <textarea rows={3} style={{ width: "100%", fontFamily: "monospace" }} value={raw} onChange={(e)=>setRaw(e.target.value)} />
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button onClick={() => navigator.clipboard.writeText(refs)} disabled={!refs}>Copy refs</button>
        <button onClick={() => { seedMergeTrainRefs(refs); alert(`Seeded merge-train refs:\n${refs}`); }} disabled={!refs}>
          Send to Merge Train
        </button>
      </div>
    </div>
  );
}
