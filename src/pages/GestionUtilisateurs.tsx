import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, refApi } from "@/services/api";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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

// ─── Utilisateurs Tab ────────────────────────────────────────────────────────
function UtilisateursGestionTab() {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedDomaineId, setSelectedDomaineId] = useState<string>("");

  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ["admin-all-users"],
    queryFn: () => adminApi.listUsers(),
  });

  const { data: domaines = [] } = useQuery({
    queryKey: ["domaines-list"],
    queryFn: () => refApi.domaines(),
  });

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!editUserId || !selectedRole) return;
      await adminApi.updateUser(editUserId, {
        role: selectedRole,
        domaineId: selectedDomaineId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-users"] });
      toast.success("Droits mis à jour");
      setEditOpen(false);
      setEditUserId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-users"] });
      toast.success("Utilisateur supprimé");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAssign = (user: any) => {
    setEditUserId(user.id);
    const topRole = user.userRoles?.[0];
    setSelectedRole(topRole?.role || "");
    setSelectedDomaineId(user.domaine?.id || "");
    setEditOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Utilisateurs & Profils d'accès</CardTitle>
        <CardDescription>Assignez un rôle à chaque utilisateur</CardDescription>
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
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : (
              allUsers.map((u: any) => {
                const topRole = u.userRoles?.[0];
                return (
                  <TableRow key={u.id} className={!topRole ? "bg-destructive/5" : ""}>
                    <TableCell className="text-sm">{u.email || "—"}</TableCell>
                    <TableCell className="font-medium">{u.nomComplet || "—"}</TableCell>
                    <TableCell>
                      {topRole ? (
                        <Badge variant="outline">{roleLabels[topRole.role] || topRole.role}</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          Aucun rôle
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{u.domaine?.nom || "—"}</TableCell>
                    <TableCell className="flex gap-1">
                      <Button
                        variant={topRole ? "ghost" : "default"}
                        size="sm"
                        onClick={() => openAssign(u)}
                      >
                        <Shield className="h-4 w-4 mr-1" />
                        {topRole ? "Modifier" : "Activer"}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action est irréversible. L'utilisateur{" "}
                              <strong>{u.email}</strong> sera définitivement supprimé.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteUserMutation.mutate(u.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditUserId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurer l'accès utilisateur</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Rôle</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="responsable_domaine">Responsable Domaine</SelectItem>
                  <SelectItem value="responsable_central">Responsable Central</SelectItem>
                  <SelectItem value="direction">Direction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedRole === "responsable_domaine" && (
              <div>
                <Label>Domaine</Label>
                <Select value={selectedDomaineId} onValueChange={setSelectedDomaineId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un domaine" />
                  </SelectTrigger>
                  <SelectContent>
                    {domaines.map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => updateUserMutation.mutate()}
              disabled={!selectedRole || updateUserMutation.isPending}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Permissions Tab ──────────────────────────────────────────────────────────
function PermissionsTab() {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState<string>("");
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, boolean>>({});

  const { data: allUsers = [] } = useQuery({
    queryKey: ["admin-all-users"],
    queryFn: () => adminApi.listUsers(),
  });

  const openEdit = async (user: any) => {
    setEditUserId(user.id);
    setEditUserName(user.nomComplet || user.email);
    const perms = await adminApi.getPermissions(user.id);
    const map: Record<string, boolean> = {};
    perms.forEach((p: any) => { map[p.menuKey] = p.canView; });
    setSelectedPermissions(map);
    setEditOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editUserId) return;
      const permissions = APP_MODULES.flatMap((mod) =>
        mod.subMenus.map((sub) => ({
          menuKey: `${mod.key}__${sub.key}`,
          canView: !!selectedPermissions[`${mod.key}__${sub.key}`],
          canCreate: !!selectedPermissions[`${mod.key}__${sub.key}`],
          canEdit: !!selectedPermissions[`${mod.key}__${sub.key}`],
          canDelete: false,
        }))
      );
      await adminApi.setPermissions(editUserId, permissions);
    },
    onSuccess: () => {
      toast.success("Permissions mises à jour");
      setEditOpen(false);
      setEditUserId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
                const allChecked = mod.subMenus.every(
                  (s) => selectedPermissions[`${mod.key}__${s.key}`]
                );
                const newPerms = { ...selectedPermissions };
                mod.subMenus.forEach((s) => {
                  newPerms[`${mod.key}__${s.key}`] = !allChecked;
                });
                setSelectedPermissions(newPerms);
              }}
            >
              {mod.subMenus.every((s) => selectedPermissions[`${mod.key}__${s.key}`])
                ? "Tout décocher"
                : "Tout cocher"}
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
                    onCheckedChange={(checked) =>
                      setSelectedPermissions((prev) => ({ ...prev, [permKey]: !!checked }))
                    }
                  />
                  <label htmlFor={permKey} className="text-sm cursor-pointer">
                    {sub.label}
                  </label>
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
      <CardHeader>
        <CardTitle className="text-lg">Permissions par utilisateur</CardTitle>
        <CardDescription>Définissez l'accès aux sous-menus pour chaque utilisateur</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allUsers.map((u: any) => {
              const topRole = u.userRoles?.[0];
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nomComplet || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    {topRole && (
                      <Badge variant="outline">{roleLabels[topRole.role] || topRole.role}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                      <Pencil className="h-4 w-4 mr-1" /> Configurer
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditUserId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Permissions — {editUserName}</DialogTitle>
          </DialogHeader>
          <PermissionsCheckboxes />
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
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
          <TabsTrigger value="utilisateurs">
            <UserCheck className="h-4 w-4 mr-1" /> Utilisateurs
          </TabsTrigger>
          <TabsTrigger value="permissions">
            <Shield className="h-4 w-4 mr-1" /> Permissions
          </TabsTrigger>
        </TabsList>
        <TabsContent value="utilisateurs">
          <UtilisateursGestionTab />
        </TabsContent>
        <TabsContent value="permissions">
          <PermissionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
