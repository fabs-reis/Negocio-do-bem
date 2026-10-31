import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

it("orienta o inventário sem receita de exclusão de esquemas", () => {
  const doc = readFileSync(path.resolve(import.meta.dirname, "../../docs/como-foi-feito.md"), "utf8");
  expect(doc).toContain("/banco-preview.json");
  expect(doc).toContain("mantenha todos os esquemas");
  expect(doc).not.toMatch(/DROP\s+SCHEMA/i);
  expect(doc).not.toContain("-- APAGAR");
});
