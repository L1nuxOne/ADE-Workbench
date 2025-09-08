import React from "react";
import { hasTauri } from "../lib/host";
import { listChangedFiles, buildOverlapMatrix, matrixToCSV } from "../lib/conflict";
import { loadFlowVars } from "../lib/flowInputs";

export function ConflictPane() {
  const [base, setBase] = React.useState("origin/main");
  const seeded = React.useMemo(() => {
    try {
      const vars = loadFlowVars("merge-train", {});
      return (vars.refs ?? "").trim();
    } catch {
      return "";
    }
  }, []);
  const [rawRefs, setRawRefs] = React.useState(seeded);
  const [refs, setRefs] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [filesByRef, setFilesByRef] = React.useState<Record<string, string[]>>({});
  const [matrix, setMatrix] = React.useState<number[][]>([]);
  const [order, setOrder] = React.useState<string[]>([]);
  const [totals, setTotals] = React.useState<number[]>([]);

  const refsArr = React.useMemo(() => {
    const arr = rawRefs.split(/\s+/).map((s) => s.trim()).filter(Boolean);
    return [...new Set(arr)]; // ensure uniqueness
  }, [rawRefs]);

  async function analyze() {
    if (!hasTauri) {
      setErr("Host unavailable");
      return;
    }
    if (!refsArr.length) {
      setErr("No refs specified");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const results: Record<string, string[]> = {};
      const queue = [...refsArr];
      const workers = Array.from(
        { length: Math.min(3, refsArr.length) },
        async function worker() {
          while (queue.length) {
            const r = queue.shift()!;
            try {
              results[r] = await listChangedFiles(base, r);
            } catch (e) {
              results[r] = [];
              console.error("diff error", r, e);
            }
          }
        }
      );
      await Promise.all(workers);
      setRefs(refsArr);
      setFilesByRef(results);
      const { matrix, totals, order } = buildOverlapMatrix(refsArr, results);
      setMatrix(matrix);
      setTotals(totals);
      setOrder(order);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function copyCSV() {
    const csv = matrixToCSV(refs, matrix);
    navigator.clipboard
      .writeText(csv)
      .catch((e) =>
        setErr(`Copy failed: ${e instanceof Error ? e.message : String(e)}`)
      );
  }
  function copyOrder() {
    navigator.clipboard
      .writeText(order.join(" "))
      .catch((e) =>
        setErr(`Copy failed: ${e instanceof Error ? e.message : String(e)}`)
      );
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <h2>Conflict Preview</h2>
      </div>
      {!hasTauri && <div style={{ color: "#b00" }}>Host unavailable — requires git access.</div>}
      <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
        <label>
          Base:&nbsp;
          <input
            value={base}
            onChange={(e) => setBase(e.target.value)}
            style={{ width: 220 }}
          />
        </label>
        <label style={{ flex: 1 }}>
          Refs (space-separated):&nbsp;
          <input
            value={rawRefs}
            onChange={(e) => setRawRefs(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <button onClick={analyze} disabled={busy || !refsArr.length}>
          {busy ? "Analyzing…" : "Analyze"}
        </button>
      </div>
      {err && <div style={{ color: "#b00", marginTop: 6 }}>{err}</div>}

      {refs.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <strong>Suggested order:</strong>
            <code
              style={{ padding: "2px 6px", background: "#f6f6f6", borderRadius: 4 }}
            >
              {order.join(" ") || "—"}
            </code>
            <button onClick={copyOrder} disabled={!order.length}>
              Copy order
            </button>
            <button onClick={copyCSV} disabled={!matrix.length}>
              Copy CSV (matrix)
            </button>
          </div>

          <div style={{ marginTop: 10, overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 480 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 6 }}>ref</th>
                  {refs.map((r) => (
                    <th key={r} style={{ padding: 6 }}>
                      {r}
                    </th>
                  ))}
                  <th style={{ padding: 6 }}>#files</th>
                </tr>
              </thead>
              <tbody>
                {refs.map((r, i) => (
                  <tr key={r}>
                    <td style={{ padding: 6, fontWeight: 600 }}>{r}</td>
                    {refs.map((c, j) => (
                      <td
                        key={c}
                        style={{
                          padding: 6,
                          textAlign: "center",
                          background: i === j ? "#fafafa" : "white",
                          border: "1px solid #eee",
                        }}
                      >
                        {i === j ? "—" : matrix[i]?.[j] ?? 0}
                      </td>
                    ))}
                    <td style={{ padding: 6, textAlign: "center" }}>
                      {totals[i] ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details style={{ marginTop: 10 }}>
            <summary>Files per ref</summary>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
                gap: 8,
                marginTop: 8,
              }}
            >
              {refs.map((r) => (
                <div
                  key={r}
                  style={{ border: "1px solid #eee", borderRadius: 8, padding: 8 }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    {r} <span style={{ opacity: 0.6 }}>({filesByRef[r]?.length || 0})</span>
                  </div>
                  <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12 }}>
                    {(filesByRef[r] || []).join("\n") || "—"}
                  </pre>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

