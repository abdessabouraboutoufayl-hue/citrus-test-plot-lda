import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Flower2, CalendarDays, Clock, TrendingDown, AlertTriangle } from "lucide-react";

export default function PhenologieDashboard() {
  const [selectedCampagne, setSelectedCampagne] = useState<string>("");

  const { data: campagnes } = useQuery({
    queryKey: ["campagnes"],
    queryFn: async () => {
      const { data } = await supabase.from("campagnes").select("*").order("date_debut", { ascending: false });
      return data || [];
    },
  });

  const { data: phenoData } = useQuery({
    queryKey: ["phenologie-dashboard", selectedCampagne],
    queryFn: async () => {
      let query = supabase.from("phenologie").select("*, varietes(code_variete, nom_commercial), domaines(nom)");
      if (selectedCampagne) query = query.eq("campagne_id", Number(selectedCampagne));
      const { data } = await query.order("variete_id");
      return data || [];
    },
  });

  const today = new Date().toISOString().split("T")[0];
  const enFloraison = (phenoData || []).filter(
    (p) => p.stade_floraison_date_debut && (!p.stade_floraison_date_fin || p.stade_floraison_date_fin >= today)
  ).length;

  const prochainesObs = (phenoData || []).filter(
    (p) => p.prochaine_observation_prevue && p.prochaine_observation_prevue <= today
  ).length;

  const dureesFlo = (phenoData || []).filter((p) => p.duree_floraison_jours).map((p) => p.duree_floraison_jours!);
  const moyenneDureeFlo = dureesFlo.length ? Math.round(dureesFlo.reduce((a, b) => a + b, 0) / dureesFlo.length) : 0;

  const tauxChutes = (phenoData || []).filter((p) => p.stade_chute_physio_taux_pct).map((p) => Number(p.stade_chute_physio_taux_pct));
  const moyenneTauxChute = tauxChutes.length ? Math.round((tauxChutes.reduce((a, b) => a + b, 0) / tauxChutes.length) * 10) / 10 : 0;

  const alertes: { type: "warning" | "error" | "info"; message: string }[] = [];
  (phenoData || []).forEach((p) => {
    if (p.alerte_floraison_tardive) alertes.push({ type: "warning", message: `Variété ${(p as any).varietes?.code_variete} : Floraison tardive` });
    if (p.alerte_chute_physio_intense) alertes.push({ type: "error", message: `Variété ${(p as any).varietes?.code_variete} : Chute physiologique intense (>50%)` });
    if (p.prochaine_observation_prevue && p.prochaine_observation_prevue <= today && !p.notification_rappel_envoyee) {
      alertes.push({ type: "info", message: `Variété ${(p as any).varietes?.code_variete} : Observation due` });
    }
  });

  const stadeKeys = [
    "stade_repos_date_debut", "stade_debourrement_date_debut", "stade_boutons_floraux_date_debut",
    "stade_prefloraison_date_debut", "stade_floraison_date_debut", "stade_chute_petales_date_debut",
    "stade_nouaison_date_debut", "stade_chute_physio_date_debut", "stade_grossissement_date_debut",
    "stade_veraison_date_debut", "stade_debut_maturite_date", "stade_maturite_recolte_date"
  ];

  const chartData = (phenoData || []).map((p) => {
    let count = 0;
    stadeKeys.forEach((k) => { if ((p as any)[k]) count++; });
    return { variete: (p as any).varietes?.code_variete || `ID ${p.variete_id}`, stades: count };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-foreground">🌸 Dashboard Phénologie</h1>
        <div className="w-48">
          <SearchableSelect
            options={(campagnes || []).map((c) => ({ value: c.id.toString(), label: c.code_campagne }))}
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

      {(phenoData || []).length === 0 && (
        <p className="text-center text-muted-foreground py-12">Aucune donnée phénologique pour cette campagne</p>
      )}
    </div>
  );
}
