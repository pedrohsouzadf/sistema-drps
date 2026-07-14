import { createClient } from '@supabase/supabase-js';

// Chaves que estarão configuradas na Vercel
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Chave secreta (Admin)

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, full_name, role, empresa_id } = req.body;

  try {
    // 1. Criar o usuário no Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (authError) throw authError;

    // 2. Criar o perfil vinculado à empresa
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authUser.user.id,
        full_name,
        role,
        empresa_id: role === 'psicologo' ? null : empresa_id
      });

    if (profileError) throw profileError;

    return res.status(200).json({ success: true, userId: authUser.user.id });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
}
