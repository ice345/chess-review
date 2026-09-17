import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
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
      ".tmp-ui-pass/**",
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
    // React's hook order is a correctness rule the TypeScript compiler cannot
    // check: a component that returns before its hooks still typechecks. The
    // dependency rule stays off here — it is a design suggestion, and the code
    // base already states its dependencies explicitly.
    files: ["apps/web/**/*.{ts,tsx}", "apps/mobile/**/*.{ts,tsx}", "packages/ui/**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",
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
