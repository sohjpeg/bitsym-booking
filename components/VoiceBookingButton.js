import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Mic, X, Loader2, CheckCircle, AlertCircle, Calendar, Clock, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function VoiceBookingButton() {
  const { user, userProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [bookingResult, setBookingResult] = useState(null);
  const [error, setError] = useState(null);
  const [patientId, setPatientId] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    if (userProfile?.patient_id) {
      setPatientId(userProfile.patient_id);
    } else if (user) {
      // Fallback fetch if not in profile yet
      supabase
        .from('patients')
        .select('id')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data) setPatientId(data.id);
        });
    }
  }, [user, userProfile]);

  const startRecording = async () => {
    try {
      setError(null);
      setTranscription('');
      setExtractedData(null);
      setBookingResult(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      setError('Could not access microphone. Please ensure permissions are granted.');
      console.error(err);
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
    try {
      // 1. Transcribe
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      const transcribeRes = await axios.post('/api/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const text = transcribeRes.data.text;
      setTranscription(text);

      // 2. Interpret
      const interpretRes = await axios.post('/api/interpret', { text });
      setExtractedData(interpretRes.data);

    } catch (err) {
      setError('Failed to process request. Please try again.');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmBooking = async () => {
    if (!extractedData || !patientId) return;
    
    setIsProcessing(true);
    try {
      const payload = { ...extractedData, patientId };
      const res = await axios.post('/api/book', payload);
      setBookingResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Booking failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetState = () => {
    setTranscription('');
    setExtractedData(null);
    setBookingResult(null);
    setError(null);
  };

  const closeModal = () => {
    setIsOpen(false);
    resetState();
    stopRecording();
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-50 group"
        aria-label="Voice Booking"
      >
        <Mic size={28} className="group-hover:scale-110 transition-transform" />
        <span className="absolute -top-10 right-0 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Book with Voice
        </span>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Mic size={18} className="text-blue-600" />
                Voice Assistant
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              {/* Success State */}
              {bookingResult ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                    <CheckCircle size={32} />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-900">Booking Confirmed!</h4>
                    <p className="text-slate-500 mt-1">{bookingResult.message}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Doctor:</span>
                      <span className="font-medium text-slate-900">{bookingResult.appointment.doctor}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Date:</span>
                      <span className="font-medium text-slate-900">{bookingResult.appointment.date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Time:</span>
                      <span className="font-medium text-slate-900">{bookingResult.appointment.time}</span>
                    </div>
                  </div>
                  <button 
                    onClick={closeModal}
                    className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : (
                /* Interaction State */
                <div className="space-y-6">
                  {/* Status Display */}
                  <div className="text-center">
                    {isRecording ? (
                      <div className="text-red-500 font-medium animate-pulse">Listening...</div>
                    ) : isProcessing ? (
                      <div className="text-blue-600 font-medium flex items-center justify-center gap-2">
                        <Loader2 size={18} className="animate-spin" />
                        Processing...
                      </div>
                    ) : extractedData ? (
                      <div className="text-slate-900 font-medium">Confirm Details</div>
                    ) : (
                      <div className="text-slate-500">Tap microphone to speak</div>
                    )}
                  </div>

                  {/* Main Action Area */}
                  <div className="flex justify-center">
                    {!extractedData && (
                      <button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isProcessing}
                        className={`
                          w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300
                          ${isRecording 
                            ? 'bg-red-500 shadow-lg shadow-red-200 scale-110' 
                            : 'bg-blue-600 shadow-lg shadow-blue-200 hover:scale-105'
                          }
                          ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                      >
                        <Mic size={32} className="text-white" />
                      </button>
                    )}
                  </div>

                  {/* Transcription Preview */}
                  {transcription && (
                    <div className="bg-slate-50 p-4 rounded-xl text-center">
                      <p className="text-slate-600 italic">"{transcription}"</p>
                    </div>
                  )}

                  {/* Confirmation Card */}
                  {extractedData && (
                    <div className="space-y-4 animate-in slide-in-from-bottom-2">
                      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <User size={18} className="text-slate-400" />
                          <div>
                            <p className="text-xs text-slate-500">Doctor/Specialty</p>
                            <p className="font-medium text-slate-900">
                              {extractedData.doctor || extractedData.speciality || 'Any available'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Calendar size={18} className="text-slate-400" />
                          <div>
                            <p className="text-xs text-slate-500">Date</p>
                            <p className="font-medium text-slate-900">{extractedData.date || 'Not specified'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Clock size={18} className="text-slate-400" />
                          <div>
                            <p className="text-xs text-slate-500">Time</p>
                            <p className="font-medium text-slate-900">{extractedData.time || 'Not specified'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={resetState}
                          className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={confirmBooking}
                          disabled={isProcessing}
                          className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {isProcessing ? 'Booking...' : 'Confirm Booking'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Error Message */}
                  {error && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                      <AlertCircle size={16} />
                      {error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
