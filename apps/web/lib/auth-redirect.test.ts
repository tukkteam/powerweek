import { describe, expect, it } from "vitest";
import { langOfPath, safeNextPath } from "./auth-redirect";

describe("safeNextPath", () => {
  it("allows paths inside the app", () => {
    expect(safeNextPath("/en/app/week")).toBe("/en/app/week");
    expect(safeNextPath("/es/app")).toBe("/es/app");
  });

  it("rejects anything else", () => {
    for (const bad of [
      null,
      "",
      "https://evil.example",
      "//evil.example/es/app",
      "/es/login",
      "/fr/app",
      "/es/app//evil",
    ]) {
      expect(safeNextPath(bad)).toBe("/es/app");
    }
  });

  it("reads the language of a path", () => {
    expect(langOfPath("/en/app")).toBe("en");
    expect(langOfPath("/xx")).toBe("es");
  });
});
