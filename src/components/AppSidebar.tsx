import { LayoutDashboard, PlusCircle, List, BarChart3, CheckSquare, LogOut, Citrus } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
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

  const navItems = [
    { title: "Tableau de bord", url: "/dashboard", icon: LayoutDashboard },
    { title: "Nouvelle saisie", url: "/production/new", icon: PlusCircle },
    { title: "Liste production", url: "/production", icon: List },
    { title: "Dashboard analytique", url: "/production/dashboard", icon: BarChart3 },
  ];

  if (userInfo.role === "responsable_central") {
    navItems.push({ title: "Validation", url: "/validation", icon: CheckSquare });
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
          <SidebarGroupLabel className="text-sidebar-foreground/50">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
