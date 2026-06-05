import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

const STADES_COMPARE = [
  { key: "repos", label: "Repos végétatif", dateField: "stade_repos_date_debut" },
  { key: "debourrement", label: "Débourrement", dateField: "stade_debourrement_date_debut" },
  { key: "boutons_floraux", label: "Boutons floraux", dateField: "stade_boutons_floraux_date_debut" },
  { key: "prefloraison", label: "Pré-floraison", dateField: "stade_prefloraison_date_debut" },
  { key: "floraison", label: "Floraison", dateField: "stade_floraison_date_debut" },
  { key: "chute_petales", label: "Chute pétales", dateField: "stade_chute_petales_date_debut" },
  { key: "nouaison", label: "Nouaison", dateField: "stade_nouaison_date_debut" },
  { key: "chute_physio", label: "Chute physiologique", dateField: "stade_chute_physio_date_debut" },
  { key: "grossissement", label: "Grossissement", dateField: "stade_grossissement_date_debut" },
  { key: "veraison", label: "Véraison", dateField: "stade_veraison_date_debut" },
  { key: "debut_maturite", label: "Début maturité", dateField: "stade_debut_maturite_date" },
  { key: "maturite_recolte", label: "Maturité récolte", dateField: "stade_maturite_recolte_date" },
];

export default function PhenologieComparaison() {
  const [selectedVariete, setSelectedVariete] = useState<string>("");
  const [campagne1, setCampagne1] = useState<string>("");
  const [campagne2, setCampagne2] = useState<string>("");

  const { data: campagnes } = useQuery({
    queryKey: ["campagnes"],
    queryFn: async () => {
      const { data } = await supabase.from("campagnes").select("*").order("date_debut", { ascending: false });
      return data || [];
    },
  });

  const { data: varietes } = useQuery({
    queryKey: ["varietes-with-types"],
    queryFn: async () => {
      const { data } = await supabase.from("varietes").select("*, types_varietes(*)").order("code_variete");
      return data || [];
    },
  });

  const { data: pheno1 } = useQuery({
    queryKey: ["phenologie-compare-1", selectedVariete, campagne1],
    queryFn: async () => {
      const { data } = await supabase.from("phenologie").select("*").eq("variete_id", Number(selectedVariete)).eq("campagne_id", Number(campagne1)).maybeSingle();
      return data;
    },
    enabled: !!selectedVariete && !!campagne1,
  });

  const { data: pheno2 } = useQuery({
    queryKey: ["phenologie-compare-2", selectedVariete, campagne2],
    queryFn: async () => {
      const { data } = await supabase.from("phenologie").select("*").eq("variete_id", Number(selectedVariete)).eq("campagne_id", Number(campagne2)).maybeSingle();
      return data;
    },
    enabled: !!selectedVariete && !!campagne2,
  });

  const camp1Label = campagnes?.find((c) => c.id.toString() === campagne1)?.code_campagne || "Campagne 1";
  const camp2Label = campagnes?.find((c) => c.id.toString() === campagne2)?.code_campagne || "Campagne 2";

  const getEcart = (field: string) => {
    if (!pheno1 || !pheno2) return null;
    const d1 = (pheno1 as any)[field];
    const d2 = (pheno2 as any)[field];
    if (!d1 || !d2) return null;
    return differenceInDays(new Date(d2), new Date(d1));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">📊 Comparaison Inter-Campagnes</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs mb-1 block">Variété</Label>
          <SearchableSelect
            options={(varietes || []).map((v) => ({ value: v.id.toString(), label: v.code_variete, sublabel: v.nom_commercial || undefined }))}
            value={selectedVariete}
            onValueChange={setSelectedVariete}
            placeholder="Variété..."
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Campagne 1</Label>
          <SearchableSelect
            options={(campagnes || []).map((c) => ({ value: c.id.toString(), label: c.code_campagne }))}
            value={campagne1}
            onValueChange={setCampagne1}
            placeholder="Campagne 1..."
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Campagne 2</Label>
          <SearchableSelect
            options={(campagnes || []).map((c) => ({ value: c.id.toString(), label: c.code_campagne }))}
            value={campagne2}
            onValueChange={setCampagne2}
            placeholder="Campagne 2..."
          />
        </div>
      </div>

      {selectedVariete && campagne1 && campagne2 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Durée floraison</p>
                <div className="flex gap-3 mt-1">
                  <span className="text-sm">{camp1Label}: <strong>{pheno1?.duree_floraison_jours ?? "—"}j</strong></span>
                  <span className="text-sm">{camp2Label}: <strong>{pheno2?.duree_floraison_jours ?? "—"}j</strong></span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Durée cycle total</p>
                <div className="flex gap-3 mt-1">
                  <span className="text-sm">{camp1Label}: <strong>{pheno1?.duree_totale_cycle_jours ?? "—"}j</strong></span>
                  <span className="text-sm">{camp2Label}: <strong>{pheno2?.duree_totale_cycle_jours ?? "—"}j</strong></span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Intensité floraison</p>
                <div className="flex gap-3 mt-1">
                  <span className="text-sm">{camp1Label}: <strong>{pheno1?.stade_floraison_intensite ?? "—"}</strong></span>
                  <span className="text-sm">{camp2Label}: <strong>{pheno2?.stade_floraison_intensite ?? "—"}</strong></span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Comparaison des stades</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stade</TableHead>
                      <TableHead>{camp1Label}</TableHead>
                      <TableHead>{camp2Label}</TableHead>
                      <TableHead>Écart (jours)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {STADES_COMPARE.map((stade) => {
                      const d1 = pheno1 ? (pheno1 as any)[stade.dateField] : null;
                      const d2 = pheno2 ? (pheno2 as any)[stade.dateField] : null;
                      const ecart = getEcart(stade.dateField);
                      return (
                        <TableRow key={stade.key}>
                          <TableCell className="font-medium text-sm">{stade.label}</TableCell>
                          <TableCell className="text-sm">{d1 ? format(new Date(d1), "dd/MM/yyyy", { locale: fr }) : "—"}</TableCell>
                          <TableCell className="text-sm">{d2 ? format(new Date(d2), "dd/MM/yyyy", { locale: fr }) : "—"}</TableCell>
                          <TableCell>
                            {ecart !== null ? (
                              <Badge variant={ecart < 0 ? "default" : ecart > 0 ? "destructive" : "secondary"} className="text-xs">
                                {ecart > 0 ? `+${ecart}` : ecart}j {ecart < 0 ? "(précoce)" : ecart > 0 ? "(tardif)" : ""}
                              </Badge>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
