import { supabase, supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Use admin client to bypass RLS for public doctor listing
    const dbClient = supabaseAdmin || supabase;

    // 1. Fetch all doctors with their user profile
    const { data: doctors, error: doctorsError } = await dbClient
      .from('doctors')
      .select(`
        id,
        specialty,
        user:users!inner(full_name, email)
      `);

    if (doctorsError) throw doctorsError;

    // 2. Fetch availability for all doctors
    const { data: availability, error: availabilityError } = await dbClient
      .from('doctor_availability')
      .select('*')
      .eq('is_active', true);

    if (availabilityError) throw availabilityError;

    // 3. Combine data
    const doctorsWithSchedule = doctors.map(doc => {
      const docSchedule = availability.filter(a => a.doctor_id === doc.id);
      
      // Sort schedule by day of week
      const daysOrder = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 7 };
      docSchedule.sort((a, b) => daysOrder[a.day_of_week] - daysOrder[b.day_of_week]);

      return {
        id: doc.id,
        name: doc.user.full_name,
        specialty: doc.specialty,
        email: doc.user.email,
        schedule: docSchedule.map(s => ({
          day: s.day_of_week,
          start: s.start_time.slice(0, 5), // HH:MM
          end: s.end_time.slice(0, 5)     // HH:MM
        }))
      };
    });

    return res.status(200).json(doctorsWithSchedule);

  } catch (error) {
    console.error('Error fetching doctors availability:', error);
    return res.status(500).json({ error: 'Failed to fetch doctors data' });
  }
}
