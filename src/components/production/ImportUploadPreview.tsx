import { useState, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Upload, Check, X, Image, Archive, Camera, ChevronDown, ChevronRight, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import imageCompression from "browser-image-compression";

interface ImportRow {
  code_variete: string;
  code_pg: string;
  ligne: number;
  position: number;
  poids: number;
  fruits: number;
  calibre: number | null;
  declassement: number | null;
  qualite: string;
  statut: string;
  recoltant: string;
  observations: string;
  valid: boolean;
  error?: string;
  photoFile?: File;
  photoKey?: string;
}

interface Variete {
  id: number;
  code_variete: string;
  nom_commercial: string | null;
}

interface PorteGreffe {
  id: number;
  code_pg: string;
  nom_pg: string;
}

interface Campagne {
  id: number;
  code_campagne: string;
}

interface Props {
  varietes: Variete[];
  porteGreffes: PorteGreffe[];
  effectiveDomaineId: number | null;
  campagneId: number | null;
  dateRecolte: string;
  campagnes: Campagne[];
}

const ACCEPTED_IMG_EXT = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const MAX_ZIP_SIZE = 50 * 1024 * 1024;

function buildPhotoKey(code: string, pg: string, ligne: number, pos: number): string {
  return `${code}_${pg}_L${String(ligne).padStart(2, "0")}P${String(pos).padStart(2, "0")}`.toLowerCase();
}

async function compressPhoto(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: "image/jpeg",
  });
}

