import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminAccess() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        await supabase.auth.signOut();
        const { data, error } = await supabase.functions.invoke("admin-access");
        if (error) throw error;
        if (!data?.email || !data?.password) throw new Error("Réponse invalide du serveur");
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });
        if (signInErr) throw signInErr;
        navigate("/dashboard", { replace: true });
      } catch (e: any) {
        toast.error(e.message || "Échec de l'accès admin");
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-2">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-muted-foreground">Connexion admin en cours...</p>
      </div>
    </div>
  );
}
