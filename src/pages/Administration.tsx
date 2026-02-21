import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle, Trash2, MapPin, Grape, Users, Link2 } from "lucide-react";
import { toast } from "sonner";

// ─── Domaines Tab ───────────────────────────────────────────────
function DomainesTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", nom: "", region: "", responsable_nom: "" });

  const { data: domaines = [], isLoading } = useQuery({
    queryKey: ["admin-domaines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("domaines").select("*").order("nom");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("domaines").insert({
        code: form.code.trim(),
        nom: form.nom.trim(),
        region: form.region.trim(),
        responsable_nom: form.responsable_nom.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-domaines"] });
      toast.success("Domaine créé");
      setOpen(false);
      setForm({ code: "", nom: "", region: "", responsable_nom: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("domaines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-domaines"] });
      toast.success("Domaine supprimé");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Domaines / Fermes</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><PlusCircle className="h-4 w-4 mr-1" /> Ajouter</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau domaine</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Code</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="DOM01" /></div>
              <div><Label>Nom</Label><Input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} placeholder="Domaine Berkane" /></div>
              <div><Label>Région</Label><Input value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} placeholder="Oriental" /></div>
              <div><Label>Responsable</Label><Input value={form.responsable_nom} onChange={e => setForm({ ...form, responsable_nom: e.target.value })} placeholder="Nom du responsable" /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={!form.code || !form.nom || !form.region || createMutation.isPending}>
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Région</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : domaines.map((d) => (
              <TableRow key={d.id}>
                <TableCell><Badge variant="outline">{d.code}</Badge></TableCell>
                <TableCell className="font-medium">{d.nom}</TableCell>
                <TableCell>{d.region}</TableCell>
                <TableCell>{d.responsable_nom || "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(d.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Variétés Tab ───────────────────────────────────────────────
function VarietesTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code_variete: "", nom_commercial: "", type_id: "" });

  const { data: varietes = [], isLoading } = useQuery({
    queryKey: ["admin-varietes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("varietes").select("*, types_varietes(type_nom)").order("code_variete");
      if (error) throw error;
      return data;
    },
  });

  const { data: types = [] } = useQuery({
    queryKey: ["types-varietes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("types_varietes").select("*").order("type_nom");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("varietes").insert({
        code_variete: form.code_variete.trim(),
        nom_commercial: form.nom_commercial.trim() || null,
        type_id: form.type_id ? Number(form.type_id) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-varietes"] });
      toast.success("Variété créée");
      setOpen(false);
      setForm({ code_variete: "", nom_commercial: "", type_id: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("varietes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-varietes"] });
      toast.success("Variété supprimée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Variétés</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><PlusCircle className="h-4 w-4 mr-1" /> Ajouter</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle variété</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Code variété</Label><Input value={form.code_variete} onChange={e => setForm({ ...form, code_variete: e.target.value })} placeholder="VAR001" /></div>
              <div><Label>Nom commercial</Label><Input value={form.nom_commercial} onChange={e => setForm({ ...form, nom_commercial: e.target.value })} placeholder="Navel" /></div>
              <div>
                <Label>Type</Label>
                <Select value={form.type_id} onValueChange={v => setForm({ ...form, type_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un type" /></SelectTrigger>
                  <SelectContent>
                    {types.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.type_nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={!form.code_variete || createMutation.isPending}>
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Nom commercial</TableHead>
              <TableHead>Type</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : varietes.map((v) => (
              <TableRow key={v.id}>
                <TableCell><Badge variant="outline">{v.code_variete}</Badge></TableCell>
                <TableCell className="font-medium">{v.nom_commercial || "—"}</TableCell>
                <TableCell>{(v.types_varietes as any)?.type_nom || "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(v.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Utilisateurs Tab ───────────────────────────────────────────
function UtilisateursTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ user_id: "", role: "", domaine_id: "" });

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*, profiles:user_id(email, nom_complet), domaines:domaine_id(nom)")
        .order("user_id");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, email, nom_complet").order("email");
      if (error) throw error;
      return data;
    },
  });

  const { data: domaines = [] } = useQuery({
    queryKey: ["admin-domaines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("domaines").select("id, nom").order("nom");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("user_roles").insert({
        user_id: form.user_id,
        role: form.role as any,
        domaine_id: form.domaine_id ? Number(form.domaine_id) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      toast.success("Rôle assigné");
      setOpen(false);
      setForm({ user_id: "", role: "", domaine_id: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      toast.success("Rôle supprimé");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleLabels: Record<string, string> = {
    responsable_domaine: "Resp. Domaine",
    responsable_central: "Resp. Central",
    direction: "Direction",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Utilisateurs & Rôles</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><PlusCircle className="h-4 w-4 mr-1" /> Assigner</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Assigner un rôle</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Utilisateur</Label>
                <Select value={form.user_id} onValueChange={v => setForm({ ...form, user_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un utilisateur" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rôle</Label>
                <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="responsable_domaine">Responsable Domaine</SelectItem>
                    <SelectItem value="responsable_central">Responsable Central</SelectItem>
                    <SelectItem value="direction">Direction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.role === "responsable_domaine" && (
                <div>
                  <Label>Domaine</Label>
                  <Select value={form.domaine_id} onValueChange={v => setForm({ ...form, domaine_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un domaine" /></SelectTrigger>
                    <SelectContent>
                      {domaines.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={!form.user_id || !form.role || createMutation.isPending}>
                Assigner
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Domaine</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : roles.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{(r.profiles as any)?.email || "—"}</TableCell>
                <TableCell>{(r.profiles as any)?.nom_complet || "—"}</TableCell>
                <TableCell><Badge>{roleLabels[r.role] || r.role}</Badge></TableCell>
                <TableCell>{(r.domaines as any)?.nom || "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Domaine-Variétés Tab ───────────────────────────────────────
function DomaineVarietesTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedDomaine, setSelectedDomaine] = useState("");
  const [selectedPorteGreffe, setSelectedPorteGreffe] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedVarietes, setSelectedVarietes] = useState<string[]>([]);
  const [nbArbres, setNbArbres] = useState("5");
  const [filterDomaine, setFilterDomaine] = useState("");

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["admin-domaine-varietes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("domaine_varietes")
        .select("*, domaines(nom, code), varietes(code_variete, nom_commercial), porte_greffes(code_pg, nom_pg)")
        .order("domaine_id");
      if (error) throw error;
      return data;
    },
  });

  const { data: domaines = [] } = useQuery({
    queryKey: ["admin-domaines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("domaines").select("id, nom").order("nom");
      if (error) throw error;
      return data;
    },
  });

  const { data: varietes = [] } = useQuery({
    queryKey: ["admin-varietes-simple"],
    queryFn: async () => {
      const { data, error } = await supabase.from("varietes").select("id, code_variete, nom_commercial, type_id").order("code_variete");
      if (error) throw error;
      return data;
    },
  });

  const { data: typesVarietes = [] } = useQuery({
    queryKey: ["types-varietes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("types_varietes").select("*").order("type_nom");
      if (error) throw error;
      return data;
    },
  });

  const { data: porteGreffes = [] } = useQuery({
    queryKey: ["admin-porte-greffes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("porte_greffes").select("id, code_pg, nom_pg").order("nom_pg");
      if (error) throw error;
      return data;
    },
  });

  // Filter already linked for selected domaine + porte-greffe combo
  const linkedVarieteIds = links
    .filter(l => String(l.domaine_id) === selectedDomaine && String(l.porte_greffe_id) === selectedPorteGreffe)
    .map(l => String(l.variete_id));

  const toggleVariete = (id: string) => {
    setSelectedVarietes(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const rows = selectedVarietes.map(vid => ({
        domaine_id: Number(selectedDomaine),
        variete_id: Number(vid),
        porte_greffe_id: Number(selectedPorteGreffe),
        nb_arbres: Number(nbArbres) || 5,
      }));
      const { error } = await supabase.from("domaine_varietes").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-domaine-varietes"] });
      toast.success(`${selectedVarietes.length} variété(s) associée(s)`);
      setOpen(false);
      setSelectedDomaine("");
      setSelectedPorteGreffe("");
      setSelectedType("");
      setSelectedVarietes([]);
      setNbArbres("5");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("domaine_varietes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-domaine-varietes"] });
      toast.success("Association supprimée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredLinks = filterDomaine
    ? links.filter(l => String(l.domaine_id) === filterDomaine)
    : links;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-lg">Domaine ↔ Variétés ↔ Porte-greffes</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={filterDomaine} onValueChange={setFilterDomaine}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrer par domaine" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les domaines</SelectItem>
              {domaines.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.nom}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><PlusCircle className="h-4 w-4 mr-1" /> Associer</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Associer des variétés à un domaine</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Domaine</Label>
                  <Select value={selectedDomaine} onValueChange={v => { setSelectedDomaine(v); setSelectedVarietes([]); }}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un domaine" /></SelectTrigger>
                    <SelectContent>
                      {domaines.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Porte-greffe</Label>
                  <Select value={selectedPorteGreffe} onValueChange={v => { setSelectedPorteGreffe(v); setSelectedVarietes([]); }}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un porte-greffe" /></SelectTrigger>
                    <SelectContent>
                      {porteGreffes.map(pg => <SelectItem key={pg.id} value={String(pg.id)}>{pg.code_pg} — {pg.nom_pg}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type de variété</Label>
                  <Select value={selectedType} onValueChange={v => { setSelectedType(v); setSelectedVarietes([]); }}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un type" /></SelectTrigger>
                    <SelectContent>
                      {typesVarietes.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.type_nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nombre d'arbres</Label>
                  <Input type="number" min={1} value={nbArbres} onChange={e => setNbArbres(e.target.value)} />
                </div>
                {selectedDomaine && selectedPorteGreffe && selectedType && (
                  <div>
                    <Label className="mb-2 block">Codes variétés ({selectedType && typesVarietes.find(t => String(t.id) === selectedType)?.type_nom})</Label>
                    <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-3">
                      {varietes
                        .filter(v => String(v.type_id) === selectedType && !linkedVarieteIds.includes(String(v.id)))
                        .map(v => (
                          <div key={v.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`var-${v.id}`}
                              checked={selectedVarietes.includes(String(v.id))}
                              onCheckedChange={() => toggleVariete(String(v.id))}
                            />
                            <label htmlFor={`var-${v.id}`} className="text-sm cursor-pointer">
                              {v.code_variete} — {v.nom_commercial || ""}
                            </label>
                          </div>
                        ))}
                      {varietes.filter(v => String(v.type_id) === selectedType && !linkedVarieteIds.includes(String(v.id))).length === 0 && (
                        <p className="text-sm text-muted-foreground">Toutes les variétés de ce type sont déjà associées.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => createMutation.mutate()} disabled={!selectedDomaine || !selectedPorteGreffe || selectedVarietes.length === 0 || createMutation.isPending}>
                  Associer ({selectedVarietes.length})
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground mb-2">{filteredLinks.length} association(s)</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domaine</TableHead>
              <TableHead>Variété</TableHead>
              <TableHead>Porte-greffe</TableHead>
              <TableHead>Nb arbres</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : filteredLinks.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{(l.domaines as any)?.nom}</TableCell>
                <TableCell><Badge variant="outline">{(l.varietes as any)?.code_variete}</Badge></TableCell>
                <TableCell>{(l.porte_greffes as any)?.code_pg || "—"}</TableCell>
                <TableCell>{l.nb_arbres}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(l.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Main Administration Page ───────────────────────────────────
export default function Administration() {
  const { userInfo } = useAuth();

  if (userInfo.role !== "responsable_central") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Administration</h1>
      <Tabs defaultValue="domaines" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="domaines" className="gap-1"><MapPin className="h-4 w-4 hidden sm:inline" /> Domaines</TabsTrigger>
          <TabsTrigger value="varietes" className="gap-1"><Grape className="h-4 w-4 hidden sm:inline" /> Variétés</TabsTrigger>
          <TabsTrigger value="users" className="gap-1"><Users className="h-4 w-4 hidden sm:inline" /> Utilisateurs</TabsTrigger>
          <TabsTrigger value="links" className="gap-1"><Link2 className="h-4 w-4 hidden sm:inline" /> Associations</TabsTrigger>
        </TabsList>
        <TabsContent value="domaines"><DomainesTab /></TabsContent>
        <TabsContent value="varietes"><VarietesTab /></TabsContent>
        <TabsContent value="users"><UtilisateursTab /></TabsContent>
        <TabsContent value="links"><DomaineVarietesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
