import type { NextApiRequest, NextApiResponse } from 'next';

interface LLMRequest {
  query: string;
  sessionId?: string;
}

interface LLMResponse {
  response: string;
  sessionId?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LLMResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ response: '', error: 'Method not allowed' });
  }

  try {
    const { query, sessionId } = req.body as LLMRequest;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ response: '', error: 'Query is required' });
    }

    // Call your backend LLM service
    const backendResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/llm/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query,
        context: sessionId || 'navigation assistance' 
      }),
    });

    if (!backendResponse.ok) {
      throw new Error('Backend LLM service error');
    }

    const data = await backendResponse.json();
    const newSessionId = data.metadata?.session_id;

    // Return the LLM response with session ID
    return res.status(200).json({ 
      response: data.response || 'I could not process your request.',
      sessionId: newSessionId
    });
  } catch (error) {
    console.error('LLM API error:', error);
    return res.status(500).json({ 
      response: 'Sorry, I encountered an error processing your request. Please try again later.',
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
} 