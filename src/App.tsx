import React from "react";
import { FlowsPane } from "./components/FlowsPane";
import { PRPane } from "./components/PRPane";
import { WorkspacePane } from "./components/WorkspacePane";
import { ConflictPane } from "./components/ConflictPane";
import { HostStatus } from "./components/HostStatus";
import { HostProvider } from "./lib/hostCtx";

export function App() {
  return (
    <HostProvider>
      <div style={{ fontFamily: "ui-sans-serif, system-ui", padding: 16 }}>
        <h1>ADE-Workbench</h1>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ margin: 0 }}>Flows discovery (repo-local in dev) and GitOps helpers.</p>
          <HostStatus />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <PRPane />
          <FlowsPane />
          <div style={{ gridColumn: "1 / span 2" }}>
            <WorkspacePane />
          </div>
          <div style={{ gridColumn: "1 / span 2" }}>
            <ConflictPane />
          </div>
        </div>
      </div>
    </HostProvider>
  );
}
