import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi, tokenStore } from "@/services/api";
import { toast } from "sonner";

export default function GuestAccess() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Préparation de l'accès invité...");

  useEffect(() => {
    (async () => {
      try {
        setStatus("Connexion du compte invité...");
        const { token } = await authApi.guestLogin();
        tokenStore.set(token);
        // Full page reload so AuthProvider re-reads the JWT from localStorage
        window.location.replace("/dashboard");
      } catch (e: any) {
        console.error(e);
        toast.error(e.message || "Erreur d'accès invité");
        setStatus("Échec. Redirection...");
        setTimeout(() => navigate("/login", { replace: true }), 2000);
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      {status}
    </div>
  );
}
