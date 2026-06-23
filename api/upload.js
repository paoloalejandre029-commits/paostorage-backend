import { google } from 'googleapis';
import multiparty from 'multiparty';
import fs from 'fs';

export const config = {
  api: { bodyParser: false }, // Disables Vercel's default parser to handle file streams
};

export default async function handler(req, res) {
  // Enable CORS so your frontend can communicate with it
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = new multiparty.Form();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: 'Error parsing form data' });
    }

    const file = files.file[0];
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      // Authenticate with Google Drive using Environment Variables
      const auth = new google.auth.JWT(
        process.env.GOOGLE_CLIENT_EMAIL,
        null,
        process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Fixes formatting issues with newlines
        ['https://www.googleapis.com/auth/drive.file']
      );

      const drive = google.drive({ version: 'v3', auth });

      const fileMetadata = {
        name: file.originalFilename,
        parents: [process.env.GOOGLE_FOLDER_ID], // Your shared folder ID
      };

      const media = {
        mimeType: file.headers['content-type'],
        body: fs.createReadStream(file.path),
      };

      const response = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id',
      });

      return res.status(200).json({ success: true, fileId: response.data.id });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Google Drive Upload Failed', details: error.message });
    }
  });
}