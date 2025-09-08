import { describe, it, expect } from "vitest";
import { parseCommand } from "../src/lib/cmd";

describe("parseCommand", () => {
  it("handles quoted args", () => {
    expect(parseCommand(`git commit -m "my msg"`)).toEqual([
      "git",
      "commit",
      "-m",
      "my msg",
    ]);
    expect(parseCommand(`bash -c 'echo hi'`)).toEqual(["bash", "-c", "echo hi"]);
  });
});
