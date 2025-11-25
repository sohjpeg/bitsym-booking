import { supabase, supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
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

    if (req.method === 'PATCH') {
      return handlePatch(req, res, user);
    }

    // Use supabaseAdmin to bypass RLS
    // 1. Get the doctor's ID
    const { data: doctor, error: doctorError } = await supabaseAdmin
      .from('doctors')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (doctorError || !doctor) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    // 2. Build the appointments query
    const { filter } = req.query;
    let query = supabaseAdmin
      .from('appointments')
      .select(`
        *,
        patient:patients(
          id,
          date_of_birth,
          user:users(full_name, email)
        )
      `)
      .eq('doctor_id', doctor.id);

    // Apply filters matching the dashboard logic
    const today = new Date().toISOString().split('T')[0];

    if (filter === 'today') {
      query = query.eq('appointment_date', today);
    } else if (filter === 'upcoming') {
      query = query.gte('appointment_date', today);
    } else if (filter === 'pending') {
      query = query.eq('status', 'pending');
    }

    query = query.order('appointment_date', { ascending: true })
                 .order('appointment_time', { ascending: true });

    const { data: appointments, error: appointmentsError } = await query;

    if (appointmentsError) {
      throw appointmentsError;
    }

    return res.status(200).json(appointments);

  } catch (error) {
    console.error('Error fetching appointments:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handlePatch(req, res, user) {
  const { id, status } = req.body;

  if (!id || !status) {
    return res.status(400).json({ error: 'Missing required fields: id, status' });
  }

  // Verify the doctor owns this appointment
  // 1. Get doctor ID
  const { data: doctor, error: doctorError } = await supabaseAdmin
    .from('doctors')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (doctorError || !doctor) {
    return res.status(404).json({ error: 'Doctor profile not found' });
  }

  // 2. Update the appointment
  const { data, error } = await supabaseAdmin
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .eq('doctor_id', doctor.id) // Ensure doctor owns the appointment
    .select()
    .single();

  if (error) {
    console.error('Error updating appointment:', error);
    return res.status(500).json({ error: 'Failed to update appointment', details: error.message });
  }

  return res.status(200).json(data);
}
