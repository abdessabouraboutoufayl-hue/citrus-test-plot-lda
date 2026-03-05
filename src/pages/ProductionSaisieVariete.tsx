import { useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { getCalibreType, getCalibreEntries, NB_ECHANTILLON, type CalibreType } from "@/lib/calibre-config";
import CalibreStep from "@/components/production/CalibreStep";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Save, Plus, Minus, Copy, TreePine, FileSpreadsheet, Camera, X } from "lucide-react";
import imageCompression from "browser-image-compression";
import ImportTemplateConfig from "@/components/production/ImportTemplateConfig";
import ImportUploadPreview from "@/components/production/ImportUploadPreview";

interface RowData {
  id: number;
  ligne: number;
  position: number;
  poids: number | null;
  fruits: number | null;
  calibre: number | null;
  qualite: string;
  statut: "Normal" | "Chétif" | "Manquant";
  photo: File | null;
  photoPreview: string | null;
}

const emptyRow = (id: number, pos: number): RowData => ({
  id,
  ligne: 1,
  position: pos,
  poids: null,
  fruits: null,
  calibre: null,
  qualite: "A",
  statut: "Normal",
  photo: null,
  photoPreview: null,
});

export default function ProductionSaisieVariete() {
  const navigate = useNavigate();
  const { user, userInfo } = useAuth();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"manual" | "import">("manual");
  const [varieteId, setVarieteId] = useState<number | null>(null);
  const [selectedPG, setSelectedPG] = useState<number | null>(null);
  const [domaineId, setDomaineId] = useState<number | null>(null);
  const [campagneId, setCampagneId] = useState<number | null>(null);
  const [dateRecolte, setDateRecolte] = useState(new Date().toISOString().split("T")[0]);
  const [nbArbres, setNbArbres] = useState(5);
  const [rows, setRows] = useState<RowData[]>(
    Array.from({ length: 5 }, (_, i) => emptyRow(i, i + 1))
  );
  const [calibreValues, setCalibreValues] = useState<Record<string, number>>({});

  const isCentral = userInfo.role === "responsable_central";
  const effectiveDomaineId = isCentral ? domaineId : userInfo.domaineId;

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

  const currentDomaine = domaines.find(d => d.id === effectiveDomaineId);
  const currentPG = porteGreffes.find(p => p.id === selectedPG);

  const updateRow = useCallback((id: number, field: keyof RowData, value: any) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      if (field === "statut" && value !== "Normal") {
        updated.poids = null;
        updated.fruits = null;
        updated.calibre = null;
      }
      return updated;
    }));
  }, []);

  const addRow = useCallback(() => {
    setRows(prev => {
      const newId = Math.max(...prev.map(r => r.id), 0) + 1;
      return [...prev, emptyRow(newId, prev.length + 1)];
    });
    setNbArbres(prev => prev + 1);
  }, []);

  const removeRow = useCallback(() => {
    if (rows.length <= 1) return;
    setRows(prev => prev.slice(0, -1));
    setNbArbres(prev => Math.max(1, prev - 1));
  }, [rows.length]);

  const duplicateRow = useCallback((id: number) => {
    setRows(prev => {
      const source = prev.find(r => r.id === id);
      if (!source) return prev;
      const idx = prev.findIndex(r => r.id === id);
      const maxId = Math.max(...prev.map(r => r.id), 0) + 1;
      const newRow = { ...source, id: maxId, position: source.position + 1, photo: null, photoPreview: null };
      const result = [...prev];
      result.splice(idx + 1, 0, newRow);
      return result;
    });
    setNbArbres(prev => prev + 1);
  }, []);

  const handleRowPhoto = useCallback(async (rowId: number, file: File | null) => {
    if (!file) {
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, photo: null, photoPreview: null } : r));
      return;
    }
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.3, maxWidthOrHeight: 1920 });
      const reader = new FileReader();
      reader.onloadend = () => {
        setRows(prev => prev.map(r => r.id === rowId ? { ...r, photo: compressed, photoPreview: reader.result as string } : r));
      };
      reader.readAsDataURL(compressed);
    } catch {
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, photo: file, photoPreview: URL.createObjectURL(file) } : r));
    }
  }, []);

  const handleNbArbresChange = useCallback((val: number) => {
    const clamped = Math.max(1, Math.min(20, val));
    setNbArbres(clamped);
    setRows(prev => {
      if (clamped > prev.length) {
        const extras = Array.from({ length: clamped - prev.length }, (_, i) => {
          const newId = Math.max(...prev.map(r => r.id), 0) + 1 + i;
          return emptyRow(newId, prev.length + i + 1);
        });
        return [...prev, ...extras];
      }
      return prev.slice(0, clamped);
    });
  }, []);

  const stats = useMemo(() => {
    const normalRows = rows.filter(r => r.statut === "Normal");
    const filledRows = normalRows.filter(r => r.poids !== null && r.poids > 0);
    const chetifCount = rows.filter(r => r.statut === "Chétif").length;
    const manquantCount = rows.filter(r => r.statut === "Manquant").length;
    const totalPoids = filledRows.reduce((s, r) => s + (r.poids || 0), 0);
    const totalFruits = filledRows.reduce((s, r) => s + (r.fruits || 0), 0);
    const moyPoids = filledRows.length > 0 ? totalPoids / filledRows.length : 0;
    return {
      totalPoids: Math.round(totalPoids * 100) / 100,
      totalFruits,
      moyPoids: Math.round(moyPoids * 100) / 100,
      nbProductifs: filledRows.length,
      chetifCount,
      manquantCount,
      total: rows.length,
    };
  }, [rows]);

  const selectedVariete = varietes.find(v => v.id === varieteId);
  const calibreType: CalibreType = selectedVariete ? getCalibreType(selectedVariete.code_variete) : null;
  const calibreEntries = getCalibreEntries(calibreType);
  const calibreTotal = calibreEntries.reduce((s, e) => s + (calibreValues[e.dbColumn] || 0), 0);
  const calibreValid = calibreType ? calibreTotal === NB_ECHANTILLON : true;
  const hasNonNormalOnly = rows.every(r => r.statut !== "Normal");
  const skipCalibre = hasNonNormalOnly;

  const handleCalibreChange = useCallback((dbColumn: string, value: number) => {
    setCalibreValues(prev => ({ ...prev, [dbColumn]: value }));
  }, []);

  const tableRef = useRef<HTMLDivElement>(null);
  const handleCellKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
    const arrowKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    if (!arrowKeys.includes(e.key)) return;
    e.preventDefault();
    let nextRow = rowIdx, nextCol = colIdx;
    if (e.key === "ArrowDown") nextRow++;
    else if (e.key === "ArrowUp") nextRow--;
    else if (e.key === "ArrowRight") nextCol++;
    else if (e.key === "ArrowLeft") nextCol--;
    const next = tableRef.current?.querySelector<HTMLInputElement>(`[data-row="${nextRow}"][data-col="${nextCol}"]`);
    if (next) { next.focus(); next.select(); }
  }, []);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    rows.forEach((r, i) => {
      if (r.statut === "Normal") {
        if (r.ligne < 1 || r.ligne > 20) errors.push(`Ligne ${i + 1}: numéro de ligne doit être 1-20`);
        if (r.position < 1 || r.position > 25) errors.push(`Ligne ${i + 1}: position doit être 1-25`);
        if (r.poids !== null && r.poids <= 0) errors.push(`Ligne ${i + 1}: poids doit être > 0`);
      }
    });
    return errors;
  }, [rows]);

  const canSave = varieteId && selectedPG && effectiveDomaineId && campagneId && dateRecolte
    && rows.some(r => r.statut === "Normal" && r.poids && r.poids > 0 && r.fruits && r.fruits > 0)
    && validationErrors.length === 0
    && (skipCalibre || calibreValid);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !effectiveDomaineId || !campagneId || !varieteId || !selectedPG) throw new Error("Données incomplètes");

      // Upload photos first
      const photoUrls: Record<number, string> = {};
      for (const r of rows) {
        if (r.photo) {
          const ext = r.photo.name?.split(".").pop() || "jpg";
          const path = `${user.id}/${Date.now()}_${r.id}.${ext}`;
          const { error: uploadErr } = await supabase.storage.from("production-photos").upload(path, r.photo);
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from("production-photos").getPublicUrl(path);
            photoUrls[r.id] = urlData.publicUrl;
          }
        }
      }

      const allInserts = rows.map(r => ({
        domaine_id: effectiveDomaineId,
        campagne_id: campagneId,
        variete_id: varieteId,
        porte_greffe_id: selectedPG,
        ligne_numero: r.ligne,
        position_ligne: r.position,
        date_recolte: dateRecolte,
        poids_total_kg: r.statut === "Normal" ? (r.poids || 0) : 0,
        nb_fruits_total: r.statut === "Normal" ? (r.fruits || 0) : 0,
        calibre_moyen_mm: r.statut === "Normal" ? (r.calibre || null) : null,
        qualite_globale: r.statut === "Normal" ? (r.qualite || null) : null,
        statut_validation: "Brouillon",
        user_id: user.id,
        arbre_statut: r.statut,
        arbre_inclus_calculs: r.statut === "Normal",
        photo_url: photoUrls[r.id] || null,
      }));
      if (allInserts.length === 0) throw new Error("Aucune donnée");
      const { error } = await supabase.from("production").insert(allInserts);
      if (error) throw error;
    },
    onSuccess: () => {
      const excluded = rows.filter(r => r.statut !== "Normal").length;
      queryClient.invalidateQueries({ queryKey: ["productions"] });
      toast.success(`${stats.nbProductifs} arbres enregistrés${excluded > 0 ? ` (${excluded} exclus)` : ""}`);
      navigate("/production");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TreePine className="h-6 w-6 text-primary" />
            Saisie Production
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Saisie manuelle ou import Excel avec photos
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/production")}>Retour</Button>
      </div>

      {/* Mode Toggle */}
      <Card>
        <CardContent className="pt-6">
          <RadioGroup
            value={mode}
            onValueChange={v => setMode(v as "manual" | "import")}
            className="flex gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="manual" id="mode-manual" />
              <Label htmlFor="mode-manual" className="cursor-pointer flex items-center gap-1.5">
                <TreePine className="h-4 w-4" /> Saisie manuelle
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="import" id="mode-import" />
              <Label htmlFor="mode-import" className="cursor-pointer flex items-center gap-1.5">
                <FileSpreadsheet className="h-4 w-4" /> Import Excel
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {mode === "import" ? (
        /* ============ IMPORT MODE ============ */
        <div className="space-y-4">
          <ImportTemplateConfig
            varietes={varietes}
            porteGreffes={porteGreffes}
            domaines={domaines}
            campagnes={campagnes}
            isCentral={isCentral}
            effectiveDomaineId={effectiveDomaineId}
            domaineId={domaineId}
            setDomaineId={setDomaineId}
            campagneId={campagneId}
            setCampagneId={setCampagneId}
            dateRecolte={dateRecolte}
            setDateRecolte={setDateRecolte}
          />
          <ImportUploadPreview
            varietes={varietes}
            porteGreffes={porteGreffes}
            effectiveDomaineId={effectiveDomaineId}
            campagneId={campagneId}
            dateRecolte={dateRecolte}
            campagnes={campagnes}
          />
        </div>
      ) : (
        /* ============ MANUAL MODE ============ */
        <>
          {/* Paramètres */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Paramètres de saisie</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isCentral ? (
                  <div className="space-y-1.5">
                    <Label>Domaine</Label>
                    <SearchableSelect
                      options={domaines.map(d => ({ value: d.id.toString(), label: `${d.nom} (${d.code})` }))}
                      value={domaineId?.toString()}
                      onValueChange={v => setDomaineId(Number(v))}
                      placeholder="Sélectionner domaine"
                      searchPlaceholder="Rechercher..."
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>Domaine</Label>
                    <Input value={currentDomaine?.nom || "Non assigné"} disabled />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Campagne</Label>
                  <SearchableSelect
                    options={campagnes.map(c => ({ value: c.id.toString(), label: c.code_campagne }))}
                    value={campagneId?.toString()}
                    onValueChange={v => setCampagneId(Number(v))}
                    placeholder="Sélectionner campagne"
                    searchPlaceholder="Rechercher..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Variété</Label>
                  <SearchableSelect
                    options={varietes.map(v => ({
                      value: v.id.toString(),
                      label: `${v.code_variete} - ${v.nom_commercial || ""}`,
                      badge: (v.types_varietes as any)?.type_code
                        ? { text: (v.types_varietes as any).type_code, color: (v.types_varietes as any)?.couleur_badge || "#999" }
                        : undefined,
                    }))}
                    value={varieteId?.toString()}
                    onValueChange={v => setVarieteId(Number(v))}
                    placeholder="Rechercher variété..."
                    searchPlaceholder="Code ou nom..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Porte-greffe</Label>
                  <Select value={selectedPG?.toString() || ""} onValueChange={v => setSelectedPG(Number(v))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un PG" /></SelectTrigger>
                    <SelectContent>
                      {porteGreffes.map(pg => (
                        <SelectItem key={pg.id} value={pg.id.toString()}>{pg.code_pg} - {pg.nom_pg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Date de récolte</Label>
                  <Input type="date" value={dateRecolte} onChange={e => setDateRecolte(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nombre d'arbres</Label>
                  <Input type="number" min={1} max={20} value={nbArbres} onChange={e => handleNbArbresChange(Number(e.target.value))} />
                </div>
              </div>
              {selectedVariete && selectedPG && (
                <div className="mt-4 flex gap-2 flex-wrap">
                  <Badge variant="secondary">{selectedVariete.code_variete}</Badge>
                  {selectedVariete.nom_commercial && <Badge variant="outline">{selectedVariete.nom_commercial}</Badge>}
                  <Badge variant="outline">PG: {currentPG?.code_pg}</Badge>
                  {currentDomaine && <Badge variant="outline">{currentDomaine.nom}</Badge>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tableau éditable */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Données par arbre</CardTitle>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus className="h-4 w-4 mr-1" />Ligne</Button>
                  <Button type="button" variant="outline" size="sm" onClick={removeRow} disabled={rows.length <= 1}><Minus className="h-4 w-4 mr-1" />Ligne</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto" ref={tableRef}>
              <Table>
                <TableHeader>
                   <TableRow>
                     <TableHead className="w-10">☑</TableHead>
                     <TableHead className="w-20">Ligne</TableHead>
                     <TableHead className="w-20">Position</TableHead>
                     <TableHead>Poids (kg)</TableHead>
                     <TableHead>Fruits</TableHead>
                     <TableHead>Calibre (mm)</TableHead>
                     <TableHead className="w-20">Qualité</TableHead>
                     <TableHead className="w-28">Statut</TableHead>
                     <TableHead className="w-16">Photo</TableHead>
                     <TableHead className="w-10"></TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, rowIdx) => {
                    const isNormal = row.statut === "Normal";
                    return (
                      <TableRow key={row.id} className={!isNormal ? "opacity-50 bg-muted/30" : ""}>
                        <TableCell><Checkbox checked={isNormal} disabled /></TableCell>
                        <TableCell>
                          <Input type="number" min={1} max={20} value={row.ligne}
                            onChange={e => updateRow(row.id, "ligne", Number(e.target.value))} className="h-8 w-16"
                            data-row={rowIdx} data-col={0} onKeyDown={e => handleCellKeyDown(e as any, rowIdx, 0)} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min={1} max={25} value={row.position}
                            onChange={e => updateRow(row.id, "position", Number(e.target.value))} className="h-8 w-16"
                            data-row={rowIdx} data-col={1} onKeyDown={e => handleCellKeyDown(e as any, rowIdx, 1)} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="0.01" placeholder="-" value={row.poids ?? ""}
                            onChange={e => updateRow(row.id, "poids", e.target.value ? Number(e.target.value) : null)}
                            className="h-8 w-24" disabled={!isNormal}
                            data-row={rowIdx} data-col={2} onKeyDown={e => handleCellKeyDown(e as any, rowIdx, 2)} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" placeholder="-" value={row.fruits ?? ""}
                            onChange={e => updateRow(row.id, "fruits", e.target.value ? Number(e.target.value) : null)}
                            className="h-8 w-20" disabled={!isNormal}
                            data-row={rowIdx} data-col={3} onKeyDown={e => handleCellKeyDown(e as any, rowIdx, 3)} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="0.1" placeholder="-" value={row.calibre ?? ""}
                            onChange={e => updateRow(row.id, "calibre", e.target.value ? Number(e.target.value) : null)}
                            className="h-8 w-20" disabled={!isNormal}
                            data-row={rowIdx} data-col={4} onKeyDown={e => handleCellKeyDown(e as any, rowIdx, 4)} />
                        </TableCell>
                        <TableCell>
                          <Select value={row.qualite} onValueChange={v => updateRow(row.id, "qualite", v)} disabled={!isNormal}>
                            <SelectTrigger className="h-8 w-16"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="A">A</SelectItem>
                              <SelectItem value="B">B</SelectItem>
                              <SelectItem value="C">C</SelectItem>
                              <SelectItem value="Hors norme">HN</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={row.statut} onValueChange={v => updateRow(row.id, "statut", v as RowData["statut"])}>
                            <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Normal">Normal</SelectItem>
                              <SelectItem value="Chétif">Chétif</SelectItem>
                              <SelectItem value="Manquant">Manquant</SelectItem>
                            </SelectContent>
                          </Select>
                         </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {row.photoPreview ? (
                              <div className="relative">
                                <img src={row.photoPreview} alt="" className="h-8 w-8 rounded object-cover" />
                                <button type="button" onClick={() => handleRowPhoto(row.id, null)}
                                  className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            ) : (
                              <label className="cursor-pointer">
                                <input type="file" accept="image/*" className="hidden"
                                  onChange={e => { const f = e.target.files?.[0]; if (f) handleRowPhoto(row.id, f); e.target.value = ""; }} />
                                <div className="h-8 w-8 rounded border border-dashed border-muted-foreground/40 flex items-center justify-center hover:border-primary hover:bg-primary/5 transition-colors">
                                  <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                              </label>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => duplicateRow(row.id)} title="Dupliquer">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Production totale</p>
                  <p className="text-xl font-bold text-primary">{stats.totalPoids} kg</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Poids moyen / arbre</p>
                  <p className="text-xl font-bold">{stats.moyPoids} kg</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total fruits</p>
                  <p className="text-xl font-bold">{stats.totalFruits}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Arbres productifs</p>
                  <p className="text-xl font-bold">{stats.nbProductifs}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                {stats.nbProductifs}/{stats.total} arbres productifs
                {stats.chetifCount > 0 && <span className="text-amber-600"> • {stats.chetifCount} chétif{stats.chetifCount > 1 ? "s" : ""}</span>}
                {stats.manquantCount > 0 && <span className="text-destructive"> • {stats.manquantCount} manquant{stats.manquantCount > 1 ? "s" : ""}</span>}
              </p>
            </CardContent>
          </Card>

          {/* Save */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => navigate("/production")}>Annuler</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!canSave || saveMutation.isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Enregistrement..." : "Sauvegarder tout"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
