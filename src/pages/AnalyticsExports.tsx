import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { refApi, productionApi, qualiteApi, exportApi } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet, FileText, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx-js-style";

type DataType = "Production" | "Qualité";

export default function AnalyticsExports() {
  const { userInfo } = useAuth();
  const [dataTypes, setDataTypes] = useState<DataType[]>(["Production"]);
  const [selectedCampagne, setSelectedCampagne] = useState<string>("all");
  const [selectedDomaine, setSelectedDomaine] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [format, setFormat] = useState<"excel" | "csv" | "pdf">("excel");
  const [generating, setGenerating] = useState(false);

  const { data: campagnes = [] } = useQuery({
    queryKey: ["exp-campagnes"],
    queryFn: () => refApi.campagnes(),
  });

  const { data: domaines = [] } = useQuery({
    queryKey: ["exp-domaines"],
    queryFn: () => refApi.domaines(),
  });

  const { data: productions = [] } = useQuery({
    queryKey: ["exp-productions"],
    queryFn: async () => { const r = await productionApi.list({ limit: 5000 }); return r.data || []; },
  });

  const { data: qualites = [] } = useQuery({
    queryKey: ["exp-qualites"],
    queryFn: async () => { const r = await qualiteApi.list({ limit: 5000 }); return r.data || []; },
  });

  const { data: exportHistory = [] } = useQuery({
    queryKey: ["exp-history"],
    queryFn: () => exportApi.history(),
  });

  const filteredProd = useMemo(() => {
    let d = productions;
    if (selectedCampagne !== "all") d = d.filter((p: any) => p.campagneId === Number(selectedCampagne));
    if (selectedDomaine !== "all") d = d.filter((p: any) => p.domaineId === Number(selectedDomaine));
    if (userInfo.role === "responsable_domaine" && userInfo.domaineId) d = d.filter((p: any) => String(p.domaineId) === String(userInfo.domaineId));
    if (dateFrom) d = d.filter((p: any) => p.dateRecolte >= dateFrom);
    if (dateTo) d = d.filter((p: any) => p.dateRecolte <= dateTo);
    return d;
  }, [productions, selectedCampagne, selectedDomaine, dateFrom, dateTo, userInfo]);

  const filteredQual = useMemo(() => {
    let d = qualites;
    if (selectedCampagne !== "all") d = d.filter((q: any) => q.campagneId === Number(selectedCampagne));
    if (selectedDomaine !== "all") d = d.filter((q: any) => q.domaineId === Number(selectedDomaine));
    if (userInfo.role === "responsable_domaine" && userInfo.domaineId) d = d.filter((q: any) => String(q.domaineId) === String(userInfo.domaineId));
    if (dateFrom) d = d.filter((q: any) => q.dateAnalyse >= dateFrom);
    if (dateTo) d = d.filter((q: any) => q.dateAnalyse <= dateTo);
    return d;
  }, [qualites, selectedCampagne, selectedDomaine, dateFrom, dateTo, userInfo]);

  const toggleDataType = (t: DataType) => {
    setDataTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const totalRows = (dataTypes.includes("Production") ? filteredProd.length : 0) + (dataTypes.includes("Qualité") ? filteredQual.length : 0);

  const generateExport = useCallback(async () => {
    if (totalRows === 0) { toast.error("Aucune donnée à exporter"); return; }
    setGenerating(true);
    try {
      const wb = XLSX.utils.book_new();

      if (dataTypes.includes("Production") && filteredProd.length > 0) {
        const rows = filteredProd.map((p: any) => ({
          Campagne: p.campagne?.codeCampagne || "",
          Domaine: p.domaine?.nom || "",
          "Code Arbre": p.codeArbre || "",
          Variété: p.variete?.codeVariete || "",
          "Porte-greffe": p.porteGreffe?.codePg || "",
          Ligne: p.ligneNumero,
          Position: p.positionLigne,
          "Date Récolte": p.dateRecolte,
          "Poids (kg)": p.poidsTotalKg,
          "Nb Fruits": p.nbFruitsTotal,
          "Poids Moyen (g)": p.poidsMoyenFruitG,
          "Calibre (mm)": p.calibreMoyenMm,
          "Déclassement %": p.tauxDeclassementPct,
          Qualité: p.qualiteGlobale,
          Récoltant: p.recoltantNom,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Production");
      }

      if (dataTypes.includes("Qualité") && filteredQual.length > 0) {
        const rows = filteredQual.map((q: any) => ({
          Campagne: q.campagne?.codeCampagne || "",
          Domaine: q.domaine?.nom || "",
          Variété: q.variete?.codeVariete || "",
          "Porte-greffe": q.porteGreffe?.codePg || "",
          "Date Analyse": q.dateAnalyse,
          Brix: q.brixDegres,
          Acidité: q.aciditeGl,
          "E/A": q.ratioEa,
          "% Jus": q.pctJus,
          "Nb Fruits": q.nbFruitsEchantillon,
          "Fermeté Peau": q.moyenneFermetePeauKgCm2,
          "Fermeté Fruit": q.moyenneFermeteFruitKgCm2,
          "Granulation Sévère": q.granulationSevere,
          Technicien: q.technicienNom,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Qualité");
      }

      if (format === "csv") {
        const ws = wb.Sheets[wb.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `export_${dataTypes.join("_")}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
      } else if (format === "pdf") {
        window.print();
      } else {
        XLSX.writeFile(wb, `export_${dataTypes.join("_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      }

      toast.success(`Export généré (${totalRows} lignes)`);
    } catch (e) {
      toast.error("Erreur lors de la génération");
    } finally {
      setGenerating(false);
    }
  }, [dataTypes, filteredProd, filteredQual, format, totalRows, selectedCampagne, selectedDomaine, dateFrom, dateTo]);

  const deleteExport = async (_id: number) => {
    toast.info("Suppression non disponible");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Exports Avancés</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Générateur d'Export Personnalisé</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Data type */}
          <div>
            <Label className="text-sm font-medium">1. Type de données</Label>
            <div className="flex gap-4 mt-2">
              {(["Production", "Qualité"] as DataType[]).map(t => (
                <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={dataTypes.includes(t)} onCheckedChange={() => toggleDataType(t)} />
                  {t}
                </label>
              ))}
            </div>
          </div>

          {/* Step 2: Filters */}
          <div>
            <Label className="text-sm font-medium">2. Filtres</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <Select value={selectedCampagne} onValueChange={setSelectedCampagne}>
                <SelectTrigger><SelectValue placeholder="Campagne" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {campagnes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.codeCampagne}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedDomaine} onValueChange={setSelectedDomaine}>
                <SelectTrigger><SelectValue placeholder="Domaine" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {domaines.map((d: any) => <SelectItem key={d.id} value={String(d.id)}>{d.nom}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="Du" />
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="Au" />
            </div>
          </div>

          {/* Step 3: Format */}
          <div>
            <Label className="text-sm font-medium">3. Format</Label>
            <div className="flex gap-4 mt-2">
              {([["excel", "Excel (.xlsx)"], ["csv", "CSV (.csv)"], ["pdf", "PDF"]] as const).map(([v, l]) => (
                <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="format" checked={format === v} onChange={() => setFormat(v)} />
                  {l}
                </label>
              ))}
            </div>
          </div>

          {/* Preview & Generate */}
          <div className="flex items-center justify-between border-t pt-4">
            <p className="text-sm text-muted-foreground">~{totalRows} lignes</p>
            <Button onClick={generateExport} disabled={generating || totalRows === 0}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Générer Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader><CardTitle className="text-base">Historique Exports</CardTitle></CardHeader>
        <CardContent>
          {exportHistory.length > 0 ? (
            <div className="space-y-2">
              {exportHistory.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between p-3 border rounded text-sm">
                  <div className="flex items-center gap-3">
                    {e.typeExport === "Excel" ? <FileSpreadsheet className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-secondary" />}
                    <div>
                      <p className="font-medium">{e.nomFichier}</p>
                      <p className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString("fr-FR")} • {e.nbLignes} lignes</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{e.typeExport}</Badge>
                    <Badge variant="secondary">{e.typeDonnees}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => deleteExport(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">Aucun export récent</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
