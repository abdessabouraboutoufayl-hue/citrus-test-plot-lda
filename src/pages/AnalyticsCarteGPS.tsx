import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Layers, Download } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Morocco center coordinates
const MOROCCO_CENTER: [number, number] = [33.9, -6.9];
const DEFAULT_COORDS: Record<string, [number, number]> = {
  "Ain Chaib": [34.05, -2.15],
  "Behja": [34.68, -1.91],
  "Triffa": [34.95, -2.35],
  "Ouargha": [34.45, -4.30],
  "Ouled Gnaou": [33.88, -6.35],
};

function createIcon(color: string) {
  return L.divIcon({
    html: `<div style="background:${color};width:24px;height:24px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:12px;">🍊</div>`,
    iconSize: [24, 24],
    className: "",
  });
}

export default function AnalyticsCarteGPS() {
  const { userInfo } = useAuth();
  const [colorMode, setColorMode] = useState<"production" | "qualite">("production");
  const [selectedDomaines, setSelectedDomaines] = useState<number[]>([]);

  const { data: domaines = [] } = useQuery({
    queryKey: ["gps-domaines"],
    queryFn: async () => { const { data } = await supabase.from("domaines").select("*"); return data || []; },
  });

  const { data: productions = [] } = useQuery({
    queryKey: ["gps-productions"],
    queryFn: async () => {
      const { data } = await supabase.from("production").select("*, varietes(code_variete, type_id), porte_greffes(code_pg), domaines(nom)");
      return data || [];
    },
  });

  const { data: qualites = [] } = useQuery({
    queryKey: ["gps-qualites"],
    queryFn: async () => {
      const { data } = await supabase.from("qualite_interne").select("*, varietes(code_variete), domaines(nom)");
      return data || [];
    },
  });

  useEffect(() => {
    if (domaines.length > 0 && selectedDomaines.length === 0) {
      if (userInfo.role === "responsable_domaine" && userInfo.domaineId) {
        setSelectedDomaines([userInfo.domaineId]);
      } else {
        setSelectedDomaines(domaines.map(d => d.id));
      }
    }
  }, [domaines, userInfo]);

  const markers = useMemo(() => {
    return domaines.filter(d => selectedDomaines.includes(d.id)).map(d => {
      const lat = d.latitude || DEFAULT_COORDS[d.nom]?.[0] || MOROCCO_CENTER[0];
      const lng = d.longitude || DEFAULT_COORDS[d.nom]?.[1] || MOROCCO_CENTER[1];
      const dProds = productions.filter(p => p.domaine_id === d.id);
      const dQuals = qualites.filter(q => q.domaine_id === d.id);
      const totalProd = dProds.reduce((s, p) => s + (p.poids_total_kg || 0), 0);
      const avgEA = dQuals.length ? dQuals.reduce((s, q) => s + (q.ratio_ea || 0), 0) / dQuals.length : 0;
      const qualAB = dProds.length ? (dProds.filter(p => p.qualite_globale === "A" || p.qualite_globale === "B").length / dProds.length) * 100 : 0;

      let color = "#EF4444"; // red
      if (colorMode === "production") {
        if (totalProd > 50) color = "#22C55E";
        else if (totalProd > 20) color = "#EAB308";
      } else {
        if (avgEA >= 12) color = "#22C55E";
        else if (avgEA >= 10) color = "#EAB308";
      }

      return { id: d.id, nom: d.nom, lat, lng, totalProd, avgEA, qualAB, nbArbres: dProds.length, nbAnalyses: dQuals.length, color };
    });
  }, [domaines, selectedDomaines, productions, qualites, colorMode]);

  const toggleDomaine = (id: number) => {
    setSelectedDomaines(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Carte GPS Parcelles</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Filtres</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Domaines</p>
              {domaines.map(d => (
                <label key={d.id} className="flex items-center gap-2 text-sm mb-1 cursor-pointer">
                  <Checkbox checked={selectedDomaines.includes(d.id)} onCheckedChange={() => toggleDomaine(d.id)} />
                  {d.nom}
                </label>
              ))}
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Code couleur</p>
              <Select value={colorMode} onValueChange={(v) => setColorMode(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Par production (kg)</SelectItem>
                  <SelectItem value="qualite">Par E/A</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Légende</p>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500" />{colorMode === "production" ? ">50 kg" : "E/A ≥12"}</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-500" />{colorMode === "production" ? "20-50 kg" : "E/A 10-12"}</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500" />{colorMode === "production" ? "<20 kg" : "E/A <10"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Map */}
        <div className="lg:col-span-3 h-[500px] rounded-lg overflow-hidden border">
          <MapContainer center={MOROCCO_CENTER} zoom={6} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {markers.map(m => (
              <Marker key={m.id} position={[m.lat, m.lng]} icon={createIcon(m.color)}>
                <Popup>
                  <div className="text-sm space-y-1 min-w-[200px]">
                    <p className="font-bold text-base">{m.nom}</p>
                    <hr />
                    <p>🌳 Arbres récoltés : <strong>{m.nbArbres}</strong></p>
                    <p>📦 Production : <strong>{m.totalProd.toFixed(1)} kg</strong></p>
                    <p>⭐ E/A moyen : <strong>{m.avgEA.toFixed(1)}</strong></p>
                    <p>✅ Qualité A+B : <strong>{m.qualAB.toFixed(0)}%</strong></p>
                    <p>🔬 Analyses : <strong>{m.nbAnalyses}</strong></p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
