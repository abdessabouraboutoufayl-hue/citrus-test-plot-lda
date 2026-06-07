import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { productionApi } from "@/services/api";
import { getCalibreType, mapExcelCalibreToDb, validateExcelCalibreSum, NB_ECHANTILLON } from "@/lib/calibre-config";
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
import { Upload, Check, X, ChevronDown, ChevronRight, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import JSZip from "jszip";
import imageCompression from "browser-image-compression";

interface ImportRow {
  codeVariete: string;
  codePg: string;
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
  rawRow?: Record<string, any>;
}

interface Variete {
  id: number;
  codeVariete: string;
  nomCommercial: string | null;
}

interface PorteGreffe {
  id: number;
  codePg: string;
  nomPg: string;
}

interface Campagne {
  id: number;
  codeCampagne: string;
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
const MAX_ZIP_SIZE = 50 * 1024 * 1024;

function buildPhotoKey(code: string, pg: string, ligne: number, pos: number): string {
  return `${code}_${pg}_L${String(ligne).padStart(2, "0")}P${String(pos).padStart(2, "0")}`.toLowerCase();
}

async function compressPhoto(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: 0.3, maxWidthOrHeight: 1920, useWebWorker: true, fileType: "image/jpeg",
  });
}

const toCamel = (s: string) => s.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());

export default function ImportUploadPreview({
  varietes, porteGreffes, effectiveDomaineId, campagneId, dateRecolte,
}: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const [uploadOpen, setUploadOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [photoMap, setPhotoMap] = useState<Map<string, File>>(new Map());
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);

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

          const foundVar = varietes.find(v => v.codeVariete.toLowerCase() === code.toLowerCase());
          const foundPG = porteGreffes.find(p => p.codePg.toLowerCase() === pg.toLowerCase());

          let error: string | undefined;
          if (!foundVar) error = `Variété "${code}" inconnue`;
          else if (!foundPG) error = `PG "${pg}" inconnu`;
          else if (ligne < 1 || ligne > 20) error = "Ligne hors limites (1-20)";
          else if (pos < 1 || pos > 25) error = "Position hors limites (1-25)";
          else if (statut === "Normal" && poids <= 0) error = "Poids requis > 0";

          if (!error && foundVar && statut === "Normal") {
            const calType = getCalibreType(foundVar.codeVariete);
            const { valid: calValid, sum: calSum } = validateExcelCalibreSum(row, calType);
            if (!calValid) {
              const normLabel = calType === "navel" ? "Navel (_N)" : "Mandarine (_M)";
              error = `Calibre ${normLabel}: total ${calSum}/${NB_ECHANTILLON}`;
            }
          }

          const photoKey = buildPhotoKey(code, pg, ligne, pos);

          return {
            codeVariete: code, codePg: pg,
            ligne, position: pos, poids, fruits, calibre, declassement,
            qualite, statut, recoltant, observations,
            valid: !error, error, photoKey,
            photoFile: photoMap.get(photoKey),
            rawRow: row,
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
    setImportRows(prev => prev.map(r => ({ ...r, photoFile: newMap.get(r.photoKey || "") })));
    toast.success(`${count} photos chargées`);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

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
      const key = `${r.codeVariete} > ${r.codePg}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return map;
  }, [importRows]);

  const handleImport = async () => {
    if (!effectiveDomaineId || !campagneId) { toast.error("Données incomplètes"); return; }
    if (validRows.length === 0) { toast.error("Aucune ligne valide"); return; }

    setIsImporting(true);
    setImportProgress(0);

    try {
      for (let i = 0; i < validRows.length; i++) {
        const r = validRows[i];
        const v = varietes.find(va => va.codeVariete.toLowerCase() === r.codeVariete.toLowerCase())!;
        const pg = porteGreffes.find(p => p.codePg.toLowerCase() === r.codePg.toLowerCase())!;
        const isNormal = r.statut === "Normal";

        const calType = getCalibreType(v.codeVariete);
        const calibreDbValues = isNormal && r.rawRow ? mapExcelCalibreToDb(r.rawRow, calType) : {};
        const calibreCamel = Object.fromEntries(Object.entries(calibreDbValues).map(([k, v]) => [toCamel(k), v]));

        const payload: Record<string, any> = {
          domaineId: effectiveDomaineId,
          campagneId,
          varieteId: v.id,
          porteGreffeId: pg.id,
          ligneNumero: r.ligne,
          positionLigne: r.position,
          dateRecolte,
          poidsTotalKg: isNormal ? r.poids : 0,
          nbFruitsTotal: isNormal ? r.fruits : 0,
          calibreMoyenMm: isNormal ? r.calibre : null,
          tauxDeclassementPct: isNormal ? r.declassement : null,
          qualiteGlobale: isNormal ? r.qualite : null,
          recoltantNom: r.recoltant || null,
          observations: r.observations || null,
          statutValidation: "Brouillon",
          arbreStatut: r.statut,
          arbreInclusCalculs: isNormal,
          ...(isNormal ? calibreCamel : {}),
        };

        if (r.photoFile) {
          const compressed = await compressPhoto(r.photoFile);
          const fd = new FormData();
          Object.entries(payload).forEach(([k, v]) => {
            if (v !== null && v !== undefined) fd.append(k, String(v));
          });
          fd.append("photo", compressed);
          await productionApi.create(fd);
        } else {
          await productionApi.createJson(payload);
        }

        setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
      }

      queryClient.invalidateQueries({ queryKey: ["productions"] });
      toast.success(`${validRows.length} arbres importés`);
      navigate("/production");
    } catch (err: any) {
      toast.error(err.message || "Erreur d'import");
    } finally {
      setIsImporting(false);
    }
  };

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
              <div className="space-y-2">
                <label className="text-sm font-medium">Photos individuelles (optionnel)</label>
                <div
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onClick={() => photoInputRef.current?.click()}
                >
                  <p className="text-sm text-muted-foreground">Photos séparées (.jpg, .png, .webp)</p>
                </div>
                <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Archive ZIP de photos (optionnel)</label>
                <div
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onClick={() => zipInputRef.current?.click()}
                >
                  <p className="text-sm text-muted-foreground">Archive .zip (max 50MB)</p>
                </div>
                <input ref={zipInputRef} type="file" accept=".zip" className="hidden" onChange={handleZipUpload} />
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
                <div className="flex flex-wrap gap-3">
                  <Badge variant="secondary">{validRows.length} valides</Badge>
                  <Badge variant="destructive">{importRows.length - validRows.length} erreurs</Badge>
                  <Badge variant="outline" className="gap-1">
                    <Check className="h-3 w-3 text-green-600" /> {matchedPhotos} photos
                  </Badge>
                  {missingPhotoCount > 0 && (
                    <Badge variant="outline" className="gap-1 text-amber-600">
                      ⚠️ {missingPhotoCount} sans photo
                    </Badge>
                  )}
                </div>

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
                                : <span className="text-amber-500 text-xs">—</span>}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{r.codeVariete}</TableCell>
                            <TableCell className="font-mono text-xs">{r.codePg}</TableCell>
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

                {isImporting && (
                  <div className="space-y-2">
                    <Progress value={importProgress} />
                    <p className="text-xs text-muted-foreground text-center">{importProgress}%</p>
                  </div>
                )}

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
                    {isImporting ? "Import en cours..." : `Importer ${validRows.length} arbres`}
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
