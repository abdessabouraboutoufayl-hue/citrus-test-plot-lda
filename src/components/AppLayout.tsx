import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { OfflineBanner } from "@/components/OfflineBanner";
import { NotificationBell } from "@/components/NotificationBell";
import { Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <div className="hidden lg:block">
          <AppSidebar />
        </div>
        <div className="flex-1 flex flex-col min-h-screen">
          <OfflineBanner />
          <header className="h-14 border-b bg-card flex items-center px-4 gap-4 sticky top-0 z-40">
            <SidebarTrigger className="lg:hidden" />
            <h1 className="text-sm font-semibold text-foreground">R&D Variétal</h1>
            <div className="ml-auto">
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6">
            <Outlet />
          </main>
          <MobileNav />
        </div>
      </div>
    </SidebarProvider>
  );
}
