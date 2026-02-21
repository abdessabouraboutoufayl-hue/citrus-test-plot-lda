import Dexie, { type EntityTable } from "dexie";

export interface OfflineProduction {
  id?: number;
  domaine_id: number;
  campagne_id: number;
  variete_id: number;
  porte_greffe_id: number;
  ligne_numero: number;
  position_ligne: number;
  code_arbre: string;
  date_recolte: string;
  poids_total_kg: number;
  nb_fruits_total: number;
  calibre_moyen_mm?: number;
  taux_declassement_pct?: number;
  qualite_globale?: string;
  photo_blob?: Blob;
  photo_legende?: string;
  recoltant_nom?: string;
  observations?: string;
  statut_validation: string;
  user_id: string;
  synced: boolean;
  created_at: string;
}

const db = new Dexie("RDVarietalDB") as Dexie & {
  offlineProductions: EntityTable<OfflineProduction, "id">;
};

db.version(1).stores({
  offlineProductions: "++id, synced, user_id",
});

export { db };
