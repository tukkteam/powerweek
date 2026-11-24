import { readFileSync, readdirSync } from "node:fs";
import { docJsonSchema } from "@tukkteam/modules";
import { describe, expect, it } from "vitest";

const migrationsDir = new URL("../../../supabase/migrations/", import.meta.url);
const schemaFile = new URL("../../../packages/modules/schema/doc.schema.json", import.meta.url);

/**
 * The database validates `plans.doc` with pg_jsonschema, using the JSON Schema of the document
 * envelope. These tests fail when the kernel's schema, the committed file and the migration
 * drift apart. Regenerate the file with: UPDATE_SCHEMA=1 pnpm --filter @tukkteam/modules test
 */
describe("plan JSON Schema in the database", () => {
  const generated = JSON.stringify(docJsonSchema());
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const withSchema = files.filter((file) =>
    readFileSync(new URL(file, migrationsDir), "utf8").includes("jsonb_matches_schema"),
  );
  const latest = readFileSync(new URL(withSchema.at(-1)!, migrationsDir), "utf8");

  it("is the envelope the kernel defines", () => {
    expect(readFileSync(schemaFile, "utf8").trim()).toBe(generated);
    expect(latest).toContain(`'${generated}'::json`);
  });

  // Remove this test together with the migration that drops plan version 1.
  it("still accepts plans from before modules, with the schema they were written under", () => {
    const literals = (sql: string) =>
      [...sql.matchAll(/'(\{"\$schema"[^']*\})'::json/g)].map((match) => match[1]!);
    const lastOfVersionOne = readFileSync(
      new URL("20261114100000_meal_options.sql", migrationsDir),
      "utf8",
    );
    const versionOne = literals(lastOfVersionOne)[0]!;
    expect(versionOne).toContain('"schemaVersion":{"type":"number","const":1}');
    expect(literals(latest)).toContain(versionOne);
  });
});
