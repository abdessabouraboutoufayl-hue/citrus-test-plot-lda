import { describe, it, expect } from "vitest";
import { APP_MODULES, getAllSubmenuKeys, getSubmenuKeyForPath } from "@/lib/permissions-config";

describe("APP_MODULES", () => {
  it("contains all expected module keys", () => {
    const keys = APP_MODULES.map(m => m.key);
    expect(keys).toContain("dashboard");
    expect(keys).toContain("production");
    expect(keys).toContain("qualite");
    expect(keys).toContain("phenologie");
    expect(keys).toContain("analytics");
    expect(keys).toContain("admin");
  });

  it("each module has at least one submenu", () => {
    APP_MODULES.forEach(m => {
      expect(m.subMenus.length).toBeGreaterThan(0);
    });
  });
});

describe("getAllSubmenuKeys", () => {
  it("returns a flat list of all submenu keys", () => {
    const keys = getAllSubmenuKeys();
    expect(keys).toContain("production_saisie");
    expect(keys).toContain("qualite_new");
    expect(keys).toContain("phenologie_suivi");
    expect(keys).toContain("analytics_global");
    expect(keys.length).toBeGreaterThan(10);
  });
});

describe("getSubmenuKeyForPath", () => {
  it("finds correct key for production saisie path", () => {
    expect(getSubmenuKeyForPath("/production/saisie-par-variete")).toBe("production_saisie");
  });

  it("finds correct key for qualite path", () => {
    expect(getSubmenuKeyForPath("/qualite/new")).toBe("qualite_new");
  });

  it("returns null for unknown path", () => {
    expect(getSubmenuKeyForPath("/unknown/path")).toBeNull();
  });

  it("matches dashboard path", () => {
    expect(getSubmenuKeyForPath("/dashboard")).toBe("dashboard");
  });
});
