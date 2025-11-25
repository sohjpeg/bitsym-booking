// API endpoint to fix missing patient profiles
// Call this if you get "Could not find patient profile" error

import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Admin client not configured' });
    }

    // Check if user exists
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('User lookup error:', userError);
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if patient record already exists
    const { data: existingPatient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingPatient) {
      return res.status(200).json({ 
        success: true, 
        message: 'Patient profile already exists',
        patientId: existingPatient.id 
      });
    }

    // Create patient record using admin client (bypasses RLS)
    const { data: newPatient, error: insertError } = await supabaseAdmin
      .from('patients')
      .insert([{ user_id: userId }])
      .select()
      .single();

    if (insertError) {
      console.error('Error creating patient record:', insertError);
      return res.status(500).json({ error: 'Failed to create patient profile: ' + insertError.message });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Patient profile created successfully',
      patientId: newPatient.id 
    });

  } catch (error) {
    console.error('Fix patient profile error:', error);
    return res.status(500).json({ error: error.message });
  }
}
