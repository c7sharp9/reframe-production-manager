// Netlify serverless function — proxies all Airtable API requests
// API key is stored in Netlify environment variables, never exposed to client

exports.handler = async (event) => {
  const API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;

  if (!API_KEY || !BASE_ID) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured — missing env vars' }) };
  }

  // The client sends the Airtable path as a query param: ?path=Equipment or ?path=Equipment/recXXX
  const airtablePath = event.queryStringParameters?.path;
  if (!airtablePath) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing path parameter' }) };
  }

  // Handle pagination offset
  const offset = event.queryStringParameters?.offset;
  let url = `https://api.airtable.com/v0/${BASE_ID}/${airtablePath}`;
  if (offset) {
    url += `?offset=${encodeURIComponent(offset)}`;
  }

  try {
    const options = {
      method: event.httpMethod,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    // Forward request body for POST/PATCH/DELETE
    if (event.body && (event.httpMethod === 'POST' || event.httpMethod === 'PATCH')) {
      options.body = event.body;
    }

    const response = await fetch(url, options);
    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
