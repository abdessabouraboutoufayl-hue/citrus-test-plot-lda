import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Check, X, Download } from "lucide-react";
import * as XLSX from "xlsx";

interface ImportRow {
  code_variete: string;
  code_pg: string;
  ligne: number;
  position: number;
  poids: number;
  fruits: number;
  calibre: number | null;
  qualite: string;
  statut: string;
  valid: boolean;
  error?: string;
}

export default function ProductionImport() {
  const navigate = useNavigate();
  const { user, userInfo } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");

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
      { Code: "EX: NAV01", PG: "MAC", Ligne: 1, Position: 1, "Poids_kg": 12.5, Fruits: 45, "Calibre_mm": 72, Qualite: "A", Statut: "Normal" },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_Import_Production.xlsx");
    toast.success("Template téléchargé");
  };

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
          const qualite = String(row.Qualite || row.qualite || "A").trim();
          const statut = String(row.Statut || row.statut || "Normal").trim();

          const foundVar = varietes.find(v => v.code_variete.toLowerCase() === code.toLowerCase());
          const foundPG = porteGreffes.find(p => p.code_pg.toLowerCase() === pg.toLowerCase());

          let error: string | undefined;
          if (!foundVar) error = `Variété "${code}" inconnue`;
          else if (!foundPG) error = `PG "${pg}" inconnu`;
          else if (ligne < 1 || ligne > 20) error = "Ligne hors limites (1-20)";
          else if (pos < 1 || pos > 25) error = "Position hors limites (1-25)";
          else if (statut === "Normal" && poids <= 0) error = "Poids requis > 0";

          return {
            code_variete: code,
            code_pg: pg,
            ligne, position: pos, poids, fruits, calibre, qualite, statut,
            valid: !error,
            error,
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

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!user || !effectiveDomaineId || !activeCampagne) throw new Error("Données incomplètes");

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
          qualite_globale: isNormal ? r.qualite : null,
          statut_validation: "Brouillon",
          user_id: user.id,
          arbre_statut: r.statut,
          arbre_inclus_calculs: isNormal,
        };
      });

      if (inserts.length === 0) throw new Error("Aucune ligne valide");
      const { error } = await supabase.from("production").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productions"] });
      toast.success(`${validRows.length} arbres importés avec succès`);
      navigate("/production");
    },
    onError: (err: any) => toast.error(err.message),
  });

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
        <Button variant="outline" onClick={() => navigate("/production")}>Retour</Button>
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
        <CardHeader><CardTitle className="text-lg">2. Charger votre fichier</CardTitle></CardHeader>
        <CardContent>
          <input type="file" ref={fileInputRef} accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
            <Upload className="h-4 w-4" /> Sélectionner un fichier Excel
          </Button>
          {fileName && <p className="text-sm text-muted-foreground mt-2">Fichier : {fileName}</p>}
        </CardContent>
      </Card>

      {importRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>3. Aperçu ({importRows.length} lignes)</span>
              <div className="flex gap-2">
                <Badge variant="secondary">{validRows.length} valides</Badge>
                <Badge variant="destructive">{importRows.length - validRows.length} erreurs</Badge>
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
                      <TableHead>Code</TableHead>
                      <TableHead>PG</TableHead>
                      <TableHead>Ligne</TableHead>
                      <TableHead>Pos</TableHead>
                      <TableHead>Poids</TableHead>
                      <TableHead>Fruits</TableHead>
                      <TableHead>Calibre</TableHead>
                      <TableHead>Qualité</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Erreur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i} className={!r.valid ? "bg-destructive/5" : ""}>
                        <TableCell>{r.valid ? <Check className="h-4 w-4 text-primary" /> : <X className="h-4 w-4 text-destructive" />}</TableCell>
                        <TableCell>{r.code_variete}</TableCell>
                        <TableCell>{r.code_pg}</TableCell>
                        <TableCell>{r.ligne}</TableCell>
                        <TableCell>{r.position}</TableCell>
                        <TableCell>{r.poids}</TableCell>
                        <TableCell>{r.fruits}</TableCell>
                        <TableCell>{r.calibre ?? "-"}</TableCell>
                        <TableCell>{r.qualite}</TableCell>
                        <TableCell>{r.statut}</TableCell>
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

      {validRows.length > 0 && (
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => { setImportRows([]); setFileName(""); }}>Annuler</Button>
          <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending} className="gap-2">
            <Upload className="h-4 w-4" />
            {importMutation.isPending ? "Import en cours..." : `Importer ${validRows.length} lignes`}
          </Button>
        </div>
      )}
    </div>
  );
}
