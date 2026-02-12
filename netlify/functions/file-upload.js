// Accepts a file as base64, stores it in Netlify Blobs, returns a public URL
// that Airtable can download from

const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "POST only" }) };
  }

  try {
    const { filename, content, contentType } = JSON.parse(event.body);

    if (!filename || !content) {
      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Missing filename or content" }) };
    }

    const store = getStore("uploads");
    const key = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    // Store the file as a buffer
    await store.set(key, Buffer.from(content, "base64"), {
      metadata: { contentType: contentType || "application/octet-stream", filename }
    });

    // Build the public URL pointing to our serve function
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "";
    const serveUrl = `${siteUrl}/.netlify/functions/file-serve?key=${encodeURIComponent(key)}`;

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ url: serveUrl, key, filename })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: err.message })
    };
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
}
