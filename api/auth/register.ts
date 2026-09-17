import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

interface RequestWithBody extends IncomingMessage {
  body?: unknown;
}

interface JsonServerResponse extends ServerResponse {
  json: (data: unknown) => JsonServerResponse;
  status: (statusCode: number) => JsonServerResponse;
}

export default async function handler(
  req: RequestWithBody,
  res: JsonServerResponse
) {
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
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Record<string, string> | undefined;
    const email = body?.email;
    const password = body?.password;

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

          // Ensure profile exists using upsert
          const { error: profError } = await supabaseAdmin.from('profiles').upsert(
            {
              id: existing.id,
              user_id: existing.id,
              display_name: email.split('@')[0],
              tracking_key: existing.id,
            },
            { onConflict: 'id' }
          );

          if (profError) {
            console.warn('Profile upsert notice for existing user:', profError.message);
          }

          return res.status(200).json({ success: true, message: 'User updated and confirmed' });
        }
      }

      return res.status(400).json({ error: createError.message });
    }

    // 2. Ensure profile exists for the newly created user using upsert
    if (createdUser?.user) {
      const { error: profError } = await supabaseAdmin.from('profiles').upsert(
        {
          id: createdUser.user.id,
          user_id: createdUser.user.id,
          display_name: email.split('@')[0],
          tracking_key: createdUser.user.id,
        },
        { onConflict: 'id' }
      );

      if (profError) {
        console.warn('Profile upsert notice for new user:', profError.message);
      }
    }

    return res.status(200).json({ success: true, user: createdUser?.user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration error';
    return res.status(500).json({ error: message });
  }
}

