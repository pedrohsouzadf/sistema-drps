import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(500).json({
      error:
        'Variável de ambiente SUPABASE_SERVICE_ROLE_KEY não configurada. ' +
        'Adicione-a ao .env (local) ou às variáveis de ambiente da Vercel.',
    });
  }

  const { userId } = req.body ?? {};
  if (!userId) {
    return res.status(400).json({ error: 'userId é obrigatório' });
  }

  const supabaseAdmin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Remove o perfil explicitamente (garante limpeza mesmo sem CASCADE no FK)
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    // Remove o usuário do Auth — impede qualquer novo login
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(400).json({ error: error.message ?? 'Erro desconhecido' });
  }
}
