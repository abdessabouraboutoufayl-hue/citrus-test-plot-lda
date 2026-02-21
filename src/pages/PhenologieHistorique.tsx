import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Label } from "@/components/ui/label";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, User } from "lucide-react";

export default function PhenologieHistorique() {
  const [selectedCampagne, setSelectedCampagne] = useState<string>("");
  const [selectedVariete, setSelectedVariete] = useState<string>("");

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

  const { data: phenoRecords } = useQuery({
    queryKey: ["phenologie-list", selectedCampagne, selectedVariete],
    queryFn: async () => {
      let query = supabase.from("phenologie").select("*, varietes(code_variete, nom_commercial), campagnes(code_campagne), domaines(nom)");
      if (selectedCampagne) query = query.eq("campagne_id", Number(selectedCampagne));
      if (selectedVariete) query = query.eq("variete_id", Number(selectedVariete));
      const { data } = await query.order("date_observation", { ascending: false });
      return data || [];
    },
  });

  const { data: observations } = useQuery({
    queryKey: ["phenologie-observations", phenoRecords?.map((p) => p.id)],
    queryFn: async () => {
      if (!phenoRecords?.length) return [];
      const ids = phenoRecords.map((p) => p.id);
      const { data } = await supabase
        .from("phenologie_observations")
        .select("*")
        .in("phenologie_id", ids)
        .order("date_observation", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!phenoRecords?.length,
  });

  const obsByPheno = (observations || []).reduce((acc: Record<number, any[]>, obs) => {
    if (!acc[obs.phenologie_id]) acc[obs.phenologie_id] = [];
    acc[obs.phenologie_id].push(obs);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">📋 Historique Phénologique</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs mb-1 block">Campagne</Label>
          <SearchableSelect
            options={(campagnes || []).map((c) => ({ value: c.id.toString(), label: c.code_campagne }))}
            value={selectedCampagne}
            onValueChange={setSelectedCampagne}
            placeholder="Toutes les campagnes"
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Variété</Label>
          <SearchableSelect
            options={(varietes || []).map((v) => ({
              value: v.id.toString(),
              label: v.code_variete,
              sublabel: v.nom_commercial || undefined,
            }))}
            value={selectedVariete}
            onValueChange={setSelectedVariete}
            placeholder="Toutes les variétés"
          />
        </div>
      </div>

      {phenoRecords?.map((pheno) => (
        <Card key={pheno.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {(pheno as any).varietes?.code_variete} — {(pheno as any).campagnes?.code_campagne}
              <span className="text-xs text-muted-foreground ml-2">({(pheno as any).domaines?.nom})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(obsByPheno[pheno.id] || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune observation enregistrée</p>
            ) : (
              <div className="space-y-4">
                {(obsByPheno[pheno.id] || []).map((obs: any) => (
                  <div key={obs.id} className="border-l-2 border-primary/30 pl-4 py-1">
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{format(new Date(obs.date_observation), "dd/MM/yyyy", { locale: fr })}</span>
                      <span className="text-xs text-muted-foreground">({formatDistanceToNow(new Date(obs.date_observation), { locale: fr, addSuffix: true })})</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> {obs.observateur_nom}</span>
                    </div>
                    {obs.stades_observes && Array.isArray(obs.stades_observes) && obs.stades_observes.length > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">Stades : {obs.stades_observes.join(", ")}</p>
                    )}
                    {obs.notes && <p className="text-sm mt-1">{obs.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {phenoRecords?.length === 0 && (
        <p className="text-center text-muted-foreground py-12">Aucun suivi phénologique trouvé</p>
      )}
    </div>
  );
}
