import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { refApi, productionApi } from "@/services/api";
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
import { Save, Camera, Upload, AlertTriangle, ArrowLeft, X } from "lucide-react";
import CalibreStep from "@/components/production/CalibreStep";
import { getCalibreType, getCalibreEntries, NB_ECHANTILLON, calibreFromRecord, type CalibreType } from "@/lib/calibre-config";
import imageCompression from "browser-image-compression";
import { v4 as uuidv4 } from "uuid";

const schema = z.object({
  domaine_id: z.string().uuid("Domaine requis"),
  campagne_id: z.string().uuid("Campagne requise"),
  variete_id: z.string().uuid("Variété requise"),
  porte_greffe_id: z.string().uuid("Porte-greffe requis"),
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [calibreValues, setCalibreValues] = useState<Record<string, number>>({});
  const navigate = useNavigate();
  const { user, userInfo } = useAuth();
  const isOnline = useOnlineStatus();
  const isCentral = userInfo.role === "responsable_central";

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

  const { data: existingData } = useQuery({
    queryKey: ["production-edit", editId],
    queryFn: () => productionApi.get(editId!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingData) {
      form.reset({
        domaine_id: existingData.domaineId,
        campagne_id: existingData.campagneId,
        variete_id: existingData.varieteId,
        porte_greffe_id: existingData.porteGreffeId,
        ligne_numero: existingData.ligneNumero,
        position_ligne: existingData.positionLigne,
        date_recolte: existingData.dateRecolte,
        poids_total_kg: Number(existingData.poidsTotalKg),
        nb_fruits_total: existingData.nbFruitsTotal,
        calibre_moyen_mm: existingData.calibreMoyenMm ? Number(existingData.calibreMoyenMm) : undefined,
        taux_declassement_pct: existingData.tauxDeclassementPct ? Number(existingData.tauxDeclassementPct) : 0,
        qualite_globale: existingData.qualiteGlobale || undefined,
        photo_legende: existingData.photoLegende || undefined,
        recoltant_nom: existingData.recoltantNom || undefined,
        observations: existingData.observations || undefined,
      });
      if (existingData.photoUrl) {
        setExistingPhotoUrl(existingData.photoUrl);
        setPhotoPreview(existingData.photoUrl);
      }
      const varCode = varietes.find((v: any) => v.id === existingData.varieteId)?.codeVariete;
      if (varCode) {
        const calType = getCalibreType(varCode);
        setCalibreValues(calibreFromRecord(existingData, calType));
      }
    }
  }, [existingData, form, varietes]);

  const watchedValues = form.watch();
  const currentDomaine = domaines.find(
    (d: any) => d.id === (userInfo.domaineId || watchedValues.domaine_id)
  );
  const poidsMoyen =
    watchedValues.poids_total_kg && watchedValues.nb_fruits_total
      ? ((watchedValues.poids_total_kg * 1000) / watchedValues.nb_fruits_total).toFixed(1)
      : "-";

  const codeArbre = (() => {
    const d = (currentDomaine as any)?.code || "??";
    const l = String(watchedValues.ligne_numero || 0).padStart(2, "0");
    const p = String(watchedValues.position_ligne || 0).padStart(2, "0");
    return `${d}-L${l}-P${p}`;
  })();

  const selectedVariete = varietes.find((v: any) => v.id === watchedValues.variete_id);
  const calibreType: CalibreType = selectedVariete
    ? getCalibreType(selectedVariete.codeVariete)
    : null;
  const calibreEntries = getCalibreEntries(calibreType);
  const calibreTotal = calibreEntries.reduce(
    (s, e) => s + (calibreValues[e.dbColumn] || 0),
    0
  );
  const calibreValid =
    calibreType ? calibreTotal === NB_ECHANTILLON || calibreTotal === 0 : true;

  const handleCalibreChange = (dbColumn: string, value: number) => {
    setCalibreValues((prev) => ({ ...prev, [dbColumn]: value }));
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1280 });
      setPhotoFile(compressed as File);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(compressed);
    } catch {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setExistingPhotoUrl(null);
  };

  const submitMutation = useMutation({
    mutationFn: async ({ data, status }: { data: FormData; status: string }) => {
      if (!user) throw new Error("Non authentifié");
      const domaineId = isCentral ? data.domaine_id : userInfo.domaineId;
      if (!domaineId) throw new Error("Domaine requis");

      // Offline mode — store in Dexie
      if (!isOnline) {
        await db.offlineProductions.add({
          domaine_id: domaineId,
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

      // Online mode — send to API
      const payload = {
        domaineId,
        campagneId: data.campagne_id,
        varieteId: data.variete_id,
        porteGreffeId: data.porte_greffe_id,
        ligneNumero: data.ligne_numero,
        positionLigne: data.position_ligne,
        dateRecolte: new Date(data.date_recolte).toISOString(),
        poidsTotalKg: data.poids_total_kg,
        nbFruitsTotal: data.nb_fruits_total,
        calibreMoyenMm: data.calibre_moyen_mm ?? null,
        tauxDeclassementPct: data.taux_declassement_pct ?? null,
        qualiteGlobale: data.qualite_globale ?? null,
        photoLegende: data.photo_legende ?? null,
        recoltantNom: data.recoltant_nom ?? null,
        observations: data.observations ?? null,
        statutValidation: status,
        nbFruitsEchantillon: calibreType ? NB_ECHANTILLON : null,
        ...calibreValues,
      };

      if (photoFile) {
        const fd = new FormData();
        fd.append("photo", photoFile);
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== null && v !== undefined) fd.append(k, String(v));
        });
        if (isEdit) {
          await productionApi.updateWithPhoto(editId!, fd);
        } else {
          await productionApi.create(fd);
        }
      } else {
        const finalPayload = { ...payload, photoUrl: existingPhotoUrl ?? undefined };
        if (isEdit) {
          await productionApi.update(editId!, finalPayload);
        } else {
          await productionApi.createJson(finalPayload);
        }
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Production modifiée" : "Production enregistrée");
      navigate("/production");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const onSubmit = (status: string) => {
    form.handleSubmit((data) => submitMutation.mutate({ data, status }))();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/production")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {isEdit ? "Modifier la saisie" : "Nouvelle saisie"}
          </h1>
          {isEdit && existingData?.statutValidation && (
            <Badge
              variant={existingData.statutValidation === "Rejeté" ? "destructive" : "secondary"}
              className="mt-1"
            >
              {existingData.statutValidation}
            </Badge>
          )}
        </div>
      </div>

      {/* Rejected comment */}
      {isEdit &&
        existingData?.statutValidation === "Rejeté" &&
        existingData?.commentairesValidation && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-4 flex gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive text-sm">Motif du rejet</p>
                <p className="text-sm text-muted-foreground">
                  {existingData.commentairesValidation}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

      <Form {...form}>
        <form className="space-y-6">
          {/* ─── Localisation ─── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📍 Localisation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isCentral ? (
                <FormField
                  control={form.control}
                  name="domaine_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Domaine</FormLabel>
                      <SearchableSelect
                        options={domaines.map((d: any) => ({
                          value: d.id,
                          label: `${d.nom} (${d.code})`,
                        }))}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Sélectionner un domaine"
                        searchPlaceholder="Rechercher domaine..."
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <div>
                  <Label>Domaine</Label>
                  <Input
                    value={
                      currentDomaine
                        ? `${(currentDomaine as any).nom} (${(currentDomaine as any).code})`
                        : "Non assigné"
                    }
                    disabled
                  />
                </div>
              )}

              <FormField
                control={form.control}
                name="campagne_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Campagne</FormLabel>
                    <SearchableSelect
                      options={campagnes.map((c: any) => ({
                        value: c.id,
                        label: c.codeCampagne,
                      }))}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Sélectionner campagne"
                      searchPlaceholder="Rechercher campagne..."
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="variete_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variété</FormLabel>
                    <SearchableSelect
                      options={varietes.map((v: any) => ({
                        value: v.id,
                        label: `${v.codeVariete} - ${v.nomCommercial || ""}`,
                        badge: v.typeVariete?.typeCode
                          ? {
                              text: v.typeVariete.typeCode,
                              color: v.typeVariete.couleurBadge || "#999",
                            }
                          : undefined,
                      }))}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Rechercher variété..."
                      searchPlaceholder="Code ou nom..."
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="porte_greffe_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Porte-greffe</FormLabel>
                    <div className="flex gap-2 flex-wrap">
                      {porteGreffes.map((pg: any) => (
                        <Button
                          key={pg.id}
                          type="button"
                          variant={field.value === pg.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => field.onChange(pg.id)}
                        >
                          {pg.codePg}
                        </Button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="ligne_numero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ligne (1-20)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="position_ligne"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Position (1-25)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={25}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <Label>Code arbre</Label>
                <Input value={codeArbre} disabled className="font-mono" />
              </div>

              <FormField
                control={form.control}
                name="date_recolte"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de récolte</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ─── Production ─── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🍊 Données de production</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="poids_total_kg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Poids total (kg)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.001"
                          placeholder="0.000"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nb_fruits_total"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de fruits</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Card className="bg-accent/30 border-0">
                <CardContent className="pt-4 pb-3">
                  <p className="text-sm text-muted-foreground">Poids moyen par fruit</p>
                  <p className="text-2xl font-bold text-primary">{poidsMoyen} g</p>
                </CardContent>
              </Card>

              <FormField
                control={form.control}
                name="calibre_moyen_mm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Calibre moyen (mm) — optionnel</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value ? Number(e.target.value) : undefined)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="taux_declassement_pct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Taux de déclassement : {field.value || 0}%</FormLabel>
                    <FormControl>
                      <Slider
                        min={0}
                        max={100}
                        step={1}
                        value={[field.value || 0]}
                        onValueChange={([v]) => field.onChange(v)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="qualite_globale"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Qualité globale</FormLabel>
                    <div className="flex gap-2 flex-wrap">
                      {["A", "B", "C", "Hors norme"].map((q) => (
                        <Button
                          key={q}
                          type="button"
                          size="sm"
                          variant={field.value === q ? "default" : "outline"}
                          className={
                            field.value === q
                              ? q === "A"
                                ? "bg-green-600 hover:bg-green-700"
                                : q === "B"
                                ? "bg-blue-600 hover:bg-blue-700"
                                : q === "C"
                                ? "bg-yellow-600 hover:bg-yellow-700"
                                : "bg-destructive hover:bg-destructive/90"
                              : ""
                          }
                          onClick={() => field.onChange(q)}
                        >
                          {q}
                        </Button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ─── Calibre ─── */}
          {calibreType && (
            <CalibreStep
              type={calibreType}
              values={calibreValues}
              onChange={handleCalibreChange}
              codeVariete={selectedVariete?.codeVariete}
              codePG={
                porteGreffes.find((p: any) => p.id === watchedValues.porte_greffe_id)?.codePg
              }
            />
          )}

          {/* ─── Photo & Observations ─── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📷 Photo & Observations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Photo</Label>
                <div className="flex gap-2 mt-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handlePhoto}
                    />
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span>
                        <Camera className="h-4 w-4 mr-1" />
                        Prendre
                      </span>
                    </Button>
                  </label>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-1" />
                        Choisir
                      </span>
                    </Button>
                  </label>
                </div>
                {photoPreview && (
                  <div className="relative mt-3 inline-block">
                    <img src={photoPreview} alt="Preview" className="rounded-lg max-h-48 object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={removePhoto}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              <FormField
                control={form.control}
                name="photo_legende"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Légende (optionnel)</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="recoltant_nom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Récoltant</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="observations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observations (optionnel)</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ─── Actions ─── */}
          <div className="flex flex-col sm:flex-row justify-between gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate("/production")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Retour à la liste
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onSubmit("Brouillon")}
                disabled={submitMutation.isPending}
              >
                Brouillon
              </Button>
              <Button
                type="button"
                onClick={() => onSubmit("Soumis")}
                disabled={
                  submitMutation.isPending ||
                  (calibreType !== null && calibreTotal > 0 && !calibreValid)
                }
                className="bg-primary hover:bg-primary/90"
              >
                <Save className="h-4 w-4 mr-1" />
                {isEdit ? "Soumettre la correction" : "Enregistrer"}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
