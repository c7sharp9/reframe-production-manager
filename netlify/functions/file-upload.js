// Accepts a file as base64, stores it in Netlify Blobs via raw HTTP (no npm deps),
// returns a public URL that Airtable can download from

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
}

function getBlobsContext() {
  const raw = process.env.NETLIFY_BLOBS_CONTEXT;
  if (!raw) return null;
  // Could be plain JSON or base64-encoded JSON depending on Netlify version
  try { return JSON.parse(raw); } catch (e) {}
  try { return JSON.parse(Buffer.from(raw, "base64").toString()); } catch (e) {}
  return null;
}

function blobUrl(ctx, storeName, key) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  if (ctx.edgeURL) {
    // Edge API: {edgeURL}/{siteID}:site:{storeName}/{key}
    return `${ctx.edgeURL}/${ctx.siteID}:site:${storeName}/${encodedKey}`;
  }
  // Fallback to management API
  const api = ctx.apiURL || "https://api.netlify.com";
  return `${api}/api/v1/blobs/${ctx.siteID}/site/${storeName}/${encodedKey}`;
}

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

    const ctx = getBlobsContext();
    if (!ctx) {
      return {
        statusCode: 500,
        headers: corsHeaders(),
        body: JSON.stringify({
          error: "Netlify Blobs context not available",
          hint: "NETLIFY_BLOBS_CONTEXT env var is missing. This is automatically set by Netlify for deployed functions."
        })
      };
    }

    const store = "uploads";
    const key = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const fileBuffer = Buffer.from(content, "base64");

    // Store the file binary via raw HTTP PUT
    const putUrl = blobUrl(ctx, store, key);
    const putRes = await fetch(putUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${ctx.token}`,
        "Content-Type": "application/octet-stream"
      },
      body: fileBuffer
    });

    if (!putRes.ok) {
      const errBody = await putRes.text();
      return {
        statusCode: 500,
        headers: corsHeaders(),
        body: JSON.stringify({ error: `Blob store PUT failed (${putRes.status})`, detail: errBody })
      };
    }

    // Store metadata as a separate blob entry
    const metaUrl = blobUrl(ctx, store, key + "__meta");
    await fetch(metaUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${ctx.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contentType: contentType || "application/octet-stream",
        filename
      })
    });

    // Build the public serve URL
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
