import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Mic, X, Loader2, CheckCircle, AlertCircle, Calendar, Clock, User, Volume2, MicOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function VoiceBookingButton() {
  const { user, userProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState(null);
  const [patientId, setPatientId] = useState(null);
  
  // Conversation State
  const [conversationStage, setConversationStageState] = useState('idle');
  const conversationStageRef = useRef('idle'); // Ref to track stage without closure issues
  
  const setConversationStage = (stage) => {
    setConversationStageState(stage);
    conversationStageRef.current = stage;
  };

  const [conversationData, setConversationDataState] = useState({
    doctor: null,
    date: null,
    time: null,
    availableSlots: [],
    suggestedSlots: []
  });
  const conversationDataRef = useRef({
    doctor: null,
    date: null,
    time: null,
    availableSlots: [],
    suggestedSlots: []
  });

  const setConversationData = (updater) => {
    setConversationDataState(prev => {
      const newState = typeof updater === 'function' ? updater(prev) : updater;
      conversationDataRef.current = newState;
      return newState;
    });
  };

  const [conversationHistory, setConversationHistory] = useState([]);
  const [bookingResult, setBookingResult] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const speechSynthesisRef = useRef(null);

  useEffect(() => {
    // Only use patient_id from userProfile (fetched via API in AuthContext)
    if (userProfile?.patient_id) {
      setPatientId(userProfile.patient_id);
    }
  }, [userProfile]);

  // Text-to-Speech function
  const speak = (text) => {
    return new Promise((resolve) => {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onstart = () => {
        setIsSpeaking(true);
      };
      
      utterance.onend = () => {
        setIsSpeaking(false);
        resolve();
      };
      
      utterance.onerror = () => {
        setIsSpeaking(false);
        resolve();
      };
      
      speechSynthesisRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    });
  };

  // Add message to conversation history
  const addToHistory = (speaker, text) => {
    setConversationHistory(prev => [...prev, { speaker, text, timestamp: Date.now() }]);
  };

  // Start the conversation
  const startConversation = async () => {
    setConversationStage('asking_doctor');
    // Reset data
    setConversationData({
      doctor: null,
      date: null,
      time: null,
      availableSlots: [],
      suggestedSlots: []
    });
    
    const greeting = "Hi! I can help you book an appointment. Which doctor would you like to see?";
    addToHistory('bot', greeting);
    await speak(greeting);
    startRecording();
  };

  const startRecording = async () => {
    try {
      setError(null);
      
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
      console.log('Processing audio blob...');
      
      // 1. Transcribe
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      const transcribeRes = await axios.post('/api/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const text = transcribeRes.data.text;
      
      console.log('Transcription:', text);
      
      // Add user's message to history
      addToHistory('user', text);

      // 2. Interpret based on current stage
      const currentStage = conversationStageRef.current;
      console.log('Current conversation stage:', currentStage);
      await handleUserResponse(text);

    } catch (err) {
      console.error('Error in processAudio:', err);
      setError('Failed to process request. Please try again.');
      const response = "Sorry, I didn't catch that. Could you please repeat?";
      addToHistory('bot', response);
      await speak(response);
      startRecording();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUserResponse = async (text) => {
    try {
      const currentStage = conversationStageRef.current;
      const lowerText = text.toLowerCase().replace(/[.,!?]/g, '').trim();

      // Handle confirmations - more flexible regex
      const isConfirmation = /(yes|yeah|yep|sure|okay|ok|correct|right|that works|sounds good|confirm)/i.test(lowerText);
      const isNegation = /(no|nope|nah|different|another|change|wrong)/i.test(lowerText);

      switch (currentStage) {
        case 'asking_doctor':
          await handleDoctorResponse(text);
          break;
        
        case 'asking_date':
          await handleDateResponse(text);
          break;
        
        case 'asking_time':
          await handleTimeResponse(text);
          break;
        
        case 'offering_slots':
          if (isConfirmation) {
            // User accepted a suggested slot
            await confirmBooking();
          } else if (isNegation) {
            // User wants different time
            const response = "What time would you prefer?";
            addToHistory('bot', response);
            await speak(response);
            setConversationStage('asking_time');
            startRecording();
          } else {
            // Try to extract a time from their response
            await handleTimeResponse(text);
          }
          break;
        
        case 'confirming':
          if (isConfirmation) {
            await confirmBooking();
          } else {
            const response = "Okay, let's start over. Which doctor would you like to see?";
            addToHistory('bot', response);
            await speak(response);
            resetConversation();
            setConversationStage('asking_doctor');
            startRecording();
          }
          break;
        
        default:
          console.warn('Unknown conversation stage:', currentStage);
      }
    } catch (error) {
      console.error('Error in handleUserResponse:', error);
      const response = "Sorry, I had trouble processing that. Could you try again?";
      addToHistory('bot', response);
      await speak(response);
      startRecording();
    }
  };

  const handleDoctorResponse = async (text) => {
    try {
      // Use the interpret API to extract doctor name
      const interpretRes = await axios.post('/api/interpret', { text });
      const data = interpretRes.data;

      if (data.doctor) {
        setConversationData(prev => ({ ...prev, doctor: data.doctor }));
        const response = `Great! I'll book with ${data.doctor}. What date works for you?`;
        addToHistory('bot', response);
        await speak(response);
        setConversationStage('asking_date');
        startRecording();
      } else {
        const response = "I didn't catch the doctor's name. Could you please repeat it?";
        addToHistory('bot', response);
        await speak(response);
        startRecording();
      }
    } catch (error) {
      console.error('Error in handleDoctorResponse:', error);
      const response = "Sorry, I had trouble understanding. Could you repeat the doctor's name?";
      addToHistory('bot', response);
      await speak(response);
      startRecording();
    }
  };

  const handleDateResponse = async (text) => {
    // Use the interpret API to extract date
    const interpretRes = await axios.post('/api/interpret', { text });
    const data = interpretRes.data;

    if (data.date) {
      setConversationData(prev => ({ ...prev, date: data.date }));
      const response = "Perfect! What time would you prefer?";
      addToHistory('bot', response);
      await speak(response);
      setConversationStage('asking_time');
      startRecording();
    } else {
      const response = "I didn't understand the date. Could you say it again? For example, 'tomorrow' or 'December 5th'";
      addToHistory('bot', response);
      await speak(response);
      startRecording();
    }
  };

  const handleTimeResponse = async (text) => {
    // Use the interpret API to extract time
    const interpretRes = await axios.post('/api/interpret', { text });
    const data = interpretRes.data;

    if (data.time) {
      setConversationData(prev => ({ ...prev, time: data.time }));
      
      // Check availability using ref data
      const currentData = conversationDataRef.current;
      await checkAvailability(currentData.doctor, currentData.date, data.time);
    } else {
      const response = "I didn't catch the time. Could you say it again? For example, '10 AM' or '2:30 PM'";
      addToHistory('bot', response);
      await speak(response);
      startRecording();
    }
  };

  const checkAvailability = async (doctorName, date, requestedTime) => {
    try {
      const res = await axios.get('/api/patient/check-availability', {
        params: { doctorName, date }
      });

      const { available, slots, message } = res.data;
      
      // If doctor was not found
      if (!available && slots.length === 0) {
        const response = message || `I couldn't find a doctor named "${doctorName}". Could you try a different name?`;
        addToHistory('bot', response);
        await speak(response);
        setConversationStage('asking_doctor');
        startRecording();
        return;
      }
      
      // Normalize the requested time
      let normalizedRequestedTime = requestedTime;
      if (requestedTime && requestedTime.length === 5) {
        normalizedRequestedTime = requestedTime;
      } else if (requestedTime) {
        normalizedRequestedTime = requestedTime.slice(0, 5);
      }
      
      const isTimeAvailable = normalizedRequestedTime && slots.some(s => s.time === normalizedRequestedTime && s.available);
      
      if (isTimeAvailable) {
        // Time is available - confirm
        const response = `Great! ${requestedTime} is available. Should I confirm your appointment with ${doctorName} on ${date} at ${requestedTime}?`;
        addToHistory('bot', response);
        await speak(response);
        setConversationStage('confirming');
        startRecording();
      } else {
        // Time not available - offer alternatives
        const availableSlots = slots.filter(s => s.available).slice(0, 3);
        
        if (availableSlots.length > 0) {
          setConversationData(prev => ({ 
            ...prev, 
            availableSlots: slots,
            suggestedSlots: availableSlots 
          }));
          
          const times = availableSlots.map(s => s.time.slice(0, 5)).join(', or ');
          const response = `Sorry, ${requestedTime} is not available. How about ${times}?`;
          addToHistory('bot', response);
          await speak(response);
          setConversationStage('offering_slots');
          startRecording();
        } else {
          const response = `Sorry, there are no available slots for ${date}. Would you like to try a different date?`;
          addToHistory('bot', response);
          await speak(response);
          setConversationStage('asking_date');
          startRecording();
        }
      }

    } catch (err) {
      console.error('Availability check failed:', err);
      const response = 'I had trouble checking availability. Could you try again?';
      addToHistory('bot', response);
      await speak(response);
      startRecording();
    }
  };

  const confirmBooking = async () => {
    const currentData = conversationDataRef.current;

    if (!currentData.doctor || !currentData.date || !currentData.time || !patientId) {
      console.error('Missing booking data:', { ...currentData, patientId });
      const response = "I'm missing some information. Let's start over.";
      addToHistory('bot', response);
      await speak(response);
      resetConversation();
      setConversationStage('asking_doctor');
      startRecording();
      return;
    }

    setIsProcessing(true);
    try {
      const payload = { 
        doctor: currentData.doctor, // API expects 'doctor', not 'doctorName'
        date: currentData.date,
        time: currentData.time,
        patientId 
      };
      
      const res = await axios.post('/api/book', payload);
      
      if (res.status === 200) {
        setBookingResult({ success: true, message: 'Appointment Booked Successfully!', appointment: payload });
        setConversationStage('completed');
        
        const response = `Perfect! Your appointment is confirmed with ${currentData.doctor} on ${currentData.date} at ${currentData.time}.`;
        addToHistory('bot', response);
        await speak(response);
      }
      
    } catch (err) {
      console.error('Booking error:', err);
      const errorMsg = err.response?.data?.error || 'Booking failed. Please try again.';
      setError(errorMsg);
      addToHistory('bot', errorMsg);
      await speak(errorMsg);
      // Don't restart conversation on error, let user try again or close
    } finally {
      setIsProcessing(false);
    }
  };

  const resetConversation = () => {
    setConversationData({
      doctor: null,
      date: null,
      time: null,
      availableSlots: [],
      suggestedSlots: []
    });
    setConversationHistory([]);
    setBookingResult(null);
    setError(null);
  };

  const closeModal = () => {
    setIsOpen(false);
    window.speechSynthesis.cancel();
    stopRecording();
    resetConversation();
    setConversationStage('idle');
  };

  const handleOpenModal = () => {
    setIsOpen(true);
    resetConversation();
    setTimeout(() => startConversation(), 500);
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={handleOpenModal}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Mic size={18} className="text-blue-600" />
                Voice Assistant
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Conversation History */}
              {conversationHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      msg.speaker === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    <p className="text-sm">{msg.text}</p>
                  </div>
                </div>
              ))}

              {/* Status Indicators */}
              {isProcessing && (
                <div className="flex justify-center">
                  <div className="bg-slate-100 rounded-2xl px-4 py-2 flex items-center gap-2 text-slate-600">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">Processing...</span>
                  </div>
                </div>
              )}

              {isSpeaking && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 rounded-2xl px-4 py-2 flex items-center gap-2 text-slate-600">
                    <Volume2 size={16} className="animate-pulse" />
                    <span className="text-sm">Speaking...</span>
                  </div>
                </div>
              )}

              {isRecording && (
                <div className="flex justify-end">
                  <div className="bg-red-100 rounded-2xl px-4 py-2 flex items-center gap-2 text-red-600">
                    <Mic size={16} className="animate-pulse" />
                    <span className="text-sm">Listening...</span>
                  </div>
                </div>
              )}

              {/* Success State */}
              {bookingResult && (
                <div className="text-center space-y-4 pt-4">
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
              )}

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
            </div>

            {/* Footer with Recording Control */}
            {!bookingResult && conversationStage !== 'idle' && (
              <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
                <div className="flex items-center justify-center gap-4">
                  {isRecording && (
                    <button
                      onClick={stopRecording}
                      className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-all"
                    >
                      <MicOff size={24} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      resetConversation();
                      setConversationStage('idle');
                      setTimeout(() => startConversation(), 300);
                    }}
                    className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Start Over
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
