import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { refApi, productionApi, qualiteApi, phenologieApi } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Star, Flower2, AlertTriangle, CheckCircle, Download, TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend, Area, AreaChart, ComposedChart } from "recharts";
import { Navigate } from "react-router-dom";

export default function AnalyticsExecutive() {
  const { userInfo } = useAuth();

  if (userInfo.role !== "direction" && userInfo.role !== "responsable_central") {
    return <Navigate to="/dashboard" replace />;
  }

  const { data: productions = [] } = useQuery({
    queryKey: ["exec-productions"],
    queryFn: async () => { const r = await productionApi.list({ limit: 5000 }); return r.data || []; },
  });

  const { data: qualites = [] } = useQuery({
    queryKey: ["exec-qualites"],
    queryFn: async () => { const r = await qualiteApi.list({ limit: 5000 }); return r.data || []; },
  });

  const { data: phenologies = [] } = useQuery({
    queryKey: ["exec-phenologies"],
    queryFn: () => phenologieApi.list(),
  });

  const { data: domaines = [] } = useQuery({
    queryKey: ["exec-domaines"],
    queryFn: () => refApi.domaines(),
  });

  // KPIs Production
  const totalProdKg = productions.reduce((s: number, p: any) => s + (p.poidsTotalKg || 0), 0);
  const totalArbres = productions.length;
  const avgPoidsFruit = totalArbres ? productions.reduce((s: number, p: any) => s + (p.poidsMoyenFruitG || 0), 0) / totalArbres : 0;
  const qualiteAB = totalArbres ? (productions.filter((p: any) => p.qualiteGlobale === "A" || p.qualiteGlobale === "B").length / totalArbres) * 100 : 0;

  // KPIs Qualité
  const avgEA = qualites.length ? qualites.reduce((s: number, q: any) => s + (q.ratioEa || 0), 0) / qualites.length : 0;
  const avgBrix = qualites.length ? qualites.reduce((s: number, q: any) => s + (q.brixDegres || 0), 0) / qualites.length : 0;
  const maturiteOpt = qualites.length ? (qualites.filter((q: any) => q.maturiteOptimale).length / qualites.length) * 100 : 0;
  const granSevere = qualites.length ? (qualites.filter((q: any) => q.alerteGranulationSevere).length / qualites.length) * 100 : 0;

  // Top 5 variétés par production
  const prodByVariete: Record<string, { code: string; total: number }> = {};
  productions.forEach((p: any) => {
    const code = p.variete?.codeVariete || "?";
    if (!prodByVariete[code]) prodByVariete[code] = { code, total: 0 };
    prodByVariete[code].total += p.poidsTotalKg || 0;
  });
  const top5Prod = Object.values(prodByVariete).sort((a, b) => b.total - a.total).slice(0, 5);

  // Top 5 variétés par E/A
  const eaByVariete: Record<string, { code: string; total: number; count: number }> = {};
  qualites.forEach((q: any) => {
    const code = q.variete?.codeVariete || "?";
    if (!eaByVariete[code]) eaByVariete[code] = { code, total: 0, count: 0 };
    eaByVariete[code].total += q.ratioEa || 0;
    eaByVariete[code].count += 1;
  });
  const top5EA = Object.values(eaByVariete).map(v => ({ code: v.code, avg: v.count ? v.total / v.count : 0 })).sort((a, b) => b.avg - a.avg).slice(0, 5);

  // Domaines performance
  const domainePerf = domaines.map((d: any) => {
    const dProds = productions.filter((p: any) => p.domaineId === d.id);
    const dQuals = qualites.filter((q: any) => q.domaineId === d.id);
    const prodScore = dProds.reduce((s: number, p: any) => s + (p.poidsTotalKg || 0), 0);
    const qualScore = dQuals.length ? dQuals.reduce((s: number, q: any) => s + (q.ratioEa || 0), 0) / dQuals.length : 0;
    return { nom: d.nom, prodScore: Math.round(prodScore * 10) / 10, qualScore: Math.round(qualScore * 10) / 10 };
  }).sort((a: any, b: any) => (b.prodScore + b.qualScore * 10) - (a.prodScore + a.qualScore * 10));

  // Monthly evolution
  const monthlyData: Record<string, { month: string; prod: number; ea: number; count: number }> = {};
  productions.forEach((p: any) => {
    const m = p.dateRecolte?.substring(0, 7) || "";
    if (!monthlyData[m]) monthlyData[m] = { month: m, prod: 0, ea: 0, count: 0 };
    monthlyData[m].prod += p.poidsTotalKg || 0;
  });
  qualites.forEach((q: any) => {
    const m = q.dateAnalyse?.substring(0, 7) || "";
    if (!monthlyData[m]) monthlyData[m] = { month: m, prod: 0, ea: 0, count: 0 };
    monthlyData[m].ea += q.ratioEa || 0;
    monthlyData[m].count += 1;
  });
  const chartData = Object.values(monthlyData).map(d => ({
    month: d.month,
    prod: Math.round(d.prod * 10) / 10,
    ea: d.count ? Math.round((d.ea / d.count) * 10) / 10 : 0,
  })).sort((a, b) => a.month.localeCompare(b.month));

  // Alertes
  const alertes: { icon: typeof AlertTriangle; text: string; type: "warning" | "error" | "success" }[] = [];
  if (granSevere > 3) alertes.push({ icon: AlertTriangle, text: `Granulation sévère détectée (${granSevere.toFixed(0)}% analyses)`, type: "error" });
  if (avgEA >= 11.5) alertes.push({ icon: CheckCircle, text: `Qualité globale excellente (E/A moyen ${avgEA.toFixed(1)})`, type: "success" });
  if (qualiteAB < 80) alertes.push({ icon: AlertTriangle, text: `Qualité A+B sous objectif (${qualiteAB.toFixed(0)}%)`, type: "warning" });

  const medals = ["🥇", "🥈", "🥉", "", ""];
  const perfColors = ["🟢", "🟢", "🟡", "🟡", "🟠"];

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Vue Exécutive</h1>
        <Button variant="outline" size="sm" onClick={handleExportPDF}><Download className="h-4 w-4 mr-2" />Export PDF</Button>
      </div>

      {/* Row 1 - 3 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Package className="h-10 w-10 text-primary" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Production Totale Campagne</p>
                <p className="text-3xl font-bold text-foreground">{(totalProdKg / 1000).toFixed(1)} T</p>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p>{domaines.length} domaines • {totalArbres} arbres récoltés</p>
                  <p>Poids moyen : {avgPoidsFruit.toFixed(0)} g/fruit</p>
                  <p>Qualité A+B : {qualiteAB.toFixed(0)}%</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-secondary">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Star className="h-10 w-10 text-secondary" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Qualité Moyenne</p>
                <p className="text-3xl font-bold text-foreground">E/A {avgEA.toFixed(1)}</p>
                <Badge variant={avgEA >= 12 ? "default" : avgEA >= 10 ? "secondary" : "destructive"} className="mt-1">
                  {avgEA >= 12 ? "Optimal" : avgEA >= 10 ? "Acceptable" : "Faible"}
                </Badge>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p>Brix moyen : {avgBrix.toFixed(1)}°</p>
                  <p>Maturité optimale : {maturiteOpt.toFixed(0)}% analyses</p>
                  <p>Granulation sévère : {granSevere.toFixed(0)}%</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-info">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Flower2 className="h-10 w-10 text-info" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Avancement Cycle</p>
                <p className="text-3xl font-bold text-foreground">{phenologies.length} suivis</p>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p>Observations actives : {phenologies.filter((p: any) => !p.stadeMaturiteRecolteDate).length}</p>
                  <p>Cycles terminés : {phenologies.filter((p: any) => p.stadeMaturiteRecolteDate).length}</p>
                  <p>Alertes floraison : {phenologies.filter((p: any) => p.alerteFloraisonTardive).length}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2 - Consolidated Chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">Vue Consolidée - Production & Qualité</CardTitle></CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis yAxisId="left" label={{ value: "Production (kg)", angle: -90, position: "insideLeft" }} />
                <YAxis yAxisId="right" orientation="right" label={{ value: "E/A", angle: 90, position: "insideRight" }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="prod" fill="hsl(var(--primary))" name="Production (kg)" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="ea" stroke="hsl(var(--secondary))" name="E/A moyen" strokeWidth={2} dot />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-12">Aucune donnée</p>
          )}
        </CardContent>
      </Card>

      {/* Row 3 - Top Performers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Top 5 Variétés (Production)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {top5Prod.map((v, i) => (
              <div key={v.code} className="flex items-center justify-between text-sm">
                <span>{medals[i]} {v.code}</span>
                <Badge variant="outline">{(v.total / 1000).toFixed(2)} T</Badge>
              </div>
            ))}
            {top5Prod.length === 0 && <p className="text-xs text-muted-foreground">Aucune donnée</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Top 5 Variétés (E/A)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {top5EA.map((v, i) => (
              <div key={v.code} className="flex items-center justify-between text-sm">
                <span>{medals[i]} {v.code}</span>
                <Badge variant={v.avg >= 12 ? "default" : "secondary"}>E/A {v.avg.toFixed(1)}</Badge>
              </div>
            ))}
            {top5EA.length === 0 && <p className="text-xs text-muted-foreground">Aucune donnée</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Domaines (Performance)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {domainePerf.map((d, i) => (
              <div key={d.nom} className="flex items-center justify-between text-sm">
                <span>{perfColors[i]} {d.nom}</span>
                <span className="text-xs text-muted-foreground">{d.prodScore} kg • E/A {d.qualScore}</span>
              </div>
            ))}
            {domainePerf.length === 0 && <p className="text-xs text-muted-foreground">Aucune donnée</p>}
          </CardContent>
        </Card>
      </div>

      {/* Row 4 - Alertes */}
      {alertes.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Alertes & Actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {alertes.map((a, i) => (
              <div key={i} className={`flex items-center gap-2 text-sm p-2 rounded ${a.type === "error" ? "bg-destructive/10 text-destructive" : a.type === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>
                <a.icon className="h-4 w-4" />
                <span>{a.text}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
