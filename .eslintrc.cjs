const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");

module.exports = [
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "no-restricted-properties": [
        "error",
        { object: "window", property: "__TAURI__", message: "Use HostClient/host abstraction only." }
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      // If your host layer is in src/lib/host.ts or src/lib/hostClient.ts, ban importing it from libs/components except through public API (adjust as needed)
      // Example: require using `useHost()` or exported helpers rather than poking internals.
    },
  },
];
