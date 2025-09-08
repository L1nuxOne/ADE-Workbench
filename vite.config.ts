import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { flowsDevPlugin } from "./vite.plugins/flowsDev";

export default defineConfig({
  plugins: [react(), flowsDevPlugin()],
  test: {
    environment: "node",
    reporters: ["default"],
    coverage: { enabled: false }
  }
});
