import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { context } = req.body;

    if (!context) {
      return res.status(400).json({ error: 'No context provided' });
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      throw new Error('GROQ_API_KEY not configured');
    }

    const systemPrompt = `You are a helpful medical appointment assistant.
Your goal is to explain to the patient why their requested appointment cannot be booked and offer helpful alternatives based on the doctor's schedule.

Context provided:
- Doctor Name
- Requested Date/Time
- Reason for unavailability (e.g., "day_inactive", "time_out_of_bounds", "fully_booked")
- Doctor's Schedule for that day (Start/End times)
- Available slots (if any)

Instructions:
1. Be polite, concise, and natural.
2. Explain the specific reason clearly (e.g., "Dr. Smith doesn't work on Saturdays" or "Dr. Smith is available on Mondays but only until 5 PM").
3. Suggest alternatives ONLY from the provided "Available slots" list. Do NOT invent times.
4. If no available slots are provided, ask the user for a different date or time preference.
5. Keep the response short (under 2 sentences if possible) as it will be spoken via TTS.
6. Do NOT mention "JSON" or technical error codes.`;

    const userPrompt = `Generate a response for this situation: ${JSON.stringify(context)}`;

    const groqResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 150,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`,
        },
      }
    );

    const generatedText = groqResponse.data.choices[0].message.content;

    return res.status(200).json({ text: generatedText });

  } catch (error) {
    console.error('Response generation error:', error);
    return res.status(500).json({ error: 'Failed to generate response' });
  }
}
