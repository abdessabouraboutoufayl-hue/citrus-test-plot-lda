import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Download, Eye } from "lucide-react";
import * as XLSX from "xlsx-js-style";

export default function PhenologieHistorique() {
  const [selectedCampagne, setSelectedCampagne] = useState("");
  const [selectedDomaine, setSelectedDomaine] = useState("");
  const [expandedObs, setExpandedObs] = useState<string[]>([]);

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

  const { data: observations } = useQuery({
    queryKey: ["obs-phenologie-historique", selectedCampagne, selectedDomaine],
    queryFn: async () => {
      let query = supabase
        .from("observations_phenologie")
        .select("*, phenologie_details(*, varietes(code_variete, types_varietes(type_code, type_nom, couleur_badge))), domaines(nom), campagnes(code_campagne)")
        .order("date_observation", { ascending: false });

      if (selectedCampagne) query = query.eq("campagne_id", Number(selectedCampagne));
      if (selectedDomaine) query = query.eq("domaine_id", Number(selectedDomaine));

      const { data } = await query;
      return data || [];
    },
  });

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d), "dd/MM/yyyy", { locale: fr }); } catch { return d; }
  };

  const handleExportExcel = () => {
    if (!observations || observations.length === 0) return;
    const rows: any[] = [];
    for (const obs of observations) {
      for (const det of (obs.phenologie_details || []) as any[]) {
        rows.push({
          Campagne: (obs as any).campagnes?.code_campagne || "—",
          Ferme: (obs as any).domaines?.nom || "—",
          "Date observation": fmtDate(obs.date_observation),
          Observateur: obs.observateur_nom,
          "Code variété": det.varietes?.code_variete || "—",
          Type: det.varietes?.types_varietes?.type_code || "—",
          "Stade précédent": det.stade_precedent || "—",
          "Stade actuel": det.stade_phenologique,
          "Date stade": fmtDate(det.date_stade),
          Observations: det.observations || "",
        });
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[addr]) {
        ws[addr].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2E7D32" } } };
      }
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
        <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={!observations || observations.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Exporter Excel
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
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
          </div>
        </CardContent>
      </Card>

      {/* Observations list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{observations?.length || 0} observation(s)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!observations || observations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Aucune observation trouvée</p>
          ) : (
            <Accordion type="multiple" value={expandedObs} onValueChange={setExpandedObs}>
              {observations.map((obs: any) => {
                const details = (obs.phenologie_details || []) as any[];
                return (
                  <AccordionItem key={obs.id} value={obs.id.toString()} className="border-b last:border-0">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-4 w-full text-left">
                        <span className="text-sm font-medium">{fmtDate(obs.date_observation)}</span>
                        <span className="text-xs text-muted-foreground">{obs.domaines?.nom}</span>
                        <span className="text-xs text-muted-foreground">{obs.campagnes?.code_campagne}</span>
                        <span className="text-xs text-muted-foreground ml-auto mr-4">
                          {obs.nb_codes_saisis || details.length} codes · {obs.observateur_nom}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-0 pb-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Code</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Stade précédent</TableHead>
                              <TableHead>Stade actuel</TableHead>
                              <TableHead>Date stade</TableHead>
                              <TableHead>Observations</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {details.map((det: any) => (
                              <TableRow key={det.id}>
                                <TableCell className="font-mono text-sm">{det.varietes?.code_variete || "—"}</TableCell>
                                <TableCell>
                                  <span
                                    className="inline-block px-2 py-0.5 rounded text-xs text-white font-medium"
                                    style={{ backgroundColor: det.varietes?.types_varietes?.couleur_badge || "#888" }}
                                  >
                                    {det.varietes?.types_varietes?.type_code || "?"}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{det.stade_precedent || "—"}</TableCell>
                                <TableCell className="text-sm font-medium">{det.stade_phenologique}</TableCell>
                                <TableCell className="text-sm">{fmtDate(det.date_stade)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{det.observations || "—"}</TableCell>
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
