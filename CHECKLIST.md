# 🚀 Setup Checklist

Use this checklist to get your Speech-to-Appointment Booking System up and running!

## ✅ Pre-Requirements

- [ ] Node.js 18.x or higher installed
- [ ] npm installed
- [ ] Modern web browser (Chrome, Edge, or Firefox)
- [ ] Microphone available

## ✅ API Keys Setup

### OpenAI API Key (Whisper)
- [ ] Go to https://platform.openai.com/
- [ ] Create account or sign in
- [ ] Navigate to API Keys section
- [ ] Click "Create new secret key"
- [ ] Copy the key (starts with `sk-`)
- [ ] **Important:** Add payment method (Whisper is pay-per-use)

### DeepSeek API Key (R1)
- [ ] Go to https://platform.deepseek.com/
- [ ] Create account or sign in
- [ ] Navigate to API Keys
- [ ] Generate new API key
- [ ] Copy the key
- [ ] **Important:** Check free tier limits

## ✅ Project Setup

- [ ] Navigate to project directory: `cd booking`
- [ ] Dependencies already installed ✅ (done during setup)
- [ ] Open `.env.local` file
- [ ] Paste your OpenAI API key after `OPENAI_API_KEY=`
- [ ] Paste your DeepSeek API key after `DEEPSEEK_API_KEY=`
- [ ] Save the file

## ✅ First Run

- [ ] Open terminal in project directory
- [ ] Run: `npm run dev`
- [ ] Wait for "Ready" message
- [ ] Open browser to http://localhost:3000
- [ ] Allow microphone access when prompted

## ✅ First Test

- [ ] Click "Start Recording" button
- [ ] Say: "I want to book Dr. Smith for tomorrow at 2 PM"
- [ ] Click "Stop Recording" button
- [ ] Wait 10-15 seconds
- [ ] Verify you see:
  - [ ] Transcription text appears
  - [ ] Extracted JSON data appears
  - [ ] Booking confirmation appears
- [ ] Check terminal for appointment logs

## ✅ Troubleshooting

If something doesn't work:

### Microphone Issues
- [ ] Check browser permissions (lock icon in address bar)
- [ ] Reload page after granting permissions
- [ ] Try different browser

### API Errors
- [ ] Verify API keys are correct in `.env.local`
- [ ] Check API keys don't have extra spaces
- [ ] Verify OpenAI account has billing enabled
- [ ] Check DeepSeek API rate limits

### No Transcription
- [ ] Speak louder or closer to mic
- [ ] Record for at least 2-3 seconds
- [ ] Check browser console (F12) for errors
- [ ] Verify OPENAI_API_KEY is set

### No Extraction
- [ ] Verify DEEPSEEK_API_KEY is set
- [ ] Check terminal logs for error messages
- [ ] Try simpler phrase first

## ✅ Files to Verify

Your project should have these key files:

- [ ] `.env.local` (with your API keys)
- [ ] `pages/index.js` (frontend interface)
- [ ] `pages/api/transcribe.js` (Whisper route)
- [ ] `pages/api/interpret.js` (DeepSeek route)
- [ ] `pages/api/book.js` (booking route)
- [ ] `README.md` (documentation)
- [ ] `TESTING.md` (test guide)
- [ ] `package.json` (dependencies)

## ✅ Expected Behavior

When working correctly:

1. **Recording Phase**
   - [ ] Green button changes to red
   - [ ] "Recording..." indicator appears
   - [ ] Pulse animation visible

2. **Transcription Phase** (5-10 seconds)
   - [ ] "Processing..." message shows
   - [ ] Text appears in textarea
   - [ ] Matches what you said

3. **Extraction Phase** (3-5 seconds)
   - [ ] JSON appears with fields:
     - doctor
     - speciality
     - date (YYYY-MM-DD format)
     - time (HH:MM format)
     - intent
     - confidence (0.0-1.0)

4. **Booking Phase** (instant)
   - [ ] Success message appears
   - [ ] Booking ID generated
   - [ ] Appointment details shown
   - [ ] Terminal shows detailed log

## ✅ Common Test Phrases

Try these to verify everything works:

- [ ] "Book Dr. Smith for tomorrow at 2 PM"
- [ ] "I need to see a cardiologist next Tuesday at 10 AM"
- [ ] "Schedule an appointment with Dr. Johnson for next week"
- [ ] "Can I see a dentist the day after tomorrow at 3"

## ✅ Production Checklist (Future)

When ready to deploy:

- [ ] Add database integration
- [ ] Implement user authentication
- [ ] Set up HTTPS (required for microphone)
- [ ] Add rate limiting
- [ ] Implement proper error logging
- [ ] Add monitoring/analytics
- [ ] Set up automated backups
- [ ] Configure environment variables on hosting
- [ ] Add CORS configuration
- [ ] Implement API key rotation

## 🎉 You're Done!

If all items are checked, your Speech-to-Appointment Booking System is ready to use!

### Next Steps:
1. Read `TESTING.md` for comprehensive testing guide
2. Read `README.md` for full documentation
3. Check `IMPLEMENTATION.md` for technical details
4. Start building Phase 2 features!

### Need Help?
- Check browser console (F12 → Console)
- Check terminal logs
- Review `README.md` troubleshooting section
- Verify API keys are correct

Happy booking! 🎤🚀
