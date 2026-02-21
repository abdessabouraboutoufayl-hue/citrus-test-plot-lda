import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sprout, Package, Cherry, Star } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["hsl(123,38%,33%)", "hsl(21,100%,60%)", "hsl(207,90%,54%)", "hsl(36,100%,50%)"];

export default function Dashboard() {
  const { userInfo } = useAuth();

  const { data: productions = [] } = useQuery({
    queryKey: ["dashboard-productions", userInfo.domaineId],
    queryFn: async () => {
      let query = supabase.from("production").select("*, varietes(code_variete, nom_commercial, type_id), porte_greffes(code_pg), domaines(nom)");
      if (userInfo.role === "responsable_domaine" && userInfo.domaineId) {
        query = query.eq("domaine_id", userInfo.domaineId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const totalArbres = productions.length;
  const totalPoids = productions.reduce((s, p) => s + (p.poids_total_kg || 0), 0);
  const avgPoidsFruit = productions.length
    ? productions.reduce((s, p) => s + (p.poids_moyen_fruit_g || 0), 0) / productions.length
    : 0;
  const qualiteAB = productions.length
    ? (productions.filter((p) => p.qualite_globale === "A" || p.qualite_globale === "B").length / productions.length) * 100
    : 0;

  // Bar chart: production by variété
  const byVariete: Record<string, number> = {};
  productions.forEach((p) => {
    const code = (p.varietes as any)?.code_variete || "?";
    byVariete[code] = (byVariete[code] || 0) + p.poids_total_kg;
  });
  const barData = Object.entries(byVariete)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([code, poids]) => ({ code, poids: Math.round(poids * 100) / 100 }));

  // Pie chart: porte-greffes
  const byPG: Record<string, number> = {};
  productions.forEach((p) => {
    const pg = (p.porte_greffes as any)?.code_pg || "?";
    byPG[pg] = (byPG[pg] || 0) + 1;
  });
  const pieData = Object.entries(byPG).map(([name, value]) => ({ name, value }));

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
    </div>
  );
}
