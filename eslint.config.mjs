import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import globals from "globals";
import obsidianmd from "eslint-plugin-obsidianmd";
import eslintConfigPrettier from "eslint-config-prettier";
import svelte from "eslint-plugin-svelte";

export default defineConfig(
  globalIgnores([
    "node_modules",
    "dist",
    "main.js",
    "eslint.config.mjs",
    "esbuild.config.mjs",
    "package.json",
  ]),
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-deprecated": "off",
    },
  },
  svelte.configs.recommended,
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        // Enable typescript parsing for `.svelte` files.
        extraFileExtensions: [".svelte"],
        parser: tseslint.parser,
      },
    },
    rules: {
      "no-unused-vars": "off",
    },
  },
  eslintConfigPrettier,
);
