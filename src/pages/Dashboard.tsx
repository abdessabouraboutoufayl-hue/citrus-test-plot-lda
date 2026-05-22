import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { productionApi } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sprout, Package, Cherry, Star } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { getCalibreType, getCalibreEntries, NB_ECHANTILLON } from "@/lib/calibre-config";

const COLORS = ["hsl(123,38%,33%)", "hsl(21,100%,60%)", "hsl(207,90%,54%)", "hsl(36,100%,50%)"];

const CALIBRE_COLORS = [
  "#2d6a4f", "#40916c", "#52b788", "#74c69d", "#95d5b2",
  "#d4a373", "#e9c46a", "#f4a261", "#e76f51", "#d62828",
  "#9b2226", "#6a040f",
];

export default function Dashboard() {
  const { userInfo } = useAuth();

  const { data: productions = [] } = useQuery({
    queryKey: ["dashboard-productions", userInfo.domaineId],
    queryFn: async () => {
      const result = await productionApi.list({
        domaineId: userInfo.domaineId ?? undefined,
        limit: 1000,
      });
      return result.data || [];
    },
  });

  const totalArbres = productions.length;
  const totalPoids = productions.reduce((s: number, p: any) => s + (Number(p.poidsTotalKg) || 0), 0);
  const avgPoidsFruit = productions.length
    ? productions.reduce((s: number, p: any) => s + (Number(p.poidsMoyenFruitG) || 0), 0) / productions.length
    : 0;
  const qualiteAB = productions.length
    ? (productions.filter((p: any) => p.qualiteGlobale === "A" || p.qualiteGlobale === "B").length / productions.length) * 100
    : 0;

  // Bar chart: production by variété
  const byVariete: Record<string, number> = {};
  productions.forEach((p: any) => {
    const code = p.variete?.codeVariete || "?";
    byVariete[code] = (byVariete[code] || 0) + Number(p.poidsTotalKg);
  });
  const barData = Object.entries(byVariete)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([code, poids]) => ({ code, poids: Math.round(poids * 100) / 100 }));

  // Pie chart: porte-greffes
  const byPG: Record<string, number> = {};
  productions.forEach((p: any) => {
    const pg = p.porteGreffe?.codePg || "?";
    byPG[pg] = (byPG[pg] || 0) + 1;
  });
  const pieData = Object.entries(byPG).map(([name, value]) => ({ name, value }));

  // Calibre distribution by variety
  const calibreChartData = (() => {
    const byVar: Record<string, { count: number; calibres: Record<string, number> }> = {};
    productions.forEach((p: any) => {
      const code = p.variete?.codeVariete;
      if (!code || !p.nbFruitsEchantillon) return;
      const calType = getCalibreType(code);
      if (!calType) return;
      const entries = getCalibreEntries(calType);
      if (!byVar[code]) byVar[code] = { count: 0, calibres: {} };
      byVar[code].count++;
      entries.forEach(e => {
        const val = Number(p[e.dbColumn]) || 0;
        byVar[code].calibres[e.label] = (byVar[code].calibres[e.label] || 0) + val;
      });
    });
    return Object.entries(byVar).map(([code, data]) => {
      const row: Record<string, any> = { code };
      const calType = getCalibreType(code);
      const entries = getCalibreEntries(calType);
      entries.forEach(e => {
        row[e.label] = data.count > 0
          ? Math.round(((data.calibres[e.label] || 0) / (data.count * NB_ECHANTILLON)) * 1000) / 10
          : 0;
      });
      return row;
    });
  })();

  const calibreLabels = (() => {
    if (calibreChartData.length === 0) return [];
    const firstCode = calibreChartData[0].code;
    const calType = getCalibreType(firstCode);
    return getCalibreEntries(calType).map(e => e.label);
  })();

  const kpis = [
    { title: "Arbres récoltés", value: totalArbres, icon: Sprout, color: "text-primary" },
    { title: "Production (kg)", value: totalPoids.toFixed(1), icon: Package, color: "text-secondary" },
    { title: "Poids moyen (g)", value: avgPoidsFruit.toFixed(1), icon: Cherry, color: "text-info" },
    { title: "Qualité A+B %", value: qualiteAB.toFixed(0) + "%", icon: Star, color: "text-warning" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <kpi.icon className={`h-8 w-8 ${kpi.color}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{kpi.title}</p>
                  <p className="text-xl font-bold">{kpi.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Production par variété (Top 10)</CardTitle></CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData} layout="vertical" margin={{ left: 60 }}>
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="code" width={50} />
                  <Tooltip />
                  <Bar dataKey="poids" fill="hsl(123,38%,33%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-12">Aucune donnée</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Répartition porte-greffes</CardTitle></CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-12">Aucune donnée</p>
            )}
          </CardContent>
        </Card>
      </div>

      {calibreChartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Distribution Calibres par Variété (% moyen)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={calibreChartData} margin={{ left: 20, bottom: 20 }}>
                <XAxis dataKey="code" />
                <YAxis unit="%" />
                <Tooltip formatter={(value: number) => `${value}%`} />
                <Legend />
                {calibreLabels.map((label, i) => (
                  <Bar key={label} dataKey={label} stackId="calibre" fill={CALIBRE_COLORS[i % CALIBRE_COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
