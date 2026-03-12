import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PlusCircle, Search, Download, Upload, Trash2, Send, Eye, Pencil, ArrowUpDown, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import * as XLSX from "xlsx-js-style";
import { getCalibreType, getCalibreEntries, NB_ECHANTILLON, type CalibreType } from "@/lib/calibre-config";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { getCalibreColor } from "@/lib/calibre-config";

const statusColors: Record<string, string> = {
  Brouillon: "bg-muted text-muted-foreground",
  Soumis: "bg-info/20 text-info",
  Validé: "bg-success/20 text-success",
  Rejeté: "bg-destructive/20 text-destructive",
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{value ?? "—"}</span>
    </div>
  );
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy", { locale: fr }); } catch { return d; }
}

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

type SortKey = "arbre" | "variete" | "pg" | "poids" | "fruits" | "poids_moy" | "date" | "statut";
type SortDir = "asc" | "desc";

export default function ProductionList() {
  const { userInfo } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("all");
  const [campagneFilter, setCampagneFilter] = useState("all");
  const [moisFilter, setMoisFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [viewItem, setViewItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<any>(null);

  const canSubmit = (p: any) => {
    if (userInfo.role === "direction") return false;
    return p.statut_validation === "Brouillon" || p.statut_validation === "Rejeté";
  };
  const canModify = (p: any) => {
    if (userInfo.role === "direction") return false;
    return p.statut_validation === "Brouillon" || p.statut_validation === "Rejeté";
  };
  const canDelete = (p: any) => {
    if (userInfo.role === "direction") return false;
    return p.statut_validation === "Brouillon";
  };

  const { data: productions = [], isLoading } = useQuery({
    queryKey: ["productions", userInfo.domaineId],
    queryFn: async () => {
      let query = supabase
        .from("production")
        .select("*, varietes(code_variete, nom_commercial), porte_greffes(code_pg), domaines(nom, code), campagnes(code_campagne)")
        .order("domaine_id", { ascending: true })
        .order("variete_id", { ascending: true })
        .order("porte_greffe_id", { ascending: true })
        .order("ligne_numero", { ascending: true })
        .order("position_ligne", { ascending: true });
      if (userInfo.role === "responsable_domaine" && userInfo.domaineId) {
        query = query.eq("domaine_id", userInfo.domaineId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("production").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productions"] });
      toast.success("Production supprimée");
      setDeleteItem(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const submitMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("production").update({ statut_validation: "Soumis" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productions"] });
      toast.success("Production soumise pour validation");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Filtering
  const filtered = useMemo(() => {
    return productions.filter((p: any) => {
      if (search) {
        const s = search.toLowerCase();
        const match = p.code_arbre?.toLowerCase().includes(s) ||
          (p.varietes as any)?.code_variete?.toLowerCase().includes(s) ||
          (p.varietes as any)?.nom_commercial?.toLowerCase().includes(s);
        if (!match) return false;
      }
      if (statutFilter !== "all" && p.statut_validation !== statutFilter) return false;
      if (moisFilter !== "all") {
        const m = new Date(p.date_recolte).getMonth() + 1;
        if (m !== parseInt(moisFilter)) return false;
      }
      return true;
    });
  }, [productions, search, statutFilter, moisFilter]);

  // Sorting
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a: any, b: any) => {
      let va: any, vb: any;
      switch (sortKey) {
        case "arbre": va = a.code_arbre || ""; vb = b.code_arbre || ""; break;
        case "variete": va = (a.varietes as any)?.code_variete || ""; vb = (b.varietes as any)?.code_variete || ""; break;
        case "pg": va = (a.porte_greffes as any)?.code_pg || ""; vb = (b.porte_greffes as any)?.code_pg || ""; break;
        case "poids": va = a.poids_total_kg ?? 0; vb = b.poids_total_kg ?? 0; break;
        case "fruits": va = a.nb_fruits_total ?? 0; vb = b.nb_fruits_total ?? 0; break;
        case "poids_moy": va = a.poids_moyen_fruit_g ?? 0; vb = b.poids_moyen_fruit_g ?? 0; break;
        case "date": va = a.date_recolte || ""; vb = b.date_recolte || ""; break;
        case "statut": va = a.statut_validation || ""; vb = b.statut_validation || ""; break;
        default: va = a.date_recolte || ""; vb = b.date_recolte || "";
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const paginated = sorted.slice((page - 1) * perPage, page * perPage);
  useMemo(() => { setPage(1); }, [search, statutFilter, moisFilter]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortHeader = ({ label, k, className }: { label: string; k: SortKey; className?: string }) => (
    <TableHead className={`cursor-pointer select-none ${className || ""}`} onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      </span>
    </TableHead>
  );

  const exportExcel = () => {
    const rows = filtered.map((p: any) => ({
      Domaine: (p.domaines as any)?.nom,
      "Code Domaine": (p.domaines as any)?.code,
      Arbre: p.code_arbre,
      Variété: (p.varietes as any)?.code_variete,
      "Nom commercial": (p.varietes as any)?.nom_commercial,
      PG: (p.porte_greffes as any)?.code_pg,
      Ligne: p.ligne_numero,
      Position: p.position_ligne,
      "Date récolte": p.date_recolte,
      "Poids (kg)": p.poids_total_kg,
      Fruits: p.nb_fruits_total,
      "Poids moy (g)": p.poids_moyen_fruit_g,
      "Calibre (mm)": p.calibre_moyen_mm,
      "Décl %": p.taux_declassement_pct,
      Qualité: p.qualite_globale,
      "Statut arbre": p.arbre_statut,
      Statut: p.statut_validation,
      Récoltant: p.recoltant_nom,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[addr]) ws[addr].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2E7D32" } } };
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Production");
    XLSX.writeFile(wb, `Production_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Export Excel téléchargé");
  };

  return (
    <div className="space-y-4">
      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Productions</h1>
        <div className="flex gap-2">
          <Button onClick={exportExcel} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          {userInfo.role !== "direction" && (
            <Button asChild size="sm">
              <Link to="/production/saisie-par-variete"><PlusCircle className="h-4 w-4 mr-1" /> Nouvelle</Link>
            </Button>
          )}
        </div>
      </div>

      {/* ═══ FILTERS ═══ */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="Brouillon">Brouillon</SelectItem>
            <SelectItem value="Soumis">Soumis</SelectItem>
            <SelectItem value="Validé">Validé</SelectItem>
            <SelectItem value="Rejeté">Rejeté</SelectItem>
          </SelectContent>
        </Select>
        <Select value={moisFilter} onValueChange={setMoisFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Mois" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous mois</SelectItem>
            {MONTHS.map((m, i) => (
              <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ═══ DESKTOP TABLE ═══ */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Arbre" k="arbre" />
              <SortHeader label="Variété" k="variete" />
              <SortHeader label="PG" k="pg" />
              <SortHeader label="Poids (kg)" k="poids" className="text-right" />
              <SortHeader label="Fruits" k="fruits" className="text-right" />
              <SortHeader label="Poids moy (g)" k="poids_moy" className="text-right" />
              <SortHeader label="Date" k="date" />
              <SortHeader label="Statut" k="statut" />
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : paginated.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucune production</TableCell></TableRow>
            ) : (
              (() => {
                // Group paginated items by combo (variete + PG)
                const comboRows: { comboKey: string; code: string; pg: string; domaineName: string; hasCalibre: boolean; items: any[] }[] = [];
                let lastCombo = "";
                for (const p of paginated) {
                  const code = (p.varietes as any)?.code_variete || "?";
                  const pg = (p.porte_greffes as any)?.code_pg || "?";
                  const domCode = (p.domaines as any)?.code || "?";
                  const domNom = (p.domaines as any)?.nom || domCode;
                  const key = `${p.domaine_id}-${code}-${pg}`;
                  if (key !== lastCombo) {
                    const hasCal = p.cal_0 != null || p.cal_1xxx != null || p.cal_1xx != null || p.cal_2 != null;
                    comboRows.push({ comboKey: key, code, pg, domaineName: domNom, hasCalibre: hasCal, items: [] });
                    lastCombo = key;
                  }
                  comboRows[comboRows.length - 1].items.push(p);
                }
                return comboRows.map(group => (
                  <React.Fragment key={group.comboKey}>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={9} className="py-1.5">
                        <span className="font-semibold text-sm">
                          📊 {group.domaineName} — {group.code}-{group.pg} ({group.items.length} arbres)
                          {group.hasCalibre && <Badge variant="secondary" className="ml-2 text-xs">Profil calibre ✓</Badge>}
                        </span>
                      </TableCell>
                    </TableRow>
                    {group.items.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.code_arbre}</TableCell>
                        <TableCell><Badge variant="outline">{(p.varietes as any)?.code_variete}</Badge></TableCell>
                        <TableCell>{(p.porte_greffes as any)?.code_pg}</TableCell>
                        <TableCell className="text-right">{p.poids_total_kg}</TableCell>
                        <TableCell className="text-right">{p.nb_fruits_total}</TableCell>
                        <TableCell className="text-right">{p.poids_moyen_fruit_g?.toFixed(1)}</TableCell>
                        <TableCell>{fmtDate(p.date_recolte)}</TableCell>
                        <TableCell><Badge className={statusColors[p.statut_validation || "Brouillon"]}>{p.statut_validation}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setViewItem(p)} title="Consulter">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canSubmit(p) && (
                              <Button variant="ghost" size="icon" onClick={() => submitMutation.mutate(p.id)} title="Soumettre" disabled={submitMutation.isPending}>
                                <Send className="h-4 w-4 text-success" />
                              </Button>
                            )}
                            {canModify(p) && (
                              <Button variant="ghost" size="icon" asChild title="Modifier">
                                <Link to={`/production/edit/${p.id}`}><Pencil className="h-4 w-4 text-primary" /></Link>
                              </Button>
                            )}
                            {canDelete(p) && (
                              <Button variant="ghost" size="icon" onClick={() => setDeleteItem(p)} title="Supprimer">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ));
              })()
            )}
          </TableBody>
        </Table>
      </div>

      {/* ═══ MOBILE CARDS ═══ */}
      <div className="md:hidden space-y-3">
        {paginated.map((p: any) => (
          <Card key={p.id} className="cursor-pointer" onClick={() => setViewItem(p)}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{p.code_arbre}</p>
                  <p className="text-xs text-muted-foreground">{(p.varietes as any)?.nom_commercial}</p>
                </div>
                <Badge className={statusColors[p.statut_validation || "Brouillon"]}>{p.statut_validation}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><span className="text-muted-foreground">Poids</span><br />{p.poids_total_kg} kg</div>
                <div><span className="text-muted-foreground">Fruits</span><br />{p.nb_fruits_total}</div>
                <div><span className="text-muted-foreground">Qualité</span><br />{p.qualite_globale || "-"}</div>
              </div>
              <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                {canSubmit(p) && (
                  <Button variant="ghost" size="sm" onClick={() => submitMutation.mutate(p.id)} disabled={submitMutation.isPending}>
                    <Send className="h-3.5 w-3.5 mr-1 text-success" /> Soumettre
                  </Button>
                )}
                {canModify(p) && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/production/edit/${p.id}`}><Pencil className="h-3.5 w-3.5 mr-1" /> Modifier</Link>
                  </Button>
                )}
                {canDelete(p) && (
                  <Button variant="ghost" size="sm" onClick={() => setDeleteItem(p)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1 text-destructive" /> Supprimer
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ═══ PAGINATION FOOTER ═══ */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{sorted.length} résultats</span>
          <span>•</span>
          <span>Afficher</span>
          <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
            <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span>par page</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" /> Précédent
          </Button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 2, totalPages - 4));
            const n = start + i;
            if (n > totalPages) return null;
            return (
              <Button key={n} variant={n === page ? "default" : "outline"} size="sm" className="w-8 h-8 p-0" onClick={() => setPage(n)}>
                {n}
              </Button>
            );
          })}
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Suivant <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ═══ DETAIL MODAL ═══ */}
      <Dialog open={!!viewItem} onOpenChange={(open) => !open && setViewItem(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails Production</DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Identification</h3>
                <DetailRow label="Code arbre" value={viewItem.code_arbre} />
                <DetailRow label="Variété" value={<Badge variant="outline">{(viewItem.varietes as any)?.code_variete}</Badge>} />
                <DetailRow label="Nom commercial" value={(viewItem.varietes as any)?.nom_commercial} />
                <DetailRow label="Porte-greffe" value={(viewItem.porte_greffes as any)?.code_pg} />
                <DetailRow label="Domaine" value={(viewItem.domaines as any)?.nom} />
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Position</h3>
                <DetailRow label="Ligne" value={viewItem.ligne_numero} />
                <DetailRow label="Position" value={viewItem.position_ligne} />
                <DetailRow label="Statut arbre" value={viewItem.arbre_statut} />
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Récolte</h3>
                <DetailRow label="Date récolte" value={fmtDate(viewItem.date_recolte)} />
                <DetailRow label="Poids total (kg)" value={viewItem.poids_total_kg} />
                <DetailRow label="Nb fruits" value={viewItem.nb_fruits_total} />
                <DetailRow label="Poids moyen (g)" value={viewItem.poids_moyen_fruit_g?.toFixed(1)} />
                <DetailRow label="Calibre moyen (mm)" value={viewItem.calibre_moyen_mm} />
                <DetailRow label="Taux déclassement (%)" value={viewItem.taux_declassement_pct} />
                <DetailRow label="Qualité globale" value={viewItem.qualite_globale} />
              </div>
              {viewItem.photo_url && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">Photo</h3>
                    <img src={viewItem.photo_url} alt="Production" className="rounded-md max-h-48 w-auto" />
                    {viewItem.photo_legende && <p className="text-xs text-muted-foreground mt-1">{viewItem.photo_legende}</p>}
                  </div>
                </>
              )}
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Informations</h3>
                <DetailRow label="Récoltant" value={viewItem.recoltant_nom} />
                <DetailRow label="Observations" value={viewItem.observations || "—"} />
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Workflow</h3>
                <DetailRow label="Statut" value={<Badge className={statusColors[viewItem.statut_validation || "Brouillon"]}>{viewItem.statut_validation}</Badge>} />
                <DetailRow label="Commentaires" value={viewItem.commentaires_validation || "—"} />
              </div>
              {/* ═══ CALIBRE SECTION ═══ */}
              {(() => {
                const code = (viewItem.varietes as any)?.code_variete;
                const pg = (viewItem.porte_greffes as any)?.code_pg;
                const calType = code ? getCalibreType(code) : null;
                const entries = getCalibreEntries(calType);
                const hasData = entries.some(e => (viewItem as any)[e.dbColumn] > 0);
                if (!hasData) return null;
                const chartData = entries
                  .map(e => ({
                    calibre: `${e.label} (${e.range})`,
                    nb: (viewItem as any)[e.dbColumn] || 0,
                    pct: Math.round(((viewItem as any)[e.dbColumn] || 0) / NB_ECHANTILLON * 100),
                  }))
                  .filter(d => d.nb > 0);
                return (
                  <>
                    <Separator />
                    <Collapsible defaultOpen>
                      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
                        <h3 className="text-sm font-semibold text-muted-foreground">📏 Profil Calibre ({NB_ECHANTILLON} fruits)</h3>
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
          )}
          <DialogFooter className="flex gap-2 sm:gap-0">
            {viewItem && canSubmit(viewItem) && (
              <Button onClick={() => { submitMutation.mutate(viewItem.id); setViewItem(null); }} className="bg-success hover:bg-success/90 text-success-foreground" disabled={submitMutation.isPending}>
                <Send className="h-4 w-4 mr-1" /> Soumettre
              </Button>
            )}
            {viewItem && canModify(viewItem) && (
              <Button variant="outline" asChild>
                <Link to={`/production/edit/${viewItem.id}`}><Pencil className="h-4 w-4 mr-1" /> Modifier</Link>
              </Button>
            )}
            {viewItem && canDelete(viewItem) && (
              <Button variant="destructive" onClick={() => { setViewItem(null); setDeleteItem(viewItem); }}>
                Supprimer
              </Button>
            )}
            <Button variant="outline" onClick={() => setViewItem(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ DELETE CONFIRMATION ═══ */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer la production {deleteItem?.code_arbre} du {deleteItem ? fmtDate(deleteItem.date_recolte) : ""} ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
