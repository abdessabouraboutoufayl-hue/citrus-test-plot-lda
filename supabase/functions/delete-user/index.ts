import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller is a responsable_central
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await supabaseClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller has responsable_central role
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "responsable_central")
      .maybeSingle();

    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-deletion
    if (user_id === caller.id) {
      return new Response(JSON.stringify({ error: "Vous ne pouvez pas supprimer votre propre compte" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete all related data to avoid FK constraint violations
    await supabaseAdmin.from("notifications").delete().eq("user_id", user_id);
    await supabaseAdmin.from("exports_historique").delete().eq("user_id", user_id);
    await supabaseAdmin.from("rapports_automatiques").delete().eq("user_destinataire", user_id);
    
    // Delete phenologie-related data
    const { data: obsIds } = await supabaseAdmin
      .from("observations_phenologie")
      .select("id")
      .eq("user_id", user_id);
    if (obsIds && obsIds.length > 0) {
      const ids = obsIds.map(o => o.id);
      await supabaseAdmin.from("phenologie_details").delete().in("observation_id", ids);
      await supabaseAdmin.from("observations_phenologie").delete().eq("user_id", user_id);
    }

    // Delete phenologie observations linked via phenologie table
    const { data: phenoIds } = await supabaseAdmin
      .from("phenologie")
      .select("id")
      .eq("user_id", user_id);
    if (phenoIds && phenoIds.length > 0) {
      const ids = phenoIds.map(p => p.id);
      await supabaseAdmin.from("phenologie_observations").delete().in("phenologie_id", ids);
    }
    await supabaseAdmin.from("phenologie").delete().eq("user_id", user_id);

    await supabaseAdmin.from("qualite_interne").delete().eq("user_id", user_id);
    await supabaseAdmin.from("production").delete().eq("user_id", user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", user_id);
    
    // Delete auth user
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
