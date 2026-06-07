import { useState, useMemo } from "react";
import { refApi, phenologieApi } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

const STADES_COMPARE = [
  { key: "repos", label: "Repos végétatif", dateField: "stadeReposDateDebut" },
  { key: "debourrement", label: "Débourrement", dateField: "stadeDebourrementDateDebut" },
  { key: "boutons_floraux", label: "Boutons floraux", dateField: "stadeBoutonsFlorauxDateDebut" },
  { key: "prefloraison", label: "Pré-floraison", dateField: "stadePrefloraisonDateDebut" },
  { key: "floraison", label: "Floraison", dateField: "stadeFloraisonDateDebut" },
  { key: "chute_petales", label: "Chute pétales", dateField: "stadeChutePetalesDateDebut" },
  { key: "nouaison", label: "Nouaison", dateField: "stadeNouaisonDateDebut" },
  { key: "chute_physio", label: "Chute physiologique", dateField: "stadeChutePhysioDateDebut" },
  { key: "grossissement", label: "Grossissement", dateField: "stadeGrossissementDateDebut" },
  { key: "veraison", label: "Véraison", dateField: "stadeVeraisonDateDebut" },
  { key: "debut_maturite", label: "Début maturité", dateField: "stadeDebutMaturiteDate" },
  { key: "maturite_recolte", label: "Maturité récolte", dateField: "stadeMaturiteRecolteDate" },
];

export default function PhenologieComparaison() {
  const [selectedVariete, setSelectedVariete] = useState<string>("");
  const [campagne1, setCampagne1] = useState<string>("");
  const [campagne2, setCampagne2] = useState<string>("");

  const { data: campagnes = [] } = useQuery({
    queryKey: ["campagnes"],
    queryFn: () => refApi.campagnes(),
  });

  const { data: varietes = [] } = useQuery({
    queryKey: ["varietes-with-types"],
    queryFn: () => refApi.varietes(),
  });

  const { data: phenoList1 = [] } = useQuery({
    queryKey: ["phenologie-compare-1", campagne1],
    queryFn: () => phenologieApi.list(campagne1),
    enabled: !!campagne1,
  });

  const { data: phenoList2 = [] } = useQuery({
    queryKey: ["phenologie-compare-2", campagne2],
    queryFn: () => phenologieApi.list(campagne2),
    enabled: !!campagne2,
  });

  const pheno1 = useMemo(
    () => phenoList1.find((p: any) => String(p.varieteId) === selectedVariete) || null,
    [phenoList1, selectedVariete]
  );
  const pheno2 = useMemo(
    () => phenoList2.find((p: any) => String(p.varieteId) === selectedVariete) || null,
    [phenoList2, selectedVariete]
  );

  const camp1Label = campagnes.find((c: any) => c.id.toString() === campagne1)?.codeCampagne || "Campagne 1";
  const camp2Label = campagnes.find((c: any) => c.id.toString() === campagne2)?.codeCampagne || "Campagne 2";

  const getEcart = (field: string) => {
    if (!pheno1 || !pheno2) return null;
    const d1 = pheno1[field];
    const d2 = pheno2[field];
    if (!d1 || !d2) return null;
    return differenceInDays(new Date(d2), new Date(d1));
  };

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d), "dd/MM/yyyy", { locale: fr }); } catch { return d; }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">📊 Comparaison Inter-Campagnes</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs mb-1 block">Variété</Label>
          <SearchableSelect
            options={(varietes || []).map((v: any) => ({ value: v.id.toString(), label: v.codeVariete, sublabel: v.nomCommercial || undefined }))}
            value={selectedVariete}
            onValueChange={setSelectedVariete}
            placeholder="Variété..."
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Campagne 1</Label>
          <SearchableSelect
            options={(campagnes || []).map((c: any) => ({ value: c.id.toString(), label: c.codeCampagne }))}
            value={campagne1}
            onValueChange={setCampagne1}
            placeholder="Campagne 1..."
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Campagne 2</Label>
          <SearchableSelect
            options={(campagnes || []).map((c: any) => ({ value: c.id.toString(), label: c.codeCampagne }))}
            value={campagne2}
            onValueChange={setCampagne2}
            placeholder="Campagne 2..."
          />
        </div>
      </div>

      {selectedVariete && campagne1 && campagne2 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Durée floraison</p>
                <div className="flex gap-3 mt-1">
                  <span className="text-sm">{camp1Label}: <strong>{pheno1?.dureeFloraisonJours ?? "—"}j</strong></span>
                  <span className="text-sm">{camp2Label}: <strong>{pheno2?.dureeFloraisonJours ?? "—"}j</strong></span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Durée cycle total</p>
                <div className="flex gap-3 mt-1">
                  <span className="text-sm">{camp1Label}: <strong>{pheno1?.dureeTotaleCycleJours ?? "—"}j</strong></span>
                  <span className="text-sm">{camp2Label}: <strong>{pheno2?.dureeTotaleCycleJours ?? "—"}j</strong></span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Intensité floraison</p>
                <div className="flex gap-3 mt-1">
                  <span className="text-sm">{camp1Label}: <strong>{pheno1?.stadeFloraisonIntensite ?? "—"}</strong></span>
                  <span className="text-sm">{camp2Label}: <strong>{pheno2?.stadeFloraisonIntensite ?? "—"}</strong></span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Comparaison des stades</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stade</TableHead>
                      <TableHead>{camp1Label}</TableHead>
                      <TableHead>{camp2Label}</TableHead>
                      <TableHead>Écart (jours)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {STADES_COMPARE.map((stade) => {
                      const d1 = pheno1 ? pheno1[stade.dateField] : null;
                      const d2 = pheno2 ? pheno2[stade.dateField] : null;
                      const ecart = getEcart(stade.dateField);
                      return (
                        <TableRow key={stade.key}>
                          <TableCell className="font-medium text-sm">{stade.label}</TableCell>
                          <TableCell className="text-sm">{fmtDate(d1)}</TableCell>
                          <TableCell className="text-sm">{fmtDate(d2)}</TableCell>
                          <TableCell>
                            {ecart !== null ? (
                              <Badge variant={ecart < 0 ? "default" : ecart > 0 ? "destructive" : "secondary"} className="text-xs">
                                {ecart > 0 ? `+${ecart}` : ecart}j {ecart < 0 ? "(précoce)" : ecart > 0 ? "(tardif)" : ""}
                              </Badge>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {(!selectedVariete || !campagne1 || !campagne2) && (
        <p className="text-center text-muted-foreground py-12">Sélectionnez une variété et deux campagnes pour comparer</p>
      )}
    </div>
  );
}
