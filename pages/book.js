import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from "next/head";
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import styles from "@/styles/Home.module.css";
import Calendar from './components/Calendar';

export default function BookAppointment() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading, signOut } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [bookingResult, setBookingResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [patientId, setPatientId] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Request microphone permissions on component mount
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => console.log('Microphone access granted'))
        .catch((err) => {
          setError('Microphone access denied. Please enable microphone permissions.');
          console.error('Microphone error:', err);
        });
    }
  }, []);

  // Fetch patient ID when user is available
  useEffect(() => {
    const checkPatientId = async () => {
      if (userProfile?.patient_id) {
        console.log('Using pre-loaded patient ID:', userProfile.patient_id);
        setPatientId(userProfile.patient_id);
        setError(null);
        return;
      }

      // Only attempt to fetch/create if we have a user but no patient_id in profile
      if (user && userProfile && !userProfile.patient_id) {
        try {
          console.log('Patient ID missing in profile, attempting to find/create...');
          const { data, error } = await supabase
            .from('patients')
            .select('id')
            .eq('user_id', user.id)
            .single();

          if (data) {
            console.log('Patient ID found (fallback):', data.id);
            setPatientId(data.id);
            setError(null);
          } else {
            console.warn('No patient record found for user');
            // Auto-create patient profile
            await createPatientProfile();
          }
        } catch (err) {
          console.error('Error:', err);
          setError('Failed to load patient information. Try clicking "Fix Profile" below.');
        }
      }
    };

    checkPatientId();
  }, [user, userProfile]);

  // Create patient profile if missing
  const createPatientProfile = async () => {
    try {
      console.log('Creating patient profile for user:', user.id);
      
      // Try to insert directly using Supabase
      const { data: newPatient, error: insertError } = await supabase
        .from('patients')
        .insert([{ user_id: user.id }])
        .select()
        .single();

      if (insertError) {
        console.error('Direct insert failed:', insertError);
        // Fall back to API endpoint
        const response = await axios.post('/api/fix-patient-profile', { userId: user.id });
        if (response.data.success) {
          setPatientId(response.data.patientId);
          setError(null);
          console.log('Patient profile created via API:', response.data.patientId);
        }
      } else {
        setPatientId(newPatient.id);
        setError(null);
        console.log('Patient profile created directly:', newPatient.id);
      }
    } catch (err) {
      console.error('Failed to create patient profile:', err);
      setError('Could not create patient profile. Please refresh the page or contact support.');
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.main}>
          <p className={styles.loading}>Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!user) {
    return null;
  }

  const startRecording = async () => {
    try {
      setError(null);
      setTranscription('');
      setExtractedData(null);
      setBookingResult(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Use webm codec for better compatibility
      const options = { mimeType: 'audio/webm' };
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      setError('Failed to start recording: ' + err.message);
      console.error('Recording error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob) => {
    setIsProcessing(true);
    setError(null);

    try {
      // Step 1: Transcribe audio using Whisper API
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const transcribeResponse = await axios.post('/api/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const transcribedText = transcribeResponse.data.text;
      setTranscription(transcribedText);

      // Step 2: Extract structured data using DeepSeek R1
      const interpretResponse = await axios.post('/api/interpret', {
        text: transcribedText,
      });

      const extractedJson = interpretResponse.data;
      setExtractedData(extractedJson);

      // Step 3: Book the appointment
      // Fetch patientId if not already loaded
      let currentPatientId = patientId;
      if (!currentPatientId) {
        console.log('Fetching patient ID before booking...');
        const { data, error: fetchError } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (fetchError || !data) {
          // Try to auto-create the patient profile directly
          console.log('Patient not found, attempting to create...');
          const { data: newPatient, error: createError } = await supabase
            .from('patients')
            .insert([{ user_id: user.id }])
            .select()
            .single();
          
          if (createError || !newPatient) {
            console.error('Failed to create patient profile:', createError);
            throw new Error('Could not create patient profile. Please refresh the page and try again.');
          }
          
          currentPatientId = newPatient.id;
          setPatientId(currentPatientId);
          console.log('Patient profile created:', currentPatientId);
        } else {
          currentPatientId = data.id;
          setPatientId(currentPatientId);
        }
      }

      const bookingPayload = {
        ...extractedJson,
        patientId: currentPatientId,
      };

      const bookResponse = await axios.post('/api/book', bookingPayload);
      setBookingResult(bookResponse.data);

    } catch (err) {
      setError('Processing error: ' + (err.response?.data?.error || err.message));
      console.error('Processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Head>
        <title>Speech-to-Appointment Booking</title>
        <meta name="description" content="Book appointments using voice commands" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div className={styles.container}>
        <main className={styles.main}>
          <h1 className={styles.title}>
            🎤 Voice Appointment Booking
          </h1>

          {userProfile && (
            <div className={styles.welcomeBox}>
              <div className={styles.welcomeContent}>
                <span>👋 Welcome, {userProfile.full_name}!</span>
                {userProfile.role === 'patient' && patientId && (
                  <span className={styles.patientBadge}>Patient ID: {patientId}</span>
                )}
              </div>
              <div className={styles.welcomeActions}>
                <button 
                  onClick={() => router.push('/patient/dashboard')} 
                  className={styles.dashboardLink}
                >
                  View Dashboard →
                </button>
                <button 
                  onClick={signOut} 
                  className={styles.logoutButton}
                >
                  Logout
                </button>
              </div>
            </div>
          )}

          <p className={styles.description}>
            Click the button below and say something like:<br />
            <em>"I want to book an appointment with Dr. Smith for next Tuesday at 2 PM"</em>
          </p>

          <div className={styles.controls}>
            {!isRecording ? (
              <button 
                onClick={startRecording} 
                className={styles.startButton}
                disabled={isProcessing}
              >
                🎙️ Start Recording
              </button>
            ) : (
              <button 
                onClick={stopRecording} 
                className={styles.stopButton}
              >
                ⏹️ Stop Recording
              </button>
            )}
          </div>

          {!patientId && !error && (
            <p className={styles.warning}>
              ⚠️ Loading patient information...
            </p>
          )}

          {error && (error.includes('patient profile') || error.includes('Patient profile')) && (
            <div className={styles.errorActions}>
              <p className={styles.errorHelp}>
                📝 Need to set up your profile first
              </p>
              <button 
                onClick={createPatientProfile} 
                className={styles.fixButton}
                disabled={isProcessing}
              >
                🔧 Create Profile Now
              </button>
              <p className={styles.errorNote}>
                If this doesn't work, see <code>FIX_PATIENT_PROFILE.md</code> in your project folder
              </p>
            </div>
          )}

          {isRecording && (
            <div className={styles.recordingIndicator}>
              <span className={styles.pulse}></span>
              Recording...
            </div>
          )}

          {isProcessing && (
            <div className={styles.processing}>
              Processing your request...
            </div>
          )}

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          {transcription && (
            <div className={styles.section}>
              <h2>Transcription</h2>
              <textarea 
                className={styles.textarea}
                value={transcription}
                readOnly
                rows={4}
              />
            </div>
          )}

          {extractedData && (
            <div className={styles.section}>
              <h2>Extracted Data</h2>
              <pre className={styles.json}>
                {JSON.stringify(extractedData, null, 2)}
              </pre>
            </div>
          )}

          {bookingResult && (
            <div className={styles.section}>
              <h2>Booking Confirmation</h2>
              <div className={styles.success}>
                {bookingResult.message}
              </div>
              <Calendar bookingData={bookingResult} />
            </div>
          )}
        </main>
      </div>
    </>
  );
}
