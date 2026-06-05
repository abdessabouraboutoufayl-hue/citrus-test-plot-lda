import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function GuestAccess() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Préparation de l'accès invité...");

  useEffect(() => {
    (async () => {
      try {
        // Sign out any existing session to avoid mixing accounts
        await supabase.auth.signOut();

        setStatus("Création / vérification du compte invité...");
        const { data, error } = await supabase.functions.invoke("guest-access");
        if (error) throw error;
        if (!data?.email || !data?.password) throw new Error("Réponse invalide du serveur");

        setStatus("Connexion automatique...");
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });
        if (signInErr) throw signInErr;

        navigate("/dashboard", { replace: true });
      } catch (e: any) {
        console.error(e);
        toast.error(e.message || "Erreur d'accès invité");
        setStatus("Échec de l'accès invité. Redirection...");
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
