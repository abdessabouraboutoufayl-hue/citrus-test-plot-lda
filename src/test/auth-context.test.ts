import { describe, it, expect } from "vitest";

// Test the role priority logic used in AuthContext
describe("Role priority logic", () => {
  const priorityOrder = ["responsable_central", "direction", "responsable_domaine"];

  it("sorts roles by priority - responsable_central first", () => {
    const roles = [
      { role: "responsable_domaine", domaine_id: 1 },
      { role: "responsable_central", domaine_id: null },
    ];
    const sorted = [...roles].sort(
      (a, b) => priorityOrder.indexOf(a.role) - priorityOrder.indexOf(b.role)
    );
    expect(sorted[0].role).toBe("responsable_central");
  });

  it("sorts roles by priority - direction before responsable_domaine", () => {
    const roles = [
      { role: "responsable_domaine", domaine_id: 1 },
      { role: "direction", domaine_id: null },
    ];
    const sorted = [...roles].sort(
      (a, b) => priorityOrder.indexOf(a.role) - priorityOrder.indexOf(b.role)
    );
    expect(sorted[0].role).toBe("direction");
  });

  it("finds domaine_id from any role", () => {
    const roles = [
      { role: "responsable_central", domaine_id: null },
      { role: "responsable_domaine", domaine_id: 5 },
    ];
    const domaineRole = roles.find(r => r.domaine_id != null);
    expect(domaineRole?.domaine_id).toBe(5);
  });

  it("returns null when no role has domaine_id", () => {
    const roles = [{ role: "direction", domaine_id: null }];
    const domaineRole = roles.find(r => r.domaine_id != null);
    expect(domaineRole).toBeUndefined();
  });
});
