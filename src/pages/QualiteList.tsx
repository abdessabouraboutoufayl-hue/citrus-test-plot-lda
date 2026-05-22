import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qualiteApi } from "@/services/api";
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
import { PlusCircle, Search, Download, Trash2, Eye, ArrowUpDown, ChevronLeft, ChevronRight, Send, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import * as XLSX from "xlsx-js-style";

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
  const [campagneFilter, setCampagneFilter] = useState("all");
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
      const result = await qualiteApi.list({
        domaineId: userInfo.domaineId ?? undefined,
        limit: 2000,
      });
      return result.data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => qualiteApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qualite-list"] });
      toast.success("Analyse supprimée");
      setDeleteItem(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const submitMutation = useMutation({
    mutationFn: (id: number) => qualiteApi.update(id, { statutValidation: "Soumis" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qualite-list"] });
      toast.success("Analyse soumise pour validation");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const canDelete = (a: any) => {
    if (userInfo.role === "direction") return false;
    return a.statutValidation === "Brouillon";
  };
  const canModify = (a: any) => {
    if (userInfo.role === "direction") return false;
    return a.statutValidation === "Brouillon" || a.statutValidation === "Rejeté";
  };
  const canSubmit = (a: any) => {
    if (userInfo.role === "direction") return false;
    return a.statutValidation === "Brouillon" || a.statutValidation === "Rejeté";
  };

  const filtered = useMemo(() => {
    return analyses.filter((a: any) => {
      if (search) {
        const s = search.toLowerCase();
        const match = a.variete?.codeVariete?.toLowerCase().includes(s) ||
          a.variete?.nomCommercial?.toLowerCase().includes(s) ||
          a.technicienNom?.toLowerCase().includes(s) ||
          a.porteGreffe?.codePg?.toLowerCase().includes(s);
        if (!match) return false;
      }
      if (statutFilter !== "all" && a.statutValidation !== statutFilter) return false;
      if (campagneFilter !== "all" && a.campagneId !== parseInt(campagneFilter)) return false;
      if (moisFilter !== "all") {
        const m = new Date(a.dateAnalyse).getMonth() + 1;
        if (m !== parseInt(moisFilter)) return false;
      }
      return true;
    });
  }, [analyses, search, statutFilter, campagneFilter, moisFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a: any, b: any) => {
      let va: any, vb: any;
      switch (sortKey) {
        case "code": va = a.variete?.codeVariete || ""; vb = b.variete?.codeVariete || ""; break;
        case "pg": va = a.porteGreffe?.codePg || ""; vb = b.porteGreffe?.codePg || ""; break;
        case "date": va = a.dateAnalyse || ""; vb = b.dateAnalyse || ""; break;
        case "brix": va = Number(a.brixDegres) ?? 0; vb = Number(b.brixDegres) ?? 0; break;
        case "acidite": va = Number(a.aciditeGl) ?? 0; vb = Number(b.aciditeGl) ?? 0; break;
        case "ea": va = Number(a.ratioEa) ?? 0; vb = Number(b.ratioEa) ?? 0; break;
        case "pct_jus": va = Number(a.pctJus) ?? 0; vb = Number(b.pctJus) ?? 0; break;
        case "pepins": va = Number(a.moyennePepinsParFruit) ?? 0; vb = Number(b.moyennePepinsParFruit) ?? 0; break;
        case "statut": va = a.statutValidation || ""; vb = b.statutValidation || ""; break;
        default: va = a.dateAnalyse || ""; vb = b.dateAnalyse || "";
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const paginated = sorted.slice((page - 1) * perPage, page * perPage);
  useMemo(() => { setPage(1); }, [search, statutFilter, campagneFilter, moisFilter]);

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
      Domaine: a.domaine?.nom,
      "Code Variété": a.variete?.codeVariete,
      "Nom Variété": a.variete?.nomCommercial,
      PG: a.porteGreffe?.codePg,
      "Date Analyse": a.dateAnalyse,
      "Nb Échantillon": a.nbFruitsEchantillon,
      "% Jus": Number(a.pctJus),
      "Poids Jus (g)": Number(a.poidsJusG),
      "Volume Jus (mL)": Number(a.volumeJusMl),
      "Brix (°)": Number(a.brixDegres),
      "Acidité (g/L)": Number(a.aciditeGl),
      "NaOH (mL)": Number(a.volumeNaohMl),
      "E/A": Number(a.ratioEa),
      "Pépins Total": a.nbPepinsEchantillonTotal,
      "Moy Pépins/Fruit": Number(a.moyennePepinsParFruit),
      "Fruits avec Pépins": a.nbFruitsAvecPepins,
      "Fermeté Peau": Number(a.moyenneFormetePeauKgCm2),
      "Fermeté Fruit": Number(a.moyenneFermeteFruitKgCm2),
      "Granulation Sévère": a.granulationSevere,
      "Granulation Légère": a.granulationLegere,
      Technicien: a.technicienNom,
      Statut: a.statutValidation,
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Qualité Interne</h1>
        <div className="flex gap-2">
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
        <Select value={campagneFilter} onValueChange={setCampagneFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Campagne" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes campagnes</SelectItem>
            {[...new Map(analyses.map((a: any) => [a.campagneId, a.campagne?.codeCampagne])).entries()]
              .filter(([, label]) => label)
              .sort(([, a], [, b]) => (b as string).localeCompare(a as string))
              .map(([id, label]) => (
                <SelectItem key={id} value={String(id)}>{label as string}</SelectItem>
              ))}
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
                  <TableCell className="font-medium"><Badge variant="outline">{a.variete?.codeVariete}</Badge></TableCell>
                  <TableCell>{a.porteGreffe?.codePg}</TableCell>
                  <TableCell>{fmtDate(a.dateAnalyse)}</TableCell>
                  <TableCell className="text-right">{Number(a.brixDegres)?.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{Number(a.aciditeGl)?.toFixed(2)}</TableCell>
                  <TableCell><EaBadge value={a.ratioEa != null ? Number(a.ratioEa) : null} /></TableCell>
                  <TableCell className="text-right">{a.pctJus != null ? Math.round(Number(a.pctJus)) : "-"}</TableCell>
                  <TableCell className="text-right">{a.moyennePepinsParFruit != null ? Number(a.moyennePepinsParFruit).toFixed(1) : "-"}</TableCell>
                  <TableCell><Badge className={statusColors[a.statutValidation || "Brouillon"]}>{a.statutValidation}</Badge></TableCell>
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

      <div className="md:hidden space-y-3">
        {paginated.map((a: any) => (
          <Card key={a.id} className="cursor-pointer" onClick={() => setViewItem(a)}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{a.variete?.codeVariete}</p>
                  <p className="text-xs text-muted-foreground">{a.porteGreffe?.codePg} • {fmtDate(a.dateAnalyse)}</p>
                </div>
                <Badge className={statusColors[a.statutValidation || "Brouillon"]}>{a.statutValidation}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><span className="text-muted-foreground">Brix</span><br />{Number(a.brixDegres)?.toFixed(1)}°</div>
                <div><span className="text-muted-foreground">E/A</span><br /><EaBadge value={a.ratioEa != null ? Number(a.ratioEa) : null} /></div>
                <div><span className="text-muted-foreground">% Jus</span><br />{a.pctJus != null ? Math.round(Number(a.pctJus)) : "-"}</div>
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

      {/* Detail modal */}
      <Dialog open={!!viewItem} onOpenChange={(open) => !open && setViewItem(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails Analyse Qualité</DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Identification</h3>
                <DetailRow label="Code variété" value={<Badge variant="outline">{viewItem.variete?.codeVariete}</Badge>} />
                <DetailRow label="Nom commercial" value={viewItem.variete?.nomCommercial} />
                <DetailRow label="Porte-greffe" value={viewItem.porteGreffe?.codePg} />
                <DetailRow label="Date analyse" value={fmtDate(viewItem.dateAnalyse)} />
                <DetailRow label="Mois" value={viewItem.moisAnalyse ? MONTHS[viewItem.moisAnalyse - 1] : "—"} />
                <DetailRow label="Nb fruits échantillon" value={viewItem.nbFruitsEchantillon} />
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Jus</h3>
                <DetailRow label="% Jus" value={viewItem.pctJus != null ? `${Number(viewItem.pctJus)}%` : null} />
                <DetailRow label="Poids jus (g)" value={Number(viewItem.poidsJusG)} />
                <DetailRow label="Volume jus (mL)" value={Number(viewItem.volumeJusMl)} />
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Analyse chimique</h3>
                <DetailRow label="Brix (°)" value={Number(viewItem.brixDegres)?.toFixed(1)} />
                <DetailRow label="Acidité (g/L)" value={Number(viewItem.aciditeGl)?.toFixed(2)} />
                <DetailRow label="Volume NaOH (mL)" value={Number(viewItem.volumeNaohMl)} />
                <DetailRow label="Ratio E/A" value={<EaBadge value={viewItem.ratioEa != null ? Number(viewItem.ratioEa) : null} />} />
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Pépins</h3>
                <DetailRow label="Total pépins" value={viewItem.nbPepinsEchantillonTotal} />
                <DetailRow label="Moyenne / fruit" value={viewItem.moyennePepinsParFruit != null ? Number(viewItem.moyennePepinsParFruit).toFixed(1) : null} />
                <DetailRow label="Fruits avec pépins" value={viewItem.nbFruitsAvecPepins} />
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Fermeté</h3>
                <DetailRow label="Peau (kg/cm²)" value={Number(viewItem.moyenneFormetePeauKgCm2)} />
                <DetailRow label="Fruit (kg/cm²)" value={Number(viewItem.moyenneFermeteFruitKgCm2)} />
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Granulation</h3>
                <DetailRow label="Sévère" value={viewItem.granulationSevere || "—"} />
                <DetailRow label="Légère" value={viewItem.granulationLegere || "—"} />
              </div>
              {viewItem.photoFruitsCoupesUrl && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">Photo fruits coupés</h3>
                    <img src={viewItem.photoFruitsCoupesUrl} alt="Fruits coupés" className="rounded-md max-h-48 w-auto" />
                    {viewItem.photoLegende && <p className="text-xs text-muted-foreground mt-1">{viewItem.photoLegende}</p>}
                  </div>
                </>
              )}
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Informations</h3>
                <DetailRow label="Technicien" value={viewItem.technicienNom} />
                <DetailRow label="Observations" value={viewItem.observations || "—"} />
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Workflow</h3>
                <DetailRow label="Statut" value={<Badge className={statusColors[viewItem.statutValidation || "Brouillon"]}>{viewItem.statutValidation}</Badge>} />
                <DetailRow label="Commentaires" value={viewItem.commentairesValidation || "—"} />
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

      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer l'analyse {deleteItem?.variete?.codeVariete} - {deleteItem?.porteGreffe?.codePg} du {deleteItem ? fmtDate(deleteItem.dateAnalyse) : ""} ?
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
