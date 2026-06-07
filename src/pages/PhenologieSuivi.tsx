import { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { refApi, phenologieApi } from "@/services/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
import { Save, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CopyCheck } from "lucide-react";

const STADES = [
  "Repos végétatif", "Débourrement", "Boutons floraux", "Pré-floraison",
  "Floraison", "Chute pétales", "Nouaison", "Chute physio.",
  "Grossissement", "Véraison", "Début maturité", "Maturité récolte",
];

const AUTOSAVE_INTERVAL = 30000;

interface DetailEdit {
  stade: string;
  date: string;
  obs: string;
  checked: boolean;
}

type EditsMap = Record<number, DetailEdit>;

export default function PhenologieSuivi() {
  const { userInfo } = useAuth();
  const queryClient = useQueryClient();
  const isCentral = userInfo.role === "responsable_central";
  const today = new Date().toISOString().split("T")[0];
  const [observationDate, setObservationDate] = useState(today);
  const [selectedCampagne, setSelectedCampagne] = useState("");
  const [selectedDomaine, setSelectedDomaine] = useState(userInfo.domaineId?.toString() || "");
  const [edits, setEdits] = useState<EditsMap>({});

  const { data: campagnes = [] } = useQuery({
    queryKey: ["campagnes"],
    queryFn: () => refApi.campagnes(),
  });

  const { data: domaines = [] } = useQuery({
    queryKey: ["domaines"],
    queryFn: () => refApi.domaines(),
  });

  const { data: varietes = [] } = useQuery({
    queryKey: ["varietes-with-types"],
    queryFn: () => refApi.varietes(),
  });

  const { data: domaineVarietes = [] } = useQuery({
    queryKey: ["domaine-varietes", selectedDomaine],
    queryFn: () => refApi.domaineVarietes(Number(selectedDomaine)),
    enabled: !!selectedDomaine,
  });

  const { data: rappels = [] } = useQuery({
    queryKey: ["rappels-pheno"],
    queryFn: () => phenologieApi.rappels(),
    enabled: !!selectedCampagne && !!selectedDomaine,
  });

  const rappel = useMemo(
    () => rappels.find((r: any) => String(r.campagneId) === selectedCampagne && String(r.domaineId) === selectedDomaine) || null,
    [rappels, selectedCampagne, selectedDomaine]
  );

  const filteredVarietes = useMemo(() => {
    if (!varietes || !domaineVarietes) return [];
    const ids = new Set(domaineVarietes.map((dv: any) => dv.varieteId));
    return varietes.filter((v: any) => ids.has(v.id));
  }, [varietes, domaineVarietes]);

  const typeGroups = useMemo(() => {
    const groups: Record<string, { typeCode: string; typeNom: string; couleur: string; varietes: any[] }> = {};
    for (const v of filteredVarietes) {
      const typeId = v.typeVariete?.id?.toString() || "0";
      if (!groups[typeId]) {
        groups[typeId] = {
          typeCode: v.typeVariete?.typeCode || "?",
          typeNom: v.typeVariete?.typeNom || "Inconnu",
          couleur: v.typeVariete?.couleurBadge || "#888",
          varietes: [],
        };
      }
      groups[typeId].varietes.push(v);
    }
    return Object.entries(groups).sort(([, a], [, b]) => a.typeCode.localeCompare(b.typeCode));
  }, [filteredVarietes]);

  const getEdit = (varieteId: number): DetailEdit =>
    edits[varieteId] || { stade: "", date: observationDate, obs: "", checked: false };

  const updateEdit = useCallback((varieteId: number, field: keyof DetailEdit, value: any) => {
    setEdits(prev => {
      const current = prev[varieteId] || { stade: "", date: observationDate, obs: "", checked: false };
      return { ...prev, [varieteId]: { ...current, [field]: value } };
    });
  }, [observationDate]);

  const duplicateStadeToType = useCallback((sourceVarieteId: number, typeVarietes: any[]) => {
    setEdits(prev => {
      const sourceEdit = prev[sourceVarieteId];
      if (!sourceEdit?.stade) {
        toast.warning("Sélectionnez d'abord un stade pour ce code");
        return prev;
      }
      const updated = { ...prev };
      for (const v of typeVarietes) {
        const current = updated[v.id] || { stade: "", date: observationDate, obs: "", checked: false };
        updated[v.id] = { ...current, stade: sourceEdit.stade, date: observationDate, checked: true };
      }
      toast.success(`Stade "${sourceEdit.stade}" appliqué à ${typeVarietes.length} codes`);
      return updated;
    });
  }, [observationDate]);

  const checkAllType = useCallback((typeVarietes: any[], check: boolean) => {
    setEdits(prev => {
      const updated = { ...prev };
      for (const v of typeVarietes) {
        const current = updated[v.id] || { stade: "", date: observationDate, obs: "", checked: false };
        updated[v.id] = { ...current, checked: check };
      }
      return updated;
    });
  }, [observationDate]);

  const totalCodes = filteredVarietes.length;
  const checkedCodes = Object.values(edits).filter(e => e.checked).length;
  const progressPct = totalCodes > 0 ? Math.round((checkedCodes / totalCodes) * 100) : 0;

  const typesCompleted = useMemo(() => {
    let done = 0;
    for (const [, group] of typeGroups) {
      if (group.varietes.length > 0 && group.varietes.every(v => edits[v.id]?.checked)) done++;
    }
    return done;
  }, [typeGroups, edits]);

  // Auto-save draft to localStorage
  useEffect(() => {
    const key = `pheno-draft-${selectedCampagne}-${selectedDomaine}`;
    const interval = setInterval(() => {
      if (Object.keys(edits).length > 0) localStorage.setItem(key, JSON.stringify(edits));
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [edits, selectedCampagne, selectedDomaine]);

  // Load draft from localStorage on filter change
  useEffect(() => {
    if (!selectedCampagne || !selectedDomaine) return;
    const key = `pheno-draft-${selectedCampagne}-${selectedDomaine}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try { setEdits(JSON.parse(saved)); toast.info("Brouillon restauré"); } catch { /* ignore */ }
    } else {
      setEdits({});
    }
  }, [selectedCampagne, selectedDomaine]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCampagne || !selectedDomaine) throw new Error("Sélectionnez campagne et domaine");
      const checkedEdits = Object.entries(edits).filter(([, e]) => e.checked && e.stade);
      if (checkedEdits.length === 0) throw new Error("Aucun code coché avec un stade");

      await phenologieApi.addObservation({
        domaineId: Number(selectedDomaine),
        campagneId: Number(selectedCampagne),
        dateObservation: observationDate,
        observateurNom: userInfo.nomComplet || "Inconnu",
        details: checkedEdits.map(([varieteId, edit]) => ({
          varieteId: Number(varieteId),
          stadePhenologique: edit.stade,
          dateStade: edit.date || today,
          observations: edit.obs || null,
        })),
      });
    },
    onSuccess: () => {
      const key = `pheno-draft-${selectedCampagne}-${selectedDomaine}`;
      localStorage.removeItem(key);
      setEdits({});
      queryClient.invalidateQueries({ queryKey: ["rappels-pheno"] });
      toast.success(`Observation enregistrée (${checkedCodes} codes)`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const selectedDomaineObj = domaines.find((d: any) => d.id.toString() === selectedDomaine);

  const nextDueDate = rappel?.prochaineObservationDue;
  const lastObsDate = rappel?.derniereObservation;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">🌸 Suivi Phénologique</h1>
        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
          <Info className="h-4 w-4" /> Saisie par accordéons de types — sélectionnez campagne et ferme
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <div>
          <Label className="text-xs mb-1 block">Campagne</Label>
          <SearchableSelect
            options={(campagnes || []).map((c: any) => ({ value: c.id.toString(), label: c.codeCampagne }))}
            value={selectedCampagne}
            onValueChange={setSelectedCampagne}
            placeholder="Campagne..."
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Ferme</Label>
          {isCentral ? (
            <SearchableSelect
              options={(domaines || []).map((d: any) => ({ value: d.id.toString(), label: d.nom, sublabel: d.region }))}
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
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Date d'observation</Label>
                  <Input
                    type="date"
                    value={observationDate}
                    onChange={e => setObservationDate(e.target.value)}
                    className="h-8 text-sm mt-1"
                  />
                </div>
                {lastObsDate && (
                  <div>
                    <p className="text-xs text-muted-foreground">Dernière observation</p>
                    <p className="text-sm font-medium">{lastObsDate}</p>
                  </div>
                )}
                {nextDueDate && (
                  <div>
                    <p className="text-xs text-muted-foreground">Prochaine due</p>
                    <p className={`text-sm font-medium ${nextDueDate < today ? "text-destructive" : ""}`}>{nextDueDate}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Progression</p>
                  <Progress value={progressPct} className="h-3" />
                  <p className="text-xs text-muted-foreground mt-1">{checkedCodes}/{totalCodes} codes ({progressPct}%)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {typeGroups.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                Aucune variété associée à cette ferme.
              </CardContent>
            </Card>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {typeGroups.map(([typeId, group]) => {
                const groupChecked = group.varietes.filter(v => edits[v.id]?.checked).length;
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
                        <div className="flex items-center gap-2 ml-auto mr-4">
                          <Button
                            variant="ghost" size="sm" className="h-6 px-2 text-xs"
                            onClick={e => {
                              e.stopPropagation();
                              const allChecked = group.varietes.every(v => edits[v.id]?.checked);
                              checkAllType(group.varietes, !allChecked);
                            }}
                          >
                            {group.varietes.every(v => edits[v.id]?.checked) ? "Décocher tout" : "Tout cocher"}
                          </Button>
                          <span className="text-xs text-muted-foreground">{groupChecked}/{group.varietes.length} codes</span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-0 pb-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[80px]">Code</TableHead>
                              <TableHead className="w-[200px]">Nouveau stade</TableHead>
                              <TableHead className="w-[140px]">Date</TableHead>
                              <TableHead className="min-w-[150px]">Obs</TableHead>
                              <TableHead className="w-[40px]">✓</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.varietes.map(v => {
                              const edit = getEdit(v.id);
                              return (
                                <TableRow key={v.id} className={edit.checked ? "bg-primary/5" : ""}>
                                  <TableCell className="font-mono text-sm">{v.codeVariete}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Select
                                        value={edit.stade || "none"}
                                        onValueChange={val => updateEdit(v.id, "stade", val === "none" ? "" : val)}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue placeholder="Stade..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">—</SelectItem>
                                          {STADES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                                              onClick={() => duplicateStadeToType(v.id, group.varietes)}
                                            >
                                              <CopyCheck className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top">
                                            <p className="text-xs">Appliquer ce stade aux codes restants</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="date" className="h-8 text-xs"
                                      value={edit.date}
                                      onChange={e => updateEdit(v.id, "date", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      className="h-8 text-xs" placeholder="Observations..."
                                      value={edit.obs}
                                      onChange={e => updateEdit(v.id, "obs", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Checkbox
                                      checked={edit.checked}
                                      onCheckedChange={c => updateEdit(v.id, "checked", !!c)}
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

          <div className="sticky bottom-4 z-10 flex items-center gap-3">
            <Button
              className="w-full sm:w-auto" size="lg"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || checkedCodes === 0}
            >
              <Save className="h-5 w-5 mr-2" />
              💾 Enregistrer ({checkedCodes} code{checkedCodes > 1 ? "s" : ""})
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
