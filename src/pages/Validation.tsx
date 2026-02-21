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
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, Bell, AlertTriangle, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy", { locale: fr }); } catch { return d; }
}

function EaBadgeInline({ value }: { value: number | null }) {
  if (value == null) return <span>-</span>;
  if (value >= 12) return <Badge className="bg-success/20 text-success">{value.toFixed(1)} ⭐</Badge>;
  if (value >= 10) return <Badge className="bg-warning/20 text-warning">{value.toFixed(1)}</Badge>;
  return <Badge className="bg-destructive/20 text-destructive">{value.toFixed(1)}</Badge>;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{value ?? "—"}</span>
    </div>
  );
}

export default function Validation() {
  const { userInfo } = useAuth();
  const queryClient = useQueryClient();
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [rejectType, setRejectType] = useState<"production" | "qualite">("production");
  const [viewItem, setViewItem] = useState<{ type: "production" | "qualite"; data: any } | null>(null);

  const { data: pendingProd = [] } = useQuery({
    queryKey: ["pending-validation-prod"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production")
        .select("*, varietes(code_variete, nom_commercial), porte_greffes(code_pg, nom_pg), domaines(nom, code), campagnes(code_campagne)")
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
        .select("*, varietes(code_variete, nom_commercial), porte_greffes(code_pg, nom_pg), domaines(nom, code), campagnes(code_campagne)")
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

  const groupedProd: Record<string, typeof pendingProd> = {};
  pendingProd.forEach((p) => {
    const nom = (p.domaines as any)?.nom || "Inconnu";
    if (!groupedProd[nom]) groupedProd[nom] = [];
    groupedProd[nom].push(p);
  });

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
                        <Button size="sm" variant="outline" onClick={() => setViewItem({ type: "production", data: p })}>
                          <Eye className="h-4 w-4 mr-1" /> Consulter
                        </Button>
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
                          <span className="text-sm text-muted-foreground">{fmtDate(a.date_analyse)}</span>
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
                        <Button size="sm" variant="outline" onClick={() => setViewItem({ type: "qualite", data: a })}>
                          <Eye className="h-4 w-4 mr-1" /> Consulter
                        </Button>
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

      {/* Reject Dialog */}
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

      {/* Consulter Dialog */}
      <Dialog open={viewItem !== null} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Récapitulatif {viewItem?.type === "production" ? "Production" : "Qualité Interne"}
            </DialogTitle>
          </DialogHeader>

          {viewItem?.type === "production" && (() => {
            const p = viewItem.data;
            return (
              <div className="space-y-3">
                <div className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Identification</p>
                  <DetailRow label="Domaine" value={(p.domaines as any)?.nom} />
                  <DetailRow label="Campagne" value={(p.campagnes as any)?.code_campagne} />
                  <DetailRow label="Code arbre" value={<span className="font-mono">{p.code_arbre}</span>} />
                  <DetailRow label="Variété" value={`${(p.varietes as any)?.code_variete} ${(p.varietes as any)?.nom_commercial ? `(${(p.varietes as any).nom_commercial})` : ""}`} />
                  <DetailRow label="Porte-greffe" value={`${(p.porte_greffes as any)?.code_pg} — ${(p.porte_greffes as any)?.nom_pg || ""}`} />
                </div>
                <Separator />
                <div className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Position & Récolte</p>
                  <DetailRow label="Ligne / Position" value={`L${p.ligne_numero} — P${p.position_ligne}`} />
                  <DetailRow label="Date récolte" value={fmtDate(p.date_recolte)} />
                  <DetailRow label="Récoltant" value={p.recoltant_nom || "—"} />
                </div>
                <Separator />
                <div className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Données de production</p>
                  <DetailRow label="Poids total" value={`${p.poids_total_kg} kg`} />
                  <DetailRow label="Nb fruits" value={p.nb_fruits_total} />
                  <DetailRow label="Poids moyen fruit" value={p.poids_moyen_fruit_g ? `${p.poids_moyen_fruit_g} g` : "—"} />
                  <DetailRow label="Calibre moyen" value={p.calibre_moyen_mm ? `${p.calibre_moyen_mm} mm` : "—"} />
                  <DetailRow label="Qualité globale" value={p.qualite_globale || "—"} />
                  <DetailRow label="Taux déclassement" value={p.taux_declassement_pct != null ? `${p.taux_declassement_pct}%` : "—"} />
                </div>
                {p.observations && (
                  <>
                    <Separator />
                    <div className="rounded-lg border p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-1">Observations</p>
                      <p className="text-sm">{p.observations}</p>
                    </div>
                  </>
                )}
                {p.photo_url && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Photo</p>
                      <img src={p.photo_url} alt={p.photo_legende || "Photo production"} className="rounded-lg max-h-48 object-cover" />
                      {p.photo_legende && <p className="text-xs text-muted-foreground mt-1">{p.photo_legende}</p>}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {viewItem?.type === "qualite" && (() => {
            const a = viewItem.data;
            return (
              <div className="space-y-3">
                <div className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Identification</p>
                  <DetailRow label="Domaine" value={a.domaines?.nom} />
                  <DetailRow label="Campagne" value={a.campagnes?.code_campagne} />
                  <DetailRow label="Date analyse" value={fmtDate(a.date_analyse)} />
                  <DetailRow label="Variété" value={`${a.varietes?.code_variete} ${a.varietes?.nom_commercial ? `(${a.varietes.nom_commercial})` : ""}`} />
                  <DetailRow label="Porte-greffe" value={`${a.porte_greffes?.code_pg} — ${a.porte_greffes?.nom_pg || ""}`} />
                  <DetailRow label="Technicien" value={a.technicien_nom} />
                </div>
                <Separator />
                <div className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Analyse physico-chimique</p>
                  <DetailRow label="Nb fruits échantillon" value={a.nb_fruits_echantillon} />
                  <DetailRow label="Brix" value={`${a.brix_degres}°`} />
                  <DetailRow label="Acidité" value={`${a.acidite_gl} g/L`} />
                  <DetailRow label="Ratio E/A" value={<EaBadgeInline value={a.ratio_ea} />} />
                  <DetailRow label="% Jus" value={a.pct_jus != null ? `${a.pct_jus}%` : "—"} />
                  <DetailRow label="Volume jus" value={a.volume_jus_ml != null ? `${a.volume_jus_ml} mL` : "—"} />
                  <DetailRow label="Poids jus" value={a.poids_jus_g != null ? `${a.poids_jus_g} g` : "—"} />
                  <DetailRow label="Volume NaOH" value={a.volume_naoh_ml != null ? `${a.volume_naoh_ml} mL` : "—"} />
                </div>
                <Separator />
                <div className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Fermeté & Pépins</p>
                  <DetailRow label="Fermeté fruit" value={a.moyenne_fermete_fruit_kg_cm2 != null ? `${a.moyenne_fermete_fruit_kg_cm2} kg/cm²` : "—"} />
                  <DetailRow label="Fermeté peau" value={a.moyenne_fermete_peau_kg_cm2 != null ? `${a.moyenne_fermete_peau_kg_cm2} kg/cm²` : "—"} />
                  <DetailRow label="Pépins total" value={a.nb_pepins_echantillon_total ?? "—"} />
                  <DetailRow label="Fruits avec pépins" value={a.nb_fruits_avec_pepins ?? "—"} />
                  <DetailRow label="Pépins moy/fruit" value={a.moyenne_pepins_par_fruit?.toFixed(1) ?? "—"} />
                </div>
                <Separator />
                <div className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Granulation & Alertes</p>
                  <DetailRow label="Granulation légère" value={a.granulation_legere || "—"} />
                  <DetailRow label="Granulation sévère" value={a.granulation_severe || "—"} />
                  <div className="flex gap-2 flex-wrap mt-2">
                    {a.maturite_optimale && <Badge className="bg-success/20 text-success text-xs">✅ Maturité optimale</Badge>}
                    {a.alerte_ea_faible && <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />E/A faible</Badge>}
                    {a.alerte_brix_hors_norme && <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Brix hors norme</Badge>}
                    {a.alerte_granulation_severe && <Badge className="bg-warning/20 text-warning text-xs">Granulation sévère</Badge>}
                  </div>
                </div>
                {a.observations && (
                  <>
                    <Separator />
                    <div className="rounded-lg border p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-1">Observations</p>
                      <p className="text-sm">{a.observations}</p>
                    </div>
                  </>
                )}
                {a.photo_fruits_coupes_url && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Photo fruits coupés</p>
                      <img src={a.photo_fruits_coupes_url} alt={a.photo_legende || "Photo"} className="rounded-lg max-h-48 object-cover" />
                      {a.photo_legende && <p className="text-xs text-muted-foreground mt-1">{a.photo_legende}</p>}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewItem(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
