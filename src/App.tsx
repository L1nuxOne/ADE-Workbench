import React from "react";
import { FlowsPane } from "./components/FlowsPane";

export function App() {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", padding: 16 }}>
      <h1>ADE-Workbench</h1>
      <p>Flows discovery (repo-local via Tauri, fallback to bundled).</p>
      <FlowsPane />
    </div>
  );
}
