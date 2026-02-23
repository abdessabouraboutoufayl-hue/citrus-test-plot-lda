import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { Save, Plus, Minus, Copy, TreePine, AlertTriangle } from "lucide-react";

interface RowData {
  id: number;
  ligne: number;
  position: number;
  poids: number | null;
  fruits: number | null;
  calibre: number | null;
  qualite: string;
  statut: "Normal" | "Chétif" | "Manquant";
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
});

export default function ProductionSaisieVariete() {
  const navigate = useNavigate();
  const { user, userInfo } = useAuth();
  const queryClient = useQueryClient();

  const [varieteId, setVarieteId] = useState<number | null>(null);
  const [porteGreffeId, setPorteGreffeId] = useState<number | null>(null);
  const [domaineId, setDomaineId] = useState<number | null>(null);
  const [campagneId, setCampagneId] = useState<number | null>(null);
  const [dateRecolte, setDateRecolte] = useState(new Date().toISOString().split("T")[0]);
  const [nbArbres, setNbArbres] = useState(5);
  const [rows, setRows] = useState<RowData[]>(
    Array.from({ length: 5 }, (_, i) => emptyRow(i, i + 1))
  );

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

  const updateRow = useCallback((id: number, field: keyof RowData, value: any) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      // Auto-update checkbox behavior based on statut
      if (field === "statut") {
        // Clear data for non-normal statuses
        if (value !== "Normal") {
          updated.poids = null;
          updated.fruits = null;
          updated.calibre = null;
        }
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
      const newId = Math.max(...prev.map(r => r.id), 0) + 1;
      const idx = prev.findIndex(r => r.id === id);
      const newRow = { ...source, id: newId, position: source.position + 1 };
      const result = [...prev];
      result.splice(idx + 1, 0, newRow);
      return result;
    });
    setNbArbres(prev => prev + 1);
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

  // Stats computed from "Normal" rows only
  const stats = useMemo(() => {
    const normalRows = rows.filter(r => r.statut === "Normal");
    const filledRows = normalRows.filter(r => r.poids !== null && r.poids > 0);
    const chetifCount = rows.filter(r => r.statut === "Chétif").length;
    const manquantCount = rows.filter(r => r.statut === "Manquant").length;

    const totalPoids = filledRows.reduce((s, r) => s + (r.poids || 0), 0);
    const totalFruits = filledRows.reduce((s, r) => s + (r.fruits || 0), 0);
    const moyPoids = filledRows.length > 0 ? totalPoids / filledRows.length : 0;
    const nbProductifs = filledRows.length;

    return {
      totalPoids: Math.round(totalPoids * 100) / 100,
      totalFruits,
      moyPoids: Math.round(moyPoids * 100) / 100,
      nbProductifs,
      chetifCount,
      manquantCount,
      total: rows.length,
    };
  }, [rows]);

  const selectedVariete = varietes.find(v => v.id === varieteId);
  const selectedPG = porteGreffes.find(pg => pg.id === porteGreffeId);

  const canSave = varieteId && porteGreffeId && effectiveDomaineId && campagneId && dateRecolte
    && rows.some(r => r.statut === "Normal" && r.poids && r.poids > 0 && r.fruits && r.fruits > 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !effectiveDomaineId || !campagneId || !varieteId || !porteGreffeId) {
        throw new Error("Données incomplètes");
      }

      const inserts = rows
        .filter(r => r.statut === "Normal" && r.poids && r.poids > 0 && r.fruits && r.fruits > 0)
        .map(r => ({
          domaine_id: effectiveDomaineId,
          campagne_id: campagneId,
          variete_id: varieteId,
          porte_greffe_id: porteGreffeId,
          ligne_numero: r.ligne,
          position_ligne: r.position,
          date_recolte: dateRecolte,
          poids_total_kg: r.poids!,
          nb_fruits_total: r.fruits!,
          calibre_moyen_mm: r.calibre || null,
          qualite_globale: r.qualite || null,
          statut_validation: "Brouillon",
          user_id: user.id,
          arbre_statut: r.statut,
          arbre_inclus_calculs: r.statut === "Normal",
        }));

      // Also insert non-normal rows to track chétif/manquant
      const nonNormalInserts = rows
        .filter(r => r.statut !== "Normal")
        .map(r => ({
          domaine_id: effectiveDomaineId,
          campagne_id: campagneId,
          variete_id: varieteId,
          porte_greffe_id: porteGreffeId,
          ligne_numero: r.ligne,
          position_ligne: r.position,
          date_recolte: dateRecolte,
          poids_total_kg: 0,
          nb_fruits_total: 0,
          calibre_moyen_mm: null,
          qualite_globale: null,
          statut_validation: "Brouillon",
          user_id: user.id,
          arbre_statut: r.statut,
          arbre_inclus_calculs: false,
        }));

      const allInserts = [...inserts, ...nonNormalInserts];
      if (allInserts.length === 0) throw new Error("Aucune donnée à enregistrer");

      const { error } = await supabase.from("production").insert(allInserts);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productions"] });
      toast.success(`${stats.nbProductifs} arbres enregistrés avec succès`);
      navigate("/production");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TreePine className="h-6 w-6 text-primary" />
            Saisie par Variété / Porte-greffe
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Saisissez la production de plusieurs arbres d'une même combinaison variété/porte-greffe
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/production")}>Retour</Button>
      </div>

      {/* Sélection initiale */}
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
              <div className="flex gap-2 flex-wrap">
                {porteGreffes.map(pg => (
                  <Button
                    key={pg.id}
                    type="button"
                    variant={porteGreffeId === pg.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPorteGreffeId(pg.id)}
                  >
                    {pg.code_pg}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Date de récolte</Label>
              <Input type="date" value={dateRecolte} onChange={e => setDateRecolte(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Nombre d'arbres</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={nbArbres}
                onChange={e => handleNbArbresChange(Number(e.target.value))}
              />
            </div>
          </div>

          {selectedVariete && selectedPG && (
            <div className="mt-4 flex gap-2 flex-wrap">
              <Badge variant="secondary">{selectedVariete.code_variete}</Badge>
              {selectedVariete.nom_commercial && (
                <Badge variant="outline">{selectedVariete.nom_commercial}</Badge>
              )}
              <Badge variant="outline">PG: {selectedPG.code_pg}</Badge>
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
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-4 w-4 mr-1" />Ligne
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={removeRow} disabled={rows.length <= 1}>
                <Minus className="h-4 w-4 mr-1" />Ligne
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
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
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => {
                const isNormal = row.statut === "Normal";
                return (
                  <TableRow key={row.id} className={!isNormal ? "opacity-50 bg-muted/30" : ""}>
                    <TableCell>
                      <Checkbox checked={isNormal} disabled />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={row.ligne}
                        onChange={e => updateRow(row.id, "ligne", Number(e.target.value))}
                        className="h-8 w-16"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        max={25}
                        value={row.position}
                        onChange={e => updateRow(row.id, "position", Number(e.target.value))}
                        className="h-8 w-16"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="-"
                        value={row.poids ?? ""}
                        onChange={e => updateRow(row.id, "poids", e.target.value ? Number(e.target.value) : null)}
                        className="h-8 w-24"
                        disabled={!isNormal}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        placeholder="-"
                        value={row.fruits ?? ""}
                        onChange={e => updateRow(row.id, "fruits", e.target.value ? Number(e.target.value) : null)}
                        className="h-8 w-20"
                        disabled={!isNormal}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="-"
                        value={row.calibre ?? ""}
                        onChange={e => updateRow(row.id, "calibre", e.target.value ? Number(e.target.value) : null)}
                        className="h-8 w-20"
                        disabled={!isNormal}
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={row.qualite} onValueChange={v => updateRow(row.id, "qualite", v)} disabled={!isNormal}>
                        <SelectTrigger className="h-8 w-16">
                          <SelectValue />
                        </SelectTrigger>
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
                        <SelectTrigger className="h-8 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Normal">Normal</SelectItem>
                          <SelectItem value="Chétif">Chétif</SelectItem>
                          <SelectItem value="Manquant">Manquant</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateRow(row.id)} title="Dupliquer">
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

      {/* Calculs automatiques */}
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
          <p className="text-sm text-muted-foreground mt-3 flex items-center gap-1">
            {stats.nbProductifs}/{stats.total} arbres productifs
            {stats.chetifCount > 0 && (
              <span className="text-warning"> • {stats.chetifCount} chétif{stats.chetifCount > 1 ? "s" : ""} exclu{stats.chetifCount > 1 ? "s" : ""}</span>
            )}
            {stats.manquantCount > 0 && (
              <span className="text-destructive"> • {stats.manquantCount} manquant{stats.manquantCount > 1 ? "s" : ""}</span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Bouton sauvegarder */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate("/production")}>Annuler</Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!canSave || saveMutation.isPending}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Enregistrement..." : "Sauvegarder tout"}
        </Button>
      </div>
    </div>
  );
}
