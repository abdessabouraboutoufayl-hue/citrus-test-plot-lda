import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Citrus } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Citrus className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Réinitialisation</CardTitle>
          <CardDescription>
            La réinitialisation de mot de passe par lien n'est pas disponible dans cette version. Contactez votre administrateur pour changer votre mot de passe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => navigate("/login")}>
            Retour à la connexion
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
