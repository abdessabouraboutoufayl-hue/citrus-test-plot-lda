import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Download, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

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

interface Domaine {
  id: number;
  nom: string;
  code: string;
}

interface Campagne {
  id: number;
  code_campagne: string;
}

interface Props {
  varietes: Variete[];
  porteGreffes: PorteGreffe[];
  domaines: Domaine[];
  campagnes: Campagne[];
  isCentral: boolean;
  effectiveDomaineId: number | null;
  domaineId: number | null;
  setDomaineId: (v: number | null) => void;
  campagneId: number | null;
  setCampagneId: (v: number | null) => void;
  dateRecolte: string;
  setDateRecolte: (v: string) => void;
}

const OPTIONAL_COLUMNS = [
  { key: "Calibre_mm", label: "Calibre" },
  { key: "Declassement_pct", label: "Déclassement" },
  { key: "Qualite", label: "Qualité" },
  { key: "Recoltant", label: "Récoltant" },
  { key: "Statut", label: "Statut" },
  { key: "Photo", label: "Photo" },
  { key: "Observations", label: "Observations" },
];

export default function ImportTemplateConfig({
  varietes, porteGreffes, domaines, campagnes,
  isCentral, effectiveDomaineId, domaineId, setDomaineId,
  campagneId, setCampagneId, dateRecolte, setDateRecolte,
}: Props) {
  const [open, setOpen] = useState(true);
  const [selectedVarietes, setSelectedVarietes] = useState<Map<number, Set<number>>>(new Map());
  const [optionalCols, setOptionalCols] = useState<Set<string>>(new Set(["Calibre_mm", "Qualite", "Statut"]));
  const [nbArbresPerCombo, setNbArbresPerCombo] = useState(5);

  const currentDomaine = domaines.find(d => d.id === effectiveDomaineId);

  const toggleVariete = useCallback((vid: number) => {
    setSelectedVarietes(prev => {
      const next = new Map(prev);
      if (next.has(vid)) {
        next.delete(vid);
      } else {
        next.set(vid, new Set());
      }
      return next;
    });
  }, []);

  const togglePG = useCallback((vid: number, pgId: number) => {
    setSelectedVarietes(prev => {
      const next = new Map(prev);
      const pgs = new Set(next.get(vid) || []);
      if (pgs.has(pgId)) pgs.delete(pgId);
      else pgs.add(pgId);
      next.set(vid, pgs);
      return next;
    });
  }, []);

  const toggleCol = useCallback((key: string) => {
    setOptionalCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const combos = useMemo(() => {
    const result: { variete: Variete; pg: PorteGreffe }[] = [];
    selectedVarietes.forEach((pgIds, vid) => {
      const v = varietes.find(va => va.id === vid);
      if (!v) return;
      pgIds.forEach(pgId => {
        const pg = porteGreffes.find(p => p.id === pgId);
        if (pg) result.push({ variete: v, pg });
      });
    });
    return result;
  }, [selectedVarietes, varietes, porteGreffes]);

  const totalLines = combos.length * nbArbresPerCombo;

  const downloadTemplate = () => {
    if (combos.length === 0) {
      toast.error("Sélectionnez au moins une combinaison variété/PG");
      return;
    }
    if (!campagneId || !effectiveDomaineId) {
      toast.error("Sélectionnez domaine et campagne");
      return;
    }

    const campagne = campagnes.find(c => c.id === campagneId);
    const domaine = domaines.find(d => d.id === effectiveDomaineId);

    // Build rows
    const rows: Record<string, any>[] = [];
    combos.forEach(({ variete, pg }) => {
      for (let a = 1; a <= nbArbresPerCombo; a++) {
        const row: Record<string, any> = {
          Campagne: campagne?.code_campagne || "",
          Date: dateRecolte,
          Domaine: domaine?.code || "",
          Code: variete.code_variete,
          PG: pg.code_pg,
          Ligne: "",
          Position: "",
          Poids_kg: "",
          Fruits: "",
        };
        if (optionalCols.has("Calibre_mm")) row["Calibre_mm"] = "";
        if (optionalCols.has("Declassement_pct")) row["Declassement_pct"] = "";
        if (optionalCols.has("Qualite")) row["Qualite"] = "A";
        if (optionalCols.has("Recoltant")) row["Recoltant"] = "";
        if (optionalCols.has("Statut")) row["Statut"] = "Normal";
        if (optionalCols.has("Photo")) row["Photo"] = "";
        if (optionalCols.has("Observations")) row["Observations"] = "";
        rows.push(row);
      }
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    const keys = Object.keys(rows[0] || {});
    ws["!cols"] = keys.map(k => ({ wch: Math.max(k.length + 2, 14) }));

    // Data validations for Qualité and Statut dropdowns
    const dvs: any[] = [];
    const qualColIdx = keys.indexOf("Qualite");
    const statutColIdx = keys.indexOf("Statut");
    if (qualColIdx >= 0) {
      dvs.push({
        sqref: `${XLSX.utils.encode_col(qualColIdx)}2:${XLSX.utils.encode_col(qualColIdx)}${rows.length + 1}`,
        type: "list",
        values: ["A", "B", "C", "Hors norme"],
      });
    }
    if (statutColIdx >= 0) {
      dvs.push({
        sqref: `${XLSX.utils.encode_col(statutColIdx)}2:${XLSX.utils.encode_col(statutColIdx)}${rows.length + 1}`,
        type: "list",
        values: ["Normal", "Chétif", "Manquant"],
      });
    }

    // Freeze panes
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

    // Instructions sheet
    const instrWs = XLSX.utils.aoa_to_sheet([
      ["Instructions Import Production"],
      [""],
      ["Colonnes pré-remplies : Campagne, Date, Domaine, Code, PG"],
      ["Colonnes à remplir : Ligne (1-20), Position (1-25), Poids_kg, Fruits"],
      [""],
      ["Qualité : A, B, C, Hors norme"],
      ["Statut : Normal, Chétif, Manquant"],
      [""],
      ["Convention photos : Code_PG_LignePosition.jpg"],
      ["Exemple : 007_MAC_L01P01.jpg"],
      ["Formats : .jpg, .jpeg, .png, .webp | Max 5MB/photo"],
    ]);
    instrWs["!cols"] = [{ wch: 60 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Données");
    XLSX.utils.book_append_sheet(wb, instrWs, "Instructions");
    XLSX.writeFile(wb, `Template_Production_${combos.length}combos_${totalLines}lignes.xlsx`);
    toast.success(`Template téléchargé (${totalLines} lignes)`);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="text-lg flex items-center gap-2">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              A. Configuration & Template
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Context commun */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Contexte commun</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <Label>Date de récolte</Label>
                  <Input type="date" value={dateRecolte} onChange={e => setDateRecolte(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Variétés & PG */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Variétés & Porte-greffes</h3>
              <div className="border rounded-lg p-3 max-h-64 overflow-y-auto space-y-3">
                {varietes.map(v => {
                  const isSelected = selectedVarietes.has(v.id);
                  const selectedPGs = selectedVarietes.get(v.id) || new Set();
                  return (
                    <div key={v.id}>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleVariete(v.id)}
                        />
                        <span className="text-sm font-medium">{v.code_variete}</span>
                        {v.nom_commercial && (
                          <span className="text-xs text-muted-foreground">- {v.nom_commercial}</span>
                        )}
                      </div>
                      {isSelected && (
                        <div className="ml-8 mt-1 flex flex-wrap gap-3">
                          {porteGreffes.map(pg => (
                            <label key={pg.id} className="flex items-center gap-1 text-xs cursor-pointer">
                              <Checkbox
                                checked={selectedPGs.has(pg.id)}
                                onCheckedChange={() => togglePG(v.id, pg.id)}
                                className="h-3.5 w-3.5"
                              />
                              {pg.code_pg}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Colonnes optionnelles */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Colonnes optionnelles</h3>
              <div className="flex flex-wrap gap-4">
                {OPTIONAL_COLUMNS.map(col => (
                  <label key={col.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={optionalCols.has(col.key)}
                      onCheckedChange={() => toggleCol(col.key)}
                      className="h-3.5 w-3.5"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Arbres par combo */}
            <div className="flex items-center gap-4">
              <div className="space-y-1.5">
                <Label>Arbres par combo</Label>
                <Input
                  type="number" min={1} max={25} value={nbArbresPerCombo}
                  onChange={e => setNbArbresPerCombo(Math.max(1, Math.min(25, Number(e.target.value))))}
                  className="w-20"
                />
              </div>
              {combos.length > 0 && (
                <div className="pt-6">
                  <Badge variant="secondary" className="text-sm">
                    {combos.length} combo{combos.length > 1 ? "s" : ""} × {nbArbresPerCombo} arbres = {totalLines} lignes
                  </Badge>
                </div>
              )}
            </div>

            {/* Download */}
            <div className="flex justify-end">
              <Button onClick={downloadTemplate} disabled={combos.length === 0} className="gap-2">
                <Download className="h-4 w-4" />
                Télécharger Template ({totalLines} lignes)
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
