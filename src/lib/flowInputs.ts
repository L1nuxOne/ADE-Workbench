export type FlowVars = Record<string, string>;
const KEY = (id: string) => `flow_inputs/${id}`;

export function loadFlowVars(id: string, defaults: FlowVars): FlowVars {
  try {
    const raw = localStorage.getItem(KEY(id));
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    return { ...defaults, ...(parsed ?? {}) };
  } catch {
    return { ...defaults };
  }
}
export function saveFlowVars(id: string, vars: FlowVars) {
  try {
    localStorage.setItem(KEY(id), JSON.stringify(vars));
  } catch (e) {
    // Log for debugging; UI remains functional without persistence.
    console.error("Failed to save flow vars to localStorage:", e);
  }
}
