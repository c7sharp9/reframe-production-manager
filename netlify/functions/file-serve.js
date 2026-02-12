// This function is no longer used.
// file-upload.js now handles both uploading and serving files.
// You can safely delete this file from your repo.

exports.handler = async () => {
  return {
    statusCode: 410,
    body: "This endpoint has been retired. File serving is now handled by file-upload."
  };
};
