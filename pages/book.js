import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from "next/head";
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Calendar from './components/Calendar';
import { Mic, User, Copy, LogOut, LayoutDashboard, Keyboard, Activity, CheckCircle, AlertCircle } from 'lucide-react';

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
  const [showCopied, setShowCopied] = useState(false);
  const [inputMode, setInputMode] = useState('voice'); // 'voice' or 'text'
  const [textInput, setTextInput] = useState('');

  
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
        setPatientId(userProfile.patient_id);
        setError(null);
        return;
      }

      if (user && userProfile && !userProfile.patient_id) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const { data, error } = await supabase
            .from('patients')
            .select('id')
            .eq('user_id', user.id)
            .single()
            .abortSignal(controller.signal);
            
          clearTimeout(timeoutId);

          if (data) {
            setPatientId(data.id);
            setError(null);
          } else {
            await createPatientProfile();
          }
        } catch (err) {
          console.error('Error fetching patient ID:', err);
          if (err.name === 'AbortError') {
             setError('Loading timed out. Please refresh the page.');
          } else {
             setError('Failed to load patient information. Try clicking "Fix Profile" below.');
          }
        }
      }
    };

    checkPatientId();
  }, [user, userProfile]);

  const createPatientProfile = async () => {
    try {
      const { data: newPatient, error: insertError } = await supabase
        .from('patients')
        .insert([{ user_id: user.id }])
        .select()
        .single();

      if (insertError) {
        const response = await axios.post('/api/fix-patient-profile', { userId: user.id });
        if (response.data.success) {
          setPatientId(response.data.patientId);
          setError(null);
        }
      } else {
        setPatientId(newPatient.id);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to create patient profile:', err);
      setError('Could not create patient profile. Please refresh the page or contact support.');
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      setTranscription('');
      setExtractedData(null);
      setBookingResult(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      setError('Failed to start recording: ' + err.message);
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
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const transcribeResponse = await axios.post('/api/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const transcribedText = transcribeResponse.data.text;
      setTranscription(transcribedText);

      const interpretResponse = await axios.post('/api/interpret', {
        text: transcribedText,
      });

      const extractedJson = interpretResponse.data;
      setExtractedData(extractedJson);

      let currentPatientId = patientId;
      if (!currentPatientId) {
        const { data } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (!data) {
          const { data: newPatient } = await supabase
            .from('patients')
            .insert([{ user_id: user.id }])
            .select()
            .single();
          currentPatientId = newPatient.id;
          setPatientId(currentPatientId);
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
    } finally {
      setIsProcessing(false);
    }
  };

  const processText = async (text) => {
    setIsProcessing(true);
    setError(null);
    setTranscription(text);

    try {
      const interpretResponse = await axios.post('/api/interpret', {
        text: text,
      });

      const extractedJson = interpretResponse.data;
      setExtractedData(extractedJson);

      let currentPatientId = patientId;
      if (!currentPatientId) {
        const { data } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (!data) {
          const { data: newPatient } = await supabase
            .from('patients')
            .insert([{ user_id: user.id }])
            .select()
            .single();
          currentPatientId = newPatient.id;
          setPatientId(currentPatientId);
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
    } finally {
      setIsProcessing(false);
    }
  };

  const copyPatientId = () => {
    if (patientId) {
      navigator.clipboard.writeText(patientId);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  };

  const maskPatientId = (id) => {
    if (!id) return 'Loading...';
    return `••••${id.slice(-5)}`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <Head>
        <title>Voice Appointment Booking | Patient Portal</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                <Activity size={20} />
              </div>
              <h1 className="text-xl font-semibold text-slate-800 tracking-tight">MedBook</h1>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center gap-8">
          
          {/* Patient Context Card */}
          <div className="w-full bg-white rounded-xl shadow-lg border border-slate-100 p-6 transition-all hover:shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                  <User size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 capitalize">
                    Welcome, {userProfile?.full_name || 'Patient'}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-slate-500 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      ID: {maskPatientId(patientId)}
                    </span>
                    <button 
                      onClick={copyPatientId}
                      className="text-slate-400 hover:text-blue-600 transition-colors relative group"
                      title="Copy Patient ID"
                    >
                      {showCopied ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        {showCopied ? 'Copied!' : 'Copy ID'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button 
                  onClick={() => router.push('/patient/dashboard')}
                  className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                >
                  Dashboard
                </button>
                <button 
                  onClick={signOut}
                  className="flex-1 sm:flex-none px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>

          {/* Voice/Text Interface */}
          <div className="w-full flex flex-col items-center text-center gap-8 py-8">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                How can we help you today?
              </h2>
              <p className="text-slate-500 text-lg max-w-lg mx-auto">
                {inputMode === 'voice' 
                  ? "Tap the microphone to schedule appointments, ask for lab results, or contact a doctor."
                  : "Type your request below to schedule appointments or ask questions."}
              </p>
            </div>

            {inputMode === 'voice' ? (
              <>
                <div className="relative group">
                  {isRecording && (
                    <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20"></div>
                  )}
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isProcessing}
                    className={`
                      relative w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-offset-4
                      ${isRecording 
                        ? 'bg-red-500 hover:bg-red-600 focus:ring-red-200' 
                        : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-200'
                      }
                      ${isProcessing ? 'opacity-70 cursor-wait' : ''}
                    `}
                  >
                    <Mic size={40} className="text-white" />
                  </button>
                </div>

                <div className="h-8">
                  {isRecording && (
                    <span className="text-red-500 font-medium animate-pulse flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      Listening...
                    </span>
                  )}
                  {isProcessing && (
                    <span className="text-blue-600 font-medium flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </span>
                  )}
                </div>

                <button 
                  onClick={() => setInputMode('text')}
                  className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors text-sm font-medium"
                >
                  <Keyboard size={18} />
                  Switch to Keyboard Input
                </button>
              </>
            ) : (
              <div className="w-full max-w-lg flex flex-col gap-4 animate-in fade-in zoom-in duration-300">
                <div className="relative">
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="E.g., I need to book an appointment with Dr. Smith for next Tuesday at 2 PM..."
                    className="w-full p-4 rounded-xl border border-slate-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-none min-h-[120px] bg-white text-slate-900"
                    disabled={isProcessing}
                  />
                  {isProcessing && (
                    <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-xl">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <button 
                    onClick={() => setInputMode('voice')}
                    className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors text-sm font-medium"
                  >
                    <Mic size={18} />
                    Switch to Voice Input
                  </button>
                  
                  <button
                    onClick={() => processText(textInput)}
                    disabled={!textInput.trim() || isProcessing}
                    className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    Send Request
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Results Area */}
          <div className="w-full space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3 text-red-700">
                <AlertCircle className="shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <h3 className="font-medium">Error</h3>
                  <p className="text-sm mt-1 opacity-90">{error}</p>
                  {(error.includes('patient profile') || error.includes('Patient profile')) && (
                    <button 
                      onClick={createPatientProfile}
                      className="mt-3 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 text-sm font-medium rounded-lg transition-colors"
                    >
                      Create Profile Now
                    </button>
                  )}
                </div>
              </div>
            )}

            {transcription && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">You said</h3>
                <p className="text-lg text-slate-800 leading-relaxed">"{transcription}"</p>
              </div>
            )}

            {bookingResult && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <CheckCircle size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-green-900">Appointment Booked!</h3>
                    <p className="text-green-700">{bookingResult.message}</p>
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-green-100 overflow-hidden">
                  <Calendar bookingData={bookingResult} />
                </div>
              </div>
            )}
            
            {/* Debug Data (Optional - can be hidden or put in a collapsible) */}
            {extractedData && !bookingResult && (
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Extracted Data</h3>
                <pre className="text-xs text-slate-600 overflow-x-auto">
                  {JSON.stringify(extractedData, null, 2)}
                </pre>
              </div>
            )}
          </div>

        </main>
      </div>
    </>
  );
}
