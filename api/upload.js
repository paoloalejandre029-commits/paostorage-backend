import { google } from 'googleapis';

export default async function handler(req, res) {
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

    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (privateKey) {
      privateKey = privateKey.replace(/\\n/g, '\n').replace(/"/g, '');
    }

    // Authenticate with a broader scope to allow permission modifications
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/drive']
    );

    const drive = google.drive({ version: 'v3', auth });

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

    // 1. Create the file profile
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',
      supportsAllDrives: true,
    });

    const fileId = response.data.id;

    // 2. FORCE TRANSFER: Make your personal Gmail account the official owner 
    // This moves the file's file-size weight over to your personal storage quota.
    try {
      await drive.permissions.create({
        fileId: fileId,
        transferOwnership: true, 
        moveToNewOwnersDrive: false,
        supportsAllDrives: true,
        resource: {
          role: 'owner',
          type: 'user',
          emailAddress: 'paolo.alejandre029@gmail.com' // <-- Your real Gmail address
        }
      });
    } catch (permError) {
      console.warn("Ownership transfer warning (ignoring if file created):", permError.message);
    }

    return res.status(200).json({ success: true, fileId: fileId });
  } catch (error) {
    console.error("CRASH ERROR:", error);
    return res.status(500).json({ 
      error: 'Server crashed internally', 
      message: error.message,
      code: error.code
    });
  }
}
