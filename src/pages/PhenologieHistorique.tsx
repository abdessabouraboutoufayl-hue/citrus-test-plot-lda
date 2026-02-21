import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Download, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import * as XLSX from "xlsx";

const STADES = [
  { key: "repos", num: 1, label: "Repos végétatif" },
  { key: "debourrement", num: 2, label: "Débourrement" },
  { key: "boutons_floraux", num: 3, label: "Boutons floraux" },
  { key: "prefloraison", num: 4, label: "Pré-floraison" },
  { key: "floraison", num: 5, label: "Floraison" },
  { key: "chute_petales", num: 6, label: "Chute pétales" },
  { key: "nouaison", num: 7, label: "Nouaison" },
  { key: "chute_physio", num: 8, label: "Chute physio." },
  { key: "grossissement", num: 9, label: "Grossissement" },
  { key: "veraison", num: 10, label: "Véraison" },
  { key: "debut_maturite", num: 11, label: "Début maturité" },
  { key: "maturite_recolte", num: 12, label: "Maturité récolte" },
];

function getStadeDateField(key: string): string {
  if (key === "debut_maturite") return "stade_debut_maturite_date";
  if (key === "maturite_recolte") return "stade_maturite_recolte_date";
  return `stade_${key}_date_debut`;
}

function getCurrentStade(record: any): { key: string; label: string } | null {
  for (let i = STADES.length - 1; i >= 0; i--) {
    if (record?.[getStadeDateField(STADES[i].key)]) return STADES[i];
  }
  return null;
}

function getFirstStadeDate(record: any): string | null {
  for (let i = 0; i < STADES.length; i++) {
    const d = record?.[getStadeDateField(STADES[i].key)];
    if (d) return d;
  }
  return null;
}

function getLastStadeDate(record: any): string | null {
  for (let i = STADES.length - 1; i >= 0; i--) {
    const d = record?.[getStadeDateField(STADES[i].key)];
    if (d) return d;
  }
  return null;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy", { locale: fr }); } catch { return d; }
}

type SortKey = "campagne" | "ferme" | "type" | "code" | "stade" | "debut" | "fin";
type SortDir = "asc" | "desc";

