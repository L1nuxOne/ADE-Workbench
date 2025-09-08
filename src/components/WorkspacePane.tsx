import React from "react";
import { hasTauri } from "../lib/host";
import { gitStatus, gitDiffFile, type FileChange } from "../lib/git";

export function WorkspacePane() {
  const [files, setFiles] = React.useState<FileChange[]>([]);
  const [err, setErr] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sel, setSel] = React.useState<{ path: string; staged: boolean } | null>(null);
  const [diff, setDiff] = React.useState("");

  const load = React.useCallback(async () => {
    if (!hasTauri) {
      setErr("Host unavailable — workspace requires host.");
      return;
    }
    setLoading(true);
    try {
      const f = await gitStatus();
      setFiles(f);
      setErr("");
      // auto-select first file if none selected
      if (!sel && f.length) setSel({ path: f[0].path, staged: f[0].staged });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [sel]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    (async () => {
      if (!sel) {
        setDiff("");
        return;
      }
      try {
        setDiff(await gitDiffFile(sel.path, sel.staged));
      } catch (e) {
        setDiff(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [sel]);

  const staged = files.filter((f) => f.staged);
  const unstaged = files.filter((f) => !f.staged);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 12, minHeight: 360 }}>
      <div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <h2>Workspace</h2>
          <button onClick={load} disabled={loading} style={{ padding: "4px 10px" }}>
            {loading ? "Reload…" : "Reload"}
          </button>
        </div>
        {err && <div style={{ color: "#b00", marginTop: 6 }}>{err}</div>}

        <Section title={`Staged (${staged.length})`}>
          {staged.length === 0 ? (
            <Empty />
          ) : (
            staged.map((f) => (
              <FileRow
                key={`S:${f.path}`}
                f={f}
                active={sel?.path === f.path && sel?.staged === true}
                onClick={() => setSel({ path: f.path, staged: true })}
              />
            ))
          )}
        </Section>

        <Section title={`Unstaged (${unstaged.length})`}>
          {unstaged.length === 0 ? (
            <Empty />
          ) : (
            unstaged.map((f) => (
              <FileRow
                key={`U:${f.path}`}
                f={f}
                active={sel?.path === f.path && sel?.staged === false}
                onClick={() => setSel({ path: f.path, staged: false })}
              />
            ))
          )}
        </Section>
      </div>

      <div>
        <h3>Diff {sel ? `— ${sel.path} (${sel.staged ? "staged" : "unstaged"})` : ""}</h3>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#0b0b0b",
            color: "#ddd",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            padding: 12,
            borderRadius: 8,
            minHeight: 300,
            outline: "1px solid #222",
            overflow: "auto",
          }}
        >
          {diff || "No diff to show."}
        </pre>
      </div>
    </div>
  );
}

function Section({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}
function Empty() {
  return <div style={{ padding: 8, opacity: 0.7 }}>—</div>;
}

function FileRow({ f, active, onClick }: { f: FileChange; active: boolean; onClick: () => void }) {
  const badge = f.status;
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        width: "100%",
        textAlign: "left",
        padding: "6px 8px",
        background: active ? "#eef6ff" : "white",
        border: 0,
        borderBottom: "1px solid #eee",
        cursor: "pointer",
      }}
    >
      <span style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.7, width: 28 }}>
        {badge}
      </span>
      <span style={{ flex: 1 }}>{f.path}</span>
      <span style={{ fontSize: 12, opacity: 0.6 }}>{f.staged ? "staged" : "unstaged"}</span>
    </button>
  );
}
