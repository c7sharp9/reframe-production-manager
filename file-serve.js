// Serves a file from Netlify Blobs by key
// This gives Airtable a public URL to download from

const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const key = event.queryStringParameters?.key;

  if (!key) {
    return { statusCode: 400, body: "Missing key parameter" };
  }

  try {
    const store = getStore("uploads");
    const blob = await store.get(key, { type: "arrayBuffer" });

    if (!blob) {
      return { statusCode: 404, body: "File not found" };
    }

    const { metadata } = await store.getMetadata(key);
    const contentType = metadata?.contentType || "application/octet-stream";

    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${metadata?.filename || key}"`,
        "Cache-Control": "public, max-age=3600"
      },
      body: Buffer.from(blob).toString("base64"),
      isBase64Encoded: true
    };
  } catch (err) {
    return { statusCode: 500, body: "Error retrieving file: " + err.message };
  }
};
