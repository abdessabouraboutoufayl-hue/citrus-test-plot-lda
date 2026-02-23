import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Download, Save, Settings2 } from "lucide-react";
import * as XLSX from "xlsx";

const STORAGE_KEY = "production_import_config";

interface ColumnConfig {
  key: string;
  label: string;
  required: boolean;
  defaultOn: boolean;
  exampleValue: string | number;
}

const ALL_COLUMNS: ColumnConfig[] = [
  { key: "Code", label: "Code variété", required: true, defaultOn: true, exampleValue: "007" },
  { key: "PG", label: "Porte-greffe", required: true, defaultOn: true, exampleValue: "MAC" },
  { key: "Ligne", label: "Ligne", required: true, defaultOn: true, exampleValue: 1 },
  { key: "Position", label: "Position", required: true, defaultOn: true, exampleValue: 1 },
  { key: "Poids_kg", label: "Poids (kg)", required: true, defaultOn: true, exampleValue: 45.75 },
  { key: "Fruits", label: "Nb fruits", required: true, defaultOn: true, exampleValue: 320 },
  { key: "Calibre_mm", label: "Calibre (mm)", required: false, defaultOn: true, exampleValue: 72 },
  { key: "Declassement_pct", label: "Déclassement (%)", required: false, defaultOn: false, exampleValue: 5 },
  { key: "Qualite", label: "Qualité", required: false, defaultOn: true, exampleValue: "A" },
  { key: "Statut", label: "Statut arbre", required: false, defaultOn: true, exampleValue: "Normal" },
  { key: "Recoltant", label: "Récoltant", required: false, defaultOn: false, exampleValue: "Ahmed" },
  { key: "Observations", label: "Observations", required: false, defaultOn: false, exampleValue: "RAS" },
  { key: "Photo", label: "Photo (nom fichier)", required: false, defaultOn: false, exampleValue: "007_MAC_L01P01.jpg" },
];

export function getImportConfig(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return ALL_COLUMNS.filter(c => c.defaultOn).map(c => c.key);
}

export default function ProductionConfigTemplate() {
  const navigate = useNavigate();
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => getImportConfig());

  const toggleColumn = (key: string) => {
    const col = ALL_COLUMNS.find(c => c.key === key);
    if (col?.required) return;
    setSelectedColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const saveConfig = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedColumns));
    toast.success("Configuration sauvegardée");
  };

  const downloadTemplate = () => {
    const activeCols = ALL_COLUMNS.filter(c => selectedColumns.includes(c.key));
    const exampleRow: Record<string, any> = {};
    activeCols.forEach(c => { exampleRow[c.key] = c.exampleValue; });

    const ws = XLSX.utils.json_to_sheet([exampleRow]);

    // Bold headers + freeze panes
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let col = range.s.c; col <= range.e.c; col++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!ws[addr]) continue;
      ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: "2E7D32" } }, font: { color: { rgb: "FFFFFF" }, bold: true } };
    }

    // Column widths
    ws["!cols"] = activeCols.map(c => ({ wch: Math.max(c.label.length, String(c.exampleValue).length) + 4 }));

    // Add instructions sheet
    const instrWs = XLSX.utils.aoa_to_sheet([
      ["Instructions Import Production"],
      [""],
      ["Colonnes obligatoires : Code, PG, Ligne, Position, Poids_kg, Fruits"],
      ["Colonnes optionnelles : " + ALL_COLUMNS.filter(c => !c.required).map(c => c.key).join(", ")],
      [""],
      ["Valeurs Qualité : A, B, C, D"],
      ["Valeurs Statut : Normal, Chétif, Manquant, Mort, Greffé, Remplacé"],
      [""],
      ["Convention nommage photos :"],
      ["Format : Code_PG_LignePosition.jpg"],
      ["Exemple : 007_MAC_L01P01.jpg"],
      [""],
      ["Formats acceptés : .jpg, .jpeg, .png, .webp"],
      ["Taille max par photo : 5 MB (compression auto)"],
    ]);
    instrWs["!cols"] = [{ wch: 60 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Données");
    XLSX.utils.book_append_sheet(wb, instrWs, "Instructions");
    XLSX.writeFile(wb, "Template_Import_Production.xlsx");
    toast.success("Template téléchargé avec les colonnes sélectionnées");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-primary" />
            Configuration Template Import
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sélectionnez les colonnes pour votre template Excel
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/production/import")}>Retour Import</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Colonnes du template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ALL_COLUMNS.map(col => (
            <div key={col.key} className="flex items-center gap-3">
              <Checkbox
                id={col.key}
                checked={selectedColumns.includes(col.key)}
                onCheckedChange={() => toggleColumn(col.key)}
                disabled={col.required}
              />
              <label htmlFor={col.key} className="text-sm flex-1 cursor-pointer">
                <span className="font-medium">{col.label}</span>
                <span className="text-muted-foreground ml-2">({col.key})</span>
                {col.required && (
                  <span className="ml-2 text-xs text-primary font-semibold">Obligatoire</span>
                )}
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={saveConfig} className="gap-2">
          <Save className="h-4 w-4" /> Sauvegarder config
        </Button>
        <Button onClick={downloadTemplate} className="gap-2">
          <Download className="h-4 w-4" /> Télécharger template
        </Button>
      </div>
    </div>
  );
}
