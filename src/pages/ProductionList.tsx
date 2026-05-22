import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productionApi } from "@/services/api";
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
import { PlusCircle, Search, Download, Trash2, Send, Eye, Pencil, ArrowUpDown, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
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
    return p.statutValidation === "Brouillon" || p.statutValidation === "Rejeté";
  };
  const canModify = (p: any) => {
    if (userInfo.role === "direction") return false;
    return p.statutValidation === "Brouillon" || p.statutValidation === "Rejeté";
  };
  const canDelete = (p: any) => {
    if (userInfo.role === "direction") return false;
    return p.statutValidation === "Brouillon";
  };

  const { data: productions = [], isLoading } = useQuery({
    queryKey: ["productions", userInfo.domaineId],
    queryFn: async () => {
      const result = await productionApi.list({
        domaineId: userInfo.domaineId ?? undefined,
        limit: 2000,
      });
      return result.data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productionApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productions"] });
      toast.success("Production supprimée");
      setDeleteItem(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const submitMutation = useMutation({
    mutationFn: (id: number) => productionApi.update(String(id), { statutValidation: "Soumis" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productions"] });
      toast.success("Production soumise pour validation");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    return productions.filter((p: any) => {
      if (search) {
        const s = search.toLowerCase();
        const match = p.codeArbre?.toLowerCase().includes(s) ||
          p.variete?.codeVariete?.toLowerCase().includes(s) ||
          p.variete?.nomCommercial?.toLowerCase().includes(s);
        if (!match) return false;
      }
      if (statutFilter !== "all" && p.statutValidation !== statutFilter) return false;
      if (campagneFilter !== "all" && p.campagneId !== parseInt(campagneFilter)) return false;
      if (moisFilter !== "all") {
        const m = new Date(p.dateRecolte).getMonth() + 1;
        if (m !== parseInt(moisFilter)) return false;
      }
      return true;
    });
  }, [productions, search, statutFilter, campagneFilter, moisFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a: any, b: any) => {
      let va: any, vb: any;
      switch (sortKey) {
        case "arbre": va = a.codeArbre || ""; vb = b.codeArbre || ""; break;
        case "variete": va = a.variete?.codeVariete || ""; vb = b.variete?.codeVariete || ""; break;
        case "pg": va = a.porteGreffe?.codePg || ""; vb = b.porteGreffe?.codePg || ""; break;
        case "poids": va = Number(a.poidsTotalKg) ?? 0; vb = Number(b.poidsTotalKg) ?? 0; break;
        case "fruits": va = a.nbFruitsTotal ?? 0; vb = b.nbFruitsTotal ?? 0; break;
        case "poids_moy": va = Number(a.poidsMoyenFruitG) ?? 0; vb = Number(b.poidsMoyenFruitG) ?? 0; break;
        case "date": va = a.dateRecolte || ""; vb = b.dateRecolte || ""; break;
        case "statut": va = a.statutValidation || ""; vb = b.statutValidation || ""; break;
        default: va = a.dateRecolte || ""; vb = b.dateRecolte || "";
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
    const rows = filtered.map((p: any) => ({
      Domaine: p.domaine?.nom,
      "Code Domaine": p.domaine?.code,
      Arbre: p.codeArbre,
      Variété: p.variete?.codeVariete,
      "Nom commercial": p.variete?.nomCommercial,
      PG: p.porteGreffe?.codePg,
      Ligne: p.ligneNumero,
      Position: p.positionLigne,
      "Date récolte": p.dateRecolte,
      "Poids (kg)": Number(p.poidsTotalKg),
      Fruits: p.nbFruitsTotal,
      "Poids moy (g)": Number(p.poidsMoyenFruitG),
      "Calibre (mm)": Number(p.calibreMoyenMm),
      "Décl %": Number(p.tauxDeclassementPct),
      Qualité: p.qualiteGlobale,
      "Statut arbre": p.arbreStatut,
      Statut: p.statutValidation,
      Récoltant: p.recoltantNom,
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
        <Select value={campagneFilter} onValueChange={setCampagneFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Campagne" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes campagnes</SelectItem>
            {[...new Map(productions.map((p: any) => [p.campagneId, p.campagne?.codeCampagne])).entries()]
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

      {/* Desktop table */}
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
                const comboRows: { comboKey: string; code: string; pg: string; domaineName: string; hasCalibre: boolean; items: any[] }[] = [];
                let lastCombo = "";
                for (const p of paginated) {
                  const code = p.variete?.codeVariete || "?";
                  const pg = p.porteGreffe?.codePg || "?";
                  const domNom = p.domaine?.nom || p.domaine?.code || "?";
                  const key = `${p.domaineId}-${code}-${pg}`;
                  if (key !== lastCombo) {
                    const hasCal = p.cal0 != null || p.cal1xxx != null || p.cal1xx != null || p.cal2 != null;
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
                          {group.domaineName} — {group.code}-{group.pg} ({group.items.length} arbres)
                          {group.hasCalibre && <Badge variant="secondary" className="ml-2 text-xs">Profil calibre ✓</Badge>}
                        </span>
                      </TableCell>
                    </TableRow>
                    {group.items.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.codeArbre}</TableCell>
                        <TableCell><Badge variant="outline">{p.variete?.codeVariete}</Badge></TableCell>
                        <TableCell>{p.porteGreffe?.codePg}</TableCell>
                        <TableCell className="text-right">{Number(p.poidsTotalKg)}</TableCell>
                        <TableCell className="text-right">{p.nbFruitsTotal}</TableCell>
                        <TableCell className="text-right">{Number(p.poidsMoyenFruitG)?.toFixed(1)}</TableCell>
                        <TableCell>{fmtDate(p.dateRecolte)}</TableCell>
                        <TableCell><Badge className={statusColors[p.statutValidation || "Brouillon"]}>{p.statutValidation}</Badge></TableCell>
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

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {paginated.map((p: any) => (
          <Card key={p.id} className="cursor-pointer" onClick={() => setViewItem(p)}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{p.codeArbre}</p>
                  <p className="text-xs text-muted-foreground">{p.variete?.nomCommercial}</p>
                </div>
                <Badge className={statusColors[p.statutValidation || "Brouillon"]}>{p.statutValidation}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><span className="text-muted-foreground">Poids</span><br />{Number(p.poidsTotalKg)} kg</div>
                <div><span className="text-muted-foreground">Fruits</span><br />{p.nbFruitsTotal}</div>
                <div><span className="text-muted-foreground">Qualité</span><br />{p.qualiteGlobale || "-"}</div>
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

      {/* Pagination */}
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
            <DialogTitle>Détails Production</DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Identification</h3>
                <DetailRow label="Code arbre" value={viewItem.codeArbre} />
                <DetailRow label="Variété" value={<Badge variant="outline">{viewItem.variete?.codeVariete}</Badge>} />
                <DetailRow label="Nom commercial" value={viewItem.variete?.nomCommercial} />
                <DetailRow label="Porte-greffe" value={viewItem.porteGreffe?.codePg} />
                <DetailRow label="Domaine" value={viewItem.domaine?.nom} />
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Position</h3>
                <DetailRow label="Ligne" value={viewItem.ligneNumero} />
                <DetailRow label="Position" value={viewItem.positionLigne} />
                <DetailRow label="Statut arbre" value={viewItem.arbreStatut} />
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Récolte</h3>
                <DetailRow label="Date récolte" value={fmtDate(viewItem.dateRecolte)} />
                <DetailRow label="Poids total (kg)" value={Number(viewItem.poidsTotalKg)} />
                <DetailRow label="Nb fruits" value={viewItem.nbFruitsTotal} />
                <DetailRow label="Poids moyen (g)" value={Number(viewItem.poidsMoyenFruitG)?.toFixed(1)} />
                <DetailRow label="Calibre moyen (mm)" value={Number(viewItem.calibreMoyenMm)} />
                <DetailRow label="Taux déclassement (%)" value={Number(viewItem.tauxDeclassementPct)} />
                <DetailRow label="Qualité globale" value={viewItem.qualiteGlobale} />
              </div>
              {viewItem.photoUrl && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">Photo</h3>
                    <img src={viewItem.photoUrl} alt="Production" className="rounded-md max-h-48 w-auto" />
                    {viewItem.photoLegende && <p className="text-xs text-muted-foreground mt-1">{viewItem.photoLegende}</p>}
                  </div>
                </>
              )}
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Informations</h3>
                <DetailRow label="Récoltant" value={viewItem.recoltantNom} />
                <DetailRow label="Observations" value={viewItem.observations || "—"} />
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Workflow</h3>
                <DetailRow label="Statut" value={<Badge className={statusColors[viewItem.statutValidation || "Brouillon"]}>{viewItem.statutValidation}</Badge>} />
                <DetailRow label="Commentaires" value={viewItem.commentairesValidation || "—"} />
              </div>
              {(() => {
                const code = viewItem.variete?.codeVariete;
                const pg = viewItem.porteGreffe?.codePg;
                const calType = code ? getCalibreType(code) : null;
                const entries = getCalibreEntries(calType);
                const hasData = entries.some(e => Number(viewItem[e.dbColumn]) > 0);
                if (!hasData) return null;
                const chartData = entries
                  .map(e => ({
                    calibre: `${e.label} (${e.range})`,
                    nb: Number(viewItem[e.dbColumn]) || 0,
                    pct: Math.round((Number(viewItem[e.dbColumn]) || 0) / NB_ECHANTILLON * 100),
                  }))
                  .filter(d => d.nb > 0);
                return (
                  <>
                    <Separator />
                    <Collapsible defaultOpen>
                      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
                        <h3 className="text-sm font-semibold text-muted-foreground">Profil Calibre ({NB_ECHANTILLON} fruits)</h3>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2 space-y-2">
                        <Badge variant="secondary" className="text-xs">Partagé : {code}-{pg}</Badge>
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

      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer la production {deleteItem?.codeArbre} du {deleteItem ? fmtDate(deleteItem.dateRecolte) : ""} ?
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
