import React from "react";
import { useHost } from "../lib/hostCtx";

export function HostStatus() {
  const { client, status, retry } = useHost();
  const label =
    status === "tauri" ? "Tauri host" :
    status === "http" ? `HTTP host-lite (${client.base})` :
    "Not connected";

  React.useEffect(() => {
    function onFocus() { void client.ensure(); }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [client]);

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, opacity: 0.9 }}>
      <span><strong>Host:</strong> {label}</span>
      <button onClick={retry} style={{ padding: "2px 8px" }}>Retry</button>
    </div>
  );
}

