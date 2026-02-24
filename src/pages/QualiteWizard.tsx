import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Save, Check, Camera, Upload, AlertTriangle, Info } from "lucide-react";

const schema = z.object({
  domaine_id: z.number().optional().nullable(),
  campagne_id: z.number({ required_error: "Campagne requise" }),
  variete_id: z.number({ required_error: "Variété requise" }),
  porte_greffe_id: z.number({ required_error: "Porte-greffe requis" }),
  date_analyse: z.string().min(1, "Date requise"),
  nb_fruits_echantillon: z.number().int().min(1).max(20).default(10),
  pct_jus: z.number().min(0).max(100).optional().nullable(),
  poids_jus_g: z.number().min(0).optional().nullable(),
  volume_jus_ml: z.number().min(0).optional().nullable(),
  brix_degres: z.number({ required_error: "Brix requis" }).min(5, "Min 5").max(20, "Max 20"),
  acidite_gl: z.number({ required_error: "Acidité requise" }).min(0.1, "Min 0.1").max(5, "Max 5"),
  volume_naoh_ml: z.number().min(0).optional().nullable(),
  nb_pepins_echantillon_total: z.number().int().min(0).optional().nullable(),
  nb_fruits_avec_pepins: z.number().int().min(0).optional().nullable(),
  moyenne_fermete_peau_kg_cm2: z.number().min(0).optional().nullable(),
  moyenne_fermete_fruit_kg_cm2: z.number().min(0).optional().nullable(),
  granulation_severe: z.enum(["Oui", "Non"]).optional().nullable(),
  granulation_legere: z.enum(["Oui", "Non"]).optional().nullable(),
  photo_legende: z.string().optional(),
  technicien_nom: z.string().min(2, "Technicien requis"),
  observations: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function EaBadge({ brix, acidite }: { brix?: number; acidite?: number }) {
  if (!brix || !acidite || acidite === 0) return null;
  const ea = brix / acidite;
  let bg = "bg-destructive/20 text-destructive";
  let label = "Maturité insuffisante";
  if (ea >= 12) { bg = "bg-success/20 text-success"; label = "Maturité optimale ⭐"; }
  else if (ea >= 10) { bg = "bg-warning/20 text-warning"; label = "Limite acceptable"; }
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl font-bold">{ea.toFixed(2)}</span>
      <Badge className={bg}>{label}</Badge>
    </div>
  );
}

export default function QualiteWizard() {
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;
  const [step, setStep] = useState(0);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, userInfo } = useAuth();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nb_fruits_echantillon: 10,
      date_analyse: new Date().toISOString().split("T")[0],
      technicien_nom: "",
      domaine_id: userInfo.domaineId || undefined,
    },
  });

  // Load existing data in edit mode
  const { data: existingData, isLoading: loadingEdit } = useQuery({
    queryKey: ["qualite-edit", editId],
    enabled: isEdit,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qualite_interne")
        .select("*")
        .eq("id", Number(editId))
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existingData) {
      form.reset({
        domaine_id: existingData.domaine_id,
        campagne_id: existingData.campagne_id,
        variete_id: existingData.variete_id,
        porte_greffe_id: existingData.porte_greffe_id,
        date_analyse: existingData.date_analyse,
        nb_fruits_echantillon: existingData.nb_fruits_echantillon,
        pct_jus: existingData.pct_jus,
        poids_jus_g: existingData.poids_jus_g,
        volume_jus_ml: existingData.volume_jus_ml,
        brix_degres: existingData.brix_degres,
        acidite_gl: existingData.acidite_gl,
        volume_naoh_ml: existingData.volume_naoh_ml,
        nb_pepins_echantillon_total: existingData.nb_pepins_echantillon_total,
        nb_fruits_avec_pepins: existingData.nb_fruits_avec_pepins,
        moyenne_fermete_peau_kg_cm2: existingData.moyenne_fermete_peau_kg_cm2,
        moyenne_fermete_fruit_kg_cm2: existingData.moyenne_fermete_fruit_kg_cm2,
        granulation_severe: existingData.granulation_severe as any,
        granulation_legere: existingData.granulation_legere as any,
        photo_legende: existingData.photo_legende || "",
        technicien_nom: existingData.technicien_nom,
        observations: existingData.observations || "",
      });
      if (existingData.photo_fruits_coupes_url) {
        setPhotoPreview(existingData.photo_fruits_coupes_url);
      }
    }
  }, [existingData]);

  const { data: campagnes = [] } = useQuery({
    queryKey: ["campagnes"],
    queryFn: async () => { const { data } = await supabase.from("campagnes").select("*"); return data || []; },
  });
  const { data: varietes = [] } = useQuery({
    queryKey: ["varietes"],
    queryFn: async () => { const { data } = await supabase.from("varietes").select("*, types_varietes(type_nom, type_code, couleur_badge)"); return data || []; },
  });
  const { data: porteGreffes = [] } = useQuery({
    queryKey: ["porte_greffes"],
    queryFn: async () => { const { data } = await supabase.from("porte_greffes").select("*"); return data || []; },
  });
  const { data: domaines = [] } = useQuery({
    queryKey: ["domaines"],
    queryFn: async () => { const { data } = await supabase.from("domaines").select("*"); return data || []; },
  });

  const isCentral = userInfo.role === "responsable_central";
  const w = form.watch();
  const currentDomaine = domaines.find((d) => d.id === (userInfo.domaineId || w.domaine_id));
  const ratioEA = w.brix_degres && w.acidite_gl && w.acidite_gl !== 0 ? w.brix_degres / w.acidite_gl : null;
  const moyennePepins = w.nb_pepins_echantillon_total != null && w.nb_fruits_echantillon
    ? (w.nb_pepins_echantillon_total / w.nb_fruits_echantillon).toFixed(2) : "-";
  const moisAnalyse = w.date_analyse ? new Date(w.date_analyse).toLocaleString("fr-FR", { month: "long" }) : "-";

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submitMutation = useMutation({
    mutationFn: async ({ data, status }: { data: FormData; status: string }) => {
      if (!user) throw new Error("Non authentifié");
      const domaineId = isCentral ? data.domaine_id : userInfo.domaineId;
      if (!domaineId) throw new Error("Domaine requis");

      let photoUrl: string | null = existingData?.photo_fruits_coupes_url || null;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const path = `qualite/${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("production-photos").upload(path, photoFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("production-photos").getPublicUrl(path);
        photoUrl = urlData.publicUrl;
      }

      const payload = {
        domaine_id: domaineId,
        campagne_id: data.campagne_id,
        variete_id: data.variete_id,
        porte_greffe_id: data.porte_greffe_id,
        date_analyse: data.date_analyse,
        nb_fruits_echantillon: data.nb_fruits_echantillon,
        pct_jus: data.pct_jus || null,
        poids_jus_g: data.poids_jus_g || null,
        volume_jus_ml: data.volume_jus_ml || null,
        brix_degres: data.brix_degres,
        acidite_gl: data.acidite_gl,
        volume_naoh_ml: data.volume_naoh_ml || null,
        nb_pepins_echantillon_total: data.nb_pepins_echantillon_total || null,
        nb_fruits_avec_pepins: data.nb_fruits_avec_pepins || null,
        moyenne_fermete_peau_kg_cm2: data.moyenne_fermete_peau_kg_cm2 || null,
        moyenne_fermete_fruit_kg_cm2: data.moyenne_fermete_fruit_kg_cm2 || null,
        granulation_severe: data.granulation_severe || null,
        granulation_legere: data.granulation_legere || null,
        observations: data.observations || null,
        photo_fruits_coupes_url: photoUrl,
        photo_legende: data.photo_legende || null,
        technicien_nom: data.technicien_nom,
        statut_validation: status,
      } as any;

      if (isEdit) {
        const { error } = await supabase.from("qualite_interne").update(payload).eq("id", Number(editId));
        if (error) throw error;
      } else {
        payload.user_id = user.id;
        const { error } = await supabase.from("qualite_interne").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(isEdit ? "Analyse modifiée" : "Analyse qualité enregistrée"); navigate("/qualite"); },
    onError: (err: any) => toast.error(err.message),
  });

  const onSubmit = (status: string) => {
    form.handleSubmit(
      (data) => submitMutation.mutate({ data, status }),
      (errors) => {
        console.error("Validation errors:", errors);
        const firstError = Object.values(errors)[0];
        toast.error(firstError?.message?.toString() || "Veuillez vérifier les champs obligatoires");
      }
    )();
  };

  const steps = ["Identification", "Jus", "Chimique", "Pépins & Fermeté", "Photo & Obs.", "Récapitulatif"];
  const selectedVariete = varietes.find((v) => v.id === w.variete_id);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{isEdit ? "Modifier l'analyse qualité" : "Nouvelle analyse qualité"}</h1>
      {loadingEdit && isEdit && <p className="text-muted-foreground">Chargement...</p>}

      {/* Stepper */}
      <div className="flex items-center justify-center gap-1 flex-wrap">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
              i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>{i + 1}</div>
            <span className="hidden lg:inline text-xs text-muted-foreground">{s}</span>
            {i < steps.length - 1 && <div className="w-4 h-0.5 bg-border" />}
          </div>
        ))}
      </div>

      <Form {...form}>
        <form className="space-y-4">
          {/* Step 0: Identification */}
          {step === 0 && (
            <Card>
              <CardHeader><CardTitle>Identification</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {isCentral ? (
                  <FormField control={form.control} name="domaine_id" render={({ field }) => (
                    <FormItem><FormLabel>Domaine</FormLabel>
                      <SearchableSelect
                        options={domaines.map((d) => ({ value: d.id.toString(), label: `${d.nom} (${d.code})` }))}
                        value={field.value?.toString()}
                        onValueChange={(v) => field.onChange(Number(v))}
                        placeholder="Sélectionner un domaine"
                        searchPlaceholder="Rechercher domaine..."
                      /><FormMessage />
                    </FormItem>
                  )} />
                ) : (
                  <div><Label>Domaine</Label><Input value={currentDomaine?.nom || "Non assigné"} disabled /></div>
                )}
                <FormField control={form.control} name="campagne_id" render={({ field }) => (
                  <FormItem><FormLabel>Campagne</FormLabel>
                    <SearchableSelect
                      options={campagnes.map((c) => ({ value: c.id.toString(), label: c.code_campagne }))}
                      value={field.value?.toString()}
                      onValueChange={(v) => field.onChange(Number(v))}
                      placeholder="Sélectionner campagne"
                      searchPlaceholder="Rechercher campagne..."
                    /><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="variete_id" render={({ field }) => (
                  <FormItem><FormLabel>Code Variété</FormLabel>
                    <SearchableSelect
                      options={varietes.map((v) => ({
                        value: v.id.toString(),
                        label: `${v.code_variete} - ${v.nom_commercial || ""}`,
                        badge: (v.types_varietes as any)?.type_code ? { text: (v.types_varietes as any).type_code, color: (v.types_varietes as any)?.couleur_badge || "#999" } : undefined,
                      }))}
                      value={field.value?.toString()}
                      onValueChange={(v) => field.onChange(Number(v))}
                      placeholder="Rechercher variété..."
                      searchPlaceholder="Code ou nom..."
                    /><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="porte_greffe_id" render={({ field }) => (
                  <FormItem><FormLabel>Porte-greffe</FormLabel>
                    <div className="flex gap-2 flex-wrap">
                      {porteGreffes.map((pg) => (
                        <Button key={pg.id} type="button" variant={field.value === pg.id ? "default" : "outline"} size="sm" onClick={() => field.onChange(pg.id)}>{pg.code_pg}</Button>
                      ))}
                    </div><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="date_analyse" render={({ field }) => (
                  <FormItem><FormLabel>Date analyse</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div><Label>Mois analyse</Label><Input value={moisAnalyse} disabled /></div>
                <FormField control={form.control} name="nb_fruits_echantillon" render={({ field }) => (
                  <FormItem><FormLabel>Nb fruits échantillon (1-20)</FormLabel>
                    <FormControl><Input type="number" min={1} max={20} {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl><FormMessage />
                  </FormItem>
                )} />
                <div className="flex items-start gap-2 p-3 bg-accent/30 rounded-md text-sm text-muted-foreground">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>💡 Analyse mensuelle par variété/porte-greffe (échantillon 10 fruits mixtes tous arbres)</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 1: Jus */}
          {step === 1 && (
            <Card>
              <CardHeader><CardTitle>Paramètres Jus</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Mesures sur échantillon {w.nb_fruits_echantillon} fruits</p>
                <FormField control={form.control} name="pct_jus" render={({ field }) => (
                  <FormItem><FormLabel>% Jus</FormLabel>
                    <div className="relative"><FormControl><Input type="number" step="0.01" placeholder="42.5" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} /></FormControl><span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span></div><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="poids_jus_g" render={({ field }) => (
                  <FormItem><FormLabel>Poids Jus</FormLabel>
                    <div className="relative"><FormControl><Input type="number" step="0.01" placeholder="125.3" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} /></FormControl><span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">g</span></div><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="volume_jus_ml" render={({ field }) => (
                  <FormItem><FormLabel>Volume Jus</FormLabel>
                    <div className="relative"><FormControl><Input type="number" step="0.01" placeholder="122.0" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} /></FormControl><span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">mL</span></div><FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>
          )}

          {/* Step 2: Chimique */}
          {step === 2 && (
            <Card>
              <CardHeader><CardTitle>Paramètres Chimiques</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="brix_degres" render={({ field }) => (
                  <FormItem><FormLabel>Brix (5-20) *</FormLabel>
                    <div className="relative"><FormControl><Input type="number" step="0.01" placeholder="11.8" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} /></FormControl><span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">°</span></div><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="acidite_gl" render={({ field }) => (
                  <FormItem><FormLabel>Acidité (0.1-5) *</FormLabel>
                    <div className="relative"><FormControl><Input type="number" step="0.001" placeholder="0.95" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} /></FormControl><span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">g/L</span></div><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="volume_naoh_ml" render={({ field }) => (
                  <FormItem><FormLabel>Volume NaOH (optionnel)</FormLabel>
                    <div className="relative"><FormControl><Input type="number" step="0.01" placeholder="9.5" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} /></FormControl><span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">mL</span></div><FormMessage />
                  </FormItem>
                )} />
                <Card className="border-0 bg-accent/30">
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground mb-1">Ratio E/A (auto-calculé)</p>
                    <EaBadge brix={w.brix_degres} acidite={w.acidite_gl} />
                    {!ratioEA && <p className="text-sm text-muted-foreground">Saisissez Brix et Acidité</p>}
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Pépins & Fermeté */}
          {step === 3 && (
            <Card>
              <CardHeader><CardTitle>Pépins & Fermeté</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">🫘 Pépins</h3>
                  <FormField control={form.control} name="nb_pepins_echantillon_total" render={({ field }) => (
                    <FormItem><FormLabel>Nb pépins total échantillon</FormLabel>
                      <FormControl><Input type="number" placeholder="23" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} /></FormControl><FormMessage />
                    </FormItem>
                  )} />
                  <div><Label>Moyenne pépins/fruit</Label><Input value={moyennePepins} disabled /></div>
                  <FormField control={form.control} name="nb_fruits_avec_pepins" render={({ field }) => (
                    <FormItem><FormLabel>Nb fruits avec pépins (max {w.nb_fruits_echantillon})</FormLabel>
                      <FormControl><Input type="number" max={w.nb_fruits_echantillon} placeholder="7" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} /></FormControl><FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">💪 Fermeté (Pénétromètre)</h3>
                  <p className="text-xs text-muted-foreground">Mesures pénétromètre moyenne 3 points</p>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="moyenne_fermete_peau_kg_cm2" render={({ field }) => (
                      <FormItem><FormLabel>Fermeté peau</FormLabel>
                        <div className="relative"><FormControl><Input type="number" step="0.01" placeholder="3.5" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} /></FormControl><span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">Kg/cm²</span></div><FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="moyenne_fermete_fruit_kg_cm2" render={({ field }) => (
                      <FormItem><FormLabel>Fermeté fruit</FormLabel>
                        <div className="relative"><FormControl><Input type="number" step="0.01" placeholder="1.2" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} /></FormControl><span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">Kg/cm²</span></div><FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Granulation</h3>
                  <p className="text-xs text-muted-foreground">Défaut texture vésicules (grains de pulpe)</p>
                  <FormField control={form.control} name="granulation_severe" render={({ field }) => (
                    <FormItem><FormLabel>Granulation sévère</FormLabel>
                      <div className="flex gap-2">
                        {(["Oui", "Non"] as const).map((v) => (
                          <Button key={v} type="button" size="sm" variant={field.value === v ? "default" : "outline"} onClick={() => field.onChange(v)}>{v}</Button>
                        ))}
                      </div><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="granulation_legere" render={({ field }) => (
                    <FormItem><FormLabel>Granulation légère</FormLabel>
                      <div className="flex gap-2">
                        {(["Oui", "Non"] as const).map((v) => (
                          <Button key={v} type="button" size="sm" variant={field.value === v ? "default" : "outline"} onClick={() => field.onChange(v)}>{v}</Button>
                        ))}
                      </div><FormMessage />
                    </FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Photo & Observations */}
          {step === 4 && (
            <Card>
              <CardHeader><CardTitle>Photo & Observations</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Photo fruits coupés (optionnelle)</Label>
                  <p className="text-xs text-muted-foreground mb-2">Photo optionnelle - fruits coupés transversal/longitudinal</p>
                  <div className="flex gap-2 mt-1">
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
                      <Button type="button" variant="outline" size="sm" asChild><span><Camera className="h-4 w-4 mr-1" />Prendre</span></Button>
                    </label>
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                      <Button type="button" variant="outline" size="sm" asChild><span><Upload className="h-4 w-4 mr-1" />Choisir</span></Button>
                    </label>
                  </div>
                  {photoPreview && <img src={photoPreview} alt="Preview" className="mt-3 rounded-lg max-h-48 object-cover" />}
                </div>
                <FormField control={form.control} name="photo_legende" render={({ field }) => (
                  <FormItem><FormLabel>Légende photo (optionnel)</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="technicien_nom" render={({ field }) => (
                  <FormItem><FormLabel>Technicien *</FormLabel><FormControl><Input placeholder="Nom du technicien" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="observations" render={({ field }) => (
                  <FormItem><FormLabel>Observations (optionnel)</FormLabel><FormControl><Textarea placeholder="Remarques qualité, anomalies, conditions..." {...field} /></FormControl></FormItem>
                )} />
              </CardContent>
            </Card>
          )}

          {/* Step 5: Récapitulatif */}
          {step === 5 && (
            <Card>
              <CardHeader><CardTitle>Récapitulatif</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-muted-foreground">Identification</h3>
                    <p>Variété : <strong>{selectedVariete?.code_variete}</strong> - {selectedVariete?.nom_commercial}</p>
                    <p>PG : <strong>{porteGreffes.find(pg => pg.id === w.porte_greffe_id)?.code_pg}</strong></p>
                    <p>Date : {w.date_analyse} • Mois : {moisAnalyse}</p>
                    <p>Échantillon : {w.nb_fruits_echantillon} fruits</p>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-muted-foreground">Jus</h3>
                    <p>% Jus : {w.pct_jus ?? "-"} • Poids : {w.poids_jus_g ?? "-"} g • Volume : {w.volume_jus_ml ?? "-"} mL</p>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-muted-foreground">Chimique</h3>
                    <p>Brix : {w.brix_degres}° • Acidité : {w.acidite_gl} g/L • NaOH : {w.volume_naoh_ml ?? "-"} mL</p>
                    <div className="mt-1"><EaBadge brix={w.brix_degres} acidite={w.acidite_gl} /></div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-muted-foreground">Pépins</h3>
                    <p>Total : {w.nb_pepins_echantillon_total ?? "-"} • Moy/fruit : {moyennePepins} • Fruits avec : {w.nb_fruits_avec_pepins ?? "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-muted-foreground">Fermeté</h3>
                    <p>Peau : {w.moyenne_fermete_peau_kg_cm2 ?? "-"} Kg/cm² • Fruit : {w.moyenne_fermete_fruit_kg_cm2 ?? "-"} Kg/cm²</p>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-muted-foreground">Granulation</h3>
                    <p>Sévère : {w.granulation_severe ?? "-"} • Légère : {w.granulation_legere ?? "-"}</p>
                  </div>
                  {photoPreview && (
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-muted-foreground">Photo</h3>
                      <img src={photoPreview} alt="Photo" className="rounded-lg max-h-32 object-cover" />
                      {w.photo_legende && <p className="text-xs text-muted-foreground">{w.photo_legende}</p>}
                    </div>
                  )}
                </div>

                {/* Alertes */}
                <div className="space-y-2 pt-2">
                  {ratioEA != null && ratioEA < 10 && (
                    <div className="flex items-center gap-2 text-destructive text-sm"><AlertTriangle className="h-4 w-4" /> E/A faible (&lt;10) - Maturité insuffisante</div>
                  )}
                  {w.brix_degres != null && (w.brix_degres < 8 || w.brix_degres > 16) && (
                    <div className="flex items-center gap-2 text-destructive text-sm"><AlertTriangle className="h-4 w-4" /> Brix hors norme (&lt;8 ou &gt;16)</div>
                  )}
                  {w.granulation_severe === "Oui" && (
                    <div className="flex items-center gap-2 text-warning text-sm"><AlertTriangle className="h-4 w-4" /> Granulation sévère détectée</div>
                  )}
                  {ratioEA != null && ratioEA >= 12 && (
                    <div className="flex items-center gap-2 text-success text-sm"><Check className="h-4 w-4" /> Maturité optimale ⭐</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Retour
            </Button>
            {step < 5 ? (
              <Button type="button" onClick={() => setStep(step + 1)}>
                Suivant <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => onSubmit("Brouillon")} disabled={submitMutation.isPending}>
                  <Save className="h-4 w-4 mr-1" /> Brouillon
                </Button>
                <Button type="button" onClick={() => onSubmit("Soumis")} disabled={submitMutation.isPending} className="bg-success hover:bg-success/90 text-success-foreground">
                  <Check className="h-4 w-4 mr-1" /> Soumettre
                </Button>
              </div>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
