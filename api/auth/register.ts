import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email, password } = body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const supabaseUrl =
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      'https://qtgbuacxiuntczeaqlqi.supabase.co';

    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      '';

    if (!serviceKey) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required' });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Create or confirm user directly with email_confirm: true (no email sending, no rate limit)
    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: email.split('@')[0] },
    });

    if (createError) {
      // If user already exists, update their email_confirm and password so they can log in
      if (
        createError.message?.toLowerCase().includes('already') ||
        createError.message?.toLowerCase().includes('exists')
      ) {
        // Find the user id
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existing = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

        if (existing) {
          await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            email_confirm: true,
            password: password,
          });

          // Ensure profile exists
          const { data: prof } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('user_id', existing.id)
            .maybeSingle();

          if (!prof) {
            await supabaseAdmin.from('profiles').insert({
              user_id: existing.id,
              display_name: email.split('@')[0],
            });
          }

          return res.status(200).json({ success: true, message: 'User updated and confirmed' });
        }
      }

      return res.status(400).json({ error: createError.message });
    }

    // 2. Ensure profile exists for the newly created user
    if (createdUser?.user) {
      await supabaseAdmin.from('profiles').insert({
        user_id: createdUser.user.id,
        display_name: email.split('@')[0],
      });
    }

    return res.status(200).json({ success: true, user: createdUser?.user });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Registration error' });
  }
}
