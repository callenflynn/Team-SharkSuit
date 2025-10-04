// Simple in-memory storage (resets when worker restarts, but works for testing)
let newsStorage = [
  {
    "content": "Welcome to Team SharkSuit! This news section will automatically update when you post messages in your Discord channel.",
    "author": "Team SharkSuit",
    "timestamp": "2024-10-04T14:00:00.000Z",
    "formattedDate": "October 4, 2024"
  }
];

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST' && request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    const url = new URL(request.url);
    const providedSecret = url.searchParams.get('secret');
    
    // Handle GET request to fetch stored news (no secret needed for reading)
    if (request.method === 'GET' && !providedSecret) {
      return new Response(JSON.stringify(newsStorage), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
    
    if (!providedSecret || providedSecret !== env.WEBHOOK_SECRET) {
      return new Response('Unauthorized - Invalid or missing secret', { status: 401 });
    }

    // Handle POST request - Discord webhook
    if (request.method === 'POST') {
      try {
        const data = await request.json();
        
        const content = data.content || '';
        const author = data.author?.username || 'Team SharkSuit';
        const timestamp = data.timestamp || new Date().toISOString();
        
        if (!content.trim() || data.author?.bot) {
          return new Response('Ignored bot message or empty content', { status: 200 });
        }

        const date = new Date(timestamp).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long', 
          day: 'numeric'
        });

        const newsItem = {
          content: content,
          author: author,
          timestamp: timestamp,
          formattedDate: date
        };

        // Add new news item at the beginning
        newsStorage.unshift(newsItem);
        newsStorage = newsStorage.slice(0, 10); // Keep only latest 10

        return new Response('News stored successfully!', { 
          status: 200,
          headers: { 'Access-Control-Allow-Origin': '*' }
        });

      } catch (error) {
        console.error('Worker error:', error);
        return new Response('Internal error', { status: 500 });
      }
    }
  }
};