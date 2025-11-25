/**
 * Appointment Booking Route - Supabase Integration
 * 
 * Accepts: Structured appointment data from Groq interpretation
 * Returns: Database-backed booking confirmation
 * 
 * Flow:
 * 1. Receive extracted appointment JSON
 * 2. Find matching doctor by name or specialty
 * 3. Check for scheduling conflicts
 * 4. Store appointment in Supabase
 * 5. Create notification for doctor
 * 6. Return booking confirmation
 */

import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const appointmentData = req.body;

    // Validate appointment data
    if (!appointmentData || typeof appointmentData !== 'object') {
      return res.status(400).json({ error: 'Invalid appointment data' });
    }

    const { doctor, speciality, date, time, patientId } = appointmentData;

    if (!doctor || !date || !time || !patientId) {
      return res.status(400).json({ 
        error: 'Missing required fields: doctor, date, time, patientId' 
      });
    }

    // Find the doctor by name or specialty
    const searchTerm = doctor || speciality || '';
    let doctors = [];

    try {
      // 1. Search by specialty
      const { data: specialtyDoctors, error: specialtyError } = await supabase
        .from('doctors')
        .select(`
          id,
          user_id,
          specialty,
          user:users!inner(full_name)
        `)
        .ilike('specialty', `%${searchTerm}%`);

      if (specialtyError) throw specialtyError;

      // 2. Search by name (via users table first)
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id')
        .ilike('full_name', `%${searchTerm}%`);

      if (userError) throw userError;

      let nameDoctors = [];
      if (users && users.length > 0) {
        const userIds = users.map(u => u.id);
        const { data: nd, error: ndError } = await supabase
          .from('doctors')
          .select(`
            id,
            user_id,
            specialty,
            user:users!inner(full_name)
          `)
          .in('user_id', userIds);

        if (ndError) throw ndError;
        nameDoctors = nd || [];
      }

      // Combine results
      const allDoctors = [...(specialtyDoctors || []), ...nameDoctors];

      // Deduplicate by ID
      doctors = Array.from(new Map(allDoctors.map(item => [item.id, item])).values());

    } catch (error) {
      console.error('Doctor query error:', error);
      return res.status(500).json({ error: 'Failed to find doctor' });
    }

    if (!doctors || doctors.length === 0) {
      return res.status(404).json({ 
        error: 'No doctor found matching the criteria',
        details: `No doctor found for: ${searchTerm}`
      });
    }

    const selectedDoctor = doctors[0];

    // Check for scheduling conflicts
    const { data: existingAppointments, error: conflictError } = await supabase
      .from('appointments')
      .select('id')
      .eq('doctor_id', selectedDoctor.id)
      .eq('appointment_date', date)
      .eq('appointment_time', time)
      .in('status', ['pending', 'confirmed']);

    if (conflictError) {
      console.error('Conflict check error:', conflictError);
    }

    if (existingAppointments && existingAppointments.length > 0) {
      return res.status(409).json({ 
        error: 'Time slot not available',
        message: 'This doctor already has an appointment at the selected time'
      });
    }

    // Create the appointment
    const { data: appointment, error: insertError } = await supabase
      .from('appointments')
      .insert([
        {
          patient_id: patientId,
          doctor_id: selectedDoctor.id,
          appointment_date: date,
          appointment_time: time,
          reason: appointmentData.reason || null,
          status: 'pending',
          booking_method: 'voice',
        },
      ])
      .select(`
        *,
        doctor:doctors(
          id,
          specialty,
          user:users(full_name, email)
        ),
        patient:patients(
          id,
          user:users(full_name, email)
        )
      `)
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return res.status(500).json({ 
        error: 'Failed to create appointment',
        details: insertError.message 
      });
    }

    // Create notification for the doctor
    await supabase
      .from('notifications')
      .insert([
        {
          user_id: selectedDoctor.user_id,
          type: 'new_appointment',
          title: 'New Appointment Request',
          message: `New appointment request from ${appointment.patient?.user?.full_name} for ${date} at ${time}`,
          related_id: appointment.id,
        },
      ]);

    // Log appointment details
    console.log('\n========================================');
    console.log('📅 NEW APPOINTMENT BOOKED');
    console.log('========================================');
    console.log('Booking ID:', appointment.id);
    console.log('Doctor:', appointment.doctor?.user?.full_name);
    console.log('Specialty:', appointment.doctor?.specialty);
    console.log('Patient:', appointment.patient?.user?.full_name);
    console.log('Date:', appointment.appointment_date);
    console.log('Time:', appointment.appointment_time);
    console.log('Status:', appointment.status);
    console.log('Method:', appointment.booking_method);
    console.log('========================================\n');

    // Return success response
    return res.status(200).json({
      success: true,
      message: '✅ Appointment booked successfully! The doctor will confirm shortly.',
      appointment: {
        bookingId: appointment.id,
        doctor: appointment.doctor?.user?.full_name,
        speciality: appointment.doctor?.specialty,
        date: appointment.appointment_date,
        time: appointment.appointment_time,
        status: appointment.status,
        bookingMethod: 'voice',
      },
    });

  } catch (error) {
    console.error('Booking error:', error.message);
    
    return res.status(500).json({
      error: 'Booking failed',
      details: error.message,
    });
  }
}
