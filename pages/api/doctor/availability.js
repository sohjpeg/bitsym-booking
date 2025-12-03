import { supabase, supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  // Check authentication
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Get doctor ID using admin client to ensure we can find it regardless of RLS
  const { data: doctor, error: doctorError } = await supabaseAdmin
    .from('doctors')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (doctorError || !doctor) {
    return res.status(404).json({ error: 'Doctor profile not found' });
  }

  if (req.method === 'GET') {
    try {
      const { data: availability, error } = await supabaseAdmin
        .from('doctor_availability')
        .select('*')
        .eq('doctor_id', doctor.id)
        .eq('is_active', true);

      if (error) throw error;

      return res.status(200).json(availability);
    } catch (error) {
      console.error('Error fetching availability:', error);
      return res.status(500).json({ error: 'Failed to fetch availability' });
    }
  } else if (req.method === 'POST') {
    try {
      const { schedule } = req.body; // Array of { day_of_week, start_time, end_time, is_active }

      if (!Array.isArray(schedule)) {
        return res.status(400).json({ error: 'Invalid schedule format' });
      }

      // We'll use a transaction-like approach: delete existing for this doctor and insert new
      // Or upsert if we want to be cleaner. Let's try upserting day by day.
      
      const updates = schedule.map(slot => ({
        doctor_id: doctor.id,
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
        is_active: slot.is_active
      }));

      const { data, error } = await supabaseAdmin
        .from('doctor_availability')
        .upsert(updates, { onConflict: 'doctor_id, day_of_week' })
        .select();

      if (error) throw error;

      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Error updating availability:', error);
      return res.status(500).json({ error: 'Failed to update availability' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
