import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { productionApi, qualiteApi, phenologieApi } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function AnalysesCroisees() {
  const { userInfo } = useAuth();

  const { data: productions = [] } = useQuery({
    queryKey: ["ac-prod"],
    queryFn: async () => {
      const r = await productionApi.list({
        domaineId: userInfo.role === "responsable_domaine" && userInfo.domaineId ? String(userInfo.domaineId) : undefined,
        limit: 5000,
      });
      return r.data || [];
    },
  });

  const { data: qualites = [] } = useQuery({
    queryKey: ["ac-qual"],
    queryFn: async () => {
      const r = await qualiteApi.list({
        domaineId: userInfo.role === "responsable_domaine" && userInfo.domaineId ? String(userInfo.domaineId) : undefined,
        limit: 5000,
      });
      return r.data || [];
    },
  });

  const { data: phenologies = [] } = useQuery({
    queryKey: ["ac-pheno"],
    queryFn: () => phenologieApi.list(),
  });

  // Section 1: Floraison → Production
  const floraisonData = useMemo(() => {
    const byVar: Record<string, { code: string; intensite: number; prod: number; count: number }> = {};
    phenologies.forEach((p: any) => {
      const code = p.variete?.codeVariete || "?";
      const intensiteMap: Record<string, number> = { "Faible": 1, "Moyenne": 2, "Élevée": 3 };
      const intensite = intensiteMap[p.stadeFloraisonIntensite || ""] || 0;
      if (intensite > 0) {
        if (!byVar[code]) byVar[code] = { code, intensite: 0, prod: 0, count: 0 };
        byVar[code].intensite = Math.max(byVar[code].intensite, intensite);
      }
    });
    productions.forEach((p: any) => {
      const code = p.variete?.codeVariete || "?";
      if (byVar[code]) {
        byVar[code].prod += p.poidsTotalKg || 0;
        byVar[code].count += 1;
      }
    });
    return Object.values(byVar).filter(v => v.count > 0).map(v => ({
      code: v.code, intensite: v.intensite, prodMoy: +(v.prod / v.count).toFixed(1),
    }));
  }, [phenologies, productions]);

  // Section 2: Chute physio → Déclassement
  const chuteData = useMemo(() => {
    const byVar: Record<string, { code: string; taux: number; declassement: number; count: number }> = {};
    phenologies.forEach((p: any) => {
      const code = p.variete?.codeVariete || "?";
      if (p.stadeChutePhysioTauxPct != null) {
        if (!byVar[code]) byVar[code] = { code, taux: 0, declassement: 0, count: 0 };
        byVar[code].taux = Math.max(byVar[code].taux, p.stadeChutePhysioTauxPct || 0);
      }
    });
    productions.forEach((p: any) => {
      const code = p.variete?.codeVariete || "?";
      if (byVar[code]) {
        byVar[code].declassement += p.tauxDeclassementPct || 0;
        byVar[code].count += 1;
      }
    });
    return Object.values(byVar).filter(v => v.count > 0).map(v => ({
      code: v.code, taux_chute: v.taux, declassement_moy: +(v.declassement / v.count).toFixed(1),
    }));
  }, [phenologies, productions]);

  // Section 3: Performance PG
  const pgData = useMemo(() => {
    const byPG: Record<string, { pg: string; nom: string; prod: number; prodC: number; ea: number; brix: number; qualC: number }> = {};
    productions.forEach((p: any) => {
      const pg = p.porteGreffe?.codePg || "?";
      const nom = p.porteGreffe?.nomPg || pg;
      if (!byPG[pg]) byPG[pg] = { pg, nom, prod: 0, prodC: 0, ea: 0, brix: 0, qualC: 0 };
      byPG[pg].prod += p.poidsTotalKg || 0;
      byPG[pg].prodC += 1;
    });
    qualites.forEach((q: any) => {
      const pg = q.porteGreffe?.codePg || "?";
      const nom = q.porteGreffe?.nomPg || pg;
      if (!byPG[pg]) byPG[pg] = { pg, nom, prod: 0, prodC: 0, ea: 0, brix: 0, qualC: 0 };
      byPG[pg].ea += q.ratioEa || 0;
      byPG[pg].brix += q.brixDegres || 0;
      byPG[pg].qualC += 1;
    });
    return Object.values(byPG).map(v => ({
      pg: v.pg, nom: v.nom,
      prodMoy: v.prodC ? +(v.prod / v.prodC).toFixed(1) : 0,
      eaMoy: v.qualC ? +(v.ea / v.qualC).toFixed(1) : 0,
      brixMoy: v.qualC ? +(v.brix / v.qualC).toFixed(1) : 0,
      score: 0,
    })).map(v => ({ ...v, score: Math.round((v.prodMoy * 0.4 + v.eaMoy * 3 + v.brixMoy * 2)) }))
      .sort((a, b) => b.score - a.score);
  }, [productions, qualites]);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Analyses Croisées</h1>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Download className="h-4 w-4 mr-2" />Export PDF</Button>
      </div>

      {/* Section 1: Floraison → Production */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Corrélation Floraison → Production</CardTitle>
          <CardDescription>Impact de l'intensité de floraison sur la production par arbre</CardDescription>
        </CardHeader>
        <CardContent>
          {floraisonData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="intensite" name="Intensité" domain={[0, 4]} ticks={[1, 2, 3]} tickFormatter={v => v === 1 ? "Faible" : v === 2 ? "Moyenne" : "Élevée"} />
                <YAxis type="number" dataKey="prodMoy" name="Prod moy (kg)" />
                <Tooltip content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  return <div className="bg-card border p-2 rounded text-xs"><p className="font-bold">{d.code}</p><p>Intensité: {d.intensite === 1 ? "Faible" : d.intensite === 2 ? "Moyenne" : "Élevée"}</p><p>Prod moy: {d.prodMoy} kg</p></div>;
                }} />
                <Scatter data={floraisonData} fill="hsl(var(--primary))" />
              </ScatterChart>
            </ResponsiveContainer>
          ) : <p className="text-muted-foreground text-sm text-center py-8">Pas assez de données phénologiques avec intensité de floraison</p>}
        </CardContent>
      </Card>

      {/* Section 2: Chute → Déclassement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Impact Chute Physiologique sur le Déclassement</CardTitle>
          <CardDescription>Relation entre le taux de chute et le % de déclassement</CardDescription>
        </CardHeader>
        <CardContent>
          {chuteData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="taux_chute" name="Taux chute (%)" />
                <YAxis type="number" dataKey="declassement_moy" name="Déclassement moy (%)" />
                <Tooltip content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  return <div className="bg-card border p-2 rounded text-xs"><p className="font-bold">{d.code}</p><p>Chute: {d.taux_chute}%</p><p>Déclassement: {d.declassement_moy}%</p></div>;
                }} />
                <Scatter data={chuteData} fill="hsl(var(--destructive))" />
              </ScatterChart>
            </ResponsiveContainer>
          ) : <p className="text-muted-foreground text-sm text-center py-8">Pas assez de données</p>}
        </CardContent>
      </Card>

      {/* Section 3: Performance PG */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance Porte-Greffes</CardTitle>
          <CardDescription>Comparaison globale des porte-greffes</CardDescription>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Porte-Greffe</th>
                <th className="p-2 text-right">Prod moy (kg)</th>
                <th className="p-2 text-right">E/A moy</th>
                <th className="p-2 text-right">Brix moy</th>
                <th className="p-2 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {pgData.map((pg, i) => (
                <tr key={pg.pg} className="border-b">
                  <td className="p-2 font-medium">{medals[i] || ""} {pg.nom} ({pg.pg})</td>
                  <td className="p-2 text-right">{pg.prodMoy}</td>
                  <td className="p-2 text-right">
                    <Badge variant={pg.eaMoy >= 12 ? "default" : pg.eaMoy >= 10 ? "secondary" : "destructive"}>{pg.eaMoy}</Badge>
                  </td>
                  <td className="p-2 text-right">{pg.brixMoy}°</td>
                  <td className="p-2 text-right font-bold">{pg.score}/100</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pgData.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">Aucune donnée</p>}
        </CardContent>
      </Card>
    </div>
  );
}