export default function PhenologieHistorique() {
  const [selectedCampagne, setSelectedCampagne] = useState("");
  const [selectedDomaine, setSelectedDomaine] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("campagne");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: campagnes } = useQuery({
    queryKey: ["campagnes"],
    queryFn: async () => {
      const { data } = await supabase.from("campagnes").select("*").order("date_debut", { ascending: false });
      return data || [];
    },
  });

  const { data: domaines } = useQuery({
    queryKey: ["domaines"],
    queryFn: async () => {
      const { data } = await supabase.from("domaines").select("*").order("nom");
      return data || [];
    },
  });

  const { data: typesVarietes } = useQuery({
    queryKey: ["types-varietes"],
    queryFn: async () => {
      const { data } = await supabase.from("types_varietes").select("*").order("type_code");
      return data || [];
    },
  });

  const { data: phenoRecords } = useQuery({
    queryKey: ["phenologie-historique"],
    queryFn: async () => {
      const { data } = await supabase
        .from("phenologie")
        .select("*, varietes(code_variete, nom_commercial, types_varietes(*)), campagnes(code_campagne), domaines(nom)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const rows = useMemo(() => {
    if (!phenoRecords) return [];
    return phenoRecords.map((r: any) => {
      const stade = getCurrentStade(r);
      const debut = getFirstStadeDate(r);
      const fin = getLastStadeDate(r);
      return {
        id: r.id,
        campagne: r.campagnes?.code_campagne || "—",
        campagneId: r.campagne_id,
        ferme: r.domaines?.nom || "—",
        domaineId: r.domaine_id,
        typeCode: r.varietes?.types_varietes?.type_code || "—",
        typeNom: r.varietes?.types_varietes?.type_nom || "—",
        typeId: r.varietes?.types_varietes?.id,
        typeCouleur: r.varietes?.types_varietes?.couleur_badge || "#888",
        code: r.varietes?.code_variete || "—",
        stadeLabel: stade?.label || "—",
        stadeNum: stade ? STADES.findIndex((s) => s.key === stade.key) : -1,
        debut,
        fin,
        debutFmt: fmtDate(debut),
        finFmt: fmtDate(fin),
        observateur: r.observateur_nom || "—",
        duree: r.duree_totale_cycle_jours,
      };
    });
  }, [phenoRecords]);

  const filtered = useMemo(() => {
    let result = rows;
    if (selectedCampagne) result = result.filter((r) => r.campagneId === Number(selectedCampagne));
    if (selectedDomaine) result = result.filter((r) => r.domaineId === Number(selectedDomaine));
    if (selectedType) result = result.filter((r) => r.typeId === Number(selectedType));
    if (dateFrom) result = result.filter((r) => r.debut && r.debut >= dateFrom);
    if (dateTo) result = result.filter((r) => r.fin && r.fin <= dateTo);
    if (globalSearch) {
      const s = globalSearch.toLowerCase();
      result = result.filter((r) =>
        r.campagne.toLowerCase().includes(s) ||
        r.ferme.toLowerCase().includes(s) ||
        r.typeCode.toLowerCase().includes(s) ||
        r.typeNom.toLowerCase().includes(s) ||
        r.code.toLowerCase().includes(s) ||
        r.stadeLabel.toLowerCase().includes(s) ||
        r.observateur.toLowerCase().includes(s)
      );
    }
    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "campagne": cmp = a.campagne.localeCompare(b.campagne); break;
        case "ferme": cmp = a.ferme.localeCompare(b.ferme); break;
        case "type": cmp = a.typeCode.localeCompare(b.typeCode); break;
        case "code": cmp = a.code.localeCompare(b.code); break;
        case "stade": cmp = a.stadeNum - b.stadeNum; break;
        case "debut": cmp = (a.debut || "").localeCompare(b.debut || ""); break;
        case "fin": cmp = (a.fin || "").localeCompare(b.fin || ""); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [rows, selectedCampagne, selectedDomaine, selectedType, dateFrom, dateTo, globalSearch, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const exportData = filtered.map((r) => ({
    Campagne: r.campagne,
    Ferme: r.ferme,
    "Type variété": `${r.typeCode} - ${r.typeNom}`,
    Code: r.code,
    "Stade actuel": r.stadeLabel,
    "Date début": r.debutFmt,
    "Date fin": r.finFmt,
    "Durée (j)": r.duree ?? "",
    Observateur: r.observateur,
  }));

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportData);
    // Style header row
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[addr]) {
        ws[addr].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2E7D32" } } };
      }
    }
    ws["!cols"] = Object.keys(exportData[0] || {}).map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historique Phénologique");
    XLSX.writeFile(wb, `historique_phenologique_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    const printContent = `
      <html><head><title>Historique Phénologique</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }
        h1 { font-size: 16px; color: #2E7D32; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #2E7D32; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
        td { border-bottom: 1px solid #ddd; padding: 5px 8px; font-size: 10px; }
        tr:nth-child(even) { background: #f9f9f9; }
        .meta { color: #666; font-size: 10px; margin-bottom: 10px; }
      </style></head><body>
      <h1>📋 Historique Phénologique</h1>
      <p class="meta">Exporté le ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr })} — ${filtered.length} enregistrement(s)</p>
      <table>
        <thead><tr>
          <th>Campagne</th><th>Ferme</th><th>Type</th><th>Code</th><th>Stade</th><th>Début</th><th>Fin</th><th>Durée</th><th>Observateur</th>
        </tr></thead>
        <tbody>${filtered.map((r) => `<tr>
          <td>${r.campagne}</td><td>${r.ferme}</td><td>${r.typeCode}</td><td>${r.code}</td>
          <td>${r.stadeLabel}</td><td>${r.debutFmt}</td><td>${r.finFmt}</td>
          <td>${r.duree ?? "—"}</td><td>${r.observateur}</td>
        </tr>`).join("")}</tbody>
      </table></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(printContent); w.document.close(); w.print(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">📋 Historique Phénologique</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportPDF} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" /> PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Campagne</Label>
              <SearchableSelect
                options={[{ value: "", label: "Toutes" }, ...(campagnes || []).map((c) => ({ value: c.id.toString(), label: c.code_campagne }))]}
                value={selectedCampagne}
                onValueChange={setSelectedCampagne}
                placeholder="Toutes"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Ferme</Label>
              <SearchableSelect
                options={[{ value: "", label: "Toutes" }, ...(domaines || []).map((d) => ({ value: d.id.toString(), label: d.nom, sublabel: d.region }))]}
                value={selectedDomaine}
                onValueChange={setSelectedDomaine}
                placeholder="Toutes"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Type variété</Label>
              <SearchableSelect
                options={[{ value: "", label: "Tous" }, ...(typesVarietes || []).map((t) => ({ value: t.id.toString(), label: t.type_code, sublabel: t.type_nom }))]}
                value={selectedType}
                onValueChange={setSelectedType}
                placeholder="Tous"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Période du</Label>
              <Input type="date" className="h-10 text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Au</Label>
              <Input type="date" className="h-10 text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Recherche</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-10 pl-8 text-sm"
                  placeholder="Rechercher..."
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{filtered.length} enregistrement(s)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Aucun résultat trouvé</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {([
                      ["campagne", "Campagne"],
                      ["ferme", "Ferme"],
                      ["type", "Type"],
                      ["code", "Code"],
                      ["stade", "Stade actuel"],
                      ["debut", "Début"],
                      ["fin", "Fin"],
                    ] as [SortKey, string][]).map(([key, label]) => (
                      <TableHead key={key} className="cursor-pointer select-none" onClick={() => toggleSort(key)}>
                        <span className="flex items-center">
                          {label}
                          <SortIcon col={key} />
                        </span>
                      </TableHead>
                    ))}
                    <TableHead>Durée</TableHead>
                    <TableHead>Observateur</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm font-medium">{row.campagne}</TableCell>
                      <TableCell className="text-sm">{row.ferme}</TableCell>
                      <TableCell>
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs text-white font-medium"
                          style={{ backgroundColor: row.typeCouleur }}
                        >
                          {row.typeCode}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{row.code}</TableCell>
                      <TableCell className="text-sm">{row.stadeLabel}</TableCell>
                      <TableCell className="text-sm">{row.debutFmt}</TableCell>
                      <TableCell className="text-sm">{row.finFmt}</TableCell>
                      <TableCell className="text-sm">{row.duree ? `${row.duree}j` : "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.observateur}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
