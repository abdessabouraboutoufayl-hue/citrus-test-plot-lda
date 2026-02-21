import { LayoutDashboard, List, FlaskConical, User, PlusCircle } from "lucide-react";
import { NavLink } from "@/components/NavLink";

export function MobileNav() {
  const items = [
    { title: "Accueil", url: "/dashboard", icon: LayoutDashboard },
    { title: "Production", url: "/production", icon: List },
    { title: "Qualité", url: "/qualite", icon: FlaskConical },
    { title: "Profil", url: "/profile", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t lg:hidden">
      <div className="flex justify-around items-center h-16">
        {items.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/dashboard"}
            className="flex flex-col items-center gap-1 px-3 py-2 text-muted-foreground min-w-[64px]"
            activeClassName="text-primary"
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs">{item.title}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
