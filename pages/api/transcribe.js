/**
 * Groq Whisper API Transcription Route
 * 
 * Accepts: webm audio file via multipart/form-data
 * Returns: Transcribed text from Groq Whisper API (FREE & FAST!)
 * 
 * Flow:
 * 1. Receive audio file using formidable
 * 2. Forward to Groq Whisper API (whisper-large-v3 model)
 * 3. Return transcription text
 * 
 * Benefits:
 * - FREE API access (no billing required)
 * - 10-20x faster than OpenAI
 * - Same Whisper model quality
 */

import formidable from 'formidable';
import FormData from 'form-data';
import axios from 'axios';
import fs from 'fs';

// Disable Next.js body parser to allow formidable to handle the request
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse multipart form data using formidable
    const form = formidable({
      maxFileSize: 25 * 1024 * 1024, // 25MB limit
    });
    
    const [fields, files] = await form.parse(req);
    
    const audioFile = files.audio?.[0];
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('Received audio file:', {
      originalName: audioFile.originalFilename,
      mimeType: audioFile.mimetype,
      size: audioFile.size,
    });

    // Prepare form data for Groq Whisper API
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFile.filepath), {
      filename: audioFile.originalFilename || 'audio.webm',
      contentType: audioFile.mimetype || 'audio/webm',
    });
    formData.append('model', 'whisper-large-v3'); // Groq's Whisper model
    formData.append('language', 'en'); // Optional: specify language for better accuracy
    formData.append('response_format', 'json'); // Get JSON response

    // Call Groq Whisper API
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      throw new Error('GROQ_API_KEY not configured in .env.local');
    }

    console.log('Sending to Groq Whisper API...');
    const whisperResponse = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${groqApiKey}`,
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    // Clean up temporary file
    fs.unlinkSync(audioFile.filepath);

    const transcribedText = whisperResponse.data.text;
    console.log('Transcription successful:', transcribedText);

    return res.status(200).json({
      text: transcribedText,
      success: true,
    });

  } catch (error) {
    console.error('Transcription error:', error.response?.data || error.message);
    
    return res.status(500).json({
      error: 'Transcription failed',
      details: error.response?.data?.error?.message || error.message,
    });
  }
}
