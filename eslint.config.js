import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  // Base TS config
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-expect-error": "allow-with-description" }],
    },
  },
  // Ban direct Tauri access everywhere EXCEPT the host abstraction files
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["src/lib/host.ts", "src/lib/hostClient.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "window", property: "__TAURI__", message: "Use HostClient/host abstraction only." }
      ],
    },
  },
];
