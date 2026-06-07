import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { tokenStore } from "@/services/api";
import { toast } from "sonner";

// Encode a fake JWT (header.payload.signature) — signature is a placeholder.
// AuthContext only reads the payload to extract role/email; no server check needed
// because the backend API is not deployed in this preview environment.
function b64url(obj: unknown) {
  return btoa(JSON.stringify(obj))
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function makeDemoToken(payload: Record<string, unknown>) {
  const header = b64url({ alg: "none", typ: "JWT" });
  const body = b64url({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    demo: true,
  });
  return `${header}.${body}.demo`;
}

export default function AdminAccess() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Connexion admin démo...");

  useEffect(() => {
    try {
      tokenStore.clear();
      const token = makeDemoToken({
        sub: "demo-admin-id",
        email: "admin-demo@domaines.co.ma",
        role: "responsable_central",
        domaineId: null,
        nomComplet: "Admin Démo",
      });
      tokenStore.set(token);
      window.location.replace("/dashboard");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Échec de l'accès admin");
      setStatus("Échec. Redirection...");
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    }
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
