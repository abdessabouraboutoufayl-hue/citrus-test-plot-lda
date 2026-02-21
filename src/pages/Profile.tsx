import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut } from "lucide-react";

const roleLabels: Record<string, string> = {
  responsable_domaine: "Responsable Domaine",
  responsable_central: "Responsable Central",
  direction: "Direction",
};

export default function Profile() {
  const { userInfo, user, signOut } = useAuth();

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Mon profil</h1>
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{user?.email}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Rôle</p>
            <Badge>{userInfo.role ? roleLabels[userInfo.role] || userInfo.role : "Non assigné"}</Badge>
          </div>
          {userInfo.nomComplet && (
            <div>
              <p className="text-sm text-muted-foreground">Nom</p>
              <p className="font-medium">{userInfo.nomComplet}</p>
            </div>
          )}
          <Button variant="destructive" onClick={signOut} className="w-full mt-4">
            <LogOut className="h-4 w-4 mr-2" /> Déconnexion
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
