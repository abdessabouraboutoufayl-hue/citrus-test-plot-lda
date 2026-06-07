import { useState } from "react";
import { refApi, phenologieApi } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Flower2, CalendarDays, Clock, TrendingDown, AlertTriangle } from "lucide-react";

export default function PhenologieDashboard() {
  const [selectedCampagne, setSelectedCampagne] = useState<string>("");

  const { data: campagnes = [] } = useQuery({
    queryKey: ["campagnes"],
    queryFn: () => refApi.campagnes(),
  });

  const { data: phenoData = [] } = useQuery({
    queryKey: ["phenologie-dashboard", selectedCampagne],
    queryFn: () => phenologieApi.list(selectedCampagne || undefined),
  });

  const today = new Date().toISOString().split("T")[0];

  const enFloraison = phenoData.filter(
    (p: any) => p.stadeFloraisonDateDebut && (!p.stadeFloraisonDateFin || p.stadeFloraisonDateFin >= today)
  ).length;

  const prochainesObs = phenoData.filter(
    (p: any) => p.prochaineObservationPrevue && p.prochaineObservationPrevue <= today
  ).length;

  const dureesFlo = phenoData.filter((p: any) => p.dureeFloraisonJours).map((p: any) => p.dureeFloraisonJours);
  const moyenneDureeFlo = dureesFlo.length ? Math.round(dureesFlo.reduce((a: number, b: number) => a + b, 0) / dureesFlo.length) : 0;

  const tauxChutes = phenoData.filter((p: any) => p.stadeChutePhysioTauxPct).map((p: any) => Number(p.stadeChutePhysioTauxPct));
  const moyenneTauxChute = tauxChutes.length ? Math.round((tauxChutes.reduce((a: number, b: number) => a + b, 0) / tauxChutes.length) * 10) / 10 : 0;

  const alertes: { type: "warning" | "error" | "info"; message: string }[] = [];
  phenoData.forEach((p: any) => {
    if (p.alerteFloraisonTardive) alertes.push({ type: "warning", message: `Variété ${p.variete?.codeVariete} : Floraison tardive` });
    if (p.alerteChutePhysioIntense) alertes.push({ type: "error", message: `Variété ${p.variete?.codeVariete} : Chute physiologique intense (>50%)` });
    if (p.prochaineObservationPrevue && p.prochaineObservationPrevue <= today && !p.notificationRappelEnvoyee) {
      alertes.push({ type: "info", message: `Variété ${p.variete?.codeVariete} : Observation due` });
    }
  });

  const stadeKeys = [
    "stadeReposDateDebut", "stadeDebourrementDateDebut", "stadeBoutonsFlorauxDateDebut",
    "stadePrefloraisonDateDebut", "stadeFloraisonDateDebut", "stadeChutePetalesDateDebut",
    "stadeNouaisonDateDebut", "stadeChutePhysioDateDebut", "stadeGrossissementDateDebut",
    "stadeVeraisonDateDebut", "stadeDebutMaturiteDate", "stadeMaturiteRecolteDate",
  ];

  const chartData = phenoData.map((p: any) => {
    let count = 0;
    stadeKeys.forEach((k) => { if (p[k]) count++; });
    return { variete: p.variete?.codeVariete || `ID ${p.varieteId}`, stades: count };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-foreground">🌸 Dashboard Phénologie</h1>
        <div className="w-48">
          <SearchableSelect
            options={(campagnes || []).map((c: any) => ({ value: c.id.toString(), label: c.codeCampagne }))}
            value={selectedCampagne}
            onValueChange={setSelectedCampagne}
            placeholder="Campagne..."
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Flower2 className="h-5 w-5 text-primary" /></div>
            <div><p className="text-2xl font-bold">{enFloraison}</p><p className="text-xs text-muted-foreground">En floraison</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><CalendarDays className="h-5 w-5 text-primary" /></div>
            <div><p className="text-2xl font-bold">{prochainesObs}</p><p className="text-xs text-muted-foreground">Observations dues</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Clock className="h-5 w-5 text-primary" /></div>
            <div><p className="text-2xl font-bold">{moyenneDureeFlo}j</p><p className="text-xs text-muted-foreground">Durée floraison moy.</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><TrendingDown className="h-5 w-5 text-destructive" /></div>
            <div><p className="text-2xl font-bold">{moyenneTauxChute}%</p><p className="text-xs text-muted-foreground">Taux chute moyen</p></div>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Progression des stades par variété</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="variete" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 12]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="stades" name="Stades complétés" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {alertes.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Alertes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {alertes.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Badge variant={a.type === "error" ? "destructive" : a.type === "warning" ? "outline" : "secondary"}>
                  {a.type === "error" ? "🔴" : a.type === "warning" ? "⚠️" : "📅"}
                </Badge>
                <span>{a.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {phenoData.length === 0 && (
        <p className="text-center text-muted-foreground py-12">Aucune donnée phénologique pour cette campagne</p>
      )}
    </div>
  );
}
