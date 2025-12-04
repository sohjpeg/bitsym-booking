import { supabase, supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { doctorId, doctorName, date } = req.query;

    if (!doctorId && !doctorName) {
      return res.status(400).json({ error: 'Missing doctorId or doctorName' });
    }

    let targetDoctorId = doctorId;

    // Use admin client for all DB operations to avoid RLS recursion/permission issues
    const dbClient = supabaseAdmin || supabase;

    // If doctorId is not provided, try to find the doctor by name
    if (!targetDoctorId && doctorName) {
      // Clean up the doctor name (remove "Dr." prefix, trim)
      const cleanName = doctorName.replace(/^Dr\.?\s+/i, '').trim();

      // Search by the full cleaned name to avoid false positives (e.g., "Smith Smith" matching "Sarah Smith")
      const { data: doctors, error: searchError } = await dbClient
        .from('doctors')
        .select('id, user:users!inner(full_name)')
        .ilike('user.full_name', `%${cleanName}%`)
        .limit(1);

      if (searchError) {
        console.error('Doctor search error:', searchError);
      }

      if (doctors && doctors.length > 0) {
        targetDoctorId = doctors[0].id;
      } else {
        // If simple search fails, we could try more complex logic here or just return unavailable
        return res.status(200).json({
          available: false,
          message: `Could not find a doctor named "${doctorName}"`,
          slots: []
        });
      }
    }

    // If no date is provided, return the full weekly schedule
    if (!date) {
      const { data: fullSchedule, error: scheduleError } = await dbClient
        .from('doctor_availability')
        .select('*')
        .eq('doctor_id', targetDoctorId)
        .eq('is_active', true);

      if (scheduleError) {
        console.error('Error fetching full schedule:', scheduleError);
        // Fallback to basic response if schedule fetch fails
        return res.status(200).json({ 
          available: true, 
          doctorId: targetDoctorId,
          message: 'Doctor found',
          schedule: []
        });
      }

      return res.status(200).json({ 
        available: true, 
        doctorId: targetDoctorId,
        message: 'Doctor found',
        schedule: fullSchedule
      });
    }

    // 1. Get the day of the week (e.g., 'Monday')
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.toLocaleDateString('en-US', { weekday: 'long' });

    // 2. Fetch doctor's schedule for that day
    const { data: schedule, error: scheduleError } = await dbClient
      .from('doctor_availability')
      .select('*')
      .eq('doctor_id', targetDoctorId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .single();

    if (scheduleError && scheduleError.code !== 'PGRST116') { // PGRST116 is "no rows found"
      throw scheduleError;
    }

    if (!schedule) {
      return res.status(200).json({ 
        available: false, 
        reason: 'day_inactive',
        schedule: null,
        message: `Doctor is not available on ${dayOfWeek}s`,
        slots: [] 
      });
    }

    // 3. Generate all possible slots
    const slots = [];
    const [startHour, startMinute] = schedule.start_time.split(':').map(Number);
    const [endHour, endMinute] = schedule.end_time.split(':').map(Number);
    
    // Parse duration (assuming '30 minutes' format or similar, defaulting to 30)
    const durationMinutes = 30; 

    let current = new Date(targetDate);
    current.setHours(startHour, startMinute, 0, 0);

    const end = new Date(targetDate);
    end.setHours(endHour, endMinute, 0, 0);

    while (current < end) {
      // Use consistent HH:MM format (24-hour)
      const hours = String(current.getHours()).padStart(2, '0');
      const minutes = String(current.getMinutes()).padStart(2, '0');
      const timeString = `${hours}:${minutes}`;
      
      slots.push({
        time: timeString,
        available: true
      });

      current.setMinutes(current.getMinutes() + durationMinutes);
    }

    // 4. Fetch existing appointments to mark busy slots
    const { data: appointments, error: aptError } = await dbClient
      .from('appointments')
      .select('appointment_time')
      .eq('doctor_id', targetDoctorId)
      .eq('appointment_date', date)
      .in('status', ['pending', 'confirmed']);

    if (aptError) throw aptError;

    // 5. Mark busy slots - ensure consistent format comparison
    const bookedTimes = new Set(
      appointments.map(a => {
        // Normalize the appointment time to HH:MM format
        const time = a.appointment_time;
        if (time.includes(':')) {
          return time.slice(0, 5); // Get HH:MM from HH:MM:SS
        }
        return time;
      })
    );

    const finalSlots = slots.map(slot => ({
      ...slot,
      available: !bookedTimes.has(slot.time)
    }));

    // Check if the specific requested time is available
    let timeAvailable = true;
    let reason = null;

    if (slots.length > 0) {
      // Check if requested time is within bounds
      // We need to check if the requested time (if provided) is in the generated slots list
      // But the client might be asking for "8pm" which isn't in the list if the doc closes at 5pm
      // So we rely on the client to check the 'available' flag for specific slots, 
      // but here we can provide the schedule context for the LLM.
    }

    return res.status(200).json({
      available: true,
      day: dayOfWeek,
      schedule: {
        start: schedule.start_time,
        end: schedule.end_time
      },
      slots: finalSlots
    });

  } catch (error) {
    console.error('Availability check error:', error);
    return res.status(500).json({ error: 'Failed to check availability' });
  }
}
