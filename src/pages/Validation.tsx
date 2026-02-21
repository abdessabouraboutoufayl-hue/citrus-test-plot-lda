import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Bell, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

function EaBadgeInline({ value }: { value: number | null }) {
  if (value == null) return <span>-</span>;
  if (value >= 12) return <Badge className="bg-success/20 text-success">{value.toFixed(1)} ⭐</Badge>;
  if (value >= 10) return <Badge className="bg-warning/20 text-warning">{value.toFixed(1)}</Badge>;
  return <Badge className="bg-destructive/20 text-destructive">{value.toFixed(1)}</Badge>;
}

export default function Validation() {
  const { userInfo } = useAuth();
  const queryClient = useQueryClient();
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [rejectType, setRejectType] = useState<"production" | "qualite">("production");

  const { data: pendingProd = [] } = useQuery({
    queryKey: ["pending-validation-prod"],
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

  const { data: pendingQualite = [] } = useQuery({
    queryKey: ["pending-validation-qualite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qualite_interne")
        .select("*, varietes(code_variete, nom_commercial), porte_greffes(code_pg), domaines(nom)")
        .eq("statut_validation", "Soumis")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const validateProdMutation = useMutation({
    mutationFn: async ({ id, status, comment }: { id: number; status: string; comment?: string }) => {
      const { error } = await supabase.from("production").update({ statut_validation: status, commentaires_validation: comment || null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["pending-validation-prod"] });
      toast.success(vars.status === "Validé" ? "Production validée" : "Production rejetée");
    },
  });

  const validateQualiteMutation = useMutation({
    mutationFn: async ({ id, status, comment }: { id: number; status: string; comment?: string }) => {
      const { error } = await supabase.from("qualite_interne").update({ statut_validation: status, commentaires_validation: comment || null } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["pending-validation-qualite"] });
      toast.success(vars.status === "Validé" ? "Analyse validée" : "Analyse rejetée");
    },
  });

  const handleReject = () => {
    if (rejectId) {
      if (rejectType === "production") {
        validateProdMutation.mutate({ id: rejectId, status: "Rejeté", comment: rejectComment });
      } else {
        validateQualiteMutation.mutate({ id: rejectId, status: "Rejeté", comment: rejectComment });
      }
      setRejectId(null);
      setRejectComment("");
    }
  };

  if (userInfo.role !== "responsable_central") {
    return <div className="text-center py-12 text-muted-foreground">Accès réservé au responsable central</div>;
  }

  // Group production by domaine
  const groupedProd: Record<string, typeof pendingProd> = {};
  pendingProd.forEach((p) => {
    const nom = (p.domaines as any)?.nom || "Inconnu";
    if (!groupedProd[nom]) groupedProd[nom] = [];
    groupedProd[nom].push(p);
  });

  // Group qualite by domaine
  const groupedQualite: Record<string, any[]> = {};
  pendingQualite.forEach((a: any) => {
    const nom = a.domaines?.nom || "Inconnu";
    if (!groupedQualite[nom]) groupedQualite[nom] = [];
    groupedQualite[nom].push(a);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6 text-warning" />
        <h1 className="text-2xl font-bold">Validation</h1>
      </div>

      <Tabs defaultValue="production">
        <TabsList>
          <TabsTrigger value="production">Production ({pendingProd.length})</TabsTrigger>
          <TabsTrigger value="qualite">Qualité ({pendingQualite.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="production" className="space-y-4 mt-4">
          {Object.entries(groupedProd).map(([domaine, items]) => (
            <div key={domaine} className="space-y-3">
              <h2 className="text-lg font-semibold">{domaine}</h2>
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
                        <Button size="sm" onClick={() => validateProdMutation.mutate({ id: p.id, status: "Validé" })} disabled={validateProdMutation.isPending}>
                          <CheckCircle className="h-4 w-4 mr-1" /> Valider
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => { setRejectId(p.id); setRejectType("production"); }} disabled={validateProdMutation.isPending}>
                          <XCircle className="h-4 w-4 mr-1" /> Rejeter
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
          {pendingProd.length === 0 && <p className="text-center text-muted-foreground py-12">Aucune production en attente</p>}
        </TabsContent>

        <TabsContent value="qualite" className="space-y-4 mt-4">
          {Object.entries(groupedQualite).map(([domaine, items]) => (
            <div key={domaine} className="space-y-3">
              <h2 className="text-lg font-semibold">{domaine}</h2>
              {items.map((a: any) => (
                <Card key={a.id}>
                  <CardContent className="pt-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{a.varietes?.code_variete}</Badge>
                          <span className="text-sm text-muted-foreground">{a.porte_greffes?.code_pg}</span>
                          <span className="text-sm text-muted-foreground">{new Date(a.date_analyse).toLocaleDateString("fr-FR")}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span>Brix {a.brix_degres}°</span>
                          <span>Acidité {a.acidite_gl} g/L</span>
                          <EaBadgeInline value={a.ratio_ea} />
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>% Jus: {a.pct_jus ?? "-"}</span>
                          <span>Pépins moy: {a.moyenne_pepins_par_fruit?.toFixed(1) ?? "-"}</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {a.alerte_ea_faible && <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />E/A faible</Badge>}
                          {a.alerte_brix_hors_norme && <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Brix hors norme</Badge>}
                          {a.alerte_granulation_severe && <Badge className="bg-warning/20 text-warning text-xs">Granulation sévère</Badge>}
                          {a.maturite_optimale && <Badge className="bg-success/20 text-success text-xs">✅ Maturité optimale</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">Technicien: {a.technicien_nom}</p>
                        {a.photo_fruits_coupes_url && (
                          <img src={a.photo_fruits_coupes_url} alt="Photo" className="mt-2 rounded max-h-20 object-cover" />
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => validateQualiteMutation.mutate({ id: a.id, status: "Validé" })} disabled={validateQualiteMutation.isPending}>
                          <CheckCircle className="h-4 w-4 mr-1" /> Valider
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => { setRejectId(a.id); setRejectType("qualite"); }} disabled={validateQualiteMutation.isPending}>
                          <XCircle className="h-4 w-4 mr-1" /> Rejeter
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
          {pendingQualite.length === 0 && <p className="text-center text-muted-foreground py-12">Aucune analyse en attente</p>}
        </TabsContent>
      </Tabs>

      <Dialog open={rejectId !== null} onOpenChange={() => setRejectId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeter {rejectType === "production" ? "la production" : "l'analyse qualité"}</DialogTitle></DialogHeader>
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
