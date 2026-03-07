import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle, Trash2, Pencil, Shield, Users, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { APP_MODULES } from "@/lib/permissions-config";

const roleLabels: Record<string, string> = {
  responsable_domaine: "Responsable Domaine",
  responsable_central: "Responsable Central",
  direction: "Direction",
};

// ─── Profils de permissions Tab ───
function ProfilsPermissionsTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nom: "", description: "" });
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, boolean>>({});

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["permission-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("permission_profiles").select("*").order("nom");
      if (error) throw error;
      return data;
    },
  });

  const { data: allPermissions = [] } = useQuery({
    queryKey: ["all-profile-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profile_permissions").select("*");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("permission_profiles").insert({
        nom: form.nom.trim(),
        description: form.description.trim() || null,
      }).select().single();
      if (error) throw error;
      // Insert permissions
      const perms = Object.entries(selectedPermissions)
        .filter(([, v]) => v)
        .map(([key]) => {
          const parts = key.split("__");
          return { profile_id: data.id, module_key: parts[0], submenu_key: parts[1], can_access: true };
        });
      if (perms.length > 0) {
        const { error: permError } = await supabase.from("profile_permissions").insert(perms);
        if (permError) throw permError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permission-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["all-profile-permissions"] });
      toast.success("Profil créé");
      setOpen(false);
      setForm({ nom: "", description: "" });
      setSelectedPermissions({});
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("permission_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permission-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["all-profile-permissions"] });
      toast.success("Profil supprimé");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = async (profile: any) => {
    setEditId(profile.id);
    setForm({ nom: profile.nom, description: profile.description || "" });
    const permsForProfile = allPermissions.filter((p: any) => p.profile_id === profile.id && p.can_access);
    const permsMap: Record<string, boolean> = {};
    permsForProfile.forEach((p: any) => {
      permsMap[`${p.module_key}__${p.submenu_key}`] = true;
    });
    setSelectedPermissions(permsMap);
    setEditOpen(true);
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      const { error } = await supabase.from("permission_profiles").update({
        nom: form.nom.trim(),
        description: form.description.trim() || null,
      }).eq("id", editId);
      if (error) throw error;
      // Replace permissions
      await supabase.from("profile_permissions").delete().eq("profile_id", editId);
      const perms = Object.entries(selectedPermissions)
        .filter(([, v]) => v)
        .map(([key]) => {
          const parts = key.split("__");
          return { profile_id: editId, module_key: parts[0], submenu_key: parts[1], can_access: true };
        });
      if (perms.length > 0) {
        const { error: permError } = await supabase.from("profile_permissions").insert(perms);
        if (permError) throw permError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permission-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["all-profile-permissions"] });
      toast.success("Profil mis à jour");
      setEditOpen(false);
      setEditId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getProfilePermCount = (profileId: string) => {
    return allPermissions.filter((p: any) => p.profile_id === profileId && p.can_access).length;
  };

  const PermissionsCheckboxes = () => (
    <div className="space-y-4 max-h-[400px] overflow-y-auto">
      {APP_MODULES.map((mod) => (
        <div key={mod.key} className="space-y-2">
          <div className="flex items-center gap-2">
            <span>{mod.icon}</span>
            <span className="font-medium text-sm">{mod.label}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => {
                const allChecked = mod.subMenus.every(s => selectedPermissions[`${mod.key}__${s.key}`]);
                const newPerms = { ...selectedPermissions };
                mod.subMenus.forEach(s => { newPerms[`${mod.key}__${s.key}`] = !allChecked; });
                setSelectedPermissions(newPerms);
              }}
            >
              {mod.subMenus.every(s => selectedPermissions[`${mod.key}__${s.key}`]) ? "Tout décocher" : "Tout cocher"}
            </Button>
          </div>
          <div className="ml-6 space-y-1">
            {mod.subMenus.map((sub) => {
              const permKey = `${mod.key}__${sub.key}`;
              return (
                <div key={sub.key} className="flex items-center gap-2">
                  <Checkbox
                    id={permKey}
                    checked={!!selectedPermissions[permKey]}
                    onCheckedChange={(checked) => setSelectedPermissions(prev => ({ ...prev, [permKey]: !!checked }))}
                  />
                  <label htmlFor={permKey} className="text-sm cursor-pointer">{sub.label}</label>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Profils de permissions</CardTitle>
          <CardDescription>Définissez des profils d'accès personnalisés par sous-menu</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm({ nom: "", description: "" }); setSelectedPermissions({}); } }}>
          <DialogTrigger asChild>
            <Button size="sm"><PlusCircle className="h-4 w-4 mr-1" /> Nouveau profil</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nouveau profil de permissions</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nom du profil</Label><Input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} placeholder="Ex: Technicien terrain" /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Accès limité aux saisies" /></div>
              <div>
                <Label className="mb-2 block">Permissions d'accès</Label>
                <PermissionsCheckboxes />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={!form.nom || createMutation.isPending}>Créer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : profiles.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Aucun profil créé</TableCell></TableRow>
            ) : profiles.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.nom}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{p.description || "—"}</TableCell>
                <TableCell><Badge variant="secondary">{getProfilePermCount(p.id)} accès</Badge></TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Modifier le profil</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nom du profil</Label><Input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div>
              <Label className="mb-2 block">Permissions d'accès</Label>
              <PermissionsCheckboxes />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate()} disabled={!form.nom || updateMutation.isPending}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Utilisateurs Tab ───
function UtilisateursGestionTab() {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedDomaineId, setSelectedDomaineId] = useState<string>("");

  // Fetch all profiles (users) and their roles
  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ["admin-all-users"],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, email, nom_complet")
        .order("email");
      if (pErr) throw pErr;

      // Get all user_roles
      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("*, domaines:domaine_id(nom)");
      if (rErr) throw rErr;

      // Merge: each profile with their role (if any)
      return (profiles || []).map((p: any) => {
        const userRole = (roles || []).find((r: any) => r.user_id === p.id);
        return {
          ...p,
          role: userRole?.role || null,
          domaine_id: userRole?.domaine_id || null,
          domaine_nom: (userRole?.domaines as any)?.nom || null,
          permission_profile_id: userRole?.permission_profile_id || null,
          has_role: !!userRole,
          role_id: userRole?.id || null,
        };
      });
    },
  });

  const { data: permProfiles = [] } = useQuery({
    queryKey: ["permission-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("permission_profiles").select("*").order("nom");
      if (error) throw error;
      return data;
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      if (!editUserId) return;
      const { error } = await supabase.from("user_roles").update({
        permission_profile_id: selectedProfileId || null,
      }).eq("user_id", editUserId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles-full"] });
      toast.success("Profil de permissions assigné");
      setEditOpen(false);
      setEditUserId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAssign = (userId: string, currentProfileId: string | null) => {
    setEditUserId(userId);
    setSelectedProfileId(currentProfileId || "");
    setEditOpen(true);
  };

  const getProfileName = (profileId: string | null) => {
    if (!profileId) return null;
    const p = permProfiles.find((pp: any) => pp.id === profileId);
    return p ? (p as any).nom : null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Utilisateurs & Profils d'accès</CardTitle>
        <CardDescription>Assignez un profil de permissions à chaque utilisateur</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Domaine</TableHead>
              <TableHead>Profil d'accès</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : roles.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm">{(r.profiles as any)?.email || "—"}</TableCell>
                <TableCell className="font-medium">{(r.profiles as any)?.nom_complet || "—"}</TableCell>
                <TableCell><Badge variant="outline">{roleLabels[r.role] || r.role}</Badge></TableCell>
                <TableCell>{(r.domaines as any)?.nom || "—"}</TableCell>
                <TableCell>
                  {r.permission_profile_id ? (
                    <Badge variant="secondary">{getProfileName(r.permission_profile_id) || "—"}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Accès complet</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => openAssign(r.user_id, r.permission_profile_id)}>
                    <Shield className="h-4 w-4 mr-1" /> Assigner
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditUserId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assigner un profil d'accès</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Profil de permissions</Label>
              <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                <SelectTrigger><SelectValue placeholder="Accès complet (par défaut)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Accès complet (par défaut)</SelectItem>
                  {permProfiles.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateProfileMutation.mutate()} disabled={updateProfileMutation.isPending}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function GestionUtilisateurs() {
  const { userInfo } = useAuth();

  if (userInfo.role !== "responsable_central") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Gestion des utilisateurs</h1>
      </div>
      <Tabs defaultValue="utilisateurs">
        <TabsList>
          <TabsTrigger value="utilisateurs"><UserCheck className="h-4 w-4 mr-1" /> Utilisateurs</TabsTrigger>
          <TabsTrigger value="profils"><Shield className="h-4 w-4 mr-1" /> Profils de permissions</TabsTrigger>
        </TabsList>
        <TabsContent value="utilisateurs"><UtilisateursGestionTab /></TabsContent>
        <TabsContent value="profils"><ProfilsPermissionsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
