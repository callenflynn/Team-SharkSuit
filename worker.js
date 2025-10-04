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

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Security: Verify Discord signature (for webhook interactions)
    const signature = request.headers.get('X-Signature-Ed25519');
    const timestamp = request.headers.get('X-Signature-Timestamp');
    
    // For regular webhook posts, we'll use a simple secret token instead
    // Discord interactions use signatures, but regular webhooks don't
    if (!signature) {
      const url = new URL(request.url);
      const providedSecret = url.searchParams.get('secret');
      
      if (!providedSecret || providedSecret !== env.WEBHOOK_SECRET) {
        return new Response('Unauthorized - Invalid or missing secret', { status: 401 });
      }
    }

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
        date: date
      };

      const currentNewsResponse = await fetch(
        `https://api.github.com/repos/callenflynn/Team-SharkSuit/contents/news.json`,
        {
          headers: {
            'Authorization': `token ${env.GITHUB_TOKEN}`,
            'User-Agent': 'Team-SharkSuit-Worker/1.0'
          }
        }
      );

      let currentNews = [];
      let sha = '';

      if (currentNewsResponse.ok) {
        const fileData = await currentNewsResponse.json();
        sha = fileData.sha;
        const decodedContent = atob(fileData.content);
        try {
          currentNews = JSON.parse(decodedContent);
        } catch (e) {
          currentNews = [];
        }
      }

      currentNews.unshift(newsItem);
      currentNews = currentNews.slice(0, 10);

      const updatePayload = {
        message: `Update news: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
        content: btoa(JSON.stringify(currentNews, null, 2)),
        sha: sha || undefined
      };

      const updateResponse = await fetch(
        `https://api.github.com/repos/callenflynn/Team-SharkSuit/contents/news.json`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${env.GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Team-SharkSuit-Worker/1.0'
          },
          body: JSON.stringify(updatePayload)
        }
      );

      if (updateResponse.ok) {
        return new Response('News updated successfully!', { 
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        });
      } else {
        const errorText = await updateResponse.text();
        console.error('GitHub update failed:', errorText);
        return new Response('Failed to update news', { status: 500 });
      }

    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal error', { status: 500 });
    }
  }
};