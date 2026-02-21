import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function getStadeObsField(key: string): string {
  if (key === "debut_maturite") return "stade_debut_maturite_observations";
  if (key === "maturite_recolte") return "stade_maturite_recolte_observations";
  return `stade_${key}_observations`;
}

function getCurrentStade(record: any): string {
  for (let i = STADES.length - 1; i >= 0; i--) {
    const dateField = getStadeDateField(STADES[i].key);
    if (record?.[dateField]) return STADES[i].key;
  }
  return "";
}

interface RowEdit {
  stade?: string;
  date?: string;
  obs?: string;
}

export default function PhenologieSuivi() {
  const { session, userInfo } = useAuth();
  const queryClient = useQueryClient();

  const [selectedCampagne, setSelectedCampagne] = useState("");
  const [selectedDomaine, setSelectedDomaine] = useState(userInfo.domaineId?.toString() || "");
  const [rowEdits, setRowEdits] = useState<Record<string, RowEdit>>({});

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

  const filteredVarietes = varietes?.filter((v) =>
    domaineVarietes?.some((dv) => dv.variete_id === v.id)
  ) || [];

  const today = new Date().toISOString().split("T")[0];

  const tableRows = filteredVarietes.map((v) => {
    const phenoRecord = phenoRecords?.find((r) => r.variete_id === v.id);
    const currentStade = getCurrentStade(phenoRecord);
    const edit = rowEdits[v.id.toString()];
    const selectedStade = edit?.stade ?? currentStade;
    // Get existing date/obs for the selected stade from DB
    const existingDate = selectedStade && phenoRecord ? (phenoRecord as any)[getStadeDateField(selectedStade)] || "" : "";
    const existingObs = selectedStade && phenoRecord ? (phenoRecord as any)[getStadeObsField(selectedStade)] || "" : "";
    return {
      varieteId: v.id,
      domaineNom: selectedDomaineObj?.nom || "-",
      typeVariete: v.types_varietes?.type_nom || "-",
      typeCode: v.types_varietes?.type_code || "",
      typeCouleur: v.types_varietes?.couleur_badge || "#888",
      codeVariete: v.code_variete,
      currentStade,
      selectedStade,
      stadeDate: edit?.date ?? existingDate,
      stadeObs: edit?.obs ?? existingObs,
      phenoRecord,
    };
  });

  const updateRowEdit = useCallback((varieteId: string, field: keyof RowEdit, value: string) => {
    setRowEdits((prev) => ({
      ...prev,
      [varieteId]: { ...prev[varieteId], [field]: value },
    }));
  }, []);

  const handleStadeChange = useCallback((varieteId: string, stadeKey: string) => {
    // When stade changes, reset date to today and obs to empty for new stade
    setRowEdits((prev) => ({
      ...prev,
      [varieteId]: { stade: stadeKey, date: today, obs: "" },
    }));
  }, [today]);

  const hasChanges = Object.keys(rowEdits).length > 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error("Non connecté");
      if (!selectedCampagne || !selectedDomaine) throw new Error("Sélectionnez campagne et domaine");

      for (const [varieteId, edit] of Object.entries(rowEdits)) {
        const row = tableRows.find((r) => r.varieteId.toString() === varieteId);
        if (!row) continue;

        const stadeKey = edit.stade ?? row.currentStade;
        if (!stadeKey) continue;

        const dateField = getStadeDateField(stadeKey);
        const obsField = getStadeObsField(stadeKey);
        const dateVal = edit.date ?? today;

        const payload: any = {
          domaine_id: Number(selectedDomaine),
          campagne_id: Number(selectedCampagne),
          variete_id: Number(varieteId),
          date_observation: dateVal,
          observateur_nom: userInfo.nomComplet || "Inconnu",
          user_id: session.user.id,
          [dateField]: dateVal,
          [obsField]: edit.obs || null,
        };

        if (row.phenoRecord) {
          const { error } = await supabase.from("phenologie").update(payload).eq("id", row.phenoRecord.id);
          if (error) throw error;
          await supabase.from("phenologie_observations").insert({
            phenologie_id: row.phenoRecord.id,
            date_observation: dateVal,
            stades_observes: [STADES.find((s) => s.key === stadeKey)?.label],
            notes: edit.obs || null,
            observateur_nom: userInfo.nomComplet || "Inconnu",
          });
        } else {
          const { data, error } = await supabase.from("phenologie").insert(payload).select().single();
          if (error) throw error;
          await supabase.from("phenologie_observations").insert({
            phenologie_id: data.id,
            date_observation: dateVal,
            stades_observes: [STADES.find((s) => s.key === stadeKey)?.label],
            notes: edit.obs || "Première observation",
            observateur_nom: userInfo.nomComplet || "Inconnu",
          });
        }
      }
    },
    onSuccess: () => {
      setRowEdits({});
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

      {selectedCampagne && selectedDomaine && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">
              Variétés — {selectedDomaineObj?.nom} ({tableRows.length})
            </CardTitle>
            {hasChanges && (
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="sm">
                <Save className="h-4 w-4 mr-2" />
                Enregistrer {Object.keys(rowEdits).length} modification(s)
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {tableRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune variété associée à cette ferme.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Domaine</TableHead>
                      <TableHead className="w-[130px]">Type variété</TableHead>
                      <TableHead className="w-[100px]">Code</TableHead>
                      <TableHead className="w-[200px]">Stade phénologique</TableHead>
                      <TableHead className="w-[150px]">Date du stade</TableHead>
                      <TableHead className="min-w-[180px]">Observations</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableRows.map((row) => {
                      const hasEdit = rowEdits[row.varieteId.toString()] !== undefined;
                      const stadeChanged = hasEdit && rowEdits[row.varieteId.toString()]?.stade !== undefined
                        && rowEdits[row.varieteId.toString()]?.stade !== row.currentStade;
                      return (
                        <TableRow key={row.varieteId} className={hasEdit ? "bg-primary/5" : ""}>
                          <TableCell className="text-sm">{row.domaineNom}</TableCell>
                          <TableCell>
                            <span
                              className="inline-block px-2 py-0.5 rounded text-xs text-white font-medium"
                              style={{ backgroundColor: row.typeCouleur }}
                            >
                              {row.typeCode}
                            </span>
                            <span className="ml-1.5 text-xs text-muted-foreground">{row.typeVariete}</span>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{row.codeVariete}</TableCell>
                          <TableCell>
                            <Select
                              value={row.selectedStade || "none"}
                              onValueChange={(val) =>
                                handleStadeChange(row.varieteId.toString(), val === "none" ? "" : val)
                              }
                            >
                              <SelectTrigger className="w-full h-9 text-xs">
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
                          <TableCell>
                            <Input
                              type="date"
                              className="h-9 text-xs w-full"
                              value={row.stadeDate}
                              onChange={(e) => updateRowEdit(row.varieteId.toString(), "date", e.target.value)}
                              disabled={!row.selectedStade}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-9 text-xs w-full"
                              placeholder="Notes..."
                              value={row.stadeObs}
                              onChange={(e) => updateRowEdit(row.varieteId.toString(), "obs", e.target.value)}
                              disabled={!row.selectedStade}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
