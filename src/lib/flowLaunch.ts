const KEY = (id: string) => `flow_inputs/${id}`;
export function seedMergeTrainRefs(refs: string) {
  try {
    const id = "merge-train";
    const raw = localStorage.getItem(KEY(id));
    const curr = raw ? JSON.parse(raw) : {};
    const next = { ...curr, refs };
    localStorage.setItem(KEY(id), JSON.stringify(next));
  } catch (e) {
    console.error("Failed to seed merge-train inputs:", e);
  }
}
