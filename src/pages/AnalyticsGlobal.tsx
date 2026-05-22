import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { refApi, productionApi, qualiteApi } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, TrendingUp, TrendingDown } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line,
  CartesianGrid, Legend, ScatterChart, Scatter, ZAxis, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, AreaChart, Area, ComposedChart, Cell,
} from "recharts";

const DOMAIN_COLORS = ["hsl(123,38%,33%)", "hsl(21,100%,60%)", "hsl(207,90%,54%)", "hsl(36,100%,50%)", "hsl(280,60%,50%)"];

export default function AnalyticsGlobal() {
  const { userInfo } = useAuth();
  const [selectedCampagne, setSelectedCampagne] = useState<string>("all");
  const [selectedDomaine, setSelectedDomaine] = useState<string>("all");

  const { data: campagnes = [] } = useQuery({
    queryKey: ["ag-campagnes"],
    queryFn: () => refApi.campagnes(),
  });

  const { data: domaines = [] } = useQuery({
    queryKey: ["ag-domaines"],
    queryFn: () => refApi.domaines(),
  });

  const { data: productions = [] } = useQuery({
    queryKey: ["ag-productions"],
    queryFn: async () => { const r = await productionApi.list({ limit: 5000 }); return r.data || []; },
  });

  const { data: qualites = [] } = useQuery({
    queryKey: ["ag-qualites"],
    queryFn: async () => { const r = await qualiteApi.list({ limit: 5000 }); return r.data || []; },
  });

  const { data: typesVarietes = [] } = useQuery({
    queryKey: ["ag-types"],
    queryFn: () => refApi.typesVarietes(),
  });

  // Filter data
  const filteredProd = useMemo(() => {
    let d = productions;
    if (selectedCampagne !== "all") d = d.filter((p: any) => p.campagneId === Number(selectedCampagne));
    if (selectedDomaine !== "all") d = d.filter((p: any) => p.domaineId === Number(selectedDomaine));
    if (userInfo.role === "responsable_domaine" && userInfo.domaineId) d = d.filter((p: any) => String(p.domaineId) === String(userInfo.domaineId));
    return d;
  }, [productions, selectedCampagne, selectedDomaine, userInfo]);

  const filteredQual = useMemo(() => {
    let d = qualites;
    if (selectedCampagne !== "all") d = d.filter((q: any) => q.campagneId === Number(selectedCampagne));
    if (selectedDomaine !== "all") d = d.filter((q: any) => q.domaineId === Number(selectedDomaine));
    if (userInfo.role === "responsable_domaine" && userInfo.domaineId) d = d.filter((q: any) => String(q.domaineId) === String(userInfo.domaineId));
    return d;
  }, [qualites, selectedCampagne, selectedDomaine, userInfo]);

  // KPIs
  const totalProd = filteredProd.reduce((s: number, p: any) => s + (p.poidsTotalKg || 0), 0);
  const avgPoidsFruit = filteredProd.length ? filteredProd.reduce((s: number, p: any) => s + (p.poidsMoyenFruitG || 0), 0) / filteredProd.length : 0;
  const avgEA = filteredQual.length ? filteredQual.reduce((s: number, q: any) => s + (q.ratioEa || 0), 0) / filteredQual.length : 0;
  const avgBrix = filteredQual.length ? filteredQual.reduce((s: number, q: any) => s + (q.brixDegres || 0), 0) / filteredQual.length : 0;
  const maturiteOpt = filteredQual.length ? (filteredQual.filter((q: any) => q.maturiteOptimale).length / filteredQual.length) * 100 : 0;

  // Scatter: Production vs Qualité par variété
  const scatterData = useMemo(() => {
    const byVar: Record<string, { code: string; prod: number; ea: number; eaCount: number; count: number }> = {};
    filteredProd.forEach((p: any) => {
      const c = p.variete?.codeVariete || "?";
      if (!byVar[c]) byVar[c] = { code: c, prod: 0, ea: 0, eaCount: 0, count: 0 };
      byVar[c].prod += p.poidsTotalKg || 0;
      byVar[c].count += 1;
    });
    filteredQual.forEach((q: any) => {
      const c = q.variete?.codeVariete || "?";
      if (!byVar[c]) byVar[c] = { code: c, prod: 0, ea: 0, eaCount: 0, count: 0 };
      byVar[c].ea += q.ratioEa || 0;
      byVar[c].eaCount += 1;
    });
    return Object.values(byVar).filter(v => v.eaCount > 0).map(v => ({
      code: v.code, prod: Math.round(v.prod * 10) / 10, ea: Math.round((v.ea / v.eaCount) * 10) / 10, count: v.count,
    }));
  }, [filteredProd, filteredQual]);

  // Heatmap: Domaines × Variétés
  const heatmapData = useMemo(() => {
    const data: { domaine: string; variete: string; value: number }[] = [];
    const vars = new Set<string>();
    filteredProd.forEach((p: any) => vars.add(p.variete?.codeVariete || "?"));
    const topVars = [...vars].slice(0, 15);
    domaines.forEach((d: any) => {
      topVars.forEach(v => {
        const total = filteredProd.filter((p: any) => p.domaineId === d.id && p.variete?.codeVariete === v).reduce((s: number, p: any) => s + (p.poidsTotalKg || 0), 0);
        data.push({ domaine: d.nom, variete: v, value: Math.round(total * 10) / 10 });
      });
    });
    return { data, vars: topVars };
  }, [filteredProd, domaines]);

  // Monthly by domaine
  const monthlyByDomaine = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    filteredProd.forEach((p: any) => {
      const m = p.dateRecolte?.substring(0, 7) || "";
      const d = p.domaine?.nom || "?";
      if (!map[m]) map[m] = {};
      map[m][d] = (map[m][d] || 0) + (p.poidsTotalKg || 0);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, vals]) => ({ month, ...vals }));
  }, [filteredProd]);

  // Radar per domaine
  const radarData = useMemo(() => {
    return domaines.map((d: any) => {
      const dP = filteredProd.filter((p: any) => p.domaineId === d.id);
      const dQ = filteredQual.filter((q: any) => q.domaineId === d.id);
      return {
        domaine: d.nom,
        Production: dP.reduce((s: number, p: any) => s + (p.poidsTotalKg || 0), 0),
        Brix: dQ.length ? dQ.reduce((s: number, q: any) => s + (q.brixDegres || 0), 0) / dQ.length : 0,
        EA: dQ.length ? dQ.reduce((s: number, q: any) => s + (q.ratioEa || 0), 0) / dQ.length : 0,
        Jus: dQ.length ? dQ.reduce((s: number, q: any) => s + (q.pctJus || 0), 0) / dQ.length : 0,
        Calibre: dP.length ? dP.reduce((s: number, p: any) => s + (p.calibreMoyenMm || 0), 0) / dP.length : 0,
      };
    });
  }, [domaines, filteredProd, filteredQual]);

  const domaineNames = domaines.map((d: any) => d.nom);

  const kpis = [
    { title: "Production (T)", value: (totalProd / 1000).toFixed(2) },
    { title: "Arbres récoltés", value: filteredProd.length },
    { title: "Poids moyen (g)", value: avgPoidsFruit.toFixed(1) },
    { title: "E/A moyen", value: avgEA.toFixed(1) },
    { title: "Brix moyen", value: avgBrix.toFixed(1) + "°" },
    { title: "Analyses qualité", value: filteredQual.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Dashboard Global</h1>
        <div className="flex gap-2">
          <Select value={selectedCampagne} onValueChange={setSelectedCampagne}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Campagne" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {campagnes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.codeCampagne}</SelectItem>)}
            </SelectContent>
          </Select>
          {userInfo.role !== "responsable_domaine" && (
            <Select value={selectedDomaine} onValueChange={setSelectedDomaine}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Domaine" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {domaines.map((d: any) => <SelectItem key={d.id} value={String(d.id)}>{d.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="temporal">Analyses temporelles</TabsTrigger>
          <TabsTrigger value="compare">Comparaisons</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpis.map(k => (
              <Card key={k.title}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">{k.title}</p>
                  <p className="text-xl font-bold">{k.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Scatter Plot */}
          <Card>
            <CardHeader><CardTitle className="text-base">Matrice Production × Qualité par Variété</CardTitle></CardHeader>
            <CardContent>
              {scatterData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <ScatterChart margin={{ left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="prod" name="Production (kg)" label={{ value: "Production (kg)", position: "bottom" }} />
                    <YAxis type="number" dataKey="ea" name="E/A" label={{ value: "E/A", angle: -90, position: "insideLeft" }} />
                    <ZAxis type="number" dataKey="count" range={[50, 400]} name="Nb arbres" />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
                      if (!payload?.length) return null;
                      const d = payload[0].payload;
                      return <div className="bg-card border p-2 rounded text-xs"><p className="font-bold">{d.code}</p><p>Prod: {d.prod} kg</p><p>E/A: {d.ea}</p><p>Arbres: {d.count}</p></div>;
                    }} />
                    <Scatter data={scatterData} fill="hsl(var(--primary))" />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : <p className="text-muted-foreground text-sm text-center py-12">Aucune donnée</p>}
            </CardContent>
          </Card>

          {/* Heatmap as table */}
          <Card>
            <CardHeader><CardTitle className="text-base">Performance Domaines × Variétés (kg)</CardTitle></CardHeader>
            <CardContent className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr><th className="text-left p-1">Domaine</th>{heatmapData.vars.map(v => <th key={v} className="p-1 text-center">{v}</th>)}</tr>
                </thead>
                <tbody>
                  {domaines.map((d: any) => (
                    <tr key={d.id}>
                      <td className="p-1 font-medium">{d.nom}</td>
                      {heatmapData.vars.map(v => {
                        const cell = heatmapData.data.find(h => h.domaine === d.nom && h.variete === v);
                        const val = cell?.value || 0;
                        const bg = val > 50 ? "bg-primary/30" : val > 20 ? "bg-primary/20" : val > 10 ? "bg-warning/20" : val > 0 ? "bg-secondary/20" : "bg-muted/30";
                        return <td key={v} className={`p-1 text-center ${bg}`}>{val > 0 ? val : "-"}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="temporal" className="space-y-6">
          {/* Monthly by domaine */}
          <Card>
            <CardHeader><CardTitle className="text-base">Évolution Production Mensuelle par Domaine</CardTitle></CardHeader>
            <CardContent>
              {monthlyByDomaine.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={monthlyByDomaine}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {domaineNames.map((n, i) => <Line key={n} type="monotone" dataKey={n} stroke={DOMAIN_COLORS[i % DOMAIN_COLORS.length]} strokeWidth={2} dot={false} />)}
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-muted-foreground text-sm text-center py-12">Aucune donnée</p>}
            </CardContent>
          </Card>

          {/* Brix vs E/A monthly */}
          <Card>
            <CardHeader><CardTitle className="text-base">Corrélation Brix vs E/A Mensuel</CardTitle></CardHeader>
            <CardContent>
              {(() => {
                const monthlyQ: Record<string, { brix: number; ea: number; c: number }> = {};
                filteredQual.forEach((q: any) => {
                  const m = q.dateAnalyse?.substring(0, 7) || "";
                  if (!monthlyQ[m]) monthlyQ[m] = { brix: 0, ea: 0, c: 0 };
                  monthlyQ[m].brix += q.brixDegres || 0;
                  monthlyQ[m].ea += q.ratioEa || 0;
                  monthlyQ[m].c += 1;
                });
                const data = Object.entries(monthlyQ).sort(([a], [b]) => a.localeCompare(b)).map(([m, v]) => ({ month: m, brix: +(v.brix / v.c).toFixed(1), ea: +(v.ea / v.c).toFixed(1) }));
                return data.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="l" />
                      <YAxis yAxisId="r" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="l" type="monotone" dataKey="brix" stroke="hsl(207,90%,54%)" name="Brix" strokeWidth={2} />
                      <Line yAxisId="r" type="monotone" dataKey="ea" stroke="hsl(21,100%,60%)" name="E/A" strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : <p className="text-muted-foreground text-sm text-center py-12">Aucune donnée</p>;
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compare" className="space-y-6">
          {/* Radar Chart */}
          <Card>
            <CardHeader><CardTitle className="text-base">Profil Qualité par Domaine</CardTitle></CardHeader>
            <CardContent>
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={[
                    { metric: "Production", ...Object.fromEntries(radarData.map(r => [r.domaine, r.Production])) },
                    { metric: "Brix", ...Object.fromEntries(radarData.map(r => [r.domaine, r.Brix])) },
                    { metric: "E/A", ...Object.fromEntries(radarData.map(r => [r.domaine, r.EA])) },
                    { metric: "% Jus", ...Object.fromEntries(radarData.map(r => [r.domaine, r.Jus])) },
                    { metric: "Calibre", ...Object.fromEntries(radarData.map(r => [r.domaine, r.Calibre])) },
                  ]}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis />
                    {domaineNames.map((n, i) => <Radar key={n} name={n} dataKey={n} stroke={DOMAIN_COLORS[i % DOMAIN_COLORS.length]} fill={DOMAIN_COLORS[i % DOMAIN_COLORS.length]} fillOpacity={0.15} />)}
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              ) : <p className="text-muted-foreground text-sm text-center py-12">Aucune donnée</p>}
            </CardContent>
          </Card>

          {/* Campagne comparison table */}
          <Card>
            <CardHeader><CardTitle className="text-base">Comparaison Campagnes</CardTitle></CardHeader>
            <CardContent className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Campagne</th>
                    <th className="p-2 text-right">Production (T)</th>
                    <th className="p-2 text-right">Arbres</th>
                    <th className="p-2 text-right">E/A moy</th>
                    <th className="p-2 text-right">Brix moy</th>
                    <th className="p-2 text-right">Analyses</th>
                  </tr>
                </thead>
                <tbody>
                  {campagnes.map((c: any) => {
                    const cp = productions.filter((p: any) => p.campagneId === c.id);
                    const cq = qualites.filter((q: any) => q.campagneId === c.id);
                    return (
                      <tr key={c.id} className="border-b">
                        <td className="p-2 font-medium">{c.codeCampagne}</td>
                        <td className="p-2 text-right">{(cp.reduce((s: number, p: any) => s + (p.poidsTotalKg || 0), 0) / 1000).toFixed(2)}</td>
                        <td className="p-2 text-right">{cp.length}</td>
                        <td className="p-2 text-right">{cq.length ? (cq.reduce((s: number, q: any) => s + (q.ratioEa || 0), 0) / cq.length).toFixed(1) : "-"}</td>
                        <td className="p-2 text-right">{cq.length ? (cq.reduce((s: number, q: any) => s + (q.brixDegres || 0), 0) / cq.length).toFixed(1) + "°" : "-"}</td>
                        <td className="p-2 text-right">{cq.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
