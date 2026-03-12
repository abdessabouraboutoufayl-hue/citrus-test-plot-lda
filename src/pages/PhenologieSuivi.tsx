import { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Save, Camera, Info, Clock, CalendarDays, CopyCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

const STADES = [
  "Repos végétatif", "Débourrement", "Boutons floraux", "Pré-floraison",
  "Floraison", "Chute pétales", "Nouaison", "Chute physio.",
  "Grossissement", "Véraison", "Début maturité", "Maturité récolte",
];

const CYCLE_WINDOW_DAYS = 4;
const CYCLE_INTERVAL_DAYS = 15;
const AUTOSAVE_INTERVAL = 30000;

interface DetailEdit {
  stade: string;
  date: string;
  obs: string;
  photo: boolean;
  checked: boolean;
}

type EditsMap = Record<number, DetailEdit>; // variete_id -> edit

export default function PhenologieSuivi() {
  const { session, userInfo } = useAuth();
  const queryClient = useQueryClient();
  const isCentral = userInfo.role === "responsable_central";
  const today = new Date().toISOString().split("T")[0];

  const [selectedCampagne, setSelectedCampagne] = useState("");
  const [selectedDomaine, setSelectedDomaine] = useState(userInfo.domaineId?.toString() || "");
  const [edits, setEdits] = useState<EditsMap>({});

  // --- Data queries ---
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
      const { data } = await supabase.from("domaine_varietes").select("variete_id").eq("domaine_id", Number(selectedDomaine));
      return data || [];
    },
    enabled: !!selectedDomaine,
  });

  // Last observation for this domaine/campagne (for pre-fill)
  const { data: lastObservation } = useQuery({
    queryKey: ["last-observation", selectedCampagne, selectedDomaine],
    queryFn: async () => {
      const { data } = await supabase
        .from("observations_phenologie")
        .select("*, phenologie_details(*)")
        .eq("campagne_id", Number(selectedCampagne))
        .eq("domaine_id", Number(selectedDomaine))
        .order("date_observation", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedCampagne && !!selectedDomaine,
  });

  // Rappel for this domaine/campagne
  const { data: rappel } = useQuery({
    queryKey: ["rappel-pheno", selectedCampagne, selectedDomaine],
    queryFn: async () => {
      const { data } = await supabase
        .from("rappels_phenologie")
        .select("*")
        .eq("campagne_id", Number(selectedCampagne))
        .eq("domaine_id", Number(selectedDomaine))
        .maybeSingle();
      return data;
    },
    enabled: !!selectedCampagne && !!selectedDomaine,
  });

  // Filter varietes for this domaine
  const filteredVarietes = useMemo(() => {
    if (!varietes || !domaineVarietes) return [];
    const ids = new Set(domaineVarietes.map((dv) => dv.variete_id));
    return varietes.filter((v) => ids.has(v.id));
  }, [varietes, domaineVarietes]);

  // Group by type
  const typeGroups = useMemo(() => {
    const groups: Record<string, { typeCode: string; typeNom: string; couleur: string; varietes: typeof filteredVarietes }> = {};
    for (const v of filteredVarietes) {
      const typeId = v.types_varietes?.id?.toString() || "0";
      if (!groups[typeId]) {
        groups[typeId] = {
          typeCode: v.types_varietes?.type_code || "?",
          typeNom: v.types_varietes?.type_nom || "Inconnu",
          couleur: v.types_varietes?.couleur_badge || "#888",
          varietes: [],
        };
      }
      groups[typeId].varietes.push(v);
    }
    return Object.entries(groups).sort(([, a], [, b]) => a.typeCode.localeCompare(b.typeCode));
  }, [filteredVarietes]);

  // Pre-fill from last observation
  const lastDetailsMap = useMemo(() => {
    const map: Record<number, { stade: string; obs: string }> = {};
    if (lastObservation?.phenologie_details) {
      for (const d of lastObservation.phenologie_details as any[]) {
        map[d.variete_id] = { stade: d.stade_phenologique, obs: "" };
      }
    }
    return map;
  }, [lastObservation]);

  const getEdit = (varieteId: number): DetailEdit => {
    if (edits[varieteId]) return edits[varieteId];
    const prev = lastDetailsMap[varieteId];
    return {
      stade: prev?.stade || "",
      date: today,
      obs: "",
      photo: false,
      checked: false,
    };
  };

  const updateEdit = useCallback((varieteId: number, field: keyof DetailEdit, value: any) => {
    setEdits((prev) => {
      const current = prev[varieteId] || {
        stade: lastDetailsMap[varieteId]?.stade || "",
        date: today,
        obs: "",
        photo: false,
        checked: false,
      };
      return { ...prev, [varieteId]: { ...current, [field]: value } };
    });
  }, [lastDetailsMap, today]);

  const duplicateStadeToType = useCallback((sourceVarieteId: number, typeVarietes: typeof filteredVarietes) => {
    const sourceEdit = edits[sourceVarieteId] || {
      stade: lastDetailsMap[sourceVarieteId]?.stade || "",
      date: today,
      obs: "",
      photo: false,
      checked: false,
    };
    if (!sourceEdit.stade) {
      toast.warning("Sélectionnez d'abord un stade pour ce code");
      return;
    }
    setEdits((prev) => {
      const updated = { ...prev };
      for (const v of typeVarietes) {
        const current = updated[v.id] || {
          stade: lastDetailsMap[v.id]?.stade || "",
          date: today,
          obs: "",
          photo: false,
          checked: false,
        };
        updated[v.id] = { ...current, stade: sourceEdit.stade, checked: true };
      }
      return updated;
    });
    toast.success(`Stade "${sourceEdit.stade}" appliqué à ${typeVarietes.length} codes`);
  }, [edits, lastDetailsMap, today, filteredVarietes]);

  // Progress stats
  const totalCodes = filteredVarietes.length;
  const checkedCodes = Object.values(edits).filter((e) => e.checked).length;
  const progressPct = totalCodes > 0 ? Math.round((checkedCodes / totalCodes) * 100) : 0;

  const typesCompleted = useMemo(() => {
    let done = 0;
    for (const [, group] of typeGroups) {
      const allChecked = group.varietes.every((v) => edits[v.id]?.checked);
      if (allChecked && group.varietes.length > 0) done++;
    }
    return done;
  }, [typeGroups, edits]);

  // Rappel display
  const lastObsDate = rappel?.derniere_observation || lastObservation?.date_observation;
  const nextDueDate = rappel?.prochaine_observation_due;
  const daysSinceLast = lastObsDate ? differenceInDays(new Date(), new Date(lastObsDate)) : null;
  const daysUntilNext = nextDueDate ? differenceInDays(new Date(nextDueDate), new Date()) : null;

  // Cycle logic: determine if this is same cycle or new
  const isNewCycle = useMemo(() => {
    if (!lastObsDate) return true;
    const refDate = lastObservation?.date_reference_cycle || lastObsDate;
    const nextDue = new Date(refDate);
    nextDue.setDate(nextDue.getDate() + CYCLE_INTERVAL_DAYS);
    const windowStart = new Date(nextDue);
    windowStart.setDate(windowStart.getDate() - CYCLE_WINDOW_DAYS);
    const now = new Date();
    // If within window of next due, it's same cycle continuation
    // If past window, it's new cycle
    return now > nextDue;
  }, [lastObsDate, lastObservation]);

  // Auto-save to localStorage
  useEffect(() => {
    const key = `pheno-draft-${selectedCampagne}-${selectedDomaine}`;
    const interval = setInterval(() => {
      if (Object.keys(edits).length > 0) {
        localStorage.setItem(key, JSON.stringify(edits));
      }
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [edits, selectedCampagne, selectedDomaine]);

  // Load draft from localStorage on filter change
  useEffect(() => {
    if (!selectedCampagne || !selectedDomaine) return;
    const key = `pheno-draft-${selectedCampagne}-${selectedDomaine}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setEdits(parsed);
        toast.info("Brouillon restauré depuis la sauvegarde locale");
      } catch { /* ignore */ }
    } else {
      setEdits({});
    }
  }, [selectedCampagne, selectedDomaine]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error("Non connecté");
      if (!selectedCampagne || !selectedDomaine) throw new Error("Sélectionnez campagne et domaine");

      const checkedEdits = Object.entries(edits).filter(([, e]) => e.checked && e.stade);
      if (checkedEdits.length === 0) throw new Error("Aucun code coché avec un stade");

      // Determine date_reference_cycle
      const dateRefCycle = isNewCycle ? today : (lastObservation?.date_reference_cycle || today);

      // Create observation header
      const { data: obs, error: obsErr } = await supabase
        .from("observations_phenologie")
        .insert({
          domaine_id: Number(selectedDomaine),
          campagne_id: Number(selectedCampagne),
          date_observation: today,
          user_id: session.user.id,
          observateur_nom: userInfo.nomComplet || "Inconnu",
          date_reference_cycle: dateRefCycle,
        })
        .select()
        .single();
      if (obsErr) throw obsErr;

      // Insert details
      const details = checkedEdits.map(([varieteId, edit]) => ({
        observation_id: obs.id,
        variete_id: Number(varieteId),
        stade_precedent: lastDetailsMap[Number(varieteId)]?.stade || null,
        stade_phenologique: edit.stade,
        date_stade: edit.date || today,
        observations: edit.obs || null,
        photo_url: null,
      }));

      const { error: detErr } = await supabase.from("phenologie_details").insert(details);
      if (detErr) throw detErr;
    },
    onSuccess: () => {
      const key = `pheno-draft-${selectedCampagne}-${selectedDomaine}`;
      localStorage.removeItem(key);
      setEdits({});
      queryClient.invalidateQueries({ queryKey: ["last-observation"] });
      queryClient.invalidateQueries({ queryKey: ["rappel-pheno"] });
      toast.success(`Observation enregistrée (${Object.values(edits).filter(e => e.checked).length} codes)`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const selectedDomaineObj = domaines?.find((d) => d.id.toString() === selectedDomaine);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">🌸 Suivi Phénologique</h1>
        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
          <Info className="h-4 w-4" /> Saisie par accordéons de types — sélectionnez campagne et ferme
        </p>
      </div>

      {/* Filters */}
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
        <>
          {/* Header stats */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Dernière observation</p>
                    <p className="text-sm font-medium">
                      {lastObsDate
                        ? `${format(new Date(lastObsDate), "dd/MM/yyyy", { locale: fr })} (${daysSinceLast}j)`
                        : "Aucune"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Prochaine due</p>
                    <p className={`text-sm font-medium ${daysUntilNext !== null && daysUntilNext < 0 ? "text-destructive" : ""}`}>
                      {nextDueDate
                        ? `${format(new Date(nextDueDate), "dd/MM/yyyy", { locale: fr })} (${daysUntilNext !== null ? (daysUntilNext >= 0 ? `dans ${daysUntilNext}j` : `${Math.abs(daysUntilNext)}j de retard`) : ""})`
                        : "—"}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Progression</p>
                  <Progress value={progressPct} className="h-3" />
                  <p className="text-xs text-muted-foreground mt-1">{checkedCodes}/{totalCodes} codes ({progressPct}%)</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Types complétés</p>
                  <p className="text-sm font-medium">{typesCompleted}/{typeGroups.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Accordion per type */}
          {typeGroups.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                Aucune variété associée à cette ferme.
              </CardContent>
            </Card>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {typeGroups.map(([typeId, group]) => {
                const groupChecked = group.varietes.filter((v) => edits[v.id]?.checked).length;
                return (
                  <AccordionItem key={typeId} value={typeId} className="border rounded-lg bg-card">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-3 w-full">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs text-white font-medium"
                          style={{ backgroundColor: group.couleur }}
                        >
                          {group.typeCode}
                        </span>
                        <span className="font-medium text-sm">{group.typeNom}</span>
                        <span className="text-xs text-muted-foreground ml-auto mr-4">
                          {groupChecked}/{group.varietes.length} codes
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-0 pb-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[80px]">Code</TableHead>
                              <TableHead className="w-[140px]">Stade actuel</TableHead>
                              <TableHead className="w-[200px]">Nouveau stade</TableHead>
                              <TableHead className="w-[140px]">Date</TableHead>
                              <TableHead className="min-w-[150px]">Obs</TableHead>
                              <TableHead className="w-[40px]">📸</TableHead>
                              <TableHead className="w-[40px]">✓</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.varietes.map((v) => {
                              const edit = getEdit(v.id);
                              const prevStade = lastDetailsMap[v.id]?.stade || "—";
                              return (
                                <TableRow key={v.id} className={edit.checked ? "bg-primary/5" : ""}>
                                  <TableCell className="font-mono text-sm">{v.code_variete}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{prevStade}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Select
                                        value={edit.stade || "none"}
                                        onValueChange={(val) => updateEdit(v.id, "stade", val === "none" ? "" : val)}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue placeholder="Stade..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">—</SelectItem>
                                          {STADES.map((s) => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 shrink-0"
                                              onClick={() => duplicateStadeToType(v.id, group.varietes)}
                                            >
                                              <CopyCheck className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top">
                                            <p className="text-xs">Appliquer ce stade à tout le type</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="date"
                                      className="h-8 text-xs"
                                      value={edit.date}
                                      onChange={(e) => updateEdit(v.id, "date", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      className="h-8 text-xs"
                                      placeholder="Observations..."
                                      value={edit.obs}
                                      onChange={(e) => updateEdit(v.id, "obs", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Checkbox
                                      checked={edit.photo}
                                      onCheckedChange={(c) => updateEdit(v.id, "photo", !!c)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Checkbox
                                      checked={edit.checked}
                                      onCheckedChange={(c) => updateEdit(v.id, "checked", !!c)}
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}

          {/* Footer save */}
          <div className="sticky bottom-4 z-10">
            <Button
              className="w-full sm:w-auto"
              size="lg"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || checkedCodes === 0}
            >
              <Save className="h-5 w-5 mr-2" />
              💾 Enregistrer observation ({checkedCodes} code{checkedCodes > 1 ? "s" : ""})
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
