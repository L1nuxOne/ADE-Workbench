import React from "react";
import { FlowsPane } from "./components/FlowsPane";
import { PRPane } from "./components/PRPane";
import { WorkspacePane } from "./components/WorkspacePane";

export function App() {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", padding: 16 }}>
      <h1>ADE-Workbench</h1>
      <p>Flows discovery (repo-local in dev) and GitOps helpers.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <PRPane />
        <FlowsPane />
        <div style={{ gridColumn: "1 / span 2" }}>
          <WorkspacePane />
        </div>
      </div>
    </div>
  );
}
