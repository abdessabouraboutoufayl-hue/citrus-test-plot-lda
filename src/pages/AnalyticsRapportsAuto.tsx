import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function AnalyticsRapportsAuto() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Rapports Automatiques</h1>
      <Card>
        <CardContent className="py-16 text-center space-y-3">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">
            La fonctionnalité de rapports automatiques sera disponible dans une prochaine version.
          </p>
          <p className="text-xs text-muted-foreground">
            Contactez votre administrateur pour configurer des rapports personnalisés.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
