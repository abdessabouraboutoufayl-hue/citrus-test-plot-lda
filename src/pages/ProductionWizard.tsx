import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { db } from "@/lib/offline-db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Save, Camera, Upload, AlertTriangle } from "lucide-react";
import CalibreStep from "@/components/production/CalibreStep";
import { getCalibreType, getCalibreEntries, NB_ECHANTILLON, type CalibreType } from "@/lib/calibre-config";

const schema = z.object({
  domaine_id: z.number({ required_error: "Domaine requis" }),
  campagne_id: z.number({ required_error: "Campagne requise" }),
  variete_id: z.number({ required_error: "Variété requise" }),
  porte_greffe_id: z.number({ required_error: "Porte-greffe requis" }),
  ligne_numero: z.number().min(1).max(20, "Ligne entre 1 et 20"),
  position_ligne: z.number().min(1).max(25, "Position entre 1 et 25"),
  date_recolte: z.string().min(1, "Date requise"),
  poids_total_kg: z.number().positive("Poids requis").max(200, "Max 200 kg"),
  nb_fruits_total: z.number().int().positive("Nombre requis").max(2000, "Max 2000"),
  calibre_moyen_mm: z.number().optional(),
  taux_declassement_pct: z.number().min(0).max(100).optional(),
  qualite_globale: z.string().optional(),
  photo_legende: z.string().optional(),
  recoltant_nom: z.string().optional(),
  observations: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function ProductionWizard() {
  const { id: editId } = useParams();
  const isEdit = !!editId;
  const [step, setStep] = useState(0);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [calibreValues, setCalibreValues] = useState<Record<string, number>>({});
  const navigate = useNavigate();
  const { user, userInfo } = useAuth();
  const isOnline = useOnlineStatus();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      ligne_numero: 1,
      position_ligne: 1,
      taux_declassement_pct: 0,
      date_recolte: new Date().toISOString().split("T")[0],
    },
  });

  const { data: campagnes = [] } = useQuery({
    queryKey: ["campagnes"],
    queryFn: async () => {
      const { data } = await supabase.from("campagnes").select("*");
      return data || [];
    },
  });

  const { data: varietes = [] } = useQuery({
    queryKey: ["varietes"],
    queryFn: async () => {
      const { data } = await supabase.from("varietes").select("*, types_varietes(type_nom, type_code, couleur_badge)");
      return data || [];
    },
  });

  const { data: porteGreffes = [] } = useQuery({
    queryKey: ["porte_greffes"],
    queryFn: async () => {
      const { data } = await supabase.from("porte_greffes").select("*");
      return data || [];
    },
  });

  const { data: domaines = [] } = useQuery({
    queryKey: ["domaines"],
    queryFn: async () => {
      const { data } = await supabase.from("domaines").select("*");
      return data || [];
    },
  });

  // Load existing data for edit mode
  const { data: existingData } = useQuery({
    queryKey: ["production-edit", editId],
    queryFn: async () => {
      const { data, error } = await supabase.from("production").select("*").eq("id", Number(editId)).single();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingData) {
      form.reset({
        domaine_id: existingData.domaine_id,
        campagne_id: existingData.campagne_id,
        variete_id: existingData.variete_id,
        porte_greffe_id: existingData.porte_greffe_id,
        ligne_numero: existingData.ligne_numero,
        position_ligne: existingData.position_ligne,
        date_recolte: existingData.date_recolte,
        poids_total_kg: Number(existingData.poids_total_kg),
        nb_fruits_total: existingData.nb_fruits_total,
        calibre_moyen_mm: existingData.calibre_moyen_mm ? Number(existingData.calibre_moyen_mm) : undefined,
        taux_declassement_pct: existingData.taux_declassement_pct ? Number(existingData.taux_declassement_pct) : 0,
        qualite_globale: existingData.qualite_globale || undefined,
        photo_legende: existingData.photo_legende || undefined,
        recoltant_nom: existingData.recoltant_nom || undefined,
        observations: existingData.observations || undefined,
      });
      if (existingData.photo_url) {
        setExistingPhotoUrl(existingData.photo_url);
        setPhotoPreview(existingData.photo_url);
      }
    }
  }, [existingData, form]);

  const watchedValues = form.watch();
  const currentDomaine = domaines.find((d) => d.id === (userInfo.domaineId || watchedValues.domaine_id));
  const poidsMoyen = watchedValues.poids_total_kg && watchedValues.nb_fruits_total
    ? ((watchedValues.poids_total_kg * 1000) / watchedValues.nb_fruits_total).toFixed(1)
    : "-";

  const codeArbre = (() => {
    const d = currentDomaine?.code || "??";
    const l = String(watchedValues.ligne_numero || 0).padStart(2, "0");
    const p = String(watchedValues.position_ligne || 0).padStart(2, "0");
    return `${d}-L${l}-P${p}`;
  })();

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

      let photoUrl: string | null = null;
      if (photoFile && isOnline) {
        const ext = photoFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("production-photos").upload(path, photoFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("production-photos").getPublicUrl(path);
        photoUrl = urlData.publicUrl;
      }

      if (!isOnline) {
        await db.offlineProductions.add({
          domaine_id: domaineId!,
          campagne_id: data.campagne_id,
          variete_id: data.variete_id,
          porte_greffe_id: data.porte_greffe_id,
          ligne_numero: data.ligne_numero,
          position_ligne: data.position_ligne,
          date_recolte: data.date_recolte,
          poids_total_kg: data.poids_total_kg,
          nb_fruits_total: data.nb_fruits_total,
          calibre_moyen_mm: data.calibre_moyen_mm,
          taux_declassement_pct: data.taux_declassement_pct,
          qualite_globale: data.qualite_globale,
          recoltant_nom: data.recoltant_nom,
          observations: data.observations,
          code_arbre: codeArbre,
          photo_blob: photoFile || undefined,
          photo_legende: data.photo_legende,
          statut_validation: status,
          user_id: user.id,
          synced: false,
          created_at: new Date().toISOString(),
        });
        toast.success("Sauvegardé hors ligne");
        navigate("/production");
        return;
      }
      const finalPhotoUrl = photoUrl || existingPhotoUrl;

      if (isEdit) {
        const { error } = await supabase.from("production").update({
          domaine_id: domaineId!,
          campagne_id: data.campagne_id,
          variete_id: data.variete_id,
          porte_greffe_id: data.porte_greffe_id,
          ligne_numero: data.ligne_numero,
          position_ligne: data.position_ligne,
          date_recolte: data.date_recolte,
          poids_total_kg: data.poids_total_kg,
          nb_fruits_total: data.nb_fruits_total,
          calibre_moyen_mm: data.calibre_moyen_mm || null,
          taux_declassement_pct: data.taux_declassement_pct || null,
          qualite_globale: data.qualite_globale || null,
          photo_url: finalPhotoUrl,
          photo_legende: data.photo_legende || null,
          recoltant_nom: data.recoltant_nom || null,
          observations: data.observations || null,
          statut_validation: status,
          nb_fruits_echantillon: calibreType ? NB_ECHANTILLON : null,
          ...calibreValues,
        } as any).eq("id", Number(editId));
        if (error) throw error;
      } else {
        const { error } = await supabase.from("production").insert({
          domaine_id: domaineId!,
          campagne_id: data.campagne_id,
          variete_id: data.variete_id,
          porte_greffe_id: data.porte_greffe_id,
          ligne_numero: data.ligne_numero,
          position_ligne: data.position_ligne,
          date_recolte: data.date_recolte,
          poids_total_kg: data.poids_total_kg,
          nb_fruits_total: data.nb_fruits_total,
          calibre_moyen_mm: data.calibre_moyen_mm || null,
          taux_declassement_pct: data.taux_declassement_pct || null,
          qualite_globale: data.qualite_globale || null,
          photo_url: finalPhotoUrl,
          photo_legende: data.photo_legende || null,
          recoltant_nom: data.recoltant_nom || null,
          observations: data.observations || null,
          statut_validation: status,
          user_id: user.id,
          nb_fruits_echantillon: calibreType ? NB_ECHANTILLON : null,
          ...calibreValues,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Production enregistrée");
      navigate("/production");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const onSubmit = (status: string) => {
    form.handleSubmit((data) => submitMutation.mutate({ data, status }))();
  };

  const steps = ["Localisation", "Production", "Calibre", "Photo", "Récapitulatif"];

  const calibreType: CalibreType = selectedVariete ? getCalibreType(selectedVariete.code_variete) : null;
  const calibreEntries = getCalibreEntries(calibreType);
  const calibreTotal = calibreEntries.reduce((s, e) => s + (calibreValues[e.dbColumn] || 0), 0);
  const calibreValid = calibreType ? calibreTotal === NB_ECHANTILLON : true;

  const handleCalibreChange = (dbColumn: string, value: number) => {
    setCalibreValues(prev => ({ ...prev, [dbColumn]: value }));
  };

  const selectedVariete = varietes.find((v) => v.id === watchedValues.variete_id);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{isEdit ? "Modifier la production" : "Nouvelle production"}</h1>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {i + 1}
            </div>
            <span className="hidden sm:inline text-xs text-muted-foreground">{s}</span>
            {i < steps.length - 1 && <div className="w-8 h-0.5 bg-border" />}
          </div>
        ))}
      </div>

      <Form {...form}>
        <form className="space-y-4">
          {step === 0 && (
            <Card>
              <CardHeader><CardTitle>Localisation</CardTitle></CardHeader>
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
                  <FormItem>
                    <FormLabel>Campagne</FormLabel>
                    <SearchableSelect
                      options={campagnes.map((c) => ({ value: c.id.toString(), label: c.code_campagne }))}
                      value={field.value?.toString()}
                      onValueChange={(v) => field.onChange(Number(v))}
                      placeholder="Sélectionner campagne"
                      searchPlaceholder="Rechercher campagne..."
                    />
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="variete_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variété</FormLabel>
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
                    />
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="porte_greffe_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Porte-greffe</FormLabel>
                    <div className="flex gap-2 flex-wrap">
                      {porteGreffes.map((pg) => (
                        <Button key={pg.id} type="button" variant={field.value === pg.id ? "default" : "outline"} size="sm" onClick={() => field.onChange(pg.id)}>
                          {pg.code_pg}
                        </Button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="ligne_numero" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ligne (1-20)</FormLabel>
                      <FormControl><Input type="number" min={1} max={20} {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="position_ligne" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Position (1-25)</FormLabel>
                      <FormControl><Input type="number" min={1} max={25} {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div>
                  <Label>Code arbre</Label>
                  <Input value={codeArbre} disabled className="font-mono" />
                </div>
                <FormField control={form.control} name="date_recolte" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de récolte</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <Card>
              <CardHeader><CardTitle>Données de production</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="poids_total_kg" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Poids total (kg)</FormLabel>
                    <FormControl><Input type="number" step="0.001" placeholder="0.000" {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="nb_fruits_total" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de fruits</FormLabel>
                    <FormControl><Input type="number" placeholder="0" {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Card className="bg-accent/30 border-0">
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Poids moyen par fruit</p>
                    <p className="text-2xl font-bold text-primary">{poidsMoyen} g</p>
                  </CardContent>
                </Card>
                <FormField control={form.control} name="calibre_moyen_mm" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Calibre moyen (mm) - optionnel</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="taux_declassement_pct" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Taux de déclassement: {field.value || 0}%</FormLabel>
                    <FormControl>
                      <Slider min={0} max={100} step={1} value={[field.value || 0]} onValueChange={([v]) => field.onChange(v)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="qualite_globale" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Qualité globale</FormLabel>
                    <div className="flex gap-2 flex-wrap">
                      {["A", "B", "C", "Hors norme"].map((q) => (
                        <Button key={q} type="button" size="sm"
                          variant={field.value === q ? "default" : "outline"}
                          className={field.value === q ? (q === "A" ? "bg-success" : q === "B" ? "bg-info" : q === "C" ? "bg-warning" : "bg-destructive") : ""}
                          onClick={() => field.onChange(q)}
                        >
                          {q}
                        </Button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <CalibreStep
              type={calibreType}
              values={calibreValues}
              onChange={handleCalibreChange}
              codeVariete={selectedVariete?.code_variete}
              codePG={porteGreffes.find(p => p.id === watchedValues.porte_greffe_id)?.code_pg}
            />
          )}

          {step === 3 && (
            <Card>
              <CardHeader><CardTitle>Photo & Observations</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Photo</Label>
                  <div className="flex gap-2 mt-2">
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
                  <FormItem><FormLabel>Légende (optionnel)</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="recoltant_nom" render={({ field }) => (
                  <FormItem><FormLabel>Récoltant</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="observations" render={({ field }) => (
                  <FormItem><FormLabel>Observations (optionnel)</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
                )} />
              </CardContent>
            </Card>
          )}

          {step === 4 && (
            <Card>
              <CardHeader><CardTitle>Récapitulatif</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Domaine:</span> {currentDomaine?.nom}</div>
                  <div><span className="text-muted-foreground">Code arbre:</span> <span className="font-mono">{codeArbre}</span></div>
                  <div><span className="text-muted-foreground">Variété:</span> {selectedVariete?.code_variete} - {selectedVariete?.nom_commercial}</div>
                  <div><span className="text-muted-foreground">Date:</span> {watchedValues.date_recolte}</div>
                  <div><span className="text-muted-foreground">Poids:</span> {watchedValues.poids_total_kg} kg</div>
                  <div><span className="text-muted-foreground">Fruits:</span> {watchedValues.nb_fruits_total}</div>
                  <div><span className="text-muted-foreground">Poids moyen:</span> {poidsMoyen} g</div>
                  <div><span className="text-muted-foreground">Qualité:</span> {watchedValues.qualite_globale || "-"}</div>
                </div>
                {(watchedValues.taux_declassement_pct || 0) > 20 && (
                  <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg text-warning">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Taux de déclassement élevé ({watchedValues.taux_declassement_pct}%)</span>
                  </div>
                )}
                {photoPreview && <img src={photoPreview} alt="Preview" className="rounded-lg max-h-32 object-cover" />}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Retour
            </Button>
            {step < 4 ? (
              <Button type="button" onClick={() => setStep((s) => s + 1)}
                disabled={step === 2 && calibreType !== null && !calibreValid}>
                Suivant <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button type="button" onClick={() => onSubmit(isEdit ? (existingData?.statut_validation || "Brouillon") : "Brouillon")} disabled={submitMutation.isPending} className="bg-primary hover:bg-primary/90">
                <Save className="h-4 w-4 mr-1" /> {isEdit ? "Enregistrer" : "Enregistrer (Brouillon)"}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
