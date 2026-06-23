import { google } from 'googleapis';

export default async function handler(req, res) {
  // 1. Handle CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2. Parse the body. Since Vercel automatically parses JSON/Base64,
    // we can read file details passed directly from our frontend.
    const { fileName, mimeType, fileData } = req.body;

    if (!fileData) {
      return res.status(400).json({ error: 'Missing file data' });
    }

    // 3. Authenticate with Google Drive
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/drive.file']
    );

    const drive = google.drive({ version: 'v3', auth });

    // 4. Convert Base64 string from frontend back to a readable buffer stream
    const buffer = Buffer.from(fileData, 'base64');
    const { Readable } = await import('stream');
    const bufferStream = new Readable();
    bufferStream.push(buffer);
    bufferStream.push(null);

    const fileMetadata = {
      name: fileName || 'Uploaded_File',
      parents: [process.env.GOOGLE_FOLDER_ID],
    };

    const media = {
      mimeType: mimeType,
      body: bufferStream,
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',
    });

    return res.status(200).json({ success: true, fileId: response.data.id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Upload failed', details: error.message });
  }
}
