import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Bell } from "lucide-react";
import { toast } from "sonner";

export default function Validation() {
  const { userInfo } = useAuth();
  const queryClient = useQueryClient();
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  const { data: pending = [] } = useQuery({
    queryKey: ["pending-validation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production")
        .select("*, varietes(code_variete, nom_commercial), porte_greffes(code_pg), domaines(nom)")
        .eq("statut_validation", "Soumis")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const validateMutation = useMutation({
    mutationFn: async ({ id, status, comment }: { id: number; status: string; comment?: string }) => {
      const { error } = await supabase
        .from("production")
        .update({ statut_validation: status, commentaires_validation: comment || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["pending-validation"] });
      toast.success(vars.status === "Validé" ? "Production validée" : "Production rejetée");
    },
  });

  const handleReject = () => {
    if (rejectId) {
      validateMutation.mutate({ id: rejectId, status: "Rejeté", comment: rejectComment });
      setRejectId(null);
      setRejectComment("");
    }
  };

  if (userInfo.role !== "responsable_central") {
    return <div className="text-center py-12 text-muted-foreground">Accès réservé au responsable central</div>;
  }

  // Group by domaine
  const grouped: Record<string, typeof pending> = {};
  pending.forEach((p) => {
    const nom = (p.domaines as any)?.nom || "Inconnu";
    if (!grouped[nom]) grouped[nom] = [];
    grouped[nom].push(p);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6 text-warning" />
        <h1 className="text-2xl font-bold">{pending.length} production(s) en attente</h1>
      </div>

      {Object.entries(grouped).map(([domaine, items]) => (
        <div key={domaine} className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">{domaine}</h2>
          {items.map((p) => (
            <Card key={p.id}>
              <CardContent className="pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{p.code_arbre}</span>
                      <Badge variant="outline">{(p.varietes as any)?.code_variete}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {p.poids_total_kg} kg • {p.nb_fruits_total} fruits • {p.qualite_globale || "Non classé"}
                    </p>
                    {(p.taux_declassement_pct || 0) > 20 && (
                      <Badge variant="destructive" className="text-xs">⚠️ Déclassement {p.taux_declassement_pct}%</Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => validateMutation.mutate({ id: p.id, status: "Validé" })} disabled={validateMutation.isPending}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Valider
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setRejectId(p.id)} disabled={validateMutation.isPending}>
                      <XCircle className="h-4 w-4 mr-1" /> Rejeter
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}

      {pending.length === 0 && (
        <p className="text-center text-muted-foreground py-12">Aucune production en attente de validation</p>
      )}

      <Dialog open={rejectId !== null} onOpenChange={() => setRejectId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeter la production</DialogTitle></DialogHeader>
          <Textarea placeholder="Raison du rejet..." value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleReject}>Confirmer le rejet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
