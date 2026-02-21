import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";

interface DrawSuperficieDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domaineName: string;
  latitude: number | null;
  longitude: number | null;
  existingGeoJSON: any | null;
  onSave: (geojson: any, superficieHa: number) => void;
}

function computeAreaHa(latlngs: L.LatLng[]): number {
  // Spherical excess approximation for area in m²
  let sum = 0;
  for (let i = 0; i < latlngs.length; i++) {
    const j = (i + 1) % latlngs.length;
    sum += (latlngs[j].lng - latlngs[i].lng) * (2 + Math.sin(latlngs[i].lat * Math.PI / 180) + Math.sin(latlngs[j].lat * Math.PI / 180));
  }
  const earthRadius = 6378137;
  const areaM2 = Math.abs(sum * earthRadius * earthRadius / 2) * Math.PI * Math.PI / (180 * 180);
  return areaM2 / 10000; // hectares
}

export default function DrawSuperficieDialog({
  open, onOpenChange, domaineName, latitude, longitude, existingGeoJSON, onSave
}: DrawSuperficieDialogProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const [currentGeoJSON, setCurrentGeoJSON] = useState<any>(null);
  const [areaHa, setAreaHa] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      return;
    }

    // Small delay to let dialog render
    const timer = setTimeout(() => {
      if (!mapContainerRef.current || mapRef.current) return;

      const center: [number, number] = [
        latitude || 33.9,
        longitude || -6.9,
      ];

      const map = L.map(mapContainerRef.current).setView(center, latitude ? 14 : 6);
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Esri",
        maxZoom: 19,
      }).addTo(map);

      // Labels overlay
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
      }).addTo(map);

      const drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);
      drawnItemsRef.current = drawnItems;

      // Load existing polygon
      if (existingGeoJSON) {
        try {
          const geoLayer = L.geoJSON(existingGeoJSON, {
            style: { color: "#22C55E", weight: 3, fillOpacity: 0.2 }
          });
          geoLayer.eachLayer((layer) => drawnItems.addLayer(layer));
          map.fitBounds(drawnItems.getBounds(), { padding: [30, 30] });
          
          // Compute area from existing
          geoLayer.eachLayer((layer: any) => {
            if (layer.getLatLngs) {
              const latlngs = layer.getLatLngs()[0];
              setAreaHa(computeAreaHa(latlngs));
            }
          });
          setCurrentGeoJSON(existingGeoJSON);
        } catch (e) {
          console.error("Error loading GeoJSON", e);
        }
      }

      const drawControl = new (L.Control as any).Draw({
        position: "topright",
        draw: {
          polygon: {
            allowIntersection: false,
            shapeOptions: { color: "#22C55E", weight: 3, fillOpacity: 0.2 },
          },
          polyline: false,
          rectangle: {
            shapeOptions: { color: "#22C55E", weight: 3, fillOpacity: 0.2 },
          },
          circle: false,
          circlemarker: false,
          marker: false,
        },
        edit: {
          featureGroup: drawnItems,
          remove: true,
        },
      });
      map.addControl(drawControl);

      map.on((L as any).Draw.Event.CREATED, (e: any) => {
        drawnItems.clearLayers();
        drawnItems.addLayer(e.layer);
        const geojson = drawnItems.toGeoJSON();
        setCurrentGeoJSON(geojson);
        
        const latlngs = e.layer.getLatLngs()[0];
        setAreaHa(computeAreaHa(latlngs));
      });

      map.on((L as any).Draw.Event.EDITED, () => {
        const geojson = drawnItems.toGeoJSON();
        setCurrentGeoJSON(geojson);
        
        drawnItems.eachLayer((layer: any) => {
          if (layer.getLatLngs) {
            const latlngs = layer.getLatLngs()[0];
            setAreaHa(computeAreaHa(latlngs));
          }
        });
      });

      map.on((L as any).Draw.Event.DELETED, () => {
        const geojson = drawnItems.toGeoJSON();
        if ((geojson as any).features?.length === 0) {
          setCurrentGeoJSON(null);
          setAreaHa(0);
        } else {
          setCurrentGeoJSON(geojson);
        }
      });

      mapRef.current = map;

      // Fix map size
      setTimeout(() => map.invalidateSize(), 200);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [open, latitude, longitude, existingGeoJSON]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !mapRef.current) return;
    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      );
      const results = await response.json();
      if (results.length > 0) {
        const { lat, lon, boundingbox } = results[0];
        if (boundingbox) {
          mapRef.current.fitBounds([
            [parseFloat(boundingbox[0]), parseFloat(boundingbox[2])],
            [parseFloat(boundingbox[1]), parseFloat(boundingbox[3])],
          ]);
        } else {
          mapRef.current.setView([parseFloat(lat), parseFloat(lon)], 16);
        }
      } else {
        // No results found
      }
    } catch (e) {
      console.error("Search error", e);
    } finally {
      setSearching(false);
    }
  };

  const handleSave = () => {
    if (currentGeoJSON) {
      onSave(currentGeoJSON, Math.round(areaHa * 100) / 100);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Tracer la superficie — {domaineName}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un lieu (ex: Berkane, Maroc)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={handleSearch} disabled={searching}>
            {searching ? "..." : "Rechercher"}
          </Button>
        </div>
        <div className="flex-1 relative rounded-lg overflow-hidden border">
          <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {areaHa > 0 ? `Superficie estimée : ${areaHa.toFixed(2)} ha` : "Dessinez un polygone sur la carte"}
          </p>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!currentGeoJSON}>
              Enregistrer
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
