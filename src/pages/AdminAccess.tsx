import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi, tokenStore } from "@/services/api";
import { toast } from "sonner";

const ADMIN_EMAIL = "admin-demo@domaines.co.ma";
const ADMIN_PASSWORD = "Admin-Demo-2026!";

export default function AdminAccess() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Connexion admin en cours...");

  useEffect(() => {
    (async () => {
      try {
        tokenStore.clear();
        const { token } = await authApi.login(ADMIN_EMAIL, ADMIN_PASSWORD);
        tokenStore.set(token);
        // Full reload so AuthProvider re-reads the JWT
        window.location.replace("/dashboard");
      } catch (e: any) {
        console.error(e);
        toast.error(e.message || "Échec de l'accès admin");
        setStatus("Échec. Redirection...");
        setTimeout(() => navigate("/login", { replace: true }), 2000);
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-2">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
