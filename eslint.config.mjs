import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Allow raw French apostrophes and quotes in JSX text.
  {
    rules: {
      "react/no-unescaped-entities": [
        "error",
        { forbid: [">", "}", '"', "{"] },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Compiled test output:
    "dist-tests/**",
  ]),
]);

export default eslintConfig;
