import { google } from 'googleapis';

export default async function handler(req, res) {
  // 1. Force CORS headers to be sent immediately, no matter what happens next
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
    const { fileName, mimeType, fileData } = req.body;

    if (!fileData) {
      return res.status(400).json({ error: 'Missing file data' });
    }

    // 2. Extra robust private key cleaning
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (privateKey) {
      // Fixes any literal '\n' text or double quotes introduced during copying/pasting
      privateKey = privateKey.replace(/\\n/g, '\n').replace(/"/g, '');
    }

    // 3. Authenticate with Google Drive
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/drive.file']
    );

    const drive = google.drive({ version: 'v3', auth });

    // 4. Convert Base64 string to buffer stream
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
    console.error("CRASH ERROR:", error);
    // Return a 200 with success:false so the browser doesn't drop the connection on a crash
    return res.status(200).json({ success: false, error: 'Server crashed internally', details: error.message });
  }
}
