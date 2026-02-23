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
import { PlusCircle, Search, Download, Upload, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useRef } from "react";

const statusColors: Record<string, string> = {
  Brouillon: "bg-muted text-muted-foreground",
  Soumis: "bg-info/20 text-info",
  Validé: "bg-success/20 text-success",
  Rejeté: "bg-destructive/20 text-destructive",
};

export default function ProductionList() {
  const { userInfo } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: productions = [], isLoading } = useQuery({
    queryKey: ["productions", userInfo.domaineId, statutFilter],
    queryFn: async () => {
      let query = supabase
        .from("production")
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
      const { error } = await supabase.from("production").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productions"] });
      toast.success("Production supprimée");
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("production").update({ statut_validation: "Soumis" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productions"] });
      toast.success("Production soumise pour validation");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = productions.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      p.code_arbre?.toLowerCase().includes(s) ||
      (p.varietes as any)?.code_variete?.toLowerCase().includes(s) ||
      (p.varietes as any)?.nom_commercial?.toLowerCase().includes(s)
    );
  });

  const exportExcel = () => {
    const rows = filtered.map((p) => ({
      Arbre: p.code_arbre,
      Variété: (p.varietes as any)?.code_variete,
      "Nom commercial": (p.varietes as any)?.nom_commercial,
      PG: (p.porte_greffes as any)?.code_pg,
      "Poids (kg)": p.poids_total_kg,
      Fruits: p.nb_fruits_total,
      "Poids moy (g)": p.poids_moyen_fruit_g,
      "Date récolte": p.date_recolte,
      Qualité: p.qualite_globale,
      Statut: p.statut_validation,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Production");
    XLSX.writeFile(wb, `Production_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Export Excel téléchargé");
  };

  const importExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws) as any[];
        toast.info(`${jsonData.length} lignes lues. Import en cours de développement.`);
      } catch {
        toast.error("Erreur de lecture du fichier Excel");
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Productions</h1>
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} accept=".xlsx,.xls" className="hidden" onChange={importExcel} />
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
          <Button onClick={exportExcel} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          {userInfo.role !== "direction" && (
            <Button asChild size="sm">
              <Link to="/production/saisie-par-variete"><PlusCircle className="h-4 w-4 mr-1" /> Nouvelle</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="Brouillon">Brouillon</SelectItem>
            <SelectItem value="Soumis">Soumis</SelectItem>
            <SelectItem value="Validé">Validé</SelectItem>
            <SelectItem value="Rejeté">Rejeté</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Arbre</TableHead>
              <TableHead>Variété</TableHead>
              <TableHead>PG</TableHead>
              <TableHead className="text-right">Poids (kg)</TableHead>
              <TableHead className="text-right">Fruits</TableHead>
              <TableHead className="text-right">Poids moy (g)</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucune production</TableCell></TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.code_arbre}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{(p.varietes as any)?.code_variete}</Badge>
                  </TableCell>
                  <TableCell>{(p.porte_greffes as any)?.code_pg}</TableCell>
                  <TableCell className="text-right">{p.poids_total_kg}</TableCell>
                  <TableCell className="text-right">{p.nb_fruits_total}</TableCell>
                  <TableCell className="text-right">{p.poids_moyen_fruit_g?.toFixed(1)}</TableCell>
                  <TableCell>{new Date(p.date_recolte).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[p.statut_validation || "Brouillon"]}>
                      {p.statut_validation}
                    </Badge>
                  </TableCell>
                  <TableCell className="flex gap-1">
                    {p.statut_validation === "Brouillon" && userInfo.role !== "direction" && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => submitMutation.mutate(p.id)} title="Soumettre">
                          <Send className="h-4 w-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(p.id)} title="Supprimer">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((p) => (
          <Card key={p.id}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{p.code_arbre}</p>
                  <p className="text-xs text-muted-foreground">{(p.varietes as any)?.nom_commercial}</p>
                </div>
                <Badge className={statusColors[p.statut_validation || "Brouillon"]}>{p.statut_validation}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><span className="text-muted-foreground">Poids</span><br />{p.poids_total_kg} kg</div>
                <div><span className="text-muted-foreground">Fruits</span><br />{p.nb_fruits_total}</div>
                <div><span className="text-muted-foreground">Qualité</span><br />{p.qualite_globale || "-"}</div>
              </div>
              {p.statut_validation === "Brouillon" && userInfo.role !== "direction" && (
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => submitMutation.mutate(p.id)}>
                    <Send className="h-3.5 w-3.5 mr-1" /> Soumettre
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(p.id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1 text-destructive" /> Supprimer
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
