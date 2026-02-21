import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Search, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const statusColors: Record<string, string> = {
  Brouillon: "bg-muted text-muted-foreground",
  Soumis: "bg-info/20 text-info",
  Validé: "bg-success/20 text-success",
  Rejeté: "bg-destructive/20 text-destructive",
};

function EaBadgeInline({ value }: { value: number | null }) {
  if (value == null) return <span>-</span>;
  if (value >= 12) return <Badge className="bg-success/20 text-success">{value.toFixed(1)} ⭐</Badge>;
  if (value >= 10) return <Badge className="bg-warning/20 text-warning">{value.toFixed(1)}</Badge>;
  return <Badge className="bg-destructive/20 text-destructive">{value.toFixed(1)}</Badge>;
}

export default function QualiteList() {
  const { userInfo } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("all");

  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ["qualite-list", userInfo.domaineId, statutFilter],
    queryFn: async () => {
      let query = supabase
        .from("qualite_interne")
        .select("*, varietes(code_variete, nom_commercial), porte_greffes(code_pg), domaines(nom, code)")
        .order("created_at", { ascending: false });
      if (userInfo.role === "responsable_domaine" && userInfo.domaineId) {
        query = query.eq("domaine_id", userInfo.domaineId);
      }
      if (statutFilter !== "all") query = query.eq("statut_validation", statutFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("qualite_interne").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qualite-list"] });
      toast.success("Analyse supprimée");
    },
  });

  const filtered = analyses.filter((a: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (a.varietes as any)?.code_variete?.toLowerCase().includes(s) ||
      a.technicien_nom?.toLowerCase().includes(s)
    );
  });

  const exportExcel = () => {
    const rows = filtered.map((a: any) => ({
      Domaine: (a.domaines as any)?.nom,
      "Code Variété": (a.varietes as any)?.code_variete,
      "Nom Variété": (a.varietes as any)?.nom_commercial,
      PG: (a.porte_greffes as any)?.code_pg,
      "Date Analyse": a.date_analyse,
      "Nb Échantillon": a.nb_fruits_echantillon,
      "% Jus": a.pct_jus,
      "Poids Jus (g)": a.poids_jus_g,
      "Volume Jus (mL)": a.volume_jus_ml,
      "Brix (°)": a.brix_degres,
      "Acidité (g/L)": a.acidite_gl,
      "NaOH (mL)": a.volume_naoh_ml,
      "E/A": a.ratio_ea,
      "Pépins Total": a.nb_pepins_echantillon_total,
      "Moy Pépins/Fruit": a.moyenne_pepins_par_fruit,
      "Fruits avec Pépins": a.nb_fruits_avec_pepins,
      "Fermeté Peau": a.moyenne_fermete_peau_kg_cm2,
      "Fermeté Fruit": a.moyenne_fermete_fruit_kg_cm2,
      "Granulation Sévère": a.granulation_severe,
      "Granulation Légère": a.granulation_legere,
      Technicien: a.technicien_nom,
      Statut: a.statut_validation,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Qualité");
    XLSX.writeFile(wb, `Qualite_Interne_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Export Excel téléchargé");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Qualité Interne</h1>
        <div className="flex gap-2">
          <Button onClick={exportExcel} variant="outline" size="sm"><Download className="h-4 w-4 mr-1" /> Export</Button>
          {userInfo.role !== "direction" && (
            <Button asChild size="sm"><Link to="/qualite/new"><PlusCircle className="h-4 w-4 mr-1" /> Nouvelle</Link></Button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher code, technicien..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="Brouillon">Brouillon</SelectItem>
            <SelectItem value="Soumis">Soumis</SelectItem>
            <SelectItem value="Validé">Validé</SelectItem>
            <SelectItem value="Rejeté">Rejeté</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>PG</TableHead>
              <TableHead className="text-right">Brix (°)</TableHead>
              <TableHead className="text-right">Acidité</TableHead>
              <TableHead>E/A</TableHead>
              <TableHead className="text-right">% Jus</TableHead>
              <TableHead className="text-right">Pépins moy</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Aucune analyse</TableCell></TableRow>
            ) : (
              filtered.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium"><Badge variant="outline">{(a.varietes as any)?.code_variete}</Badge></TableCell>
                  <TableCell>{(a.porte_greffes as any)?.code_pg}</TableCell>
                  <TableCell className="text-right">{a.brix_degres}</TableCell>
                  <TableCell className="text-right">{a.acidite_gl}</TableCell>
                  <TableCell><EaBadgeInline value={a.ratio_ea} /></TableCell>
                  <TableCell className="text-right">{a.pct_jus ?? "-"}</TableCell>
                  <TableCell className="text-right">{a.moyenne_pepins_par_fruit?.toFixed(1) ?? "-"}</TableCell>
                  <TableCell>{new Date(a.date_analyse).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell><Badge className={statusColors[a.statut_validation || "Brouillon"]}>{a.statut_validation}</Badge></TableCell>
                  <TableCell>
                    {a.statut_validation === "Brouillon" && userInfo.role !== "direction" && (
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-3">
        {filtered.map((a: any) => (
          <Card key={a.id}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{(a.varietes as any)?.code_variete}</p>
                  <p className="text-xs text-muted-foreground">{(a.porte_greffes as any)?.code_pg} • {new Date(a.date_analyse).toLocaleDateString("fr-FR")}</p>
                </div>
                <Badge className={statusColors[a.statut_validation || "Brouillon"]}>{a.statut_validation}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><span className="text-muted-foreground">Brix</span><br />{a.brix_degres}°</div>
                <div><span className="text-muted-foreground">E/A</span><br /><EaBadgeInline value={a.ratio_ea} /></div>
                <div><span className="text-muted-foreground">% Jus</span><br />{a.pct_jus ?? "-"}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
