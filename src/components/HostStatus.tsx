import React from "react";
import { HOST_BASE, hostKind, hasHost, onWindowFocusProbe } from "../lib/host";

export function HostStatus() {
  const [ok, setOk] = React.useState<boolean>(hostKind() === "tauri");
  const [kind, setKind] = React.useState<"tauri"|"http"|"none">(hostKind() ?? "none");

  React.useEffect(() => onWindowFocusProbe((v) => {
    setOk(v);
    setKind(hostKind() ? "tauri" : (v ? "http" : "none"));
  }), []);

  async function retry() {
    const v = await hasHost();
    setOk(v);
    setKind(hostKind() ? "tauri" : (v ? "http" : "none"));
  }

  const label =
    kind === "tauri" ? "Tauri host"
    : ok ? `HTTP host-lite (${HOST_BASE})`
    : "Not connected";

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, opacity: 0.9 }}>
      <span><strong>Host:</strong> {label}</span>
      <button onClick={retry} style={{ padding: "2px 8px" }}>Retry</button>
    </div>
  );
}

