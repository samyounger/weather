import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import jestConfig from "eslint-plugin-jest";

export default [
  js.configs.recommended,
  jestConfig.configs["flat/recommended"],
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", {
        varsIgnorePattern: "^_",
        argsIgnorePattern: "^_",
      }],
      "object-curly-spacing": ["error", "always"],
      "semi": ["error", "always"],
    },
  },
  {
    ignores: [
      "dist/",
      "coverage/",
      "node_modules/",
    ],
  },
];
