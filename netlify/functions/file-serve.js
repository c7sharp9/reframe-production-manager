// Serves uploaded files from Netlify Blobs via raw HTTP (no npm deps)
// Gives Airtable a public URL to download attachments from

function getBlobsContext() {
  const raw = process.env.NETLIFY_BLOBS_CONTEXT;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) {}
  try { return JSON.parse(Buffer.from(raw, "base64").toString()); } catch (e) {}
  return null;
}

function blobUrl(ctx, storeName, key) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  if (ctx.edgeURL) {
    return `${ctx.edgeURL}/${ctx.siteID}:site:${storeName}/${encodedKey}`;
  }
  const api = ctx.apiURL || "https://api.netlify.com";
  return `${api}/api/v1/blobs/${ctx.siteID}/site/${storeName}/${encodedKey}`;
}

exports.handler = async (event) => {
  const key = event.queryStringParameters?.key;

  if (!key) {
    return { statusCode: 400, body: "Missing key parameter" };
  }

  try {
    const ctx = getBlobsContext();
    if (!ctx) {
      return { statusCode: 500, body: "Netlify Blobs context not available" };
    }

    const store = "uploads";

    // Fetch the file binary
    const fileUrl = blobUrl(ctx, store, key);
    const fileRes = await fetch(fileUrl, {
      headers: { "Authorization": `Bearer ${ctx.token}` }
    });

    if (!fileRes.ok) {
      return { statusCode: 404, body: "File not found" };
    }

    // Fetch metadata
    const metaUrl = blobUrl(ctx, store, key + "__meta");
    const metaRes = await fetch(metaUrl, {
      headers: { "Authorization": `Bearer ${ctx.token}` }
    });

    let meta = { contentType: "application/octet-stream", filename: key };
    if (metaRes.ok) {
      try { meta = await metaRes.json(); } catch (e) {}
    }

    const buffer = Buffer.from(await fileRes.arrayBuffer());

    return {
      statusCode: 200,
      headers: {
        "Content-Type": meta.contentType,
        "Content-Disposition": `inline; filename="${meta.filename}"`,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*"
      },
      body: buffer.toString("base64"),
      isBase64Encoded: true
    };
  } catch (err) {
    return { statusCode: 500, body: "Error: " + err.message };
  }
};
