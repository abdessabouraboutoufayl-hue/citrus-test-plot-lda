import { useState, useMemo } from "react";
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
import { PlusCircle, Search, Download, Upload, Trash2, Eye, ArrowUpDown, ChevronLeft, ChevronRight, Send, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import * as XLSX from "xlsx";

const statusColors: Record<string, string> = {
  Brouillon: "bg-muted text-muted-foreground",
  Soumis: "bg-info/20 text-info",
  Validé: "bg-success/20 text-success",
  Rejeté: "bg-destructive/20 text-destructive",
};

function EaBadge({ value }: { value: number | null }) {
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

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy", { locale: fr }); } catch { return d; }
}

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

type SortKey = "code" | "pg" | "date" | "brix" | "acidite" | "ea" | "pct_jus" | "pepins" | "statut";
type SortDir = "asc" | "desc";

export default function QualiteList() {
  const { userInfo } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("all");
  const [moisFilter, setMoisFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [viewItem, setViewItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<any>(null);

  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ["qualite-list", userInfo.domaineId],
    queryFn: async () => {
      let query = supabase
        .from("qualite_interne")
        .select("*, varietes(code_variete, nom_commercial), porte_greffes(code_pg), domaines(nom, code)")
        .order("created_at", { ascending: false });
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
      const { error } = await supabase.from("qualite_interne").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qualite-list"] });
      toast.success("Analyse supprimée");
      setDeleteItem(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const submitMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("qualite_interne").update({ statut_validation: "Soumis" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qualite-list"] });
      toast.success("Analyse soumise pour validation");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const canDelete = (a: any) => {
    if (userInfo.role === "direction") return false;
    if (userInfo.role === "responsable_central") return a.statut_validation === "Brouillon";
    return a.statut_validation === "Brouillon";
  };

  const canModify = (a: any) => {
    if (userInfo.role === "direction") return false;
    if (userInfo.role === "responsable_central") return a.statut_validation === "Brouillon" || a.statut_validation === "Rejeté";
    return a.statut_validation === "Brouillon" || a.statut_validation === "Rejeté";
  };

  const canSubmit = (a: any) => {
    if (userInfo.role === "direction") return false;
    return a.statut_validation === "Brouillon" || a.statut_validation === "Rejeté";
  };

  // Filtering
  const filtered = useMemo(() => {
    return analyses.filter((a: any) => {
      // Search
      if (search) {
        const s = search.toLowerCase();
        const match = (a.varietes as any)?.code_variete?.toLowerCase().includes(s) ||
          (a.varietes as any)?.nom_commercial?.toLowerCase().includes(s) ||
          a.technicien_nom?.toLowerCase().includes(s) ||
          (a.porte_greffes as any)?.code_pg?.toLowerCase().includes(s);
        if (!match) return false;
      }
      // Statut
      if (statutFilter !== "all" && a.statut_validation !== statutFilter) return false;
      // Mois
      if (moisFilter !== "all") {
        const m = new Date(a.date_analyse).getMonth() + 1;
        if (m !== parseInt(moisFilter)) return false;
      }
      return true;
    });
  }, [analyses, search, statutFilter, moisFilter]);

  // Sorting
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a: any, b: any) => {
      let va: any, vb: any;
      switch (sortKey) {
        case "code": va = (a.varietes as any)?.code_variete || ""; vb = (b.varietes as any)?.code_variete || ""; break;
        case "pg": va = (a.porte_greffes as any)?.code_pg || ""; vb = (b.porte_greffes as any)?.code_pg || ""; break;
        case "date": va = a.date_analyse || ""; vb = b.date_analyse || ""; break;
        case "brix": va = a.brix_degres ?? 0; vb = b.brix_degres ?? 0; break;
        case "acidite": va = a.acidite_gl ?? 0; vb = b.acidite_gl ?? 0; break;
        case "ea": va = a.ratio_ea ?? 0; vb = b.ratio_ea ?? 0; break;
        case "pct_jus": va = a.pct_jus ?? 0; vb = b.pct_jus ?? 0; break;
        case "pepins": va = a.moyenne_pepins_par_fruit ?? 0; vb = b.moyenne_pepins_par_fruit ?? 0; break;
        case "statut": va = a.statut_validation || ""; vb = b.statut_validation || ""; break;
        default: va = a.date_analyse || ""; vb = b.date_analyse || "";
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

  // Reset page when filters change
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
    const rows = filtered.map((a: any) => ({
      Domaine: (a.domaines as any)?.nom,
      "Code Variété": (a.varietes as any)?.code_variete,
      "Nom Variété": (a.varietes as any)?.nom_commercial,
      PG: (a.porte_greffes as any)?.code_pg,
      "Date Analyse": a.date_analyse,
      "Nb Échantillon": a.nb_fruits_echantillon,
      "% Jus": a.pct_jus,
      "Poids Jus (g)": a.poids_jus_g,
      "Volume Jus (mL)": a.volume_jus_ml,
      "Brix (°)": a.brix_degres,
      "Acidité (g/L)": a.acidite_gl,
      "NaOH (mL)": a.volume_naoh_ml,
      "E/A": a.ratio_ea,
      "Pépins Total": a.nb_pepins_echantillon_total,
      "Moy Pépins/Fruit": a.moyenne_pepins_par_fruit,
      "Fruits avec Pépins": a.nb_fruits_avec_pepins,
      "Fermeté Peau": a.moyenne_fermete_peau_kg_cm2,
      "Fermeté Fruit": a.moyenne_fermete_fruit_kg_cm2,
      "Granulation Sévère": a.granulation_severe,
      "Granulation Légère": a.granulation_legere,
      Technicien: a.technicien_nom,
      Statut: a.statut_validation,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[addr]) ws[addr].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2E7D32" } } };
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Qualité");
    XLSX.writeFile(wb, `Qualite_Interne_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Export Excel téléchargé");
  };

  return (
    <div className="space-y-4">
      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Qualité Interne</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/qualite/import"><Upload className="h-4 w-4 mr-1" /> Import</Link>
          </Button>
          <Button onClick={exportExcel} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          {userInfo.role !== "direction" && (
            <Button asChild size="sm">
              <Link to="/qualite/new"><PlusCircle className="h-4 w-4 mr-1" /> Nouvelle</Link>
            </Button>
          )}
        </div>
      </div>

      {/* ═══ FILTERS ═══ */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher code, technicien..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
              <SortHeader label="Code" k="code" />
              <SortHeader label="PG" k="pg" />
              <SortHeader label="Date" k="date" />
              <SortHeader label="Brix (°)" k="brix" className="text-right" />
              <SortHeader label="Acidité (g/L)" k="acidite" className="text-right" />
              <SortHeader label="E/A" k="ea" />
              <SortHeader label="% Jus" k="pct_jus" className="text-right" />
              <SortHeader label="Pépins moy" k="pepins" className="text-right" />
              <SortHeader label="Statut" k="statut" />
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : paginated.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Aucune analyse</TableCell></TableRow>
            ) : (
              paginated.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium"><Badge variant="outline">{(a.varietes as any)?.code_variete}</Badge></TableCell>
                  <TableCell>{(a.porte_greffes as any)?.code_pg}</TableCell>
                  <TableCell>{fmtDate(a.date_analyse)}</TableCell>
                  <TableCell className="text-right">{a.brix_degres?.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{a.acidite_gl?.toFixed(2)}</TableCell>
                  <TableCell><EaBadge value={a.ratio_ea} /></TableCell>
                  <TableCell className="text-right">{a.pct_jus != null ? Math.round(a.pct_jus) : "-"}</TableCell>
                  <TableCell className="text-right">{a.moyenne_pepins_par_fruit?.toFixed(1) ?? "-"}</TableCell>
                  <TableCell><Badge className={statusColors[a.statut_validation || "Brouillon"]}>{a.statut_validation}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewItem(a)} title="Consulter">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canSubmit(a) && (
                        <Button variant="ghost" size="icon" onClick={() => submitMutation.mutate(a.id)} title="Soumettre" disabled={submitMutation.isPending}>
                          <Send className="h-4 w-4 text-success" />
                        </Button>
                      )}
                      {canModify(a) && (
                        <Button variant="ghost" size="icon" asChild title="Modifier">
                          <Link to={`/qualite/edit/${a.id}`}><Pencil className="h-4 w-4 text-primary" /></Link>
                        </Button>
                      )}
                      {canDelete(a) && (
                        <Button variant="ghost" size="icon" onClick={() => setDeleteItem(a)} title="Supprimer">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ═══ MOBILE CARDS ═══ */}
      <div className="md:hidden space-y-3">
        {paginated.map((a: any) => (
          <Card key={a.id} className="cursor-pointer" onClick={() => setViewItem(a)}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{(a.varietes as any)?.code_variete}</p>
                  <p className="text-xs text-muted-foreground">{(a.porte_greffes as any)?.code_pg} • {fmtDate(a.date_analyse)}</p>
                </div>
                <Badge className={statusColors[a.statut_validation || "Brouillon"]}>{a.statut_validation}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><span className="text-muted-foreground">Brix</span><br />{a.brix_degres?.toFixed(1)}°</div>
                <div><span className="text-muted-foreground">E/A</span><br /><EaBadge value={a.ratio_ea} /></div>
                <div><span className="text-muted-foreground">% Jus</span><br />{a.pct_jus != null ? Math.round(a.pct_jus) : "-"}</div>
              </div>
              <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                {canSubmit(a) && (
                  <Button variant="ghost" size="sm" onClick={() => submitMutation.mutate(a.id)} disabled={submitMutation.isPending}>
                    <Send className="h-3.5 w-3.5 mr-1 text-success" /> Soumettre
                  </Button>
                )}
                {canModify(a) && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/qualite/edit/${a.id}`}><Pencil className="h-3.5 w-3.5 mr-1" /> Modifier</Link>
                  </Button>
                )}
                {canDelete(a) && (
                  <Button variant="ghost" size="sm" onClick={() => setDeleteItem(a)}>
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
            <DialogTitle>Détails Analyse Qualité</DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-4">
              {/* Identification */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Identification</h3>
                <DetailRow label="Code variété" value={<Badge variant="outline">{(viewItem.varietes as any)?.code_variete}</Badge>} />
                <DetailRow label="Nom commercial" value={(viewItem.varietes as any)?.nom_commercial} />
                <DetailRow label="Porte-greffe" value={(viewItem.porte_greffes as any)?.code_pg} />
                <DetailRow label="Date analyse" value={fmtDate(viewItem.date_analyse)} />
                <DetailRow label="Mois" value={viewItem.mois_analyse ? MONTHS[viewItem.mois_analyse - 1] : "—"} />
                <DetailRow label="Nb fruits échantillon" value={viewItem.nb_fruits_echantillon} />
              </div>
              <Separator />

              {/* Jus */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Jus</h3>
                <DetailRow label="% Jus" value={viewItem.pct_jus != null ? `${viewItem.pct_jus}%` : null} />
                <DetailRow label="Poids jus (g)" value={viewItem.poids_jus_g} />
                <DetailRow label="Volume jus (mL)" value={viewItem.volume_jus_ml} />
              </div>
              <Separator />

              {/* Chimique */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Analyse chimique</h3>
                <DetailRow label="Brix (°)" value={viewItem.brix_degres?.toFixed(1)} />
                <DetailRow label="Acidité (g/L)" value={viewItem.acidite_gl?.toFixed(2)} />
                <DetailRow label="Volume NaOH (mL)" value={viewItem.volume_naoh_ml} />
                <DetailRow label="Ratio E/A" value={<EaBadge value={viewItem.ratio_ea} />} />
              </div>
              <Separator />

              {/* Pépins */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Pépins</h3>
                <DetailRow label="Total pépins" value={viewItem.nb_pepins_echantillon_total} />
                <DetailRow label="Moyenne / fruit" value={viewItem.moyenne_pepins_par_fruit?.toFixed(1)} />
                <DetailRow label="Fruits avec pépins" value={viewItem.nb_fruits_avec_pepins} />
              </div>
              <Separator />

              {/* Fermeté */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Fermeté</h3>
                <DetailRow label="Peau (kg/cm²)" value={viewItem.moyenne_fermete_peau_kg_cm2} />
                <DetailRow label="Fruit (kg/cm²)" value={viewItem.moyenne_fermete_fruit_kg_cm2} />
              </div>
              <Separator />

              {/* Granulation */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Granulation</h3>
                <DetailRow label="Sévère" value={viewItem.granulation_severe || "—"} />
                <DetailRow label="Légère" value={viewItem.granulation_legere || "—"} />
              </div>

              {/* Photo */}
              {viewItem.photo_fruits_coupes_url && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">Photo fruits coupés</h3>
                    <img src={viewItem.photo_fruits_coupes_url} alt="Fruits coupés" className="rounded-md max-h-48 w-auto" />
                    {viewItem.photo_legende && <p className="text-xs text-muted-foreground mt-1">{viewItem.photo_legende}</p>}
                  </div>
                </>
              )}

              <Separator />
              {/* Infos complémentaires */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Informations</h3>
                <DetailRow label="Technicien" value={viewItem.technicien_nom} />
                <DetailRow label="Observations" value={viewItem.observations || "—"} />
              </div>
              <Separator />

              {/* Workflow */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Workflow</h3>
                <DetailRow label="Statut" value={<Badge className={statusColors[viewItem.statut_validation || "Brouillon"]}>{viewItem.statut_validation}</Badge>} />
                <DetailRow label="Commentaires" value={viewItem.commentaires_validation || "—"} />
              </div>
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
                <Link to={`/qualite/edit/${viewItem.id}`}><Pencil className="h-4 w-4 mr-1" /> Modifier</Link>
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
              Supprimer l'analyse {(deleteItem?.varietes as any)?.code_variete} - {(deleteItem?.porte_greffes as any)?.code_pg} du {deleteItem ? fmtDate(deleteItem.date_analyse) : ""} ?
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
