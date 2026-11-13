import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planJsonSchema } from "../src";

const schemaFile = new URL("../schema/plan.schema.json", import.meta.url);
const migrationsDir = new URL("../../../supabase/migrations/", import.meta.url);

/**
 * The database validates `plans.doc` with pg_jsonschema using the JSON Schema generated
 * from the zod schema. These tests fail when the two drift apart.
 * Regenerate with: UPDATE_SCHEMA=1 pnpm --filter @powerweek/core test
 */
describe("plan JSON Schema", () => {
  const generated = JSON.stringify(planJsonSchema());

  it("matches the committed schema file", () => {
    if (process.env.UPDATE_SCHEMA) writeFileSync(schemaFile, `${generated}\n`);
    expect(readFileSync(schemaFile, "utf8").trim()).toBe(generated);
  });

  it("is the schema the latest migration enforces", () => {
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const withSchema = files.filter((f) =>
      readFileSync(new URL(f, migrationsDir), "utf8").includes("jsonb_matches_schema"),
    );
    const latest = withSchema.at(-1);
    expect(latest, "a migration must define the plan schema check").toBeDefined();
    const sql = readFileSync(new URL(latest!, migrationsDir), "utf8");
    expect(sql).toContain(generated);
  });
});
