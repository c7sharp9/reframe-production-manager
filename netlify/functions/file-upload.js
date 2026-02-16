// Handles both UPLOAD (POST) and SERVE (GET) in the same function.
// Files are stored in /tmp so the same Lambda instance can serve them
// back when Airtable requests the download URL. No npm dependencies needed.

const fs = require("fs");
const path = require("path");

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  // ─── SERVE MODE (GET) ─────────────────────────────────────────────
  // Airtable hits this URL to download the file
  if (event.httpMethod === "GET") {
    const key = event.queryStringParameters?.key;
    if (!key) {
      return { statusCode: 400, body: "Missing key parameter" };
    }

    const safeName = key.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join("/tmp", safeName);
    const metaPath = path.join("/tmp", safeName + ".meta");

    if (!fs.existsSync(filePath)) {
      return {
        statusCode: 404,
        body: "File not found — the temporary file may have expired. Please try uploading again."
      };
    }

    let meta = { contentType: "application/octet-stream", filename: key };
    if (fs.existsSync(metaPath)) {
      try { meta = JSON.parse(fs.readFileSync(metaPath, "utf8")); } catch (e) {}
    }

    const fileData = fs.readFileSync(filePath);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": meta.contentType,
        "Content-Disposition": `inline; filename="${meta.filename}"`,
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*"
      },
      body: fileData.toString("base64"),
      isBase64Encoded: true
    };
  }

  // ─── UPLOAD MODE (POST) ───────────────────────────────────────────
  // Browser sends file as base64, we store in /tmp and return a serve URL
  if (event.httpMethod === "POST") {
    try {
      const { filename, content, contentType } = JSON.parse(event.body);

      if (!filename || !content) {
        return {
          statusCode: 400,
          headers: corsHeaders(),
          body: JSON.stringify({ error: "Missing filename or content" })
        };
      }

      const key = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const filePath = path.join("/tmp", key);
      const metaPath = path.join("/tmp", key + ".meta");

      // Write file and metadata to /tmp
      fs.writeFileSync(filePath, Buffer.from(content, "base64"));
      fs.writeFileSync(metaPath, JSON.stringify({
        contentType: contentType || "application/octet-stream",
        filename
      }));

      // Build serve URL pointing to THIS SAME function via GET
      const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "";
      const serveUrl = `${siteUrl}/.netlify/functions/file-upload?key=${encodeURIComponent(key)}`;

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
  }

  return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
};
