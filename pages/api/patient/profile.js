import { supabase, supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get the user's access token from the request headers
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  try {
    // Verify the user's session
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Use supabaseAdmin to bypass RLS
    const { data: patient, error: patientError } = await supabaseAdmin
      .from('patients')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (patientError) {
      // If no patient profile exists, return 404 but don't error out
      if (patientError.code === 'PGRST116') {
         return res.status(404).json({ error: 'Patient profile not found' });
      }
      throw patientError;
    }

    return res.status(200).json(patient);

  } catch (error) {
    console.error('Error fetching patient profile:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
