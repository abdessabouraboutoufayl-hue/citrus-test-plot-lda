import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldAlert, LogOut } from "lucide-react";

export default function NoAccess() {
  const { signOut, userInfo } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl">Accès non autorisé</CardTitle>
          <CardDescription className="text-base mt-2">
            Votre compte a été créé avec succès, mais aucun droit d'accès ne vous a encore été attribué.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Veuillez contacter votre administrateur pour qu'il vous attribue les droits nécessaires.
          </p>
          {userInfo.email && (
            <p className="text-xs text-muted-foreground">
              Connecté en tant que : <span className="font-medium text-foreground">{userInfo.email}</span>
            </p>
          )}
          <Button variant="outline" onClick={() => signOut()} className="w-full">
            <LogOut className="h-4 w-4 mr-2" /> Se déconnecter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
