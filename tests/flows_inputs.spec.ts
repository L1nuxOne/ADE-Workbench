import { describe, it, expect, beforeEach } from "vitest";
import { loadFlowVars, saveFlowVars } from "../src/lib/flowInputs";
import { template } from "../src/lib/flows";

declare var global: any;

describe("flow inputs helpers", () => {
  beforeEach(() => {
    let store: Record<string, string> = {};
    global.localStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { store = {}; },
    } as any;
  });

  it("merges defaults with saved values", () => {
    const defaults = { a: "1", b: "2" };
    saveFlowVars("flow1", { a: "x" });
    expect(loadFlowVars("flow1", defaults)).toEqual({ a: "x", b: "2" });
  });

  it("template throws on missing var", () => {
    expect(() => template("echo {{foo}}", {})).toThrow(/missing var: foo/);
  });

  it("selection overrides reflected in command", () => {
    const defaults = { opt: "A" };
    saveFlowVars("flow2", { opt: "B" });
    const vars = loadFlowVars("flow2", defaults);
    expect(template("run {{opt}}", vars)).toBe("run B");
  });
});
