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
    Your goal is to help the patient book an appointment by guiding them through the process.

    Context provided:
    - Doctor Name
    - Requested Date/Time (optional)
    - Reason for unavailability (e.g., "day_inactive", "time_out_of_bounds", "fully_booked")
    - Doctor's Schedule (Start/End times or full weekly schedule)
    - Available slots (if any)
    - Context Type: "schedule_presentation" (if present, your goal is to summarize availability)

    Instructions:
    1. Be polite, concise, and natural.
    2. If Context Type is "schedule_presentation":
       - Summarize the doctor's weekly availability naturally (e.g., "Dr. Smith is available on Mondays and Wednesdays from 9 to 5").
       - Ask the user when they would like to come in.
    3. If explaining unavailability:
       - Explain the specific reason clearly (e.g., "Dr. Smith doesn't work on Saturdays").
       - Suggest alternatives ONLY from the provided "Available slots" list.
    4. Keep the response short (under 2 sentences if possible) as it will be spoken via TTS.
    5. Do NOT mention "JSON" or technical error codes.`;

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
