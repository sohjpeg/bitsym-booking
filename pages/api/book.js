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

import { supabase, supabaseAdmin } from '../../lib/supabase';
import axios from 'axios';

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
    const searchTerm = doctor || speciality || 'unknown';
    let doctors = [];

    // Use supabaseAdmin to bypass RLS if available
    const dbClient = supabaseAdmin || supabase;

    try {

      if (doctor) {
        // LLM-based fuzzy matching for doctor name
        console.log(`Attempting LLM match for doctor: "${doctor}"`);

        // 1. Fetch all doctors from the database
        const { data: allDoctorsDB, error: fetchError } = await dbClient
          .from('doctors')
          .select(`
            id,
            user_id,
            specialty,
            user:users!inner(full_name)
          `);

        if (fetchError) {
          console.error('Error fetching doctors:', fetchError);
          throw fetchError;
        }

        console.log(`Fetched ${allDoctorsDB?.length || 0} doctors from DB`);

        if (!allDoctorsDB || allDoctorsDB.length === 0) {
          console.log('No doctors found in database.');
        } else {
          // 2. Prepare list for LLM
          const doctorList = allDoctorsDB.map(d => ({
            id: d.id,
            name: d.user.full_name,
            specialty: d.specialty
          }));

          // 3. Call Groq API for matching
          const groqApiKey = process.env.GROQ_API_KEY;
          if (!groqApiKey) {
            throw new Error('GROQ_API_KEY not configured');
          }

          const systemPrompt = `You are an intelligent fuzzy matching assistant. Match the user's input name to one of the doctors in the database.
          
Database Doctors:
${JSON.stringify(doctorList, null, 2)}

Instructions:
1. Find the doctor whose name is the closest match to the User Input.
2. Handle:
   - Titles (e.g., "Dr." vs "Dr", "Doctor")
   - Typos (e.g., "Sohaib" vs "Saheb")
   - Phonetic similarities
   - Partial names
3. Return JSON ONLY:
{
  "match_id": "uuid of the matched doctor or null",
  "confidence": 0.0-1.0 (score of the match)
}
`;

          const userPrompt = `User Input: "${doctor}"`;

          const groqResponse = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
              model: 'llama-3.3-70b-versatile',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              temperature: 0.1, // Low temp for precision
              response_format: { type: 'json_object' }
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqApiKey}`
              }
            }
          );

          const aiResponse = groqResponse.data.choices[0].message.content;
          console.log('Groq matching response:', aiResponse);

          let matchResult;
          try {
             matchResult = JSON.parse(aiResponse);
          } catch (e) {
             const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
             if (jsonMatch) matchResult = JSON.parse(jsonMatch[0]);
          }

          if (matchResult && matchResult.match_id && matchResult.confidence > 0.6) {
             const matchedDoctor = allDoctorsDB.find(d => d.id === matchResult.match_id);
             if (matchedDoctor) {
               doctors = [matchedDoctor];
               console.log(`LLM matched "${doctor}" to "${matchedDoctor.user.full_name}" (Confidence: ${matchResult.confidence})`);
             }
          } else {
             console.log('LLM could not find a confident match.');
          }
        }
      } 
      
      // Fallback: If no doctor found by name (or name not provided), try specialty
      if (doctors.length === 0 && speciality) {
        console.log(`Searching by specialty: "${speciality}"`);
        const { data: specialtyDoctors, error: specialtyError } = await supabase
          .from('doctors')
          .select(`
            id,
            user_id,
            specialty,
            user:users!inner(full_name)
          `)
          .ilike('specialty', `%${speciality}%`);

        if (specialtyError) throw specialtyError;
        doctors = specialtyDoctors || [];
      }

    } catch (error) {
      console.error('Doctor query error:', error);
      return res.status(500).json({ 
        error: 'Failed to find doctor',
        details: error.message,
        stack: error.stack // Temporary for debugging
      });
    }

    if (!doctors || doctors.length === 0) {
      return res.status(404).json({ 
        error: 'No doctor found matching the criteria',
        details: `No doctor found for: ${searchTerm}`
      });
    }

    const selectedDoctor = doctors[0];

    // Check for scheduling conflicts
    const { data: existingAppointments, error: conflictError } = await dbClient
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
    const { data: appointment, error: insertError } = await dbClient
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
    await dbClient
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
