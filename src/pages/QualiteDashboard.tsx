import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { qualiteApi } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Citrus, Star, CheckCircle } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, ReferenceLine
} from "recharts";

function EaBadgeInline({ value }: { value: number | null }) {
  if (value == null) return <span>-</span>;
  if (value >= 12) return <Badge className="bg-success/20 text-success">{value.toFixed(1)} ⭐</Badge>;
  if (value >= 10) return <Badge className="bg-warning/20 text-warning">{value.toFixed(1)}</Badge>;
  return <Badge className="bg-destructive/20 text-destructive">{value.toFixed(1)}</Badge>;
}

const COLORS = ["hsl(21,100%,60%)", "hsl(207,90%,54%)", "hsl(123,38%,33%)", "hsl(36,100%,50%)", "hsl(280,60%,50%)"];
const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export default function QualiteDashboard() {
  const { userInfo } = useAuth();
  const [selectedVariete, setSelectedVariete] = useState<string>("all");

  const { data: analyses = [] } = useQuery({
    queryKey: ["qualite-dashboard", userInfo.domaineId],
    queryFn: async () => {
      const result = await qualiteApi.list({
        statut: "Validé",
        domaineId: userInfo.domaineId ?? undefined,
        limit: 2000,
      });
      return (result.data || []) as any[];
    },
  });

  // KPIs
  const now = new Date();
  const thisMonth = analyses.filter((a: any) => {
    const d = new Date(a.dateAnalyse);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const avgBrix = analyses.length ? analyses.reduce((s: number, a: any) => s + (a.brixDegres || 0), 0) / analyses.length : 0;
  const avgEA = analyses.length ? analyses.reduce((s: number, a: any) => s + (a.ratioEa || 0), 0) / analyses.length : 0;
  const pctOptimal = analyses.length ? (analyses.filter((a: any) => a.maturiteOptimale).length / analyses.length) * 100 : 0;

  const kpis = [
    { title: "Analyses (ce mois)", value: thisMonth.length, icon: BarChart3, color: "text-primary" },
    { title: "Brix moyen", value: avgBrix.toFixed(1) + "°", icon: Citrus, color: "text-warning" },
    { title: "E/A moyen", value: avgEA.toFixed(1), icon: Star, color: "text-info" },
    { title: "% Maturité optimale", value: pctOptimal.toFixed(0) + "%", icon: CheckCircle, color: "text-success" },
  ];

  // E/A evolution by month (top 5 varieties)
  const varieteCounts: Record<string, number> = {};
  analyses.forEach((a: any) => { const c = a.variete?.codeVariete; if (c) varieteCounts[c] = (varieteCounts[c] || 0) + 1; });
  const top5 = Object.entries(varieteCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);

  const eaByMonth: Record<number, Record<string, number[]>> = {};
  analyses.forEach((a: any) => {
    const m = a.moisAnalyse;
    const code = a.variete?.codeVariete;
    if (!m || !code || !top5.includes(code)) return;
    if (!eaByMonth[m]) eaByMonth[m] = {};
    if (!eaByMonth[m][code]) eaByMonth[m][code] = [];
    if (a.ratioEa) eaByMonth[m][code].push(a.ratioEa);
  });
  const eaLineData = Object.entries(eaByMonth).sort(([a], [b]) => Number(a) - Number(b)).map(([m, varieties]) => {
    const point: any = { mois: MONTHS[Number(m) - 1] || m };
    top5.forEach((v) => { point[v] = varieties[v] ? +(varieties[v].reduce((s, x) => s + x, 0) / varieties[v].length).toFixed(2) : null; });
    return point;
  });

  // Brix by type
  const brixByType: Record<string, { total: number; count: number; color: string }> = {};
  analyses.forEach((a: any) => {
    const t = a.variete?.typeVariete;
    if (!t) return;
    if (!brixByType[t.typeCode]) brixByType[t.typeCode] = { total: 0, count: 0, color: t.couleurBadge || "#999" };
    brixByType[t.typeCode].total += a.brixDegres || 0;
    brixByType[t.typeCode].count += 1;
  });
  const brixBarData = Object.entries(brixByType).map(([type, d]) => ({ type, brix: +(d.total / d.count).toFixed(2), color: d.color }));

  // Maturity timeline for selected variety
  const uniqueVarietes = [...new Set(analyses.map((a: any) => a.variete?.codeVariete).filter(Boolean))];
  const timelineData = analyses
    .filter((a: any) => selectedVariete === "all" || a.variete?.codeVariete === selectedVariete)
    .sort((a: any, b: any) => new Date(a.dateAnalyse).getTime() - new Date(b.dateAnalyse).getTime())
    .map((a: any) => ({
      date: new Date(a.dateAnalyse).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      brix: a.brixDegres,
      acidite: a.aciditeGl,
      ea: a.ratioEa,
    }));

  // Top 10 varieties by E/A
  const varieteStats: Record<string, { brix: number[]; acidite: number[]; ea: number[]; jus: number[]; type: string }> = {};
  analyses.forEach((a: any) => {
    const code = a.variete?.codeVariete;
    if (!code) return;
    if (!varieteStats[code]) varieteStats[code] = { brix: [], acidite: [], ea: [], jus: [], type: a.variete?.typeVariete?.typeCode || "" };
    if (a.brixDegres) varieteStats[code].brix.push(a.brixDegres);
    if (a.aciditeGl) varieteStats[code].acidite.push(a.aciditeGl);
    if (a.ratioEa) varieteStats[code].ea.push(a.ratioEa);
    if (a.pctJus) varieteStats[code].jus.push(a.pctJus);
  });
  const avg = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
  const topVarietes = Object.entries(varieteStats)
    .map(([code, s]) => ({ code, type: s.type, brix: avg(s.brix), acidite: avg(s.acidite), ea: avg(s.ea), jus: avg(s.jus), count: s.ea.length }))
    .sort((a, b) => b.ea - a.ea)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard Qualité</h1>

      {/* KPIs */}
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

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Évolution E/A par mois (Top 5 variétés)</CardTitle></CardHeader>
          <CardContent>
            {eaLineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={eaLineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mois" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine y={12} stroke="hsl(123,38%,33%)" strokeDasharray="5 5" label="Optimal" />
                  {top5.map((v, i) => <Line key={v} type="monotone" dataKey={v} stroke={COLORS[i]} strokeWidth={2} dot connectNulls />)}
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-12">Aucune donnée</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Brix moyen par type</CardTitle></CardHeader>
          <CardContent>
            {brixBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={brixBarData}>
                  <XAxis dataKey="type" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="brix" radius={[4, 4, 0, 0]}>
                    {brixBarData.map((d, i) => (
                      <rect key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-12">Aucune donnée</p>}
          </CardContent>
        </Card>
      </div>

      {/* Maturity timeline */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-base">Courbe de maturité</CardTitle>
            <Select value={selectedVariete} onValueChange={setSelectedVariete}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Variété" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes variétés</SelectItem>
                {uniqueVarietes.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {timelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <ReferenceLine yAxisId="left" y={12} stroke="hsl(123,38%,33%)" strokeDasharray="5 5" label="E/A Optimal" />
                <Line yAxisId="left" type="monotone" dataKey="brix" name="Brix (°)" stroke="hsl(207,90%,54%)" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="acidite" name="Acidité (g/L)" stroke="hsl(0,70%,50%)" strokeWidth={2} />
                <Line yAxisId="left" type="monotone" dataKey="ea" name="E/A" stroke="hsl(123,38%,33%)" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-muted-foreground text-sm text-center py-12">Aucune donnée</p>}
        </CardContent>
      </Card>

      {/* Top 10 table */}
      <Card>
        <CardHeader><CardTitle className="text-base">🏆 Top 10 Variétés par Qualité (E/A moyen)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rang</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Brix moy</TableHead>
                <TableHead className="text-right">Acidité moy</TableHead>
                <TableHead>E/A moy</TableHead>
                <TableHead className="text-right">% Jus moy</TableHead>
                <TableHead className="text-right">Analyses</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topVarietes.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucune donnée</TableCell></TableRow>
              ) : topVarietes.map((v, i) => (
                <TableRow key={v.code}>
                  <TableCell className="font-medium">{i + 1}</TableCell>
                  <TableCell><Badge variant="outline">{v.code}</Badge></TableCell>
                  <TableCell>{v.type}</TableCell>
                  <TableCell className="text-right">{v.brix.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{v.acidite.toFixed(2)}</TableCell>
                  <TableCell><EaBadgeInline value={v.ea} /></TableCell>
                  <TableCell className="text-right">{v.jus.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{v.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
