import { useState, useMemo } from "react";
import { getCalibreType, getCalibreEntries, NB_ECHANTILLON, getCalibreColor } from "@/lib/calibre-config";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, Bell, AlertTriangle, Eye, ChevronDown, MapPin, Filter, ShieldAlert, ShieldCheck } from "lucide-react";
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

type NiveauAlerte = "ok" | "mineur" | "attention" | "critique";

function NiveauBadge({ niveau }: { niveau: NiveauAlerte | string | null }) {
  switch (niveau) {
    case "critique": return <Badge variant="destructive" className="text-xs">🔴 Critique</Badge>;
    case "attention": return <Badge className="bg-orange-500/20 text-orange-600 dark:text-orange-400 text-xs">🟠 Attention</Badge>;
    case "mineur": return <Badge className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-xs">🟡 Mineur</Badge>;
    default: return <Badge className="bg-success/20 text-success text-xs">✅ OK</Badge>;
  }
}

const REJECT_REASONS = [
  "Poids incohérent",
  "Nombre fruits aberrant",
  "Données incomplètes",
  "Photo manquante/floue",
  "Vérifier mesure",
  "Autre",
];

export default function Validation() {
  const { user, userInfo } = useAuth();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [rejectIds, setRejectIds] = useState<number[]>([]);
  const [rejectType, setRejectType] = useState<"production" | "qualite">("production");
  const [rejectReasons, setRejectReasons] = useState<string[]>([]);
  const [rejectComment, setRejectComment] = useState("");
  const [viewItem, setViewItem] = useState<{ type: "production" | "qualite"; data: any } | null>(null);
  const [filterDomaine, setFilterDomaine] = useState<string>("all");
  const [filterAlertes, setFilterAlertes] = useState(false);
  const [openDomaines, setOpenDomaines] = useState<Set<string>>(new Set());

  // ─── Queries ───
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

  // ─── Mutations ───
  const validateProdMutation = useMutation({
    mutationFn: async ({ ids, status, comment }: { ids: number[]; status: string; comment?: string }) => {
      const { error } = await supabase.from("production")
        .update({ statut_validation: status, commentaires_validation: comment || null })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["pending-validation-prod"] });
      setSelectedIds(new Set());
      toast.success(vars.status === "Validé" ? `${vars.ids.length} production(s) validée(s)` : `${vars.ids.length} production(s) rejetée(s)`);
    },
  });

  const validateQualiteMutation = useMutation({
    mutationFn: async ({ id, status, comment }: { id: number; status: string; comment?: string }) => {
      const { error } = await supabase.from("qualite_interne")
        .update({ statut_validation: status, commentaires_validation: comment || null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["pending-validation-qualite"] });
      toast.success(vars.status === "Validé" ? "Analyse validée" : "Analyse rejetée");
    },
  });

  // ─── Reject handler ───
  const handleReject = () => {
    if (rejectIds.length === 0) return;
    const reasonText = [...rejectReasons, rejectComment].filter(Boolean).join(" | ");
    if (rejectType === "qualite") {
      // Reject each qualité item individually
      rejectIds.forEach(id => {
        validateQualiteMutation.mutate({ id, status: "Rejeté", comment: reasonText });
      });
    } else {
      validateProdMutation.mutate({ ids: rejectIds, status: "Rejeté", comment: reasonText });
    }
    setRejectIds([]);
    setRejectReasons([]);
    setRejectComment("");
  };

  // ─── Permissions ───
  const isCentral = userInfo.role === "responsable_central";
  const isResponsableDomaine = userInfo.role === "responsable_domaine";

  // ─── Filtered production data ───
  const filteredProd = useMemo(() => {
    let items = pendingProd;
    if (filterDomaine !== "all") items = items.filter(p => String((p.domaines as any)?.nom) === filterDomaine);
    if (filterAlertes) items = items.filter(p => ["attention", "critique"].includes((p as any).niveau_alerte));
    return items;
  }, [pendingProd, filterDomaine, filterAlertes]);

  // ─── KPI ───
  const kpi = useMemo(() => {
    const total = pendingProd.length;
    const withAlertes = pendingProd.filter(p => ["attention", "critique"].includes((p as any).niveau_alerte)).length;
    const okCount = pendingProd.filter(p => ["ok", "mineur"].includes((p as any).niveau_alerte || "ok")).length;
    const domaines = new Set(pendingProd.map(p => (p.domaines as any)?.nom)).size;
    return { total, withAlertes, okCount, domaines };
  }, [pendingProd]);

  // ─── Group by domaine ───
  const groupedProd = useMemo(() => {
    const groups: Record<string, typeof filteredProd> = {};
    filteredProd.forEach(p => {
      const nom = (p.domaines as any)?.nom || "Inconnu";
      if (!groups[nom]) groups[nom] = [];
      groups[nom].push(p);
    });
    return groups;
  }, [filteredProd]);

  const groupedQualite: Record<string, any[]> = {};
  pendingQualite.forEach((a: any) => {
    const nom = a.domaines?.nom || "Inconnu";
    if (!groupedQualite[nom]) groupedQualite[nom] = [];
    groupedQualite[nom].push(a);
  });

  // ─── Selection helpers ───
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProd.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProd.map(p => p.id)));
    }
  };

  const toggleSelectDomaine = (items: typeof filteredProd) => {
    const ids = items.map(p => p.id);
    const allSelected = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const toggleDomaine = (nom: string) => {
    setOpenDomaines(prev => {
      const next = new Set(prev);
      if (next.has(nom)) next.delete(nom); else next.add(nom);
      return next;
    });
  };

  const uniqueDomaines = [...new Set(pendingProd.map(p => (p.domaines as any)?.nom || "Inconnu"))];

  if (!isCentral && !isResponsableDomaine) {
    return <div className="text-center py-12 text-muted-foreground">Accès réservé aux responsables</div>;
  }

  const getAlertDetails = (p: any) => {
    const alerts: { level: string; message: string }[] = [];
    if (p.alerte_poids_critique) alerts.push({ level: "critique", message: `Poids ${p.poids_total_kg}kg dépasse le seuil critique` });
    if (p.alerte_poids_aberrant) alerts.push({ level: "attention", message: `Poids ${p.poids_total_kg}kg hors plage normale` });
    if (p.alerte_fruits_anormal) alerts.push({ level: "attention", message: `Nb fruits ${p.nb_fruits_total} anormal` });
    if (p.alerte_poids_moyen_anormal) alerts.push({ level: "mineur", message: `Poids moyen fruit ${p.poids_moyen_fruit_g?.toFixed(0)}g anormal` });
    if (p.alerte_declassement_critique) alerts.push({ level: "critique", message: `Déclassement ${p.taux_declassement_pct}% critique` });
    return alerts;
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6 text-warning" />
        <h1 className="text-2xl font-bold">Validation</h1>
      </div>

      <Tabs defaultValue="production">
        <TabsList>
          <TabsTrigger value="production">Production ({pendingProd.length})</TabsTrigger>
          <TabsTrigger value="qualite">Qualité ({pendingQualite.length})</TabsTrigger>
        </TabsList>

        {/* ═══════════ PRODUCTION TAB ═══════════ */}
        <TabsContent value="production" className="space-y-4 mt-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card><CardContent className="pt-4 pb-3 text-center">
              <Bell className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{kpi.total}</p>
              <p className="text-xs text-muted-foreground">Productions à valider</p>
            </CardContent></Card>
            <Card className={kpi.withAlertes > 0 ? "border-destructive/50" : ""}>
              <CardContent className="pt-4 pb-3 text-center">
                <ShieldAlert className={`h-5 w-5 mx-auto mb-1 ${kpi.withAlertes > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                <p className={`text-2xl font-bold ${kpi.withAlertes > 0 ? "text-destructive" : ""}`}>{kpi.withAlertes}</p>
                <p className="text-xs text-muted-foreground">Avec alertes</p>
              </CardContent>
            </Card>
            <Card className={kpi.okCount > 0 ? "border-success/50" : ""}>
              <CardContent className="pt-4 pb-3 text-center">
                <ShieldCheck className="h-5 w-5 mx-auto mb-1 text-success" />
                <p className="text-2xl font-bold text-success">{kpi.okCount}</p>
                <p className="text-xs text-muted-foreground">OK à valider</p>
              </CardContent>
            </Card>
            <Card><CardContent className="pt-4 pb-3 text-center">
              <MapPin className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{kpi.domaines}</p>
              <p className="text-xs text-muted-foreground">Domaines concernés</p>
            </CardContent></Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={filterDomaine} onValueChange={setFilterDomaine}>
                    <SelectTrigger className="w-48 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les domaines</SelectItem>
                      {uniqueDomaines.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={filterAlertes} onCheckedChange={setFilterAlertes} id="filter-alertes" />
                  <Label htmlFor="filter-alertes" className="text-sm cursor-pointer">⚠️ Alertes uniquement</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Batch Actions */}
          {isCentral && filteredProd.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 px-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === filteredProd.length && filteredProd.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm text-muted-foreground">Tout sélectionner</span>
              </div>
              <Button
                size="sm"
                disabled={selectedIds.size === 0 || validateProdMutation.isPending}
                onClick={() => validateProdMutation.mutate({ ids: [...selectedIds], status: "Validé" })}
              >
                <CheckCircle className="h-4 w-4 mr-1" /> Valider sélection ({selectedIds.size})
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={selectedIds.size === 0 || validateProdMutation.isPending}
                onClick={() => { setRejectType("production"); setRejectIds([...selectedIds]); }}
              >
                <XCircle className="h-4 w-4 mr-1" /> Rejeter sélection ({selectedIds.size})
              </Button>
            </div>
          )}

          {/* Accordions by domain */}
          {Object.entries(groupedProd).map(([domaine, items]) => {
            const alertCount = items.filter(p => ["attention", "critique"].includes((p as any).niveau_alerte)).length;
            const critiques = items.filter(p => (p as any).niveau_alerte === "critique");
            const attentions = items.filter(p => (p as any).niveau_alerte === "attention");
            const totalKg = items.reduce((s, p) => s + Number(p.poids_total_kg || 0), 0);
            const isOpen = openDomaines.has(domaine);

            return (
              <Collapsible key={domaine} open={isOpen} onOpenChange={() => toggleDomaine(domaine)}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardContent className="pt-4 pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`} />
                          <span className="font-semibold">{domaine}</span>
                          <Badge variant="outline">{items.length} arbres</Badge>
                          {alertCount > 0 && <Badge variant="destructive" className="text-xs">⚠️ {alertCount} alertes</Badge>}
                        </div>
                        <span className="text-sm text-muted-foreground">{totalKg.toFixed(1)} kg total</span>
                      </div>
                    </CardContent>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <Separator />
                    <div className="p-4 space-y-3">
                      {/* Alert summary box */}
                      {alertCount > 0 && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                          <p className="text-sm font-semibold text-destructive flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4" /> ALERTES DÉTECTÉES
                          </p>
                          {critiques.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-destructive">🔴 CRITIQUES ({critiques.length})</p>
                              {critiques.map(p => (
                                <p key={p.id} className="text-xs text-muted-foreground ml-4">
                                  {p.code_arbre}: {getAlertDetails(p).filter(a => a.level === "critique").map(a => a.message).join(", ")}
                                </p>
                              ))}
                            </div>
                          )}
                          {attentions.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">🟠 ATTENTION ({attentions.length})</p>
                              {attentions.map(p => (
                                <p key={p.id} className="text-xs text-muted-foreground ml-4">
                                  {p.code_arbre}: {getAlertDetails(p).filter(a => a.level === "attention").map(a => a.message).join(", ")}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left">
                              {isCentral && <th className="p-2 w-8"><Checkbox checked={items.every(p => selectedIds.has(p.id))} onCheckedChange={() => toggleSelectDomaine(items)} /></th>}
                              <th className="p-2 w-10">Alerte</th>
                              <th className="p-2">Code arbre</th>
                              <th className="p-2">Poids</th>
                              <th className="p-2">Fruits</th>
                              <th className="p-2 hidden sm:table-cell">Qualité</th>
                              <th className="p-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map(p => (
                              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                                {isCentral && <td className="p-2"><Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} /></td>}
                                <td className="p-2"><NiveauBadge niveau={(p as any).niveau_alerte} /></td>
                                <td className="p-2">
                                  <span className="font-mono font-semibold">{p.code_arbre}</span>
                                  <span className="text-xs text-muted-foreground ml-1">({(p.varietes as any)?.code_variete})</span>
                                </td>
                                <td className="p-2">{p.poids_total_kg} kg</td>
                                <td className="p-2">{p.nb_fruits_total}</td>
                                <td className="p-2 hidden sm:table-cell">{p.qualite_globale || "—"}</td>
                                <td className="p-2 text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewItem({ type: "production", data: p })}>
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    {isCentral && (
                                      <>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-success" onClick={() => validateProdMutation.mutate({ ids: [p.id], status: "Validé" })} disabled={validateProdMutation.isPending}>
                                          <CheckCircle className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { setRejectType("production"); setRejectIds([p.id]); }} disabled={validateProdMutation.isPending}>
                                          <XCircle className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Domain footer stats */}
                      {isCentral && (
                        <div className="flex flex-wrap gap-3 pt-2">
                          <Button size="sm" variant="outline" onClick={() => toggleSelectDomaine(items)}>
                            Sélectionner domaine
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              const okIds = items.filter(p => ["ok", "mineur"].includes((p as any).niveau_alerte || "ok")).map(p => p.id);
                              if (okIds.length > 0) validateProdMutation.mutate({ ids: okIds, status: "Validé" });
                            }}
                            disabled={validateProdMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" /> Valider OK ({items.filter(p => ["ok", "mineur"].includes((p as any).niveau_alerte || "ok")).length})
                          </Button>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
                        <span>Production totale : {totalKg.toFixed(1)} kg</span>
                        <span>Qualité A+B : {items.filter(p => p.qualite_globale === "A" || p.qualite_globale === "B").length}/{items.length}</span>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}

          {filteredProd.length === 0 && <p className="text-center text-muted-foreground py-12">Aucune production en attente</p>}
        </TabsContent>

        {/* ═══════════ QUALITÉ TAB ═══════════ */}
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
                        <div className="flex gap-2 flex-wrap">
                          {a.alerte_ea_faible && <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />E/A faible</Badge>}
                          {a.alerte_brix_hors_norme && <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Brix hors norme</Badge>}
                          {a.maturite_optimale && <Badge className="bg-success/20 text-success text-xs">✅ Maturité optimale</Badge>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setViewItem({ type: "qualite", data: a })}>
                          <Eye className="h-4 w-4 mr-1" /> Consulter
                        </Button>
                        {isCentral && (
                          <>
                            <Button size="sm" onClick={() => validateQualiteMutation.mutate({ id: a.id, status: "Validé" })} disabled={validateQualiteMutation.isPending}>
                              <CheckCircle className="h-4 w-4 mr-1" /> Valider
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => { setRejectType("qualite"); setRejectIds([a.id]); }} disabled={validateQualiteMutation.isPending}>
                              <XCircle className="h-4 w-4 mr-1" /> Rejeter
                            </Button>
                          </>
                        )}
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

      {/* ═══════════ REJECT DIALOG ═══════════ */}
      <Dialog open={rejectIds.length > 0} onOpenChange={() => { setRejectIds([]); setRejectReasons([]); setRejectComment(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter {rejectIds.length > 1 ? `${rejectIds.length} éléments` : "l'élément"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Raisons du rejet</Label>
              {REJECT_REASONS.map(reason => (
                <div key={reason} className="flex items-center gap-2">
                  <Checkbox
                    checked={rejectReasons.includes(reason)}
                    onCheckedChange={(checked) => {
                      setRejectReasons(prev => checked ? [...prev, reason] : prev.filter(r => r !== reason));
                    }}
                  />
                  <span className="text-sm">{reason}</span>
                </div>
              ))}
            </div>
            <Textarea
              placeholder="Commentaire additionnel..."
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectIds([]); setRejectReasons([]); setRejectComment(""); }}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectReasons.length === 0 && !rejectComment.trim()}
            >
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ VIEW DIALOG ═══════════ */}
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
            const alerts = getAlertDetails(p);
            return (
              <div className="space-y-3">
                {/* Alerts section */}
                {alerts.length > 0 && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                    <p className="text-xs font-semibold text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Alertes</p>
                    {alerts.map((a, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        {a.level === "critique" ? "🔴" : a.level === "attention" ? "🟠" : "🟡"} {a.message}
                      </p>
                    ))}
                  </div>
                )}
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
                  <DetailRow label="Niveau alerte" value={<NiveauBadge niveau={(p as any).niveau_alerte} />} />
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
                {/* ═══ CALIBRE SECTION ═══ */}
                {(() => {
                  const code = (p.varietes as any)?.code_variete;
                  const pg = (p.porte_greffes as any)?.code_pg;
                  const calType = code ? getCalibreType(code) : null;
                  const entries = getCalibreEntries(calType);
                  const hasData = entries.some(e => (p as any)[e.dbColumn] > 0);
                  if (!hasData) return null;
                  const chartData = entries
                    .map(e => ({
                      calibre: `${e.label} (${e.range})`,
                      nb: (p as any)[e.dbColumn] || 0,
                      pct: Math.round(((p as any)[e.dbColumn] || 0) / NB_ECHANTILLON * 100),
                    }))
                    .filter(d => d.nb > 0);
                  return (
                    <>
                      <Separator />
                      <Collapsible defaultOpen>
                        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
                          <h3 className="text-xs text-muted-foreground font-semibold">📏 Profil Calibre ({NB_ECHANTILLON} fruits)</h3>
                          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2 space-y-2">
                          <Badge variant="secondary" className="text-xs">ℹ️ Partagé : {code}-{pg}</Badge>
                          <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
                                <XAxis type="number" />
                                <YAxis type="category" dataKey="calibre" width={80} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(value: number, name: string, props: any) => [`${value} fruits (${props.payload.pct}%)`, "Quantité"]} />
                                <Bar dataKey="nb" radius={[0, 4, 4, 0]}>
                                  {chartData.map((_, idx) => (
                                    <Cell key={idx} fill={getCalibreColor(idx, chartData.length)} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </>
                  );
                })()}
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
                </div>
                <Separator />
                <div className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Fermeté & Pépins</p>
                  <DetailRow label="Fermeté fruit" value={a.moyenne_fermete_fruit_kg_cm2 != null ? `${a.moyenne_fermete_fruit_kg_cm2} kg/cm²` : "—"} />
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
