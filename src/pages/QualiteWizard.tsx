import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { refApi, qualiteApi } from "@/services/api";
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
import { ChevronLeft, ChevronRight, Save, Camera, Upload, AlertTriangle, Info, Check } from "lucide-react";

const schema = z.object({
  domaineId: z.number().optional().nullable(),
  campagneId: z.number({ required_error: "Campagne requise" }),
  varieteId: z.number({ required_error: "Variété requise" }),
  porteGreffeId: z.number({ required_error: "Porte-greffe requis" }),
  dateAnalyse: z.string().min(1, "Date requise"),
  nbFruitsEchantillon: z.number().int().min(1).max(20).default(10),
  pctJus: z.number().min(0).max(100).optional().nullable(),
  poidsJusG: z.number().min(0).optional().nullable(),
  volumeJusMl: z.number().min(0).optional().nullable(),
  brixDegres: z.number({ required_error: "Brix requis" }).min(5, "Min 5").max(20, "Max 20"),
  aciditeGl: z.number({ required_error: "Acidité requise" }).min(0.1, "Min 0.1").max(5, "Max 5"),
  volumeNaohMl: z.number().min(0).optional().nullable(),
  nbPepinsEchantillonTotal: z.number().int().min(0).optional().nullable(),
  nbFruitsAvecPepins: z.number().int().min(0).optional().nullable(),
  moyenneFermetePeauKgCm2: z.number().min(0).optional().nullable(),
  moyenneFermeteFruitKgCm2: z.number().min(0).optional().nullable(),
  granulationSevere: z.enum(["Oui", "Non"]).optional().nullable(),
  granulationLegere: z.enum(["Oui", "Non"]).optional().nullable(),
  photoLegende: z.string().optional(),
  technicienNom: z.string().min(2, "Technicien requis"),
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
  const { userInfo } = useAuth();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nbFruitsEchantillon: 10,
      dateAnalyse: new Date().toISOString().split("T")[0],
      technicienNom: "",
      domaineId: userInfo.domaineId ? Number(userInfo.domaineId) : undefined,
    },
  });

  // Load existing data in edit mode
  const { data: existingData, isLoading: loadingEdit } = useQuery({
    queryKey: ["qualite-edit", editId],
    enabled: isEdit,
    queryFn: () => qualiteApi.get(Number(editId)),
  });

  useEffect(() => {
    if (existingData) {
      form.reset({
        domaineId: existingData.domaineId,
        campagneId: existingData.campagneId,
        varieteId: existingData.varieteId,
        porteGreffeId: existingData.porteGreffeId,
        dateAnalyse: existingData.dateAnalyse,
        nbFruitsEchantillon: existingData.nbFruitsEchantillon,
        pctJus: existingData.pctJus,
        poidsJusG: existingData.poidsJusG,
        volumeJusMl: existingData.volumeJusMl,
        brixDegres: existingData.brixDegres,
        aciditeGl: existingData.aciditeGl,
        volumeNaohMl: existingData.volumeNaohMl,
        nbPepinsEchantillonTotal: existingData.nbPepinsEchantillonTotal,
        nbFruitsAvecPepins: existingData.nbFruitsAvecPepins,
        moyenneFermetePeauKgCm2: existingData.moyenneFermetePeauKgCm2,
        moyenneFermeteFruitKgCm2: existingData.moyenneFermeteFruitKgCm2,
        granulationSevere: existingData.granulationSevere as any,
        granulationLegere: existingData.granulationLegere as any,
        photoLegende: existingData.photoLegende || "",
        technicienNom: existingData.technicienNom,
        observations: existingData.observations || "",
      });
      if (existingData.photoFruitsCoupesUrl) {
        setPhotoPreview(existingData.photoFruitsCoupesUrl);
      }
    }
  }, [existingData]);

  const { data: campagnes = [] } = useQuery({
    queryKey: ["campagnes"],
    queryFn: () => refApi.campagnes(),
  });
  const { data: varietes = [] } = useQuery({
    queryKey: ["varietes"],
    queryFn: () => refApi.varietes(),
  });
  const { data: porteGreffes = [] } = useQuery({
    queryKey: ["porte_greffes"],
    queryFn: () => refApi.porteGreffes(),
  });
  const { data: domaines = [] } = useQuery({
    queryKey: ["domaines"],
    queryFn: () => refApi.domaines(),
  });

  const isCentral = userInfo.role === "responsable_central";
  const w = form.watch();
  const currentDomaine = domaines.find((d: any) => d.id === (userInfo.domaineId ? Number(userInfo.domaineId) : w.domaineId));
  const ratioEA = w.brixDegres && w.aciditeGl && w.aciditeGl !== 0 ? w.brixDegres / w.aciditeGl : null;
  const moyennePepins = w.nbPepinsEchantillonTotal != null && w.nbFruitsEchantillon
    ? (w.nbPepinsEchantillonTotal / w.nbFruitsEchantillon).toFixed(2) : "-";
  const moisAnalyse = w.dateAnalyse ? new Date(w.dateAnalyse).toLocaleString("fr-FR", { month: "long" }) : "-";

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
      const domaineId = isCentral ? data.domaineId : (userInfo.domaineId ? Number(userInfo.domaineId) : null);
      if (!domaineId) throw new Error("Domaine requis");

      const payload: Record<string, any> = {
        domaineId,
        campagneId: data.campagneId,
        varieteId: data.varieteId,
        porteGreffeId: data.porteGreffeId,
        dateAnalyse: data.dateAnalyse,
        nbFruitsEchantillon: data.nbFruitsEchantillon,
        pctJus: data.pctJus || null,
        poidsJusG: data.poidsJusG || null,
        volumeJusMl: data.volumeJusMl || null,
        brixDegres: data.brixDegres,
        aciditeGl: data.aciditeGl,
        volumeNaohMl: data.volumeNaohMl || null,
        nbPepinsEchantillonTotal: data.nbPepinsEchantillonTotal || null,
        nbFruitsAvecPepins: data.nbFruitsAvecPepins || null,
        moyenneFermetePeauKgCm2: data.moyenneFermetePeauKgCm2 || null,
        moyenneFermeteFruitKgCm2: data.moyenneFermeteFruitKgCm2 || null,
        granulationSevere: data.granulationSevere || null,
        granulationLegere: data.granulationLegere || null,
        observations: data.observations || null,
        photoLegende: data.photoLegende || null,
        technicienNom: data.technicienNom,
        statutValidation: status,
      };

      if (photoFile) {
        const formData = new FormData();
        Object.entries(payload).forEach(([k, v]) => { if (v != null) formData.append(k, String(v)); });
        formData.append("photo", photoFile);
        if (isEdit) {
          return qualiteApi.updateWithPhoto(Number(editId), formData);
        } else {
          return qualiteApi.createWithPhoto(formData);
        }
      } else {
        if (isEdit) {
          return qualiteApi.update(Number(editId), payload);
        } else {
          return qualiteApi.create(payload);
        }
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
  const selectedVariete = varietes.find((v: any) => v.id === w.varieteId);

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
                  <FormField control={form.control} name="domaineId" render={({ field }) => (
                    <FormItem><FormLabel>Domaine</FormLabel>
                      <SearchableSelect
                        options={domaines.map((d: any) => ({ value: d.id.toString(), label: `${d.nom} (${d.code})` }))}
                        value={field.value?.toString()}
                        onValueChange={(v) => field.onChange(Number(v))}
                        placeholder="Sélectionner un domaine"
                        searchPlaceholder="Rechercher domaine..."
                      /><FormMessage />
                    </FormItem>
                  )} />
                ) : (
                  <div><Label>Domaine</Label><Input value={(currentDomaine as any)?.nom || "Non assigné"} disabled /></div>
                )}
                <FormField control={form.control} name="campagneId" render={({ field }) => (
                  <FormItem><FormLabel>Campagne</FormLabel>
                    <SearchableSelect
                      options={campagnes.map((c: any) => ({ value: c.id.toString(), label: c.codeCampagne }))}
                      value={field.value?.toString()}
                      onValueChange={(v) => field.onChange(Number(v))}
                      placeholder="Sélectionner campagne"
                      searchPlaceholder="Rechercher campagne..."
                    /><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="varieteId" render={({ field }) => (
                  <FormItem><FormLabel>Code Variété</FormLabel>
                    <SearchableSelect
                      options={varietes.map((v: any) => ({
                        value: v.id.toString(),
                        label: `${v.codeVariete} - ${v.nomCommercial || ""}`,
                        badge: v.typeVariete?.typeCode ? { text: v.typeVariete.typeCode, color: v.typeVariete?.couleurBadge || "#999" } : undefined,
                      }))}
                      value={field.value?.toString()}
                      onValueChange={(v) => field.onChange(Number(v))}
                      placeholder="Rechercher variété..."
                      searchPlaceholder="Code ou nom..."
                    /><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="porteGreffeId" render={({ field }) => (
                  <FormItem><FormLabel>Porte-greffe</FormLabel>
                    <div className="flex gap-2 flex-wrap">
                      {porteGreffes.map((pg: any) => (
                        <Button key={pg.id} type="button" variant={field.value === pg.id ? "default" : "outline"} size="sm" onClick={() => field.onChange(pg.id)}>{pg.codePg}</Button>
                      ))}
                    </div><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="dateAnalyse" render={({ field }) => (
                  <FormItem><FormLabel>Date analyse</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div><Label>Mois analyse</Label><Input value={moisAnalyse} disabled /></div>
                <FormField control={form.control} name="nbFruitsEchantillon" render={({ field }) => (
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
                <p className="text-sm text-muted-foreground">Mesures sur échantillon {w.nbFruitsEchantillon} fruits</p>
                <FormField control={form.control} name="pctJus" render={({ field }) => (
                  <FormItem><FormLabel>% Jus</FormLabel>
                    <div className="relative"><FormControl><Input type="number" step="0.01" placeholder="42.5" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} /></FormControl><span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span></div><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="poidsJusG" render={({ field }) => (
                  <FormItem><FormLabel>Poids Jus</FormLabel>
                    <div className="relative"><FormControl><Input type="number" step="0.01" placeholder="125.3" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} /></FormControl><span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">g</span></div><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="volumeJusMl" render={({ field }) => (
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
                <FormField control={form.control} name="brixDegres" render={({ field }) => (
                  <FormItem><FormLabel>Brix (5-20) *</FormLabel>
                    <div className="relative"><FormControl><Input type="number" step="0.01" placeholder="11.8" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} /></FormControl><span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">°</span></div><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="aciditeGl" render={({ field }) => (
                  <FormItem><FormLabel>Acidité (0.1-5) *</FormLabel>
                    <div className="relative"><FormControl><Input type="number" step="0.001" placeholder="0.95" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} /></FormControl><span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">g/L</span></div><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="volumeNaohMl" render={({ field }) => (
                  <FormItem><FormLabel>Volume NaOH (optionnel)</FormLabel>
                    <div className="relative"><FormControl><Input type="number" step="0.01" placeholder="9.5" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} /></FormControl><span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">mL</span></div><FormMessage />
                  </FormItem>
                )} />
                <Card className="border-0 bg-accent/30">
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground mb-1">Ratio E/A (auto-calculé)</p>
                    <EaBadge brix={w.brixDegres} acidite={w.aciditeGl} />
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
                  <FormField control={form.control} name="nbPepinsEchantillonTotal" render={({ field }) => (
                    <FormItem><FormLabel>Nb pépins total échantillon</FormLabel>
                      <FormControl><Input type="number" placeholder="23" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} /></FormControl><FormMessage />
                    </FormItem>
                  )} />
                  <div><Label>Moyenne pépins/fruit</Label><Input value={moyennePepins} disabled /></div>
                  <FormField control={form.control} name="nbFruitsAvecPepins" render={({ field }) => (
                    <FormItem><FormLabel>Nb fruits avec pépins (max {w.nbFruitsEchantillon})</FormLabel>
                      <FormControl><Input type="number" max={w.nbFruitsEchantillon} placeholder="7" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} /></FormControl><FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">💪 Fermeté (Pénétromètre)</h3>
                  <p className="text-xs text-muted-foreground">Mesures pénétromètre moyenne 3 points</p>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="moyenneFermetePeauKgCm2" render={({ field }) => (
                      <FormItem><FormLabel>Fermeté peau</FormLabel>
                        <div className="relative"><FormControl><Input type="number" step="0.01" placeholder="3.5" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} /></FormControl><span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">Kg/cm²</span></div><FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="moyenneFermeteFruitKgCm2" render={({ field }) => (
                      <FormItem><FormLabel>Fermeté fruit</FormLabel>
                        <div className="relative"><FormControl><Input type="number" step="0.01" placeholder="1.2" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} /></FormControl><span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">Kg/cm²</span></div><FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Granulation</h3>
                  <p className="text-xs text-muted-foreground">Défaut texture vésicules (grains de pulpe)</p>
                  <FormField control={form.control} name="granulationSevere" render={({ field }) => (
                    <FormItem><FormLabel>Granulation sévère</FormLabel>
                      <div className="flex gap-2">
                        {(["Oui", "Non"] as const).map((v) => (
                          <Button key={v} type="button" size="sm" variant={field.value === v ? "default" : "outline"} onClick={() => field.onChange(v)}>{v}</Button>
                        ))}
                      </div><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="granulationLegere" render={({ field }) => (
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
                <FormField control={form.control} name="photoLegende" render={({ field }) => (
                  <FormItem><FormLabel>Légende photo (optionnel)</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="technicienNom" render={({ field }) => (
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
                    <p>Variété : <strong>{(selectedVariete as any)?.codeVariete}</strong> - {(selectedVariete as any)?.nomCommercial}</p>
                    <p>PG : <strong>{porteGreffes.find((pg: any) => pg.id === w.porteGreffeId)?.codePg}</strong></p>
                    <p>Date : {w.dateAnalyse} • Mois : {moisAnalyse}</p>
                    <p>Échantillon : {w.nbFruitsEchantillon} fruits</p>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-muted-foreground">Jus</h3>
                    <p>% Jus : {w.pctJus ?? "-"} • Poids : {w.poidsJusG ?? "-"} g • Volume : {w.volumeJusMl ?? "-"} mL</p>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-muted-foreground">Chimique</h3>
                    <p>Brix : {w.brixDegres}° • Acidité : {w.aciditeGl} g/L • NaOH : {w.volumeNaohMl ?? "-"} mL</p>
                    <div className="mt-1"><EaBadge brix={w.brixDegres} acidite={w.aciditeGl} /></div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-muted-foreground">Pépins</h3>
                    <p>Total : {w.nbPepinsEchantillonTotal ?? "-"} • Moy/fruit : {moyennePepins} • Fruits avec : {w.nbFruitsAvecPepins ?? "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-muted-foreground">Fermeté</h3>
                    <p>Peau : {w.moyenneFermetePeauKgCm2 ?? "-"} Kg/cm² • Fruit : {w.moyenneFermeteFruitKgCm2 ?? "-"} Kg/cm²</p>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-muted-foreground">Granulation</h3>
                    <p>Sévère : {w.granulationSevere ?? "-"} • Légère : {w.granulationLegere ?? "-"}</p>
                  </div>
                  {photoPreview && (
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-muted-foreground">Photo</h3>
                      <img src={photoPreview} alt="Photo" className="rounded-lg max-h-32 object-cover" />
                      {w.photoLegende && <p className="text-xs text-muted-foreground">{w.photoLegende}</p>}
                    </div>
                  )}
                </div>

                {/* Alertes */}
                <div className="space-y-2 pt-2">
                  {ratioEA != null && ratioEA < 10 && (
                    <div className="flex items-center gap-2 text-destructive text-sm"><AlertTriangle className="h-4 w-4" /> E/A faible (&lt;10) - Maturité insuffisante</div>
                  )}
                  {w.brixDegres != null && (w.brixDegres < 8 || w.brixDegres > 16) && (
                    <div className="flex items-center gap-2 text-destructive text-sm"><AlertTriangle className="h-4 w-4" /> Brix hors norme (&lt;8 ou &gt;16)</div>
                  )}
                  {w.granulationSevere === "Oui" && (
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
              <Button type="button" onClick={() => onSubmit(isEdit ? (existingData?.statutValidation || "Brouillon") : "Brouillon")} disabled={submitMutation.isPending} className="bg-primary hover:bg-primary/90">
                <Save className="h-4 w-4 mr-1" /> {isEdit ? "Enregistrer" : "Enregistrer (Brouillon)"}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
