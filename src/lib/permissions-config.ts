// All app modules and sub-menus for permission management
export interface SubMenu {
  key: string;
  label: string;
  path: string;
}

export interface Module {
  key: string;
  label: string;
  icon: string;
  subMenus: SubMenu[];
}

export const APP_MODULES: Module[] = [
  {
    key: "dashboard",
    label: "Tableau de bord",
    icon: "📊",
    subMenus: [
      { key: "dashboard", label: "Tableau de bord", path: "/dashboard" },
    ],
  },
  {
    key: "production",
    label: "Production",
    icon: "📊",
    subMenus: [
      { key: "production_saisie", label: "Saisie / Import", path: "/production/saisie-par-variete" },
      { key: "production_list", label: "Liste production", path: "/production" },
      { key: "production_dashboard", label: "Dashboard production", path: "/production/dashboard" },
    ],
  },
  {
    key: "qualite",
    label: "Qualité Interne",
    icon: "🍊",
    subMenus: [
      { key: "qualite_new", label: "Nouvelle analyse", path: "/qualite/new" },
      { key: "qualite_list", label: "Liste analyses", path: "/qualite" },
      { key: "qualite_dashboard", label: "Dashboard qualité", path: "/qualite/dashboard" },
    ],
  },
  {
    key: "phenologie",
    label: "Phénologie",
    icon: "🌸",
    subMenus: [
      { key: "phenologie_suivi", label: "Suivi phénologique", path: "/phenologie/suivi" },
      { key: "phenologie_historique", label: "Historique", path: "/phenologie/historique" },
      { key: "phenologie_comparaison", label: "Comparaison campagnes", path: "/phenologie/comparaison" },
      { key: "phenologie_dashboard", label: "Dashboard phénologie", path: "/phenologie/dashboard" },
    ],
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: "📈",
    subMenus: [
      { key: "analytics_executive", label: "Vue Exécutive", path: "/analytics/executive" },
      { key: "analytics_global", label: "Dashboard Global", path: "/analytics/global" },
      { key: "analytics_carte", label: "Carte GPS", path: "/analytics/carte-gps" },
      { key: "analytics_croisees", label: "Analyses Croisées", path: "/analytics/analyses-croisees" },
      { key: "analytics_exports", label: "Exports Avancés", path: "/analytics/exports" },
      { key: "analytics_rapports", label: "Rapports Auto", path: "/analytics/rapports-auto" },
    ],
  },
  {
    key: "admin",
    label: "Administration",
    icon: "⚙️",
    subMenus: [
      { key: "validation", label: "Validation", path: "/validation" },
      { key: "administration", label: "Administration", path: "/admin" },
    ],
  },
];

// Get all submenu keys as a flat list
export function getAllSubmenuKeys(): string[] {
  return APP_MODULES.flatMap(m => m.subMenus.map(s => s.key));
}

// Find the submenu key for a given path
export function getSubmenuKeyForPath(path: string): string | null {
  for (const mod of APP_MODULES) {
    for (const sub of mod.subMenus) {
      if (path.startsWith(sub.path)) return sub.key;
    }
  }
  return null;
}
