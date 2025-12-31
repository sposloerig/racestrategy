// Netlify Function to proxy RedMist auth requests (bypasses CORS)

export async function handler(event) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const response = await fetch(
      'https://auth.redmist.racing/realms/redmist/protocol/openid-connect/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: event.body,
      }
    );

    const data = await response.text();
    
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: data,
    };
  } catch (error) {
    console.error('Auth proxy error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Auth proxy failed', message: error.message }),
    };
  }
}

