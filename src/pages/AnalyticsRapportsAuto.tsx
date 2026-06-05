import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, FileText, Power, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";

export default function AnalyticsRapportsAuto() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState("");
  const [typeRapport, setTypeRapport] = useState("Mensuel");
  const [domaineId, setDomaineId] = useState<string>("all");

  const { data: rapports = [] } = useQuery({
    queryKey: ["rapports-auto"],
    queryFn: async () => {
      const { data } = await supabase.from("rapports_automatiques").select("*, domaines(nom)").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: domaines = [] } = useQuery({
    queryKey: ["ra-domaines"],
    queryFn: async () => { const { data } = await supabase.from("domaines").select("*"); return data || []; },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!nom.trim()) throw new Error("Nom requis");
      const prochainEnvoi = new Date();
      if (typeRapport === "Mensuel") prochainEnvoi.setMonth(prochainEnvoi.getMonth() + 1, 1);
      else if (typeRapport === "Hebdomadaire") prochainEnvoi.setDate(prochainEnvoi.getDate() + (8 - prochainEnvoi.getDay()) % 7);
      else prochainEnvoi.setDate(prochainEnvoi.getDate() + 30);

      const { error } = await supabase.from("rapports_automatiques").insert({
        nom_rapport: nom,
        type_rapport: typeRapport,
        domaine_id: domaineId !== "all" ? Number(domaineId) : null,
        user_destinataire: user?.id,
        prochain_envoi: prochainEnvoi.toISOString(),
        actif: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rapports-auto"] });
      toast.success("Rapport créé");
      setOpen(false);
      setNom("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = async (id: number, actif: boolean) => {
    await supabase.from("rapports_automatiques").update({ actif: !actif }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["rapports-auto"] });
    toast.success(actif ? "Rapport désactivé" : "Rapport activé");
  };

  const deleteRapport = async (id: number) => {
    await supabase.from("rapports_automatiques").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["rapports-auto"] });
    toast.success("Rapport supprimé");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Rapports Automatiques</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nouveau Rapport</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer un Rapport Automatique</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nom du rapport</Label>
                <Input value={nom} onChange={e => setNom(e.target.value)} placeholder="Rapport mensuel production" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={typeRapport} onValueChange={setTypeRapport}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mensuel">Mensuel</SelectItem>
                    <SelectItem value="Hebdomadaire">Hebdomadaire</SelectItem>
                    <SelectItem value="Fin_Campagne">Fin de Campagne</SelectItem>
                    <SelectItem value="Custom">Personnalisé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Domaine</Label>
                <Select value={domaineId} onValueChange={setDomaineId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les domaines</SelectItem>
                    {domaines.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>Créer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {rapports.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              Aucun rapport configuré. Créez votre premier rapport automatique.
            </CardContent>
          </Card>
        )}

        {rapports.map(r => (
          <Card key={r.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">{r.nom_rapport}</h3>
                    <Badge variant={r.actif ? "default" : "secondary"}>{r.actif ? "Actif" : "Inactif"}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Type : {r.type_rapport}</p>
                    <p>Domaine : {(r.domaines as any)?.nom || "Tous"}</p>
                    {r.dernier_envoi && <p>Dernier envoi : {new Date(r.dernier_envoi).toLocaleDateString("fr-FR")}</p>}
                    {r.prochain_envoi && (
                      <p className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Prochain envoi : {new Date(r.prochain_envoi).toLocaleDateString("fr-FR")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => toggleActive(r.id, r.actif ?? false)}>
                    <Power className={`h-4 w-4 ${r.actif ? "text-primary" : "text-muted-foreground"}`} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteRapport(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
