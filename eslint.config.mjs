import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/.next/**",
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/target/**",
      "**/src-tauri/gen/**",
      "**/.venv/**",
      "**/public/engine/**",
      "playwright-report/**",
      "test-results/**",
      "references/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_", "ignoreRestSiblings": true }],
    },
  },
  {
    // The offline worker is served verbatim, so it is plain JavaScript with the
    // service worker globals rather than browser document globals.
    files: ["apps/web/public/sw.js"],
    languageOptions: {
      globals: { self: "readonly", caches: "readonly", clients: "readonly", fetch: "readonly", Response: "readonly", Request: "readonly", URL: "readonly" },
    },
  },
);
