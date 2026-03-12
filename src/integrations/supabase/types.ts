export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      campagnes: {
        Row: {
          code_campagne: string
          created_at: string | null
          date_debut: string
          date_fin: string
          id: number
          statut: string | null
        }
        Insert: {
          code_campagne: string
          created_at?: string | null
          date_debut: string
          date_fin: string
          id?: number
          statut?: string | null
        }
        Update: {
          code_campagne?: string
          created_at?: string | null
          date_debut?: string
          date_fin?: string
          id?: number
          statut?: string | null
        }
        Relationships: []
      }
      domaine_varietes: {
        Row: {
          created_at: string | null
          domaine_id: number
          id: number
          nb_arbres: number
          porte_greffe_id: number | null
          variete_id: number
        }
        Insert: {
          created_at?: string | null
          domaine_id: number
          id?: number
          nb_arbres?: number
          porte_greffe_id?: number | null
          variete_id: number
        }
        Update: {
          created_at?: string | null
          domaine_id?: number
          id?: number
          nb_arbres?: number
          porte_greffe_id?: number | null
          variete_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "domaine_varietes_domaine_id_fkey"
            columns: ["domaine_id"]
            isOneToOne: false
            referencedRelation: "domaines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domaine_varietes_porte_greffe_id_fkey"
            columns: ["porte_greffe_id"]
            isOneToOne: false
            referencedRelation: "porte_greffes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domaine_varietes_variete_id_fkey"
            columns: ["variete_id"]
            isOneToOne: false
            referencedRelation: "varietes"
            referencedColumns: ["id"]
          },
        ]
      }
      domaines: {
        Row: {
          code: string
          created_at: string | null
          id: number
          latitude: number | null
          longitude: number | null
          nom: string
          region: string
          responsable_nom: string | null
          superficie_geojson: Json | null
          superficie_ha: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          nom: string
          region: string
          responsable_nom?: string | null
          superficie_geojson?: Json | null
          superficie_ha?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          nom?: string
          region?: string
          responsable_nom?: string | null
          superficie_geojson?: Json | null
          superficie_ha?: number | null
        }
        Relationships: []
      }
      exports_historique: {
        Row: {
          created_at: string | null
          fichier_url: string | null
          filtres_appliques: Json | null
          id: number
          nb_lignes: number | null
          nom_fichier: string
          taille_fichier_kb: number | null
          type_donnees: string
          type_export: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          fichier_url?: string | null
          filtres_appliques?: Json | null
          id?: number
          nb_lignes?: number | null
          nom_fichier: string
          taille_fichier_kb?: number | null
          type_donnees?: string
          type_export?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          fichier_url?: string | null
          filtres_appliques?: Json | null
          id?: number
          nb_lignes?: number | null
          nom_fichier?: string
          taille_fichier_kb?: number | null
          type_donnees?: string
          type_export?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      observations_phenologie: {
        Row: {
          campagne_id: number
          created_at: string | null
          date_observation: string
          date_reference_cycle: string | null
          domaine_id: number
          id: number
          nb_codes_saisis: number | null
          observateur_nom: string
          user_id: string
        }
        Insert: {
          campagne_id: number
          created_at?: string | null
          date_observation: string
          date_reference_cycle?: string | null
          domaine_id: number
          id?: number
          nb_codes_saisis?: number | null
          observateur_nom: string
          user_id: string
        }
        Update: {
          campagne_id?: number
          created_at?: string | null
          date_observation?: string
          date_reference_cycle?: string | null
          domaine_id?: number
          id?: number
          nb_codes_saisis?: number | null
          observateur_nom?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "observations_phenologie_campagne_id_fkey"
            columns: ["campagne_id"]
            isOneToOne: false
            referencedRelation: "campagnes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_phenologie_domaine_id_fkey"
            columns: ["domaine_id"]
            isOneToOne: false
            referencedRelation: "domaines"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_profiles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          nom: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          nom: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          nom?: string
        }
        Relationships: []
      }
      phenologie: {
        Row: {
          alerte_chute_physio_intense: boolean | null
          alerte_cycle_anormal: boolean | null
          alerte_floraison_tardive: boolean | null
          campagne_id: number
          conditions_meteo_generales: string | null
          created_at: string | null
          date_observation: string
          domaine_id: number
          duree_chute_physio_jours: number | null
          duree_floraison_jours: number | null
          duree_totale_cycle_jours: number | null
          id: number
          notification_rappel_envoyee: boolean | null
          observateur_nom: string
          prochaine_observation_prevue: string | null
          stade_boutons_floraux_date_debut: string | null
          stade_boutons_floraux_observations: string | null
          stade_chute_petales_date_debut: string | null
          stade_chute_petales_observations: string | null
          stade_chute_physio_date_debut: string | null
          stade_chute_physio_date_fin: string | null
          stade_chute_physio_intensite: string | null
          stade_chute_physio_observations: string | null
          stade_chute_physio_taux_pct: number | null
          stade_debourrement_date_debut: string | null
          stade_debourrement_observations: string | null
          stade_debut_maturite_date: string | null
          stade_debut_maturite_observations: string | null
          stade_floraison_date_debut: string | null
          stade_floraison_date_fin: string | null
          stade_floraison_intensite: string | null
          stade_floraison_nb_fleurs_estime: number | null
          stade_floraison_observations: string | null
          stade_floraison_pct_arbres: number | null
          stade_grossissement_date_debut: string | null
          stade_grossissement_observations: string | null
          stade_maturite_recolte_date: string | null
          stade_maturite_recolte_observations: string | null
          stade_nouaison_date_debut: string | null
          stade_nouaison_observations: string | null
          stade_nouaison_taux_pct: number | null
          stade_prefloraison_date_debut: string | null
          stade_prefloraison_observations: string | null
          stade_repos_date_debut: string | null
          stade_repos_observations: string | null
          stade_veraison_date_debut: string | null
          stade_veraison_observations: string | null
          stade_veraison_pct_fruits_colores: number | null
          temperature_moyenne_periode: number | null
          updated_at: string | null
          user_id: string
          variete_id: number
        }
        Insert: {
          alerte_chute_physio_intense?: boolean | null
          alerte_cycle_anormal?: boolean | null
          alerte_floraison_tardive?: boolean | null
          campagne_id: number
          conditions_meteo_generales?: string | null
          created_at?: string | null
          date_observation: string
          domaine_id: number
          duree_chute_physio_jours?: number | null
          duree_floraison_jours?: number | null
          duree_totale_cycle_jours?: number | null
          id?: number
          notification_rappel_envoyee?: boolean | null
          observateur_nom: string
          prochaine_observation_prevue?: string | null
          stade_boutons_floraux_date_debut?: string | null
          stade_boutons_floraux_observations?: string | null
          stade_chute_petales_date_debut?: string | null
          stade_chute_petales_observations?: string | null
          stade_chute_physio_date_debut?: string | null
          stade_chute_physio_date_fin?: string | null
          stade_chute_physio_intensite?: string | null
          stade_chute_physio_observations?: string | null
          stade_chute_physio_taux_pct?: number | null
          stade_debourrement_date_debut?: string | null
          stade_debourrement_observations?: string | null
          stade_debut_maturite_date?: string | null
          stade_debut_maturite_observations?: string | null
          stade_floraison_date_debut?: string | null
          stade_floraison_date_fin?: string | null
          stade_floraison_intensite?: string | null
          stade_floraison_nb_fleurs_estime?: number | null
          stade_floraison_observations?: string | null
          stade_floraison_pct_arbres?: number | null
          stade_grossissement_date_debut?: string | null
          stade_grossissement_observations?: string | null
          stade_maturite_recolte_date?: string | null
          stade_maturite_recolte_observations?: string | null
          stade_nouaison_date_debut?: string | null
          stade_nouaison_observations?: string | null
          stade_nouaison_taux_pct?: number | null
          stade_prefloraison_date_debut?: string | null
          stade_prefloraison_observations?: string | null
          stade_repos_date_debut?: string | null
          stade_repos_observations?: string | null
          stade_veraison_date_debut?: string | null
          stade_veraison_observations?: string | null
          stade_veraison_pct_fruits_colores?: number | null
          temperature_moyenne_periode?: number | null
          updated_at?: string | null
          user_id: string
          variete_id: number
        }
        Update: {
          alerte_chute_physio_intense?: boolean | null
          alerte_cycle_anormal?: boolean | null
          alerte_floraison_tardive?: boolean | null
          campagne_id?: number
          conditions_meteo_generales?: string | null
          created_at?: string | null
          date_observation?: string
          domaine_id?: number
          duree_chute_physio_jours?: number | null
          duree_floraison_jours?: number | null
          duree_totale_cycle_jours?: number | null
          id?: number
          notification_rappel_envoyee?: boolean | null
          observateur_nom?: string
          prochaine_observation_prevue?: string | null
          stade_boutons_floraux_date_debut?: string | null
          stade_boutons_floraux_observations?: string | null
          stade_chute_petales_date_debut?: string | null
          stade_chute_petales_observations?: string | null
          stade_chute_physio_date_debut?: string | null
          stade_chute_physio_date_fin?: string | null
          stade_chute_physio_intensite?: string | null
          stade_chute_physio_observations?: string | null
          stade_chute_physio_taux_pct?: number | null
          stade_debourrement_date_debut?: string | null
          stade_debourrement_observations?: string | null
          stade_debut_maturite_date?: string | null
          stade_debut_maturite_observations?: string | null
          stade_floraison_date_debut?: string | null
          stade_floraison_date_fin?: string | null
          stade_floraison_intensite?: string | null
          stade_floraison_nb_fleurs_estime?: number | null
          stade_floraison_observations?: string | null
          stade_floraison_pct_arbres?: number | null
          stade_grossissement_date_debut?: string | null
          stade_grossissement_observations?: string | null
          stade_maturite_recolte_date?: string | null
          stade_maturite_recolte_observations?: string | null
          stade_nouaison_date_debut?: string | null
          stade_nouaison_observations?: string | null
          stade_nouaison_taux_pct?: number | null
          stade_prefloraison_date_debut?: string | null
          stade_prefloraison_observations?: string | null
          stade_repos_date_debut?: string | null
          stade_repos_observations?: string | null
          stade_veraison_date_debut?: string | null
          stade_veraison_observations?: string | null
          stade_veraison_pct_fruits_colores?: number | null
          temperature_moyenne_periode?: number | null
          updated_at?: string | null
          user_id?: string
          variete_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "phenologie_campagne_id_fkey"
            columns: ["campagne_id"]
            isOneToOne: false
            referencedRelation: "campagnes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phenologie_domaine_id_fkey"
            columns: ["domaine_id"]
            isOneToOne: false
            referencedRelation: "domaines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phenologie_variete_id_fkey"
            columns: ["variete_id"]
            isOneToOne: false
            referencedRelation: "varietes"
            referencedColumns: ["id"]
          },
        ]
      }
      phenologie_details: {
        Row: {
          created_at: string | null
          date_stade: string | null
          id: number
          observation_id: number
          observations: string | null
          photo_url: string | null
          stade_phenologique: string
          stade_precedent: string | null
          variete_id: number
        }
        Insert: {
          created_at?: string | null
          date_stade?: string | null
          id?: number
          observation_id: number
          observations?: string | null
          photo_url?: string | null
          stade_phenologique: string
          stade_precedent?: string | null
          variete_id: number
        }
        Update: {
          created_at?: string | null
          date_stade?: string | null
          id?: number
          observation_id?: number
          observations?: string | null
          photo_url?: string | null
          stade_phenologique?: string
          stade_precedent?: string | null
          variete_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "phenologie_details_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "observations_phenologie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phenologie_details_variete_id_fkey"
            columns: ["variete_id"]
            isOneToOne: false
            referencedRelation: "varietes"
            referencedColumns: ["id"]
          },
        ]
      }
      phenologie_observations: {
        Row: {
          created_at: string | null
          date_observation: string
          id: number
          notes: string | null
          observateur_nom: string
          phenologie_id: number
          stades_observes: Json | null
        }
        Insert: {
          created_at?: string | null
          date_observation: string
          id?: number
          notes?: string | null
          observateur_nom: string
          phenologie_id: number
          stades_observes?: Json | null
        }
        Update: {
          created_at?: string | null
          date_observation?: string
          id?: number
          notes?: string | null
          observateur_nom?: string
          phenologie_id?: number
          stades_observes?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "phenologie_observations_phenologie_id_fkey"
            columns: ["phenologie_id"]
            isOneToOne: false
            referencedRelation: "phenologie"
            referencedColumns: ["id"]
          },
        ]
      }
      porte_greffes: {
        Row: {
          code_pg: string
          created_at: string | null
          id: number
          nom_pg: string
        }
        Insert: {
          code_pg: string
          created_at?: string | null
          id?: number
          nom_pg: string
        }
        Update: {
          code_pg?: string
          created_at?: string | null
          id?: number
          nom_pg?: string
        }
        Relationships: []
      }
      production: {
        Row: {
          alerte_declassement_critique: boolean | null
          alerte_fruits_anormal: boolean | null
          alerte_poids_aberrant: boolean | null
          alerte_poids_critique: boolean | null
          alerte_poids_moyen_anormal: boolean | null
          arbre_inclus_calculs: boolean
          arbre_statut: string
          cal_0: number | null
          cal_1: number | null
          cal_10: number | null
          cal_11: number | null
          cal_1x_inf: number | null
          cal_1x_sup: number | null
          cal_1xx: number | null
          cal_1xxx: number | null
          cal_2: number | null
          cal_3: number | null
          cal_4: number | null
          cal_5: number | null
          cal_6: number | null
          cal_7: number | null
          cal_8: number | null
          cal_hors_calibre: number | null
          calibre_moyen_mm: number | null
          campagne_id: number
          code_arbre: string | null
          commentaires_validation: string | null
          created_at: string | null
          date_recolte: string
          domaine_id: number
          id: number
          is_offline_draft: boolean | null
          ligne_numero: number
          nb_fruits_echantillon: number | null
          nb_fruits_total: number
          niveau_alerte: string | null
          observations: string | null
          photo_legende: string | null
          photo_url: string | null
          poids_moyen_fruit_g: number | null
          poids_total_kg: number
          porte_greffe_id: number
          position_ligne: number
          qualite_globale: string | null
          recoltant_nom: string | null
          statut_validation: string | null
          taux_declassement_pct: number | null
          updated_at: string | null
          user_id: string
          variete_id: number
        }
        Insert: {
          alerte_declassement_critique?: boolean | null
          alerte_fruits_anormal?: boolean | null
          alerte_poids_aberrant?: boolean | null
          alerte_poids_critique?: boolean | null
          alerte_poids_moyen_anormal?: boolean | null
          arbre_inclus_calculs?: boolean
          arbre_statut?: string
          cal_0?: number | null
          cal_1?: number | null
          cal_10?: number | null
          cal_11?: number | null
          cal_1x_inf?: number | null
          cal_1x_sup?: number | null
          cal_1xx?: number | null
          cal_1xxx?: number | null
          cal_2?: number | null
          cal_3?: number | null
          cal_4?: number | null
          cal_5?: number | null
          cal_6?: number | null
          cal_7?: number | null
          cal_8?: number | null
          cal_hors_calibre?: number | null
          calibre_moyen_mm?: number | null
          campagne_id: number
          code_arbre?: string | null
          commentaires_validation?: string | null
          created_at?: string | null
          date_recolte: string
          domaine_id: number
          id?: number
          is_offline_draft?: boolean | null
          ligne_numero: number
          nb_fruits_echantillon?: number | null
          nb_fruits_total: number
          niveau_alerte?: string | null
          observations?: string | null
          photo_legende?: string | null
          photo_url?: string | null
          poids_moyen_fruit_g?: number | null
          poids_total_kg: number
          porte_greffe_id: number
          position_ligne: number
          qualite_globale?: string | null
          recoltant_nom?: string | null
          statut_validation?: string | null
          taux_declassement_pct?: number | null
          updated_at?: string | null
          user_id: string
          variete_id: number
        }
        Update: {
          alerte_declassement_critique?: boolean | null
          alerte_fruits_anormal?: boolean | null
          alerte_poids_aberrant?: boolean | null
          alerte_poids_critique?: boolean | null
          alerte_poids_moyen_anormal?: boolean | null
          arbre_inclus_calculs?: boolean
          arbre_statut?: string
          cal_0?: number | null
          cal_1?: number | null
          cal_10?: number | null
          cal_11?: number | null
          cal_1x_inf?: number | null
          cal_1x_sup?: number | null
          cal_1xx?: number | null
          cal_1xxx?: number | null
          cal_2?: number | null
          cal_3?: number | null
          cal_4?: number | null
          cal_5?: number | null
          cal_6?: number | null
          cal_7?: number | null
          cal_8?: number | null
          cal_hors_calibre?: number | null
          calibre_moyen_mm?: number | null
          campagne_id?: number
          code_arbre?: string | null
          commentaires_validation?: string | null
          created_at?: string | null
          date_recolte?: string
          domaine_id?: number
          id?: number
          is_offline_draft?: boolean | null
          ligne_numero?: number
          nb_fruits_echantillon?: number | null
          nb_fruits_total?: number
          niveau_alerte?: string | null
          observations?: string | null
          photo_legende?: string | null
          photo_url?: string | null
          poids_moyen_fruit_g?: number | null
          poids_total_kg?: number
          porte_greffe_id?: number
          position_ligne?: number
          qualite_globale?: string | null
          recoltant_nom?: string | null
          statut_validation?: string | null
          taux_declassement_pct?: number | null
          updated_at?: string | null
          user_id?: string
          variete_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_campagne_id_fkey"
            columns: ["campagne_id"]
            isOneToOne: false
            referencedRelation: "campagnes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_domaine_id_fkey"
            columns: ["domaine_id"]
            isOneToOne: false
            referencedRelation: "domaines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_porte_greffe_id_fkey"
            columns: ["porte_greffe_id"]
            isOneToOne: false
            referencedRelation: "porte_greffes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_variete_id_fkey"
            columns: ["variete_id"]
            isOneToOne: false
            referencedRelation: "varietes"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_permissions: {
        Row: {
          can_access: boolean | null
          id: string
          module_key: string
          profile_id: string
          submenu_key: string
        }
        Insert: {
          can_access?: boolean | null
          id?: string
          module_key: string
          profile_id: string
          submenu_key: string
        }
        Update: {
          can_access?: boolean | null
          id?: string
          module_key?: string
          profile_id?: string
          submenu_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "permission_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          nom_complet: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          nom_complet?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          nom_complet?: string | null
        }
        Relationships: []
      }
      qualite_interne: {
        Row: {
          acidite_gl: number
          alerte_brix_hors_norme: boolean | null
          alerte_ea_faible: boolean | null
          alerte_granulation_severe: boolean | null
          annee_analyse: number | null
          brix_degres: number
          campagne_id: number
          commentaires_validation: string | null
          created_at: string | null
          date_analyse: string
          domaine_id: number
          granulation_legere: string | null
          granulation_severe: string | null
          id: number
          is_offline_draft: boolean | null
          maturite_optimale: boolean | null
          mois_analyse: number | null
          moyenne_fermete_fruit_kg_cm2: number | null
          moyenne_fermete_peau_kg_cm2: number | null
          moyenne_pepins_par_fruit: number | null
          nb_fruits_avec_pepins: number | null
          nb_fruits_echantillon: number
          nb_pepins_echantillon_total: number | null
          observations: string | null
          pct_jus: number | null
          photo_fruits_coupes_url: string | null
          photo_legende: string | null
          poids_jus_g: number | null
          porte_greffe_id: number
          ratio_ea: number | null
          statut_validation: string | null
          technicien_nom: string
          updated_at: string | null
          user_id: string
          variete_id: number
          volume_jus_ml: number | null
          volume_naoh_ml: number | null
        }
        Insert: {
          acidite_gl: number
          alerte_brix_hors_norme?: boolean | null
          alerte_ea_faible?: boolean | null
          alerte_granulation_severe?: boolean | null
          annee_analyse?: number | null
          brix_degres: number
          campagne_id: number
          commentaires_validation?: string | null
          created_at?: string | null
          date_analyse: string
          domaine_id: number
          granulation_legere?: string | null
          granulation_severe?: string | null
          id?: number
          is_offline_draft?: boolean | null
          maturite_optimale?: boolean | null
          mois_analyse?: number | null
          moyenne_fermete_fruit_kg_cm2?: number | null
          moyenne_fermete_peau_kg_cm2?: number | null
          moyenne_pepins_par_fruit?: number | null
          nb_fruits_avec_pepins?: number | null
          nb_fruits_echantillon?: number
          nb_pepins_echantillon_total?: number | null
          observations?: string | null
          pct_jus?: number | null
          photo_fruits_coupes_url?: string | null
          photo_legende?: string | null
          poids_jus_g?: number | null
          porte_greffe_id: number
          ratio_ea?: number | null
          statut_validation?: string | null
          technicien_nom: string
          updated_at?: string | null
          user_id: string
          variete_id: number
          volume_jus_ml?: number | null
          volume_naoh_ml?: number | null
        }
        Update: {
          acidite_gl?: number
          alerte_brix_hors_norme?: boolean | null
          alerte_ea_faible?: boolean | null
          alerte_granulation_severe?: boolean | null
          annee_analyse?: number | null
          brix_degres?: number
          campagne_id?: number
          commentaires_validation?: string | null
          created_at?: string | null
          date_analyse?: string
          domaine_id?: number
          granulation_legere?: string | null
          granulation_severe?: string | null
          id?: number
          is_offline_draft?: boolean | null
          maturite_optimale?: boolean | null
          mois_analyse?: number | null
          moyenne_fermete_fruit_kg_cm2?: number | null
          moyenne_fermete_peau_kg_cm2?: number | null
          moyenne_pepins_par_fruit?: number | null
          nb_fruits_avec_pepins?: number | null
          nb_fruits_echantillon?: number
          nb_pepins_echantillon_total?: number | null
          observations?: string | null
          pct_jus?: number | null
          photo_fruits_coupes_url?: string | null
          photo_legende?: string | null
          poids_jus_g?: number | null
          porte_greffe_id?: number
          ratio_ea?: number | null
          statut_validation?: string | null
          technicien_nom?: string
          updated_at?: string | null
          user_id?: string
          variete_id?: number
          volume_jus_ml?: number | null
          volume_naoh_ml?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qualite_interne_campagne_id_fkey"
            columns: ["campagne_id"]
            isOneToOne: false
            referencedRelation: "campagnes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualite_interne_domaine_id_fkey"
            columns: ["domaine_id"]
            isOneToOne: false
            referencedRelation: "domaines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualite_interne_porte_greffe_id_fkey"
            columns: ["porte_greffe_id"]
            isOneToOne: false
            referencedRelation: "porte_greffes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualite_interne_variete_id_fkey"
            columns: ["variete_id"]
            isOneToOne: false
            referencedRelation: "varietes"
            referencedColumns: ["id"]
          },
        ]
      }
      rappels_phenologie: {
        Row: {
          campagne_id: number
          derniere_observation: string | null
          domaine_id: number
          id: number
          notification_envoyee: boolean | null
          prochaine_observation_due: string | null
        }
        Insert: {
          campagne_id: number
          derniere_observation?: string | null
          domaine_id: number
          id?: number
          notification_envoyee?: boolean | null
          prochaine_observation_due?: string | null
        }
        Update: {
          campagne_id?: number
          derniere_observation?: string | null
          domaine_id?: number
          id?: number
          notification_envoyee?: boolean | null
          prochaine_observation_due?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rappels_phenologie_campagne_id_fkey"
            columns: ["campagne_id"]
            isOneToOne: false
            referencedRelation: "campagnes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rappels_phenologie_domaine_id_fkey"
            columns: ["domaine_id"]
            isOneToOne: false
            referencedRelation: "domaines"
            referencedColumns: ["id"]
          },
        ]
      }
      rapports_automatiques: {
        Row: {
          actif: boolean | null
          created_at: string | null
          dernier_envoi: string | null
          domaine_id: number | null
          frequence_cron: string | null
          id: number
          nom_rapport: string
          prochain_envoi: string | null
          template_rapport: Json | null
          type_rapport: string
          user_destinataire: string | null
        }
        Insert: {
          actif?: boolean | null
          created_at?: string | null
          dernier_envoi?: string | null
          domaine_id?: number | null
          frequence_cron?: string | null
          id?: number
          nom_rapport: string
          prochain_envoi?: string | null
          template_rapport?: Json | null
          type_rapport?: string
          user_destinataire?: string | null
        }
        Update: {
          actif?: boolean | null
          created_at?: string | null
          dernier_envoi?: string | null
          domaine_id?: number | null
          frequence_cron?: string | null
          id?: number
          nom_rapport?: string
          prochain_envoi?: string | null
          template_rapport?: Json | null
          type_rapport?: string
          user_destinataire?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rapports_automatiques_domaine_id_fkey"
            columns: ["domaine_id"]
            isOneToOne: false
            referencedRelation: "domaines"
            referencedColumns: ["id"]
          },
        ]
      }
      seuils_qualite: {
        Row: {
          code_variete: string
          created_at: string | null
          declassement_acceptable: number | null
          declassement_critique: number | null
          fruits_max: number | null
          fruits_min: number | null
          id: number
          poids_critique: number | null
          poids_max: number | null
          poids_min: number | null
          poids_moy_max: number | null
          poids_moy_min: number | null
          poids_moy_optimal_max: number | null
          poids_moy_optimal_min: number | null
          poids_optimal_max: number | null
          poids_optimal_min: number | null
        }
        Insert: {
          code_variete: string
          created_at?: string | null
          declassement_acceptable?: number | null
          declassement_critique?: number | null
          fruits_max?: number | null
          fruits_min?: number | null
          id?: number
          poids_critique?: number | null
          poids_max?: number | null
          poids_min?: number | null
          poids_moy_max?: number | null
          poids_moy_min?: number | null
          poids_moy_optimal_max?: number | null
          poids_moy_optimal_min?: number | null
          poids_optimal_max?: number | null
          poids_optimal_min?: number | null
        }
        Update: {
          code_variete?: string
          created_at?: string | null
          declassement_acceptable?: number | null
          declassement_critique?: number | null
          fruits_max?: number | null
          fruits_min?: number | null
          id?: number
          poids_critique?: number | null
          poids_max?: number | null
          poids_min?: number | null
          poids_moy_max?: number | null
          poids_moy_min?: number | null
          poids_moy_optimal_max?: number | null
          poids_moy_optimal_min?: number | null
          poids_optimal_max?: number | null
          poids_optimal_min?: number | null
        }
        Relationships: []
      }
      types_varietes: {
        Row: {
          couleur_badge: string | null
          created_at: string | null
          id: number
          type_code: string
          type_nom: string
        }
        Insert: {
          couleur_badge?: string | null
          created_at?: string | null
          id?: number
          type_code: string
          type_nom: string
        }
        Update: {
          couleur_badge?: string | null
          created_at?: string | null
          id?: number
          type_code?: string
          type_nom?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          domaine_id: number | null
          id: string
          permission_profile_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          domaine_id?: number | null
          id?: string
          permission_profile_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          domaine_id?: number | null
          id?: string
          permission_profile_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_domaine_id_fkey"
            columns: ["domaine_id"]
            isOneToOne: false
            referencedRelation: "domaines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_permission_profile_id_fkey"
            columns: ["permission_profile_id"]
            isOneToOne: false
            referencedRelation: "permission_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      varietes: {
        Row: {
          code_variete: string
          created_at: string | null
          id: number
          nom_commercial: string | null
          statut: string | null
          type_id: number | null
        }
        Insert: {
          code_variete: string
          created_at?: string | null
          id?: number
          nom_commercial?: string | null
          statut?: string | null
          type_id?: number | null
        }
        Update: {
          code_variete?: string
          created_at?: string | null
          id?: number
          nom_commercial?: string | null
          statut?: string | null
          type_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "varietes_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "types_varietes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_domaine_id: { Args: { _user_id: string }; Returns: number }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "responsable_domaine" | "responsable_central" | "direction"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["responsable_domaine", "responsable_central", "direction"],
    },
  },
} as const
