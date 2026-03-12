import { LayoutDashboard, PlusCircle, List, BarChart3, CheckSquare, LogOut, Citrus, Settings, FlaskConical, Flower2, History, GitCompareArrows, LineChart, Map, GitMerge, Download, FileText, TreePine, Users } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const { userInfo, signOut } = useAuth();
  const { hasAccess } = usePermissions();

  const productionItems = [
    { title: "Saisie / Import", url: "/production/saisie-par-variete", icon: TreePine, permKey: "production_saisie" },
    { title: "Liste production", url: "/production", icon: List, permKey: "production_list" },
    { title: "Dashboard production", url: "/production/dashboard", icon: BarChart3, permKey: "production_dashboard" },
  ].filter(i => hasAccess(i.permKey));

  const qualiteItems = [
    { title: "Nouvelle analyse", url: "/qualite/new", icon: PlusCircle, permKey: "qualite_new" },
    { title: "Liste analyses", url: "/qualite", icon: List, permKey: "qualite_list" },
    { title: "Dashboard qualité", url: "/qualite/dashboard", icon: BarChart3, permKey: "qualite_dashboard" },
  ].filter(i => hasAccess(i.permKey));

  const phenologieItems = [
    { title: "Suivi phénologique", url: "/phenologie/suivi", icon: Flower2, permKey: "phenologie_suivi" },
    { title: "Historique", url: "/phenologie/historique", icon: History, permKey: "phenologie_historique" },
    { title: "Comparaison campagnes", url: "/phenologie/comparaison", icon: GitCompareArrows, permKey: "phenologie_comparaison" },
    { title: "Dashboard phénologie", url: "/phenologie/dashboard", icon: BarChart3, permKey: "phenologie_dashboard" },
  ].filter(i => hasAccess(i.permKey));

  const analyticsItems = [
    ...(userInfo.role === "direction" || userInfo.role === "responsable_central" ? [{ title: "Vue Exécutive", url: "/analytics/executive", icon: LineChart, permKey: "analytics_executive" }] : []),
    { title: "Dashboard Global", url: "/analytics/global", icon: BarChart3, permKey: "analytics_global" },
    { title: "Carte GPS", url: "/analytics/carte-gps", icon: Map, permKey: "analytics_carte" },
    { title: "Analyses Croisées", url: "/analytics/analyses-croisees", icon: GitMerge, permKey: "analytics_croisees" },
    { title: "Exports Avancés", url: "/analytics/exports", icon: Download, permKey: "analytics_exports" },
    { title: "Rapports Auto", url: "/analytics/rapports-auto", icon: FileText, permKey: "analytics_rapports" },
  ].filter(i => hasAccess(i.permKey));

  const adminItems: typeof productionItems = [];
  if (userInfo.role === "responsable_central") {
    adminItems.push({ title: "Validation", url: "/validation", icon: CheckSquare, permKey: "admin_validation" });
    adminItems.push({ title: "Administration", url: "/admin", icon: Settings, permKey: "admin_administration" });
    adminItems.push({ title: "Gestion utilisateurs", url: "/admin/utilisateurs", icon: Users, permKey: "admin_utilisateurs" });
  }

  return (
    <Sidebar className="border-r-0">
      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center gap-2 px-4 py-4">
            <Citrus className="h-8 w-8 text-sidebar-primary" />
            <div>
              <h2 className="text-sm font-bold text-sidebar-foreground">R&D Variétal</h2>
              <p className="text-xs text-sidebar-foreground/60">Production Agrumes</p>
            </div>
          </div>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/dashboard" end className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                    <LayoutDashboard className="h-4 w-4" /><span>Tableau de bord</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">📊 Production</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {productionItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <item.icon className="h-4 w-4" /><span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">🍊 Qualité Interne</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {qualiteItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <item.icon className="h-4 w-4" /><span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">🌸 Phénologie</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {phenologieItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <item.icon className="h-4 w-4" /><span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">📈 Analytics</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analyticsItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <item.icon className="h-4 w-4" /><span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {adminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/50">Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                        <item.icon className="h-4 w-4" /><span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="text-xs text-sidebar-foreground/50 mb-2">
          {userInfo.email}
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground">
          <LogOut className="h-4 w-4 mr-2" />
          Déconnexion
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
