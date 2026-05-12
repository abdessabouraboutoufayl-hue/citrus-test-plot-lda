import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import ProductionList from "@/pages/ProductionList";
import ProductionWizard from "@/pages/ProductionWizard";
import Validation from "@/pages/Validation";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/NotFound";
import Administration from "@/pages/Administration";
import QualiteWizard from "@/pages/QualiteWizard";
import QualiteList from "@/pages/QualiteList";
import QualiteDashboard from "@/pages/QualiteDashboard";
import PhenologieSuivi from "@/pages/PhenologieSuivi";
import PhenologieHistorique from "@/pages/PhenologieHistorique";
import PhenologieComparaison from "@/pages/PhenologieComparaison";
import PhenologieDashboard from "@/pages/PhenologieDashboard";
import AnalyticsExecutive from "@/pages/AnalyticsExecutive";
import AnalyticsGlobal from "@/pages/AnalyticsGlobal";

import AnalysesCroisees from "@/pages/AnalysesCroisees";
import AnalyticsExports from "@/pages/AnalyticsExports";
import AnalyticsRapportsAuto from "@/pages/AnalyticsRapportsAuto";
import ProductionSaisieVariete from "@/pages/ProductionSaisieVariete";
import ResetPassword from "@/pages/ResetPassword";
import GestionUtilisateurs from "@/pages/GestionUtilisateurs";
import NoAccess from "@/pages/NoAccess";
import GuestAccess from "@/pages/GuestAccess";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, userInfo } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Chargement...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!userInfo.role) return <NoAccess />;
  return <>{children}</>;
}

function AppRoutes() {
  const { session, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Chargement...</div>;

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/guest" element={<GuestAccess />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/production" element={<ProductionList />} />
        <Route path="/production/new" element={<ProductionWizard />} />
        <Route path="/production/saisie-par-variete" element={<ProductionSaisieVariete />} />
        <Route path="/production/edit/:id" element={<ProductionWizard />} />
        <Route path="/production/dashboard" element={<Dashboard />} />
        <Route path="/qualite" element={<QualiteList />} />
        <Route path="/qualite/new" element={<QualiteWizard />} />
        <Route path="/qualite/edit/:id" element={<QualiteWizard />} />
        <Route path="/qualite/dashboard" element={<QualiteDashboard />} />
        <Route path="/phenologie/suivi" element={<PhenologieSuivi />} />
        <Route path="/phenologie/historique" element={<PhenologieHistorique />} />
        <Route path="/phenologie/comparaison" element={<PhenologieComparaison />} />
        <Route path="/phenologie/dashboard" element={<PhenologieDashboard />} />
        <Route path="/validation" element={<Validation />} />
        <Route path="/admin" element={<Administration />} />
        <Route path="/admin/utilisateurs" element={<GestionUtilisateurs />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/analytics/executive" element={<AnalyticsExecutive />} />
        <Route path="/analytics/global" element={<AnalyticsGlobal />} />
        
        <Route path="/analytics/analyses-croisees" element={<AnalysesCroisees />} />
        <Route path="/analytics/exports" element={<AnalyticsExports />} />
        <Route path="/analytics/rapports-auto" element={<AnalyticsRapportsAuto />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
