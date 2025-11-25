/**
 * Groq Llama Interpretation Route
 * 
 * Accepts: Transcribed text from Whisper
 * Returns: Structured JSON with appointment details
 * 
 * Flow:
 * 1. Receive transcription text
 * 2. Inject current date for relative date parsing
 * 3. Call Groq Llama API (FREE & FAST!)
 * 4. Extract structured appointment data (doctor, specialty, date, time, intent, confidence)
 * 5. Return JSON
 * 
 * Groq Llama handles:
 * - Filler word filtering ("um", "uh", etc.)
 * - Relative date parsing ("tomorrow", "next Tuesday", "next week")
 * - Natural language understanding
 * - JSON extraction with confidence scoring
 * 
 * Benefits:
 * - FREE API access
 * - Super fast inference
 * - High accuracy with llama-3.3-70b-versatile
 */

import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    console.log('Processing transcription:', text);

    // Get current date for relative date parsing
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
    
    // Calculate dates for reference
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    // Groq API configuration
    const groqApiKey = process.env.GROQ_API_KEY;

    if (!groqApiKey) {
      throw new Error('GROQ_API_KEY not configured in .env.local');
    }

    // Construct prompt for Groq Llama
    const systemPrompt = `You are an expert appointment booking assistant. Extract structured appointment information from user speech with high accuracy.

Current Date Context:
- Today is ${formattedDate} (${dayOfWeek})
- Tomorrow is ${tomorrowDate}

Instructions:
1. Ignore filler words (um, uh, like, you know, etc.)
2. Convert relative dates to absolute YYYY-MM-DD format:
   - "tomorrow" → ${tomorrowDate}
   - "next Tuesday" → calculate next occurrence of Tuesday from ${formattedDate}
   - "in 3 days" → calculate 3 days from today
   - If day of week is mentioned, find next occurrence
3. Parse time in 24-hour format (HH:MM):
   - "2 PM" → "14:00"
   - "morning" → "09:00"
   - "afternoon" → "14:00"
   - "evening" → "18:00"
4. Extract doctor name (e.g., "Dr. Smith", "Dr. Johnson")
5. Extract medical specialty if mentioned (e.g., "cardiologist", "dentist")
6. Determine intent: "book" (default for appointments), "reschedule", "cancel", or "inquiry"
7. Provide confidence score based on information completeness:
   - 0.9-1.0: All fields present and clear
   - 0.7-0.9: Most fields present
   - 0.5-0.7: Some ambiguity
   - 0.0-0.5: Missing critical information

CRITICAL: You MUST respond with ONLY valid JSON. No explanations, no markdown, just JSON.

Required JSON structure:
{
  "doctor": "string or null",
  "speciality": "string or null",
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM or null",
  "intent": "book|reschedule|cancel|inquiry",
  "confidence": 0.0-1.0
}`;

    const userPrompt = `Extract appointment details from: "${text}"`;

    console.log('Calling Groq Llama API...');

    // Call Groq API (OpenAI-compatible endpoint)
    const groqResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile', // Fast and accurate
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.3, // Lower temperature for deterministic extraction
        max_tokens: 500,
        response_format: { type: 'json_object' }, // Force JSON output
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`,
        },
      }
    );

    const aiResponse = groqResponse.data.choices[0].message.content;
    console.log('Groq Llama response:', aiResponse);

    // Parse JSON from response
    let extractedData;
    try {
      // Remove markdown code blocks if present
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || 
                       aiResponse.match(/```\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : aiResponse;
      
      extractedData = JSON.parse(jsonString.trim());
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // Fallback: try to extract JSON object from response
      const jsonObjectMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        extractedData = JSON.parse(jsonObjectMatch[0]);
      } else {
        throw new Error('Failed to parse JSON from Groq response');
      }
    }

    // Validate and normalize fields
    const validatedData = {
      doctor: extractedData.doctor || null,
      speciality: extractedData.speciality || extractedData.specialty || null,
      date: extractedData.date || null,
      time: extractedData.time || null,
      intent: extractedData.intent || 'book',
      confidence: typeof extractedData.confidence === 'number' ? extractedData.confidence : 0.5,
    };

    console.log('Extracted appointment data:', validatedData);

    return res.status(200).json(validatedData);

  } catch (error) {
    console.error('Interpretation error:', error.response?.data || error.message);
    
    return res.status(500).json({
      error: 'Interpretation failed',
      details: error.response?.data?.error?.message || error.message,
    });
  }
}
