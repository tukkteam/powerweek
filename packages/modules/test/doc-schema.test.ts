import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { docJsonSchema } from "../src";

const schemaFile = new URL("../schema/doc.schema.json", import.meta.url);

/**
 * The JSON Schema of the document envelope is committed so that a database can enforce it.
 * This test fails when the zod schema and the committed file drift apart.
 * Regenerate with: UPDATE_SCHEMA=1 pnpm --filter @tukkteam/modules test
 */
describe("document JSON Schema", () => {
  it("matches the committed schema file", () => {
    const generated = JSON.stringify(docJsonSchema());
    if (process.env.UPDATE_SCHEMA) writeFileSync(schemaFile, `${generated}\n`);
    expect(readFileSync(schemaFile, "utf8").trim()).toBe(generated);
  });
});
