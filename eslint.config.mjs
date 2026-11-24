import ts from "typescript-eslint";
export default ts.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  ...ts.configs.recommended,
);
