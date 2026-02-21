import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/SearchableSelect";
import { toast } from "sonner";
import { Info, Save } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const STADES = [
  { key: "repos", num: 1, label: "Repos végétatif" },
  { key: "debourrement", num: 2, label: "Débourrement" },
  { key: "boutons_floraux", num: 3, label: "Boutons floraux" },
  { key: "prefloraison", num: 4, label: "Pré-floraison" },
  { key: "floraison", num: 5, label: "Floraison" },
  { key: "chute_petales", num: 6, label: "Chute pétales" },
  { key: "nouaison", num: 7, label: "Nouaison" },
  { key: "chute_physio", num: 8, label: "Chute physio." },
  { key: "grossissement", num: 9, label: "Grossissement" },
  { key: "veraison", num: 10, label: "Véraison" },
  { key: "debut_maturite", num: 11, label: "Début maturité" },
  { key: "maturite_recolte", num: 12, label: "Maturité récolte" },
];

function getStadeDateField(key: string): string {
  if (key === "debut_maturite") return "stade_debut_maturite_date";
  if (key === "maturite_recolte") return "stade_maturite_recolte_date";
  return `stade_${key}_date_debut`;
}

function getCurrentStade(record: any): string {
  // Return the latest completed stade
  for (let i = STADES.length - 1; i >= 0; i--) {
    const dateField = getStadeDateField(STADES[i].key);
    if (record?.[dateField]) return STADES[i].key;
  }
  return "";
}

