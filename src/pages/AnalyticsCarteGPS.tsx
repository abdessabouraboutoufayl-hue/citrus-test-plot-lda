import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const MOROCCO_CENTER: [number, number] = [33.9, -6.9];
const DEFAULT_COORDS: Record<string, [number, number]> = {
  "Ain Chaib": [34.05, -2.15],
  "Behja": [34.68, -1.91],
  "Triffa": [34.95, -2.35],
  "Ouargha": [34.45, -4.30],
  "Ouled Gnaou": [33.88, -6.35],
};

export default function AnalyticsCarteGPS() {
  const { userInfo } = useAuth();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polygonsRef = useRef<L.GeoJSON[]>([]);
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

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current).setView(MOROCCO_CENTER, 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  const markers = useMemo(() => {
    return domaines.filter(d => selectedDomaines.includes(d.id)).map(d => {
      const lat = (d as any).latitude || DEFAULT_COORDS[d.nom]?.[0] || MOROCCO_CENTER[0];
      const lng = (d as any).longitude || DEFAULT_COORDS[d.nom]?.[1] || MOROCCO_CENTER[1];
      const dProds = productions.filter(p => p.domaine_id === d.id);
      const dQuals = qualites.filter(q => q.domaine_id === d.id);
      const totalProd = dProds.reduce((s, p) => s + (p.poids_total_kg || 0), 0);
      const avgEA = dQuals.length ? dQuals.reduce((s, q) => s + (q.ratio_ea || 0), 0) / dQuals.length : 0;
      const qualAB = dProds.length ? (dProds.filter(p => p.qualite_globale === "A" || p.qualite_globale === "B").length / dProds.length) * 100 : 0;

      let color = "#EF4444";
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

  // Update markers and polygons on map
  useEffect(() => {
    if (!mapRef.current) return;
    // Remove old markers & polygons
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    polygonsRef.current.forEach(p => p.remove());
    polygonsRef.current = [];

    // Draw polygons for domaines with superficie_geojson
    domaines.filter(d => selectedDomaines.includes(d.id)).forEach(d => {
      const geojson = (d as any).superficie_geojson;
      if (geojson) {
        try {
          const layer = L.geoJSON(geojson, {
            style: { color: "#22C55E", weight: 2, fillOpacity: 0.15, fillColor: "#22C55E" },
          });
          layer.addTo(mapRef.current!);
          polygonsRef.current.push(layer);
        } catch (e) { /* skip invalid */ }
      }
    });

    markers.forEach(m => {
      const icon = L.divIcon({
        html: `<div style="background:${m.color};width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:14px;">🍊</div>`,
        iconSize: [28, 28],
        className: "",
      });
      const marker = L.marker([m.lat, m.lng], { icon }).addTo(mapRef.current!);
      marker.bindPopup(`
        <div style="min-width:200px;font-family:system-ui;">
          <h3 style="margin:0 0 8px;font-size:16px;font-weight:700;">${m.nom}</h3>
          <hr style="margin:4px 0;border-color:#eee;">
          <p style="margin:4px 0;">🌳 Arbres : <strong>${m.nbArbres}</strong></p>
          <p style="margin:4px 0;">📦 Production : <strong>${m.totalProd.toFixed(1)} kg</strong></p>
          <p style="margin:4px 0;">⭐ E/A moyen : <strong>${m.avgEA.toFixed(1)}</strong></p>
          <p style="margin:4px 0;">✅ Qualité A+B : <strong>${m.qualAB.toFixed(0)}%</strong></p>
          <p style="margin:4px 0;">🔬 Analyses : <strong>${m.nbAnalyses}</strong></p>
        </div>
      `);
      markersRef.current.push(marker);
    });

    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      // Extend bounds with polygon bounds
      polygonsRef.current.forEach(p => bounds.extend(p.getBounds()));
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }, [markers, domaines, selectedDomaines]);

  const toggleDomaine = (id: number) => {
    setSelectedDomaines(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Carte GPS Parcelles</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
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
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: "#22C55E" }} />{colorMode === "production" ? ">50 kg" : "E/A ≥12"}</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: "#EAB308" }} />{colorMode === "production" ? "20-50 kg" : "E/A 10-12"}</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: "#EF4444" }} />{colorMode === "production" ? "<20 kg" : "E/A <10"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 h-[500px] rounded-lg overflow-hidden border">
          <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />
        </div>
      </div>
    </div>
  );
}
