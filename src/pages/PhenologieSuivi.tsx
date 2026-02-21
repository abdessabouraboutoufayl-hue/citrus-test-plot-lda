import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SearchableSelect } from "@/components/SearchableSelect";
import { toast } from "sonner";
import { Flower2, Leaf, TreeDeciduous, Cherry, Sun, Paintbrush, Check, Clock, CalendarDays, Bell, BellOff, Info } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

const STADES = [
  { key: "repos", num: 1, label: "Repos végétatif", icon: TreeDeciduous, color: "bg-gray-400", critical: false },
  { key: "debourrement", num: 2, label: "Débourrement", icon: Leaf, color: "bg-lime-500", critical: false },
  { key: "boutons_floraux", num: 3, label: "Boutons floraux visibles", icon: Flower2, color: "bg-yellow-400", critical: false },
  { key: "prefloraison", num: 4, label: "Pré-floraison", icon: Flower2, color: "bg-yellow-400", critical: false },
  { key: "floraison", num: 5, label: "Floraison", icon: Flower2, color: "bg-pink-500", critical: true },
  { key: "chute_petales", num: 6, label: "Chute pétales", icon: Leaf, color: "bg-pink-300", critical: false },
  { key: "nouaison", num: 7, label: "Nouaison", icon: Cherry, color: "bg-orange-500", critical: false },
  { key: "chute_physio", num: 8, label: "Chute physiologique", icon: Cherry, color: "bg-red-500", critical: true },
  { key: "grossissement", num: 9, label: "Grossissement fruits", icon: Sun, color: "bg-amber-400", critical: false },
  { key: "veraison", num: 10, label: "Véraison", icon: Paintbrush, color: "bg-purple-500", critical: false },
  { key: "debut_maturite", num: 11, label: "Début maturité", icon: Check, color: "bg-green-500", critical: false },
  { key: "maturite_recolte", num: 12, label: "Maturité récolte", icon: Check, color: "bg-green-700", critical: false },
];

function getStadeDateField(key: string): string {
  if (key === "debut_maturite") return "stade_debut_maturite_date";
  if (key === "maturite_recolte") return "stade_maturite_recolte_date";
  return `stade_${key}_date_debut`;
}

