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

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Chargement...</div>;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { session, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Chargement...</div>;

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/production" element={<ProductionList />} />
        <Route path="/production/new" element={<ProductionWizard />} />
        <Route path="/production/dashboard" element={<Dashboard />} />
        <Route path="/validation" element={<Validation />} />
        <Route path="/admin" element={<Administration />} />
        <Route path="/profile" element={<Profile />} />
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