export default function PhenologieSuivi() {
  const { session, userInfo } = useAuth();
  const queryClient = useQueryClient();

  const [selectedCampagne, setSelectedCampagne] = useState("");
  const [selectedDomaine, setSelectedDomaine] = useState(userInfo.domaineId?.toString() || "");
  // Track stade changes per variété: { [varieteId]: stadeKey }
  const [stadeChanges, setStadeChanges] = useState<Record<string, string>>({});

  const isCentral = userInfo.role === "responsable_central";

  const { data: campagnes } = useQuery({
    queryKey: ["campagnes"],
    queryFn: async () => {
      const { data } = await supabase.from("campagnes").select("*").order("date_debut", { ascending: false });
      return data || [];
    },
  });

  const { data: domaines } = useQuery({
    queryKey: ["domaines"],
    queryFn: async () => {
      const { data } = await supabase.from("domaines").select("*").order("nom");
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

  // Get domaine_varietes for the selected domaine to know which varieties belong to it
  const { data: domaineVarietes } = useQuery({
    queryKey: ["domaine-varietes", selectedDomaine],
    queryFn: async () => {
      const { data } = await supabase
        .from("domaine_varietes")
        .select("variete_id")
        .eq("domaine_id", Number(selectedDomaine));
      return data || [];
    },
    enabled: !!selectedDomaine,
  });

  // Fetch existing phenologie records for selected campagne + domaine
  const { data: phenoRecords } = useQuery({
    queryKey: ["phenologie-list", selectedCampagne, selectedDomaine],
    queryFn: async () => {
      const { data } = await supabase
        .from("phenologie")
        .select("*")
        .eq("campagne_id", Number(selectedCampagne))
        .eq("domaine_id", Number(selectedDomaine));
      return data || [];
    },
    enabled: !!selectedCampagne && !!selectedDomaine,
  });

  const selectedDomaineObj = domaines?.find((d) => d.id.toString() === selectedDomaine);

  // Filter varieties to those belonging to this domaine
  const filteredVarietes = varietes?.filter((v) =>
    domaineVarietes?.some((dv) => dv.variete_id === v.id)
  ) || [];

  // Build rows: one per variety of the domaine
  const tableRows = filteredVarietes.map((v) => {
    const phenoRecord = phenoRecords?.find((r) => r.variete_id === v.id);
    const currentStade = getCurrentStade(phenoRecord);
    const pendingStade = stadeChanges[v.id.toString()];
    return {
      varieteId: v.id,
      domaineNom: selectedDomaineObj?.nom || "-",
      typeVariete: v.types_varietes?.type_nom || "-",
      typeCode: v.types_varietes?.type_code || "",
      typeCouleur: v.types_varietes?.couleur_badge || "#888",
      codeVariete: v.code_variete,
      currentStade,
      selectedStade: pendingStade ?? currentStade,
      phenoRecord,
    };
  });

  const handleStadeChange = useCallback((varieteId: string, stadeKey: string) => {
    setStadeChanges((prev) => ({ ...prev, [varieteId]: stadeKey }));
  }, []);

  const hasChanges = Object.keys(stadeChanges).length > 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error("Non connecté");
      if (!selectedCampagne || !selectedDomaine) throw new Error("Sélectionnez campagne et domaine");

      const today = new Date().toISOString().split("T")[0];

      for (const [varieteId, stadeKey] of Object.entries(stadeChanges)) {
        const row = tableRows.find((r) => r.varieteId.toString() === varieteId);
        if (!row) continue;
        // Skip if stade hasn't actually changed
        if (row.currentStade === stadeKey) continue;

        const dateField = getStadeDateField(stadeKey);
        const payload: any = {
          domaine_id: Number(selectedDomaine),
          campagne_id: Number(selectedCampagne),
          variete_id: Number(varieteId),
          date_observation: today,
          observateur_nom: userInfo.nomComplet || "Inconnu",
          user_id: session.user.id,
          [dateField]: today,
        };

        if (row.phenoRecord) {
          const { error } = await supabase.from("phenologie").update(payload).eq("id", row.phenoRecord.id);
          if (error) throw error;
          await supabase.from("phenologie_observations").insert({
            phenologie_id: row.phenoRecord.id,
            date_observation: today,
            stades_observes: [STADES.find((s) => s.key === stadeKey)?.label],
            notes: null,
            observateur_nom: userInfo.nomComplet || "Inconnu",
          });
        } else {
          const { data, error } = await supabase.from("phenologie").insert(payload).select().single();
          if (error) throw error;
          await supabase.from("phenologie_observations").insert({
            phenologie_id: data.id,
            date_observation: today,
            stades_observes: [STADES.find((s) => s.key === stadeKey)?.label],
            notes: "Première observation",
            observateur_nom: userInfo.nomComplet || "Inconnu",
          });
        }
      }
    },
    onSuccess: () => {
      setStadeChanges({});
      queryClient.invalidateQueries({ queryKey: ["phenologie-list"] });
      toast.success("Observations enregistrées");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">🌸 Suivi Phénologique</h1>
        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
          <Info className="h-4 w-4" /> Saisie par tableau — sélectionnez campagne et ferme
        </p>
      </div>

      {/* Filtres */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <div>
          <Label className="text-xs mb-1 block">Campagne</Label>
          <SearchableSelect
            options={(campagnes || []).map((c) => ({ value: c.id.toString(), label: c.code_campagne }))}
            value={selectedCampagne}
            onValueChange={setSelectedCampagne}
            placeholder="Campagne..."
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Ferme</Label>
          {isCentral ? (
            <SearchableSelect
              options={(domaines || []).map((d) => ({ value: d.id.toString(), label: d.nom, sublabel: d.region }))}
              value={selectedDomaine}
              onValueChange={setSelectedDomaine}
              placeholder="Ferme..."
            />
          ) : (
            <div className="h-10 flex items-center px-3 rounded-md border bg-muted text-sm">
              {selectedDomaineObj?.nom || "—"}
            </div>
          )}
        </div>
      </div>

      {/* Tableau */}
      {selectedCampagne && selectedDomaine && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">
              Variétés — {selectedDomaineObj?.nom} ({tableRows.length})
            </CardTitle>
            {hasChanges && (
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="sm">
                <Save className="h-4 w-4 mr-2" />
                Enregistrer {Object.keys(stadeChanges).length} modification(s)
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {tableRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune variété associée à cette ferme.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Domaine</TableHead>
                    <TableHead className="w-[140px]">Type variété</TableHead>
                    <TableHead className="w-[120px]">Code</TableHead>
                    <TableHead>Stade phénologique</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((row) => {
                    const changed = stadeChanges[row.varieteId.toString()] !== undefined
                      && stadeChanges[row.varieteId.toString()] !== row.currentStade;
                    return (
                      <TableRow key={row.varieteId} className={changed ? "bg-primary/5" : ""}>
                        <TableCell className="text-sm">{row.domaineNom}</TableCell>
                        <TableCell>
                          <span
                            className="inline-block px-2 py-0.5 rounded text-xs text-white font-medium"
                            style={{ backgroundColor: row.typeCouleur }}
                          >
                            {row.typeCode}
                          </span>
                          <span className="ml-2 text-sm text-muted-foreground">{row.typeVariete}</span>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{row.codeVariete}</TableCell>
                        <TableCell>
                          <Select
                            value={row.selectedStade || "none"}
                            onValueChange={(val) =>
                              handleStadeChange(row.varieteId.toString(), val === "none" ? "" : val)
                            }
                          >
                            <SelectTrigger className="w-[220px] h-9">
                              <SelectValue placeholder="Aucun stade" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Aucun stade —</SelectItem>
                              {STADES.map((s) => (
                                <SelectItem key={s.key} value={s.key}>
                                  {s.num}. {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
