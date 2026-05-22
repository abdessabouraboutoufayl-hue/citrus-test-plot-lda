import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { refApi, adminApi } from "@/services/api";
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
import { PlusCircle, Trash2, MapPin, Grape, Users, Link2, Pencil, PenTool } from "lucide-react";
import { toast } from "sonner";
import DrawSuperficieDialog from "@/components/DrawSuperficieDialog";

// ─── Domaines Tab ───────────────────────────────────────────────
function DomainesTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ code: "", nom: "", region: "", responsableNom: "" });
  const [drawOpen, setDrawOpen] = useState(false);
  const [drawDomaine, setDrawDomaine] = useState<any>(null);

  const { data: domaines = [], isLoading } = useQuery({
    queryKey: ["admin-domaines"],
    queryFn: () => refApi.domaines(),
  });

  const createMutation = useMutation({
    mutationFn: () => refApi.createDomaine({
      code: form.code.trim(),
      nom: form.nom.trim(),
      region: form.region.trim(),
      responsableNom: form.responsableNom.trim() || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-domaines"] });
      toast.success("Domaine créé");
      setOpen(false);
      setForm({ code: "", nom: "", region: "", responsableNom: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editId) return Promise.resolve();
      return refApi.updateDomaine(editId, {
        code: form.code.trim(),
        nom: form.nom.trim(),
        region: form.region.trim(),
        responsableNom: form.responsableNom.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-domaines"] });
      toast.success("Domaine modifié");
      setEditOpen(false);
      setEditId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => refApi.deleteDomaine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-domaines"] });
      toast.success("Domaine supprimé");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (d: any) => {
    setEditId(d.id);
    setForm({ code: d.code, nom: d.nom, region: d.region, responsableNom: d.responsableNom || "" });
    setEditOpen(true);
  };

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
              <div><Label>Responsable</Label><Input value={form.responsableNom} onChange={e => setForm({ ...form, responsableNom: e.target.value })} placeholder="Nom du responsable" /></div>
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
              <TableHead>Superficie</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : domaines.map((d: any) => (
              <TableRow key={d.id}>
                <TableCell><Badge variant="outline">{d.code}</Badge></TableCell>
                <TableCell className="font-medium">{d.nom}</TableCell>
                <TableCell>{d.region}</TableCell>
                <TableCell>{d.responsableNom || "—"}</TableCell>
                <TableCell>
                  {d.superficieHa ? (
                    <Badge variant="secondary">{d.superficieHa} ha</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="icon" title="Tracer la superficie" onClick={() => { setDrawDomaine(d); setDrawOpen(true); }}>
                    <PenTool className="h-4 w-4 text-primary" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(d.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier le domaine</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Code</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            <div><Label>Nom</Label><Input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} /></div>
            <div><Label>Région</Label><Input value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} /></div>
            <div><Label>Responsable</Label><Input value={form.responsableNom} onChange={e => setForm({ ...form, responsableNom: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate()} disabled={!form.code || !form.nom || !form.region || updateMutation.isPending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {drawDomaine && (
        <DrawSuperficieDialog
          open={drawOpen}
          onOpenChange={(v) => { setDrawOpen(v); if (!v) setDrawDomaine(null); }}
          domaineName={drawDomaine.nom}
          latitude={drawDomaine.latitude}
          longitude={drawDomaine.longitude}
          existingGeoJSON={drawDomaine.superficieGeojson}
          onSave={async (geojson, superficieHa) => {
            try {
              await refApi.updateDomaine(drawDomaine.id, { superficieGeojson: geojson, superficieHa });
              queryClient.invalidateQueries({ queryKey: ["admin-domaines"] });
              toast.success(`Superficie enregistrée : ${superficieHa} ha`);
            } catch (e: any) {
              toast.error(e.message);
            }
          }}
        />
      )}
    </Card>
  );
}

// ─── Variétés Tab ───────────────────────────────────────────────
function VarietesTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ codeVariete: "", nomCommercial: "", typeId: "" });

  const { data: varietes = [], isLoading } = useQuery({
    queryKey: ["admin-varietes"],
    queryFn: () => refApi.varietes(),
  });

  const { data: types = [] } = useQuery({
    queryKey: ["types-varietes"],
    queryFn: () => refApi.typesVarietes(),
  });

  const createMutation = useMutation({
    mutationFn: () => refApi.createVariete({
      codeVariete: form.codeVariete.trim(),
      nomCommercial: form.nomCommercial.trim() || null,
      typeId: form.typeId ? Number(form.typeId) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-varietes"] });
      toast.success("Variété créée");
      setOpen(false);
      setForm({ codeVariete: "", nomCommercial: "", typeId: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editId) return Promise.resolve();
      return refApi.updateVariete(editId, {
        codeVariete: form.codeVariete.trim(),
        nomCommercial: form.nomCommercial.trim() || null,
        typeId: form.typeId ? Number(form.typeId) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-varietes"] });
      toast.success("Variété modifiée");
      setEditOpen(false);
      setEditId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => refApi.deleteVariete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-varietes"] });
      toast.success("Variété supprimée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (v: any) => {
    setEditId(v.id);
    setForm({ codeVariete: v.codeVariete, nomCommercial: v.nomCommercial || "", typeId: v.typeId ? String(v.typeId) : "" });
    setEditOpen(true);
  };

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
              <div><Label>Code variété</Label><Input value={form.codeVariete} onChange={e => setForm({ ...form, codeVariete: e.target.value })} placeholder="VAR001" /></div>
              <div><Label>Nom commercial</Label><Input value={form.nomCommercial} onChange={e => setForm({ ...form, nomCommercial: e.target.value })} placeholder="Navel" /></div>
              <div>
                <Label>Type</Label>
                <Select value={form.typeId} onValueChange={v => setForm({ ...form, typeId: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un type" /></SelectTrigger>
                  <SelectContent>
                    {types.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.typeNom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={!form.codeVariete || createMutation.isPending}>
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
            ) : varietes.map((v: any) => (
              <TableRow key={v.id}>
                <TableCell><Badge variant="outline">{v.codeVariete}</Badge></TableCell>
                <TableCell className="font-medium">{v.nomCommercial || "—"}</TableCell>
                <TableCell>{v.typeVariete?.typeNom || "—"}</TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(v)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(v.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier la variété</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Code variété</Label><Input value={form.codeVariete} onChange={e => setForm({ ...form, codeVariete: e.target.value })} /></div>
            <div><Label>Nom commercial</Label><Input value={form.nomCommercial} onChange={e => setForm({ ...form, nomCommercial: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.typeId} onValueChange={v => setForm({ ...form, typeId: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un type" /></SelectTrigger>
                <SelectContent>
                  {types.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.typeNom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate()} disabled={!form.codeVariete || updateMutation.isPending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Utilisateurs Tab ───────────────────────────────────────────
function UtilisateursTab() {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ role: "", domaineId: "" });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminApi.listUsers(),
  });

  const { data: domaines = [] } = useQuery({
    queryKey: ["admin-domaines"],
    queryFn: () => refApi.domaines(),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editUser) return Promise.resolve();
      return adminApi.updateUser(editUser.id, {
        role: editForm.role,
        domaineId: editForm.domaineId ? Number(editForm.domaineId) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Utilisateur modifié");
      setEditOpen(false);
      setEditUser(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Utilisateur supprimé");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleLabels: Record<string, string> = {
    responsable_domaine: "Resp. Domaine",
    responsable_central: "Resp. Central",
    direction: "Direction",
  };

  const openEdit = (u: any) => {
    setEditUser(u);
    setEditForm({ role: u.role || "", domaineId: u.domaineId ? String(u.domaineId) : "" });
    setEditOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Utilisateurs & Rôles</CardTitle>
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
            ) : users.map((u: any) => (
              <TableRow key={u.id}>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.nomComplet || "—"}</TableCell>
                <TableCell><Badge>{roleLabels[u.role] || u.role || "—"}</Badge></TableCell>
                <TableCell>{u.domaine?.nom || "—"}</TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(u.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier l'utilisateur</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Rôle</Label>
              <Select value={editForm.role} onValueChange={v => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="responsable_domaine">Responsable Domaine</SelectItem>
                  <SelectItem value="responsable_central">Responsable Central</SelectItem>
                  <SelectItem value="direction">Direction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editForm.role === "responsable_domaine" && (
              <div>
                <Label>Domaine</Label>
                <Select value={editForm.domaineId} onValueChange={v => setEditForm({ ...editForm, domaineId: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un domaine" /></SelectTrigger>
                  <SelectContent>
                    {domaines.map((d: any) => <SelectItem key={d.id} value={String(d.id)}>{d.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate()} disabled={!editForm.role || updateMutation.isPending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Domaine-Variétés Tab ───────────────────────────────────────
function DomaineVarietesTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editNbArbres, setEditNbArbres] = useState("5");
  const [selectedDomaine, setSelectedDomaine] = useState("");
  const [selectedPorteGreffe, setSelectedPorteGreffe] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedVarietes, setSelectedVarietes] = useState<string[]>([]);
  const [nbArbres, setNbArbres] = useState("5");
  const [filterDomaine, setFilterDomaine] = useState("");

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["admin-domaine-varietes"],
    queryFn: () => refApi.domaineVarietes(),
  });

  const { data: domaines = [] } = useQuery({
    queryKey: ["admin-domaines"],
    queryFn: () => refApi.domaines(),
  });

  const { data: varietes = [] } = useQuery({
    queryKey: ["admin-varietes-simple"],
    queryFn: () => refApi.varietes(),
  });

  const { data: typesVarietes = [] } = useQuery({
    queryKey: ["types-varietes"],
    queryFn: () => refApi.typesVarietes(),
  });

  const { data: porteGreffes = [] } = useQuery({
    queryKey: ["admin-porte-greffes"],
    queryFn: () => refApi.porteGreffes(),
  });

  const linkedVarieteIds = links
    .filter((l: any) => String(l.domaineId) === selectedDomaine && String(l.porteGreffeId) === selectedPorteGreffe)
    .map((l: any) => String(l.varieteId));

  const toggleVariete = (id: string) => {
    setSelectedVarietes(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      for (const vid of selectedVarietes) {
        await refApi.createDomaineVariete({
          domaineId: Number(selectedDomaine),
          varieteId: Number(vid),
          porteGreffeId: Number(selectedPorteGreffe),
          nbArbres: Number(nbArbres) || 5,
        });
      }
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

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editId) return Promise.resolve();
      return refApi.updateDomaineVariete(editId, { nbArbres: Number(editNbArbres) || 5 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-domaine-varietes"] });
      toast.success("Association modifiée");
      setEditOpen(false);
      setEditId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => refApi.deleteDomaineVariete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-domaine-varietes"] });
      toast.success("Association supprimée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredLinks = filterDomaine && filterDomaine !== "all"
    ? links.filter((l: any) => String(l.domaineId) === filterDomaine)
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
              {domaines.map((d: any) => <SelectItem key={d.id} value={String(d.id)}>{d.nom}</SelectItem>)}
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
                  <Select value={selectedDomaine} onValueChange={v => { setSelectedDomaine(v); setSelectedType(""); setSelectedVarietes([]); setSelectedPorteGreffe(""); }}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un domaine" /></SelectTrigger>
                    <SelectContent>
                      {domaines.map((d: any) => <SelectItem key={d.id} value={String(d.id)}>{d.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {selectedDomaine && (
                  <div>
                    <Label>Type de variété</Label>
                    <Select value={selectedType} onValueChange={v => { setSelectedType(v); setSelectedVarietes([]); }}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner un type" /></SelectTrigger>
                      <SelectContent>
                        {typesVarietes.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.typeNom}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {selectedDomaine && selectedType && (
                  <div>
                    <Label className="mb-2 block">Codes variétés ({typesVarietes.find((t: any) => String(t.id) === selectedType)?.typeNom})</Label>
                    <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-3">
                      {varietes
                        .filter((v: any) => String(v.typeId) === selectedType && !linkedVarieteIds.includes(String(v.id)))
                        .map((v: any) => (
                          <div key={v.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`var-${v.id}`}
                              checked={selectedVarietes.includes(String(v.id))}
                              onCheckedChange={() => toggleVariete(String(v.id))}
                            />
                            <label htmlFor={`var-${v.id}`} className="text-sm cursor-pointer">
                              {v.codeVariete} — {v.nomCommercial || ""}
                            </label>
                          </div>
                        ))}
                      {varietes.filter((v: any) => String(v.typeId) === selectedType && !linkedVarieteIds.includes(String(v.id))).length === 0 && (
                        <p className="text-sm text-muted-foreground">Toutes les variétés de ce type sont déjà associées.</p>
                      )}
                    </div>
                  </div>
                )}
                {selectedVarietes.length > 0 && (
                  <div>
                    <Label>Porte-greffe</Label>
                    <Select value={selectedPorteGreffe} onValueChange={setSelectedPorteGreffe}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner un porte-greffe" /></SelectTrigger>
                      <SelectContent>
                        {porteGreffes.map((pg: any) => <SelectItem key={pg.id} value={String(pg.id)}>{pg.codePg} — {pg.nomPg}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {selectedPorteGreffe && (
                  <div>
                    <Label>Nombre d'arbres</Label>
                    <Input type="number" min={1} value={nbArbres} onChange={e => setNbArbres(e.target.value)} />
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
            ) : filteredLinks.map((l: any) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.domaine?.nom}</TableCell>
                <TableCell><Badge variant="outline">{l.variete?.codeVariete}</Badge></TableCell>
                <TableCell>{l.porteGreffe?.codePg || "—"}</TableCell>
                <TableCell>{l.nbArbres}</TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditId(l.id); setEditNbArbres(String(l.nbArbres)); setEditOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(l.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier l'association</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre d'arbres</Label>
              <Input type="number" min={1} value={editNbArbres} onChange={e => setEditNbArbres(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