export default function PhenologieSuivi() {
  const { session, userInfo } = useAuth();
  const queryClient = useQueryClient();

  const [selectedCampagne, setSelectedCampagne] = useState<string>("");
  const [selectedVariete, setSelectedVariete] = useState<string>("");
  const [observateurNom, setObservateurNom] = useState(userInfo.nomComplet || "");
  const [conditionsMeteo, setConditionsMeteo] = useState("");
  const [temperatureMoyenne, setTemperatureMoyenne] = useState("");
  const [rappelActif, setRappelActif] = useState(true);
  const [formData, setFormData] = useState<Record<string, any>>({});

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

  const { data: domaines } = useQuery({
    queryKey: ["domaines"],
    queryFn: async () => {
      const { data } = await supabase.from("domaines").select("*");
      return data || [];
    },
  });

  const userDomaine = domaines?.find((d) => d.id === userInfo.domaineId);

  const { data: phenoRecord } = useQuery({
    queryKey: ["phenologie", selectedCampagne, selectedVariete, userInfo.domaineId],
    queryFn: async () => {
      if (!selectedCampagne || !selectedVariete || !userInfo.domaineId) return null;
      const { data } = await supabase
        .from("phenologie")
        .select("*")
        .eq("campagne_id", Number(selectedCampagne))
        .eq("variete_id", Number(selectedVariete))
        .eq("domaine_id", userInfo.domaineId)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedCampagne && !!selectedVariete && !!userInfo.domaineId,
  });

  useEffect(() => {
    if (phenoRecord) {
      const data: Record<string, any> = {};
      STADES.forEach((s) => {
        const dateField = getStadeDateField(s.key);
        data[dateField] = (phenoRecord as any)[dateField] || "";
        const obsField = s.key === "debut_maturite" ? "stade_debut_maturite_observations" : s.key === "maturite_recolte" ? "stade_maturite_recolte_observations" : `stade_${s.key}_observations`;
        data[obsField] = (phenoRecord as any)[obsField] || "";
      });
      data.stade_floraison_date_fin = phenoRecord.stade_floraison_date_fin || "";
      data.stade_floraison_intensite = phenoRecord.stade_floraison_intensite || "";
      data.stade_floraison_pct_arbres = phenoRecord.stade_floraison_pct_arbres ?? "";
      data.stade_floraison_nb_fleurs_estime = phenoRecord.stade_floraison_nb_fleurs_estime ?? "";
      data.stade_nouaison_taux_pct = phenoRecord.stade_nouaison_taux_pct ?? "";
      data.stade_chute_physio_date_fin = phenoRecord.stade_chute_physio_date_fin || "";
      data.stade_chute_physio_intensite = phenoRecord.stade_chute_physio_intensite || "";
      data.stade_chute_physio_taux_pct = phenoRecord.stade_chute_physio_taux_pct ?? "";
      data.stade_veraison_pct_fruits_colores = phenoRecord.stade_veraison_pct_fruits_colores ?? "";
      setConditionsMeteo(phenoRecord.conditions_meteo_generales || "");
      setTemperatureMoyenne(phenoRecord.temperature_moyenne_periode?.toString() || "");
      setObservateurNom(phenoRecord.observateur_nom || userInfo.nomComplet || "");
      setFormData(data);
    } else {
      setFormData({});
    }
  }, [phenoRecord]);

  const updateField = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCampagne || !selectedVariete || !userInfo.domaineId || !session?.user?.id) {
        throw new Error("Veuillez sélectionner campagne et variété");
      }
      const payload: any = {
        domaine_id: userInfo.domaineId,
        campagne_id: Number(selectedCampagne),
        variete_id: Number(selectedVariete),
        date_observation: new Date().toISOString().split("T")[0],
        observateur_nom: observateurNom,
        conditions_meteo_generales: conditionsMeteo || null,
        temperature_moyenne_periode: temperatureMoyenne ? Number(temperatureMoyenne) : null,
        user_id: session.user.id,
      };
      Object.entries(formData).forEach(([key, val]) => {
        if (val === "" || val === undefined) {
          payload[key] = null;
        } else if (key.includes("pct") || key.includes("taux") || key.includes("nb_fleurs") || key.includes("temperature")) {
          payload[key] = Number(val);
        } else {
          payload[key] = val;
        }
      });

      if (phenoRecord) {
        const { error } = await supabase.from("phenologie").update(payload).eq("id", phenoRecord.id);
        if (error) throw error;
        const stadesObserves = STADES.filter((s) => {
          const dateField = getStadeDateField(s.key);
          return formData[dateField];
        }).map((s) => s.label);
        await supabase.from("phenologie_observations").insert({
          phenologie_id: phenoRecord.id,
          date_observation: payload.date_observation,
          stades_observes: stadesObserves,
          notes: conditionsMeteo || null,
          observateur_nom: observateurNom,
        });
      } else {
        const { data, error } = await supabase.from("phenologie").insert(payload).select().single();
        if (error) throw error;
        await supabase.from("phenologie_observations").insert({
          phenologie_id: data.id,
          date_observation: payload.date_observation,
          stades_observes: [],
          notes: "Première observation",
          observateur_nom: observateurNom,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phenologie"] });
      toast.success("Observation phénologique enregistrée");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isStadeCompleted = (key: string) => !!formData[getStadeDateField(key)];
  const completedCount = STADES.filter((s) => isStadeCompleted(s.key)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          🌸 Suivi Phénologique {userDomaine ? `- ${userDomaine.nom}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
          <Info className="h-4 w-4" /> Suivi par variété globale (tous arbres confondus)
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          <Label className="text-xs mb-1 block">Variété</Label>
          <SearchableSelect
            options={(varietes || []).map((v) => ({
              value: v.id.toString(),
              label: v.code_variete,
              sublabel: v.nom_commercial || undefined,
              badge: v.types_varietes ? { text: v.types_varietes.type_code, color: v.types_varietes.couleur_badge || "#888" } : undefined,
            }))}
            value={selectedVariete}
            onValueChange={setSelectedVariete}
            placeholder="Variété..."
          />
        </div>
        <div className="flex items-end">
          <Button variant={rappelActif ? "default" : "outline"} onClick={() => setRappelActif(!rappelActif)} className="w-full">
            {rappelActif ? <Bell className="h-4 w-4 mr-2" /> : <BellOff className="h-4 w-4 mr-2" />}
            Rappel 15j {rappelActif ? "actif" : "inactif"}
          </Button>
        </div>
      </div>

      {selectedCampagne && selectedVariete && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4" /> Timeline — {completedCount}/12 stades
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative pl-6">
                {STADES.map((stade, idx) => {
                  const completed = isStadeCompleted(stade.key);
                  const dateField = getStadeDateField(stade.key);
                  const dateVal = formData[dateField];
                  return (
                    <div key={stade.key} className="relative pb-6 last:pb-0">
                      {idx < STADES.length - 1 && (
                        <div className={`absolute left-[-16px] top-6 bottom-0 w-0.5 ${completed ? "bg-primary" : "bg-muted"}`} />
                      )}
                      <div className="flex items-start gap-3">
                        <div className={`absolute left-[-20px] w-3 h-3 rounded-full border-2 ${completed ? `${stade.color} border-transparent` : "bg-background border-muted-foreground/30"}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${completed ? "text-foreground" : "text-muted-foreground"}`}>
                            {stade.critical && "⭐ "}{stade.num}. {stade.label}
                          </p>
                          {dateVal && (
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(dateVal), "dd/MM/yyyy", { locale: fr })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {phenoRecord?.duree_totale_cycle_jours && (
                <p className="text-sm text-muted-foreground mt-4 pt-4 border-t">
                  Durée cycle total : <strong>{phenoRecord.duree_totale_cycle_jours}j</strong>
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Checklist des stades</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="space-y-1">
                {STADES.map((stade) => {
                  const completed = isStadeCompleted(stade.key);
                  const dateField = getStadeDateField(stade.key);
                  const obsField = stade.key === "debut_maturite" ? "stade_debut_maturite_observations" : stade.key === "maturite_recolte" ? "stade_maturite_recolte_observations" : `stade_${stade.key}_observations`;
                  const Icon = stade.icon;
                  return (
                    <AccordionItem key={stade.key} value={stade.key} className="border rounded-lg px-3">
                      <AccordionTrigger className="text-sm hover:no-underline py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${completed ? stade.color : "bg-muted"}`} />
                          <Icon className="h-4 w-4" />
                          <span>{stade.critical && "⭐ "}{stade.num}. {stade.label}</span>
                          {completed && <Check className="h-3 w-3 text-green-500" />}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pb-4">
                        <div>
                          <Label className="text-xs">Date début</Label>
                          <Input type="date" value={formData[dateField] || ""} onChange={(e) => updateField(dateField, e.target.value)} className="h-9" />
                        </div>
                        {stade.key === "floraison" && (
                          <>
                            <div>
                              <Label className="text-xs">Date fin</Label>
                              <Input type="date" value={formData.stade_floraison_date_fin || ""} onChange={(e) => updateField("stade_floraison_date_fin", e.target.value)} className="h-9" />
                            </div>
                            {formData.stade_floraison_date_debut && formData.stade_floraison_date_fin && (
                              <p className="text-xs text-muted-foreground">Durée : {differenceInDays(new Date(formData.stade_floraison_date_fin), new Date(formData.stade_floraison_date_debut))}j (auto-calculé)</p>
                            )}
                            <div>
                              <Label className="text-xs">Intensité</Label>
                              <RadioGroup value={formData.stade_floraison_intensite || ""} onValueChange={(v) => updateField("stade_floraison_intensite", v)} className="flex gap-4 mt-1">
                                {["Faible", "Moyenne", "Élevée"].map((v) => (
                                  <div key={v} className="flex items-center gap-1"><RadioGroupItem value={v} id={`flor-${v}`} /><Label htmlFor={`flor-${v}`} className="text-xs">{v}</Label></div>
                                ))}
                              </RadioGroup>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div><Label className="text-xs">% Arbres en fleur</Label><Input type="number" min={0} max={100} value={formData.stade_floraison_pct_arbres ?? ""} onChange={(e) => updateField("stade_floraison_pct_arbres", e.target.value)} className="h-9" /></div>
                              <div><Label className="text-xs">Nb fleurs estimé</Label><Input type="number" value={formData.stade_floraison_nb_fleurs_estime ?? ""} onChange={(e) => updateField("stade_floraison_nb_fleurs_estime", e.target.value)} className="h-9" /></div>
                            </div>
                          </>
                        )}
                        {stade.key === "nouaison" && (
                          <div><Label className="text-xs">Taux nouaison %</Label><Input type="number" min={0} max={100} value={formData.stade_nouaison_taux_pct ?? ""} onChange={(e) => updateField("stade_nouaison_taux_pct", e.target.value)} className="h-9" /></div>
                        )}
                        {stade.key === "chute_physio" && (
                          <>
                            <div><Label className="text-xs">Date fin</Label><Input type="date" value={formData.stade_chute_physio_date_fin || ""} onChange={(e) => updateField("stade_chute_physio_date_fin", e.target.value)} className="h-9" /></div>
                            {formData.stade_chute_physio_date_debut && formData.stade_chute_physio_date_fin && (
                              <p className="text-xs text-muted-foreground">Durée : {differenceInDays(new Date(formData.stade_chute_physio_date_fin), new Date(formData.stade_chute_physio_date_debut))}j</p>
                            )}
                            <div>
                              <Label className="text-xs">Intensité</Label>
                              <RadioGroup value={formData.stade_chute_physio_intensite || ""} onValueChange={(v) => updateField("stade_chute_physio_intensite", v)} className="flex gap-4 mt-1">
                                {["Faible", "Moyenne", "Intense"].map((v) => (
                                  <div key={v} className="flex items-center gap-1"><RadioGroupItem value={v} id={`chute-${v}`} /><Label htmlFor={`chute-${v}`} className="text-xs">{v}</Label></div>
                                ))}
                              </RadioGroup>
                            </div>
                            <div><Label className="text-xs">Taux chute estimé %</Label><Input type="number" min={0} max={100} value={formData.stade_chute_physio_taux_pct ?? ""} onChange={(e) => updateField("stade_chute_physio_taux_pct", e.target.value)} className="h-9" /></div>
                          </>
                        )}
                        {stade.key === "veraison" && (
                          <div><Label className="text-xs">% Fruits colorés</Label><Input type="number" min={0} max={100} value={formData.stade_veraison_pct_fruits_colores ?? ""} onChange={(e) => updateField("stade_veraison_pct_fruits_colores", e.target.value)} className="h-9" /></div>
                        )}
                        <div>
                          <Label className="text-xs">Observations</Label>
                          <Textarea value={formData[obsField] || ""} onChange={(e) => updateField(obsField, e.target.value)} rows={2} className="text-sm" />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>

              <div className="mt-6 space-y-3 pt-4 border-t">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><Label className="text-xs">Observateur</Label><Input value={observateurNom} onChange={(e) => setObservateurNom(e.target.value)} className="h-9" /></div>
                  <div><Label className="text-xs">Température moyenne °C</Label><Input type="number" step="0.1" value={temperatureMoyenne} onChange={(e) => setTemperatureMoyenne(e.target.value)} className="h-9" /></div>
                  <div><Label className="text-xs">Conditions météo</Label><Input value={conditionsMeteo} onChange={(e) => setConditionsMeteo(e.target.value)} className="h-9" placeholder="Temps sec, T° 18-25°C" /></div>
                </div>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !observateurNom} className="w-full">
                  💾 Enregistrer observation
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
