import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GUEST_EMAIL = 'invite@domaines.co.ma';
const GUEST_PASSWORD = 'Invite-Demo-2026!';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Try to find existing guest user
    const { data: list } = await admin.auth.admin.listUsers();
    let guest = list?.users?.find((u) => u.email === GUEST_EMAIL);

    if (!guest) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: GUEST_EMAIL,
        password: GUEST_PASSWORD,
        email_confirm: true,
        user_metadata: { nom_complet: 'Compte Invité' },
      });
      if (createErr) throw createErr;
      guest = created.user!;
    } else {
      // Ensure password is in sync (in case it was rotated)
      await admin.auth.admin.updateUserById(guest.id, { password: GUEST_PASSWORD, email_confirm: true });
    }

    // Ensure profile exists
    await admin.from('profiles').upsert({ id: guest.id, email: GUEST_EMAIL, nom_complet: 'Compte Invité' });

    // Ensure direction role
    const { data: existingRole } = await admin
      .from('user_roles')
      .select('id')
      .eq('user_id', guest.id)
      .eq('role', 'direction')
      .maybeSingle();
    if (!existingRole) {
      await admin.from('user_roles').insert({ user_id: guest.id, role: 'direction' });
    }

    return new Response(
      JSON.stringify({ email: GUEST_EMAIL, password: GUEST_PASSWORD }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
