import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "prefer-const": "warn"
    },
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "*.config.js",
      "*.config.ts",
      "scripts/**",
      "public/**",
      ".vercel/**",
      "coverage/**",
      ".turbo/**",
      "lib/examples/**",
      "lib/hka/soap-client.ts",
      "lib/hka/xml-generator.ts",
      "lib/prisma-utils.ts",
      "lib/prisma.ts",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
