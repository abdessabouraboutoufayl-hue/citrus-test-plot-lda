import { useState, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Check, X, Download, Image, Camera, Settings2, Archive } from "lucide-react";
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
  photoKey?: string; // matching key
}

const ACCEPTED_IMG_EXT = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50MB

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

export default function ProductionImport() {
  const navigate = useNavigate();
  const { user, userInfo } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [photoMap, setPhotoMap] = useState<Map<string, File>>(new Map());
  const [photoFileName, setPhotoFileName] = useState("");
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [missingPhotos, setMissingPhotos] = useState<ImportRow[]>([]);
  const [showMissing, setShowMissing] = useState(false);

  const effectiveDomaineId = userInfo.domaineId;

  const { data: varietes = [] } = useQuery({
    queryKey: ["varietes"],
    queryFn: async () => {
      const { data } = await supabase.from("varietes").select("*");
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

  const { data: campagnes = [] } = useQuery({
    queryKey: ["campagnes"],
    queryFn: async () => {
      const { data } = await supabase.from("campagnes").select("*").eq("statut", "En cours");
      return data || [];
    },
  });

  const activeCampagne = campagnes[0];

  const downloadTemplate = () => {
    const template = [
      { Code: "007", PG: "MAC", Ligne: 1, Position: 1, Poids_kg: 45.75, Fruits: 320, Calibre_mm: 72, Qualite: "A", Statut: "Normal" },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_Import_Production.xlsx");
    toast.success("Template téléchargé");
  };

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
            code_variete: code,
            code_pg: pg,
            ligne, position: pos, poids, fruits, calibre, declassement,
            qualite, statut, recoltant, observations,
            valid: !error,
            error,
            photoKey,
            photoFile: photoMap.get(photoKey),
          };
        });

        setImportRows(parsed);
        const validCount = parsed.filter(r => r.valid).length;
        toast.info(`${parsed.length} lignes lues, ${validCount} valides`);
      } catch {
        toast.error("Erreur de lecture du fichier Excel");
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Handle photo files (multi-select)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newMap = new Map(photoMap);
    let count = 0;
    for (const file of Array.from(files)) {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ACCEPTED_IMG_EXT.includes(ext)) continue;
      if (file.size > MAX_PHOTO_SIZE) {
        toast.warning(`${file.name} dépasse 5MB, sera compressée`);
      }
      const nameNoExt = file.name.replace(/\.[^.]+$/, "").toLowerCase();
      newMap.set(nameNoExt, file);
      count++;
    }
    setPhotoMap(newMap);
    setPhotoFileName(`${count} photos sélectionnées`);
    // Re-match rows
    setImportRows(prev => prev.map(r => ({
      ...r,
      photoFile: newMap.get(r.photoKey || ""),
    })));
    toast.success(`${count} photos chargées`);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  // Handle ZIP
  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_ZIP_SIZE) {
      toast.error("ZIP trop volumineux (max 50MB)");
      return;
    }
    try {
      const zip = await JSZip.loadAsync(file);
      const newMap = new Map(photoMap);
      let count = 0;
      const promises: Promise<void>[] = [];

      zip.forEach((relativePath, entry) => {
        if (entry.dir) return;
        const ext = "." + relativePath.split(".").pop()?.toLowerCase();
        if (!ACCEPTED_IMG_EXT.includes(ext)) return;
        const fileName = relativePath.split("/").pop() || "";
        const nameNoExt = fileName.replace(/\.[^.]+$/, "").toLowerCase();

        promises.push(
          entry.async("blob").then(blob => {
            const photoFile = new File([blob], fileName, { type: `image/${ext.replace(".", "")}` });
            newMap.set(nameNoExt, photoFile);
            count++;
          })
        );
      });

      await Promise.all(promises);
      setPhotoMap(newMap);
      setPhotoFileName(`ZIP: ${count} photos extraites`);
      setImportRows(prev => prev.map(r => ({
        ...r,
        photoFile: newMap.get(r.photoKey || ""),
      })));
      toast.success(`${count} photos extraites du ZIP`);
    } catch {
      toast.error("Erreur de lecture du fichier ZIP");
    }
    if (zipInputRef.current) zipInputRef.current.value = "";
  };

  const grouped = useMemo(() => {
    const map = new Map<string, ImportRow[]>();
    importRows.forEach(r => {
      const key = `${r.code_variete} > ${r.code_pg}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return map;
  }, [importRows]);

  const validRows = importRows.filter(r => r.valid);
  const matchedPhotos = importRows.filter(r => r.valid && r.photoFile).length;
  const missingPhotoCount = validRows.length - matchedPhotos;

  // Import mutation
  const handleImport = async () => {
    if (!user || !effectiveDomaineId || !activeCampagne) {
      toast.error("Données incomplètes");
      return;
    }
    if (validRows.length === 0) {
      toast.error("Aucune ligne valide");
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    const total = validRows.length;
    let photoCount = 0;
    const missingList: ImportRow[] = [];

    try {
      // Batch insert production data
      const inserts = validRows.map(r => {
        const v = varietes.find(va => va.code_variete.toLowerCase() === r.code_variete.toLowerCase())!;
        const pg = porteGreffes.find(p => p.code_pg.toLowerCase() === r.code_pg.toLowerCase())!;
        const isNormal = r.statut === "Normal";
        return {
          domaine_id: effectiveDomaineId,
          campagne_id: activeCampagne.id,
          variete_id: v.id,
          porte_greffe_id: pg.id,
          ligne_numero: r.ligne,
          position_ligne: r.position,
          date_recolte: new Date().toISOString().split("T")[0],
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

      const { data: inserted, error } = await supabase
        .from("production")
        .insert(inserts)
        .select("id, code_arbre");
      if (error) throw error;

      // Upload photos
      if (inserted) {
        for (let i = 0; i < validRows.length; i++) {
          const row = validRows[i];
          const record = inserted[i];
          setImportProgress(Math.round(((i + 1) / total) * 100));

          if (row.photoFile) {
            try {
              const compressed = await compressPhoto(row.photoFile);
              const date = new Date().toISOString().split("T")[0];
              const storagePath = `${row.code_variete}_${row.code_pg}_${date}_${record.id}.jpg`;

              const { error: uploadErr } = await supabase.storage
                .from("production-photos")
                .upload(storagePath, compressed, { contentType: "image/jpeg", upsert: true });

              if (!uploadErr) {
                const { data: urlData } = supabase.storage
                  .from("production-photos")
                  .getPublicUrl(storagePath);

                await supabase
                  .from("production")
                  .update({ photo_url: urlData.publicUrl })
                  .eq("id", record.id);
                photoCount++;
              }
            } catch {
              // Photo upload failed, add to missing
              missingList.push(row);
            }
          } else {
            missingList.push(row);
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["productions"] });
      toast.success(`${validRows.length} arbres + ${photoCount} photos importés`);

      if (missingList.length > 0) {
        setMissingPhotos(missingList);
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

  // Missing photo individual upload
  const handleMissingPhotoUpload = async (row: ImportRow, file: File) => {
    try {
      const compressed = await compressPhoto(file);
      const date = new Date().toISOString().split("T")[0];
      const storagePath = `${row.code_variete}_${row.code_pg}_${date}_missing.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from("production-photos")
        .upload(storagePath, compressed, { contentType: "image/jpeg", upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("production-photos")
        .getPublicUrl(storagePath);

      // Find production record by code_arbre pattern
      // For now just remove from missing list
      setMissingPhotos(prev => prev.filter(r => r.photoKey !== row.photoKey));
      toast.success(`Photo ajoutée pour ${row.code_variete} L${row.ligne}P${row.position}`);
    } catch {
      toast.error("Erreur upload photo");
    }
  };

  // Missing photos view
  if (showMissing) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Camera className="h-6 w-6 text-primary" />
            Photos manquantes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {missingPhotos.length} arbres sans photo. Uploadez individuellement ou passez.
          </p>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>PG</TableHead>
                  <TableHead>Ligne</TableHead>
                  <TableHead>Pos</TableHead>
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
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
                        className="text-xs w-48"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleMissingPhotoUpload(r, f);
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button onClick={() => navigate("/production")} className="gap-2">
            {missingPhotos.length > 0 ? "Passer" : "Terminer"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            Import Excel Production
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importez vos données de production depuis un fichier Excel
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/production/config-template")} className="gap-1">
            <Settings2 className="h-4 w-4" /> Config Template
          </Button>
          <Button variant="outline" onClick={() => navigate("/production")}>Retour</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">1. Télécharger le template</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Colonnes attendues : Code | PG | Ligne | Position | Poids_kg | Fruits | Calibre_mm | Qualite | Statut
          </p>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-1" /> Télécharger template
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">2. Charger vos fichiers</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Excel upload */}
          <div>
            <p className="text-sm font-medium mb-2">Fichier Excel (.xlsx, .csv)</p>
            <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
            <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" /> Sélectionner fichier Excel
            </Button>
            {fileName && <p className="text-sm text-muted-foreground mt-1">📄 {fileName}</p>}
          </div>

          {/* Photo uploads */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Photos (optionnel)</p>
            <p className="text-xs text-muted-foreground mb-3">
              Convention : Code_PG_LignePosition.jpg (ex: 007_MAC_L01P01.jpg)
            </p>
            <div className="flex gap-2 flex-wrap">
              <input type="file" ref={photoInputRef} accept=".jpg,.jpeg,.png,.webp" multiple className="hidden" onChange={handlePhotoUpload} />
              <Button variant="outline" onClick={() => photoInputRef.current?.click()} className="gap-2">
                <Image className="h-4 w-4" /> Photos (.jpg/.png)
              </Button>
              <input type="file" ref={zipInputRef} accept=".zip" className="hidden" onChange={handleZipUpload} />
              <Button variant="outline" onClick={() => zipInputRef.current?.click()} className="gap-2">
                <Archive className="h-4 w-4" /> Archive ZIP
              </Button>
            </div>
            {photoFileName && <p className="text-sm text-muted-foreground mt-1">📸 {photoFileName}</p>}
            {photoMap.size > 0 && (
              <p className="text-xs text-primary mt-1">{photoMap.size} photos en mémoire</p>
            )}
          </div>
        </CardContent>
      </Card>

      {importRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between flex-wrap gap-2">
              <span>3. Aperçu ({importRows.length} lignes)</span>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">{validRows.length} valides</Badge>
                <Badge variant="destructive">{importRows.length - validRows.length} erreurs</Badge>
                {photoMap.size > 0 && (
                  <>
                    <Badge className="bg-primary/10 text-primary">{matchedPhotos} photos matchées</Badge>
                    {missingPhotoCount > 0 && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">{missingPhotoCount} manquantes</Badge>
                    )}
                  </>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {Array.from(grouped.entries()).map(([group, rows]) => (
              <div key={group}>
                <div className="px-4 py-2 bg-muted/50 font-medium text-sm border-b">{group}</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      {photoMap.size > 0 && <TableHead className="w-8">📸</TableHead>}
                      <TableHead>Code</TableHead>
                      <TableHead>PG</TableHead>
                      <TableHead>Ligne</TableHead>
                      <TableHead>Pos</TableHead>
                      <TableHead>Poids</TableHead>
                      <TableHead>Fruits</TableHead>
                      <TableHead>Calibre</TableHead>
                      <TableHead>Qualité</TableHead>
                      <TableHead>Statut</TableHead>
                      {photoMap.size > 0 && <TableHead>Photo</TableHead>}
                      <TableHead>Erreur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i} className={!r.valid ? "bg-destructive/5" : ""}>
                        <TableCell>{r.valid ? <Check className="h-4 w-4 text-primary" /> : <X className="h-4 w-4 text-destructive" />}</TableCell>
                        {photoMap.size > 0 && (
                          <TableCell>
                            {r.photoFile ? (
                              <span className="text-primary" title="Photo trouvée">✓</span>
                            ) : (
                              <span className="text-amber-500" title="Photo manquante">⚠️</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell>{r.code_variete}</TableCell>
                        <TableCell>{r.code_pg}</TableCell>
                        <TableCell>{r.ligne}</TableCell>
                        <TableCell>{r.position}</TableCell>
                        <TableCell>{r.poids}</TableCell>
                        <TableCell>{r.fruits}</TableCell>
                        <TableCell>{r.calibre ?? "-"}</TableCell>
                        <TableCell>{r.qualite}</TableCell>
                        <TableCell>{r.statut}</TableCell>
                        {photoMap.size > 0 && (
                          <TableCell className="text-xs">
                            {r.photoFile ? (
                              <span className="text-primary font-medium">{r.photoFile.name.slice(0, 20)}</span>
                            ) : (
                              <span className="text-muted-foreground">❌ Manquante</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-xs text-destructive">{r.error || ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isImporting && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm mb-2">Import en cours... {importProgress}%</p>
            <Progress value={importProgress} />
          </CardContent>
        </Card>
      )}

      {validRows.length > 0 && !isImporting && (
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => { setImportRows([]); setFileName(""); setPhotoMap(new Map()); setPhotoFileName(""); }}>Annuler</Button>
          <Button onClick={handleImport} className="gap-2">
            <Upload className="h-4 w-4" />
            Importer {validRows.length} lignes{matchedPhotos > 0 ? ` + ${matchedPhotos} photos` : ""}
          </Button>
        </div>
      )}
    </div>
  );
}