export default function ImportUploadPreview({
  varietes, porteGreffes, effectiveDomaineId, campagneId, dateRecolte, campagnes,
}: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const [uploadOpen, setUploadOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(true);

  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [photoMap, setPhotoMap] = useState<Map<string, File>>(new Map());
  const [photoFileName, setPhotoFileName] = useState("");
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [missingPhotos, setMissingPhotos] = useState<ImportRow[]>([]);
  const [showMissing, setShowMissing] = useState(false);

  // Parse Excel
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws) as any[];

        const parsed: ImportRow[] = jsonData.map(row => {
          const code = String(row.Code || row.code_variete || row.Variete || "").trim();
          const pg = String(row.PG || row.code_pg || row.Porte_greffe || "").trim();
          const ligne = Number(row.Ligne || row.ligne || 0);
          const pos = Number(row.Position || row.Pos || row.position || 0);
          const poids = Number(row.Poids_kg || row.Poids || row.poids || 0);
          const fruits = Number(row.Fruits || row.fruits || 0);
          const calibre = row.Calibre_mm || row.Calibre ? Number(row.Calibre_mm || row.Calibre) : null;
          const declassement = row.Declassement_pct || row.Declassement ? Number(row.Declassement_pct || row.Declassement) : null;
          const qualite = String(row.Qualite || row.qualite || "A").trim();
          const statut = String(row.Statut || row.statut || "Normal").trim();
          const recoltant = String(row.Recoltant || row.recoltant || "").trim();
          const observations = String(row.Observations || row.observations || "").trim();

          const foundVar = varietes.find(v => v.code_variete.toLowerCase() === code.toLowerCase());
          const foundPG = porteGreffes.find(p => p.code_pg.toLowerCase() === pg.toLowerCase());

          let error: string | undefined;
          if (!foundVar) error = `Variété "${code}" inconnue`;
          else if (!foundPG) error = `PG "${pg}" inconnu`;
          else if (ligne < 1 || ligne > 20) error = "Ligne hors limites (1-20)";
          else if (pos < 1 || pos > 25) error = "Position hors limites (1-25)";
          else if (statut === "Normal" && poids <= 0) error = "Poids requis > 0";

          const photoKey = buildPhotoKey(code, pg, ligne, pos);

          return {
            code_variete: code, code_pg: pg,
            ligne, position: pos, poids, fruits, calibre, declassement,
            qualite, statut, recoltant, observations,
            valid: !error, error, photoKey,
            photoFile: photoMap.get(photoKey),
          };
        });

        setImportRows(parsed);
        setPreviewOpen(true);
        toast.info(`${parsed.length} lignes lues, ${parsed.filter(r => r.valid).length} valides`);
      } catch {
        toast.error("Erreur de lecture du fichier Excel");
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Photos multi-select
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newMap = new Map(photoMap);
    let count = 0;
    for (const file of Array.from(files)) {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ACCEPTED_IMG_EXT.includes(ext)) continue;
      const nameNoExt = file.name.replace(/\.[^.]+$/, "").toLowerCase();
      newMap.set(nameNoExt, file);
      count++;
    }
    setPhotoMap(newMap);
    setPhotoFileName(`${count} photos`);
    setImportRows(prev => prev.map(r => ({ ...r, photoFile: newMap.get(r.photoKey || "") })));
    toast.success(`${count} photos chargées`);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  // ZIP
  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_ZIP_SIZE) { toast.error("ZIP > 50MB"); return; }
    try {
      const zip = await JSZip.loadAsync(file);
      const newMap = new Map(photoMap);
      let count = 0;
      const promises: Promise<void>[] = [];
      zip.forEach((relativePath, entry) => {
        if (entry.dir) return;
        const ext = "." + relativePath.split(".").pop()?.toLowerCase();
        if (!ACCEPTED_IMG_EXT.includes(ext)) return;
        const fName = relativePath.split("/").pop() || "";
        const nameNoExt = fName.replace(/\.[^.]+$/, "").toLowerCase();
        promises.push(entry.async("blob").then(blob => {
          newMap.set(nameNoExt, new File([blob], fName, { type: `image/${ext.replace(".", "")}` }));
          count++;
        }));
      });
      await Promise.all(promises);
      setPhotoMap(newMap);
      setPhotoFileName(`ZIP: ${count} photos`);
      setImportRows(prev => prev.map(r => ({ ...r, photoFile: newMap.get(r.photoKey || "") })));
      toast.success(`${count} photos extraites`);
    } catch { toast.error("Erreur ZIP"); }
    if (zipInputRef.current) zipInputRef.current.value = "";
  };

  const validRows = importRows.filter(r => r.valid);
  const matchedPhotos = importRows.filter(r => r.valid && r.photoFile).length;
  const missingPhotoCount = validRows.length - matchedPhotos;

  const grouped = useMemo(() => {
    const map = new Map<string, ImportRow[]>();
    importRows.forEach(r => {
      const key = `${r.code_variete} > ${r.code_pg}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return map;
  }, [importRows]);

  // Import
  const handleImport = async () => {
    if (!user || !effectiveDomaineId || !campagneId) { toast.error("Données incomplètes"); return; }
    if (validRows.length === 0) { toast.error("Aucune ligne valide"); return; }

    setIsImporting(true);
    setImportProgress(0);
    let photoCount = 0;
    const missList: ImportRow[] = [];

    try {
      const inserts = validRows.map(r => {
        const v = varietes.find(va => va.code_variete.toLowerCase() === r.code_variete.toLowerCase())!;
        const pg = porteGreffes.find(p => p.code_pg.toLowerCase() === r.code_pg.toLowerCase())!;
        const isNormal = r.statut === "Normal";
        return {
          domaine_id: effectiveDomaineId,
          campagne_id: campagneId,
          variete_id: v.id,
          porte_greffe_id: pg.id,
          ligne_numero: r.ligne,
          position_ligne: r.position,
          date_recolte: dateRecolte,
          poids_total_kg: isNormal ? r.poids : 0,
          nb_fruits_total: isNormal ? r.fruits : 0,
          calibre_moyen_mm: isNormal ? r.calibre : null,
          taux_declassement_pct: isNormal ? r.declassement : null,
          qualite_globale: isNormal ? r.qualite : null,
          recoltant_nom: r.recoltant || null,
          observations: r.observations || null,
          statut_validation: "Brouillon",
          user_id: user.id,
          arbre_statut: r.statut,
          arbre_inclus_calculs: isNormal,
        };
      });

      const { data: inserted, error } = await supabase.from("production").insert(inserts).select("id, code_arbre");
      if (error) throw error;

      if (inserted) {
        for (let i = 0; i < validRows.length; i++) {
          const row = validRows[i];
          const record = inserted[i];
          setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
          if (row.photoFile) {
            try {
              const compressed = await compressPhoto(row.photoFile);
              const storagePath = `${row.code_variete}_${row.code_pg}_${dateRecolte}_${record.id}.jpg`;
              const { error: upErr } = await supabase.storage
                .from("production-photos")
                .upload(storagePath, compressed, { contentType: "image/jpeg", upsert: true });
              if (!upErr) {
                const { data: urlData } = supabase.storage.from("production-photos").getPublicUrl(storagePath);
                await supabase.from("production").update({ photo_url: urlData.publicUrl }).eq("id", record.id);
                photoCount++;
              }
            } catch { missList.push(row); }
          } else {
            missList.push(row);
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["productions"] });
      toast.success(`${validRows.length} arbres + ${photoCount} photos importés`);

      if (missList.length > 0) {
        setMissingPhotos(missList);
        setShowMissing(true);
      } else {
        navigate("/production");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur d'import");
    } finally {
      setIsImporting(false);
    }
  };

  // Missing photos view
  if (showMissing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Photos manquantes ({missingPhotos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead><TableHead>PG</TableHead>
                <TableHead>Ligne</TableHead><TableHead>Pos</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {missingPhotos.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{r.code_variete}</TableCell>
                  <TableCell>{r.code_pg}</TableCell>
                  <TableCell>{r.ligne}</TableCell>
                  <TableCell>{r.position}</TableCell>
                  <TableCell>
                    <input type="file" accept=".jpg,.jpeg,.png,.webp" className="text-xs w-48"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          const compressed = await compressPhoto(f);
                          const storagePath = `${r.code_variete}_${r.code_pg}_${dateRecolte}_missing_${i}.jpg`;
                          await supabase.storage.from("production-photos").upload(storagePath, compressed, { contentType: "image/jpeg", upsert: true });
                          setMissingPhotos(prev => prev.filter((_, idx) => idx !== i));
                          toast.success(`Photo ajoutée`);
                        } catch { toast.error("Erreur upload"); }
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end mt-4">
            <Button onClick={() => navigate("/production")}>
              {missingPhotos.length > 0 ? "Passer" : "Terminer"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section B - Upload */}
      <Collapsible open={uploadOpen} onOpenChange={setUploadOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="text-lg flex items-center gap-2">
                {uploadOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                B. Upload fichiers
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Excel */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Excel rempli (.xlsx, .csv)</label>
                  <div
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {fileName || "Cliquez pour sélectionner"}
                    </p>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                </div>

                {/* Photos */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Photos (optionnel)</label>
                  <div className="space-y-2">
                    <div
                      className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      <Image className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">Multi-select .jpg/.png</p>
                    </div>
                    <div
                      className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                      onClick={() => zipInputRef.current?.click()}
                    >
                      <Archive className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">ZIP (max 50MB)</p>
                    </div>
                  </div>
                  {photoFileName && <Badge variant="secondary">{photoFileName}</Badge>}
                  <input ref={photoInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" multiple className="hidden" onChange={handlePhotoUpload} />
                  <input ref={zipInputRef} type="file" accept=".zip" className="hidden" onChange={handleZipUpload} />
                  <p className="text-xs text-muted-foreground">Convention : Code_PG_LignePosition.jpg</p>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Section C - Preview */}
      {importRows.length > 0 && (
        <Collapsible open={previewOpen} onOpenChange={setPreviewOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="text-lg flex items-center gap-2">
                  {previewOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  C. Aperçu ({importRows.length} lignes)
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                {/* Counters */}
                <div className="flex flex-wrap gap-3">
                  <Badge variant="secondary">{validRows.length} valides</Badge>
                  <Badge variant="destructive">{importRows.length - validRows.length} erreurs</Badge>
                  <Badge variant="outline" className="gap-1">
                    <Check className="h-3 w-3 text-green-600" /> {matchedPhotos} photos
                  </Badge>
                  {missingPhotoCount > 0 && (
                    <Badge variant="outline" className="gap-1 text-amber-600">
                      ⚠️ {missingPhotoCount} manquantes
                    </Badge>
                  )}
                </div>

                {/* Grouped table */}
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">✅</TableHead>
                        <TableHead className="w-8">📸</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>PG</TableHead>
                        <TableHead>Ligne</TableHead>
                        <TableHead>Pos</TableHead>
                        <TableHead>Poids</TableHead>
                        <TableHead>Fruits</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from(grouped.entries()).map(([group, rows]) => (
                        rows.map((r, i) => (
                          <TableRow key={`${group}-${i}`} className={!r.valid ? "bg-destructive/5" : ""}>
                            <TableCell>
                              {r.valid ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-destructive" />}
                            </TableCell>
                            <TableCell>
                              {r.photoFile
                                ? <Check className="h-4 w-4 text-green-600" />
                                : <span className="text-amber-500 text-xs">⚠️</span>}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{r.code_variete}</TableCell>
                            <TableCell className="font-mono text-xs">{r.code_pg}</TableCell>
                            <TableCell>{r.ligne}</TableCell>
                            <TableCell>{r.position}</TableCell>
                            <TableCell>{r.poids}</TableCell>
                            <TableCell>{r.fruits}</TableCell>
                            <TableCell>
                              <span className="text-xs">{r.statut}</span>
                              {r.error && <p className="text-xs text-destructive">{r.error}</p>}
                            </TableCell>
                          </TableRow>
                        ))
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Import progress */}
                {isImporting && (
                  <div className="space-y-2">
                    <Progress value={importProgress} />
                    <p className="text-xs text-muted-foreground text-center">{importProgress}%</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => { setImportRows([]); setFileName(""); }}>
                    Annuler
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={validRows.length === 0 || isImporting || !campagneId || !effectiveDomaineId}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {isImporting ? "Import en cours..." : `Importer ${validRows.length} arbres + ${matchedPhotos} photos`}
                  </Button>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
