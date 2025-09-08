import { describe, it, expect } from "vitest";
import { template } from "../src/lib/flows";

describe("templating", () => {
  it("substitutes vars", () => {
    expect(template("echo {{a}}-{{b}}", { a: "x", b: "y" })).toBe("echo x-y");
  });
  it("fails on missing var", () => {
    expect(() => template("{{a}} {{b}}", { a: "x" })).toThrow(/missing var: b/);
  });
});
