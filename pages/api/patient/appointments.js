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

    // Use supabaseAdmin to bypass RLS
    // 1. Get the patient's ID
    const { data: patient, error: patientError } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    // 2. Fetch appointments with doctor details
    const { data: appointments, error: appointmentsError } = await supabaseAdmin
      .from('appointments')
      .select(`
        *,
        doctor:doctors(
          id,
          specialty,
          user:users(full_name, email)
        )
      `)
      .eq('patient_id', patient.id)
      .order('appointment_date', { ascending: true });

    if (appointmentsError) {
      throw appointmentsError;
    }

    return res.status(200).json(appointments);

  } catch (error) {
    console.error('Error fetching appointments:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
