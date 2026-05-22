import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { refApi, phenologieApi } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Download } from "lucide-react";
import * as XLSX from "xlsx-js-style";

const STADES = [
  { label: "Repos végétatif", field: "stadeReposDateDebut" },
  { label: "Débourrement", field: "stadeDebourrementDateDebut" },
  { label: "Boutons floraux", field: "stadeBoutonsFlorauxDateDebut" },
  { label: "Pré-floraison", field: "stadePrefloraisonDateDebut" },
  { label: "Floraison", field: "stadeFloraisonDateDebut" },
  { label: "Chute pétales", field: "stadeChutePetalesDateDebut" },
  { label: "Nouaison", field: "stadeNouaisonDateDebut" },
  { label: "Chute physio.", field: "stadeChutePhysioDateDebut" },
  { label: "Grossissement", field: "stadeGrossissementDateDebut" },
  { label: "Véraison", field: "stadeVeraisonDateDebut" },
  { label: "Début maturité", field: "stadeDebutMaturiteDate" },
  { label: "Maturité récolte", field: "stadeMaturiteRecolteDate" },
];

export default function PhenologieHistorique() {
  const { userInfo } = useAuth();
  const isCentral = userInfo.role === "responsable_central" || userInfo.role === "direction";
  const [selectedCampagne, setSelectedCampagne] = useState("");
  const [selectedDomaine, setSelectedDomaine] = useState(
    !isCentral && userInfo.domaineId ? userInfo.domaineId.toString() : ""
  );

  const { data: campagnes = [] } = useQuery({
    queryKey: ["campagnes"],
    queryFn: () => refApi.campagnes(),
  });

  const { data: domaines = [] } = useQuery({
    queryKey: ["domaines"],
    queryFn: () => refApi.domaines(),
  });

  const { data: phenoList = [] } = useQuery({
    queryKey: ["phenologie-historique", selectedCampagne],
    queryFn: () => phenologieApi.list(selectedCampagne || undefined),
  });

  const filtered = phenoList.filter((p: any) => {
    if (selectedDomaine && String(p.domaineId) !== selectedDomaine) return false;
    return true;
  });

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d), "dd/MM/yyyy", { locale: fr }); } catch { return d; }
  };

  const handleExportExcel = () => {
    if (!filtered || filtered.length === 0) return;
    const rows: any[] = [];
    for (const p of filtered) {
      for (const stade of STADES) {
        const dateVal = p[stade.field];
        if (dateVal) {
          rows.push({
            Campagne: campagnes.find((c: any) => c.id === p.campagneId)?.codeCampagne || "—",
            Domaine: domaines.find((d: any) => d.id === p.domaineId)?.nom || "—",
            "Code variété": p.variete?.codeVariete || "—",
            Stade: stade.label,
            "Date début": fmtDate(dateVal),
          });
        }
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[addr]) ws[addr].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2E7D32" } } };
    }
    ws["!cols"] = Object.keys(rows[0] || {}).map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historique Phénologique");
    XLSX.writeFile(wb, `historique_phenologique_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">📋 Historique Phénologique</h1>
        <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Exporter Excel
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            <div>
              <Label className="text-xs mb-1 block">Campagne</Label>
              <SearchableSelect
                options={[{ value: "", label: "Toutes" }, ...(campagnes || []).map((c: any) => ({ value: c.id.toString(), label: c.codeCampagne }))]}
                value={selectedCampagne}
                onValueChange={setSelectedCampagne}
                placeholder="Toutes"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Ferme</Label>
              {isCentral ? (
                <SearchableSelect
                  options={[{ value: "", label: "Toutes" }, ...(domaines || []).map((d: any) => ({ value: d.id.toString(), label: d.nom }))]}
                  value={selectedDomaine}
                  onValueChange={setSelectedDomaine}
                  placeholder="Toutes"
                />
              ) : (
                <div className="h-10 flex items-center px-3 rounded-md border bg-muted text-sm">
                  {domaines.find((d: any) => d.id.toString() === selectedDomaine)?.nom || "—"}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{filtered.length} enregistrement(s)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Aucun enregistrement trouvé</p>
          ) : (
            <Accordion type="multiple">
              {filtered.map((p: any) => {
                const stadesDone = STADES.filter(s => p[s.field]).length;
                const campagneCode = campagnes.find((c: any) => c.id === p.campagneId)?.codeCampagne || "—";
                const domaineNom = domaines.find((d: any) => d.id === p.domaineId)?.nom || "—";
                return (
                  <AccordionItem key={p.id} value={String(p.id)} className="border-b last:border-0">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-4 w-full text-left">
                        <span className="text-sm font-medium">{p.variete?.codeVariete || "—"}</span>
                        <span className="text-xs text-muted-foreground">{domaineNom}</span>
                        <span className="text-xs text-muted-foreground">{campagneCode}</span>
                        <span className="text-xs text-muted-foreground ml-auto mr-4">{stadesDone}/12 stades</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-0 pb-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Stade</TableHead>
                              <TableHead>Date début</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {STADES.map(stade => (
                              <TableRow key={stade.field} className={!p[stade.field] ? "opacity-40" : ""}>
                                <TableCell className="text-sm font-medium">{stade.label}</TableCell>
                                <TableCell className="text-sm">{fmtDate(p[stade.field])}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
