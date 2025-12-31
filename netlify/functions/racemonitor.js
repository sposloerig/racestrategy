// netlify/functions/racemonitor.js
// Proxy for Race Monitor API to bypass CORS

exports.handler = async function(event, context) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { endpoint, apiToken, ...params } = JSON.parse(event.body);

    if (!endpoint || !apiToken) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing endpoint or apiToken' }),
      };
    }

    // Build form data
    const formData = new URLSearchParams();
    formData.append('apiToken', apiToken);
    
    // Add any additional params
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    }

    // Make request to Race Monitor API
    const response = await fetch(`https://api.race-monitor.com/v2${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Race Monitor proxy error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to proxy Race Monitor request', details: error.message }),
    };
  }
};

