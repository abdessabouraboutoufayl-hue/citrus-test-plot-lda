import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/SearchableSelect";
import { toast } from "sonner";
import { Flower2, Leaf, TreeDeciduous, Cherry, Sun, Paintbrush, Check, CalendarDays, Bell, BellOff, Info } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STADES = [
  { key: "repos", num: 1, label: "Repos végétatif", icon: TreeDeciduous, color: "bg-gray-400" },
  { key: "debourrement", num: 2, label: "Débourrement", icon: Leaf, color: "bg-lime-500" },
  { key: "boutons_floraux", num: 3, label: "Boutons floraux visibles", icon: Flower2, color: "bg-yellow-400" },
  { key: "prefloraison", num: 4, label: "Pré-floraison", icon: Flower2, color: "bg-yellow-400" },
  { key: "floraison", num: 5, label: "Floraison", icon: Flower2, color: "bg-pink-500", critical: true },
  { key: "chute_petales", num: 6, label: "Chute pétales", icon: Leaf, color: "bg-pink-300" },
  { key: "nouaison", num: 7, label: "Nouaison", icon: Cherry, color: "bg-orange-500" },
  { key: "chute_physio", num: 8, label: "Chute physiologique", icon: Cherry, color: "bg-red-500", critical: true },
  { key: "grossissement", num: 9, label: "Grossissement fruits", icon: Sun, color: "bg-amber-400" },
  { key: "veraison", num: 10, label: "Véraison", icon: Paintbrush, color: "bg-purple-500" },
  { key: "debut_maturite", num: 11, label: "Début maturité", icon: Check, color: "bg-green-500" },
  { key: "maturite_recolte", num: 12, label: "Maturité récolte", icon: Check, color: "bg-green-700" },
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

export default function PhenologieSuivi() {
  const { session, userInfo } = useAuth();
  const queryClient = useQueryClient();

  const [selectedCampagne, setSelectedCampagne] = useState("");
  const [selectedVariete, setSelectedVariete] = useState("");
  const [selectedStade, setSelectedStade] = useState("");
  const [stadeDate, setStadeDate] = useState("");
  const [stadeObs, setStadeObs] = useState("");
  const [observateurNom, setObservateurNom] = useState(userInfo.nomComplet || "");
  const [rappelActif, setRappelActif] = useState(true);

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
  const selectedVarieteObj = varietes?.find((v) => v.id.toString() === selectedVariete);

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

  // When stade selection changes, load existing data for that stade
  useEffect(() => {
    if (phenoRecord && selectedStade) {
      const dateField = getStadeDateField(selectedStade);
      const obsField = getStadeObsField(selectedStade);
      setStadeDate((phenoRecord as any)[dateField] || "");
      setStadeObs((phenoRecord as any)[obsField] || "");
    } else {
      setStadeDate("");
      setStadeObs("");
    }
  }, [selectedStade, phenoRecord]);

  const isStadeCompleted = (key: string) => phenoRecord ? !!(phenoRecord as any)[getStadeDateField(key)] : false;
  const completedCount = STADES.filter((s) => isStadeCompleted(s.key)).length;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCampagne || !selectedVariete) throw new Error("Veuillez sélectionner campagne et variété");
      if (!userInfo.domaineId) throw new Error("Aucun domaine associé à votre compte");
      if (!session?.user?.id) throw new Error("Vous devez être connecté");
      if (!selectedStade) throw new Error("Veuillez sélectionner un stade");
      if (!stadeDate) throw new Error("Veuillez saisir une date");

      const dateField = getStadeDateField(selectedStade);
      const obsField = getStadeObsField(selectedStade);

      const payload: any = {
        domaine_id: userInfo.domaineId,
        campagne_id: Number(selectedCampagne),
        variete_id: Number(selectedVariete),
        date_observation: new Date().toISOString().split("T")[0],
        observateur_nom: observateurNom,
        user_id: session.user.id,
        [dateField]: stadeDate,
        [obsField]: stadeObs || null,
      };

      if (phenoRecord) {
        const { error } = await supabase.from("phenologie").update(payload).eq("id", phenoRecord.id);
        if (error) throw error;
        await supabase.from("phenologie_observations").insert({
          phenologie_id: phenoRecord.id,
          date_observation: payload.date_observation,
          stades_observes: [STADES.find((s) => s.key === selectedStade)?.label],
          notes: stadeObs || null,
          observateur_nom: observateurNom,
        });
      } else {
        const { data, error } = await supabase.from("phenologie").insert(payload).select().single();
        if (error) throw error;
        await supabase.from("phenologie_observations").insert({
          phenologie_id: data.id,
          date_observation: payload.date_observation,
          stades_observes: [STADES.find((s) => s.key === selectedStade)?.label],
          notes: "Première observation",
          observateur_nom: observateurNom,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phenologie"] });
      toast.success("Observation enregistrée");
    },
    onError: (e: any) => toast.error(e.message),
  });

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
          {/* Timeline */}
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
                  const dateVal = phenoRecord ? (phenoRecord as any)[dateField] : null;
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

          {/* Formulaire de saisie */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Saisie observation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Nom domaine</Label>
                  <Input value={userDomaine?.nom || ""} disabled className="h-9 bg-muted" />
                </div>
                <div>
                  <Label className="text-xs">Date observation</Label>
                  <Input type="date" value={new Date().toISOString().split("T")[0]} disabled className="h-9 bg-muted" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Type variété</Label>
                  <Input value={selectedVarieteObj?.types_varietes?.type_nom || "-"} disabled className="h-9 bg-muted" />
                </div>
                <div>
                  <Label className="text-xs">Code variété</Label>
                  <Input value={selectedVarieteObj?.code_variete || "-"} disabled className="h-9 bg-muted" />
                </div>
              </div>

              <div>
                <Label className="text-xs">Stade phénologique</Label>
                <SearchableSelect
                  options={STADES.map((s) => ({
                    value: s.key,
                    label: `${s.num}. ${s.label}`,
                    sublabel: isStadeCompleted(s.key) ? "✅ Déjà renseigné" : undefined,
                  }))}
                  value={selectedStade}
                  onValueChange={setSelectedStade}
                  placeholder="Sélectionner un stade..."
                />
              </div>

              {selectedStade && (
                <>
                  <div>
                    <Label className="text-xs">Date du stade</Label>
                    <Input type="date" value={stadeDate} onChange={(e) => setStadeDate(e.target.value)} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Observateur</Label>
                    <Input value={observateurNom} onChange={(e) => setObservateurNom(e.target.value)} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Observations</Label>
                    <Textarea value={stadeObs} onChange={(e) => setStadeObs(e.target.value)} rows={3} className="text-sm" placeholder="Notes sur ce stade..." />
                  </div>
                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !observateurNom || !stadeDate} className="w-full">
                    💾 Enregistrer observation
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
