import OpenAI from "openai";
import Busboy from "busboy";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const contentType = event.headers["content-type"] || event.headers["Content-Type"];
  if (!contentType?.includes("multipart/form-data")) {
    return { statusCode: 400, body: "Expected multipart/form-data" };
  }

  try {
    const audio = await parseMultipart(event, contentType);
    
    if (!audio?.buffer) {
      return { statusCode: 400, body: "No audio file uploaded." };
    }

    const maxSize = 25 * 1024 * 1024;
    if (audio.buffer.length > maxSize) {
      return {
        statusCode: 400,
        body: `File too large (${(audio.buffer.length / 1024 / 1024).toFixed(1)} MB). Maximum is 25 MB.`
      };
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const file = new File(
      [audio.buffer], 
      audio.filename || "audio.m4a", 
      { type: audio.mimeType || "audio/mp4" }
    );

    console.log(`Transcribing: ${audio.filename} (${(audio.buffer.length / 1024 / 1024).toFixed(2)} MB)`);

    const result = await client.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
    });

    console.log("Transcription complete");

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: result.text, filename: audio.filename }),
    };

  } catch (err) {
    console.error("Transcription error:", err);
    
    if (err.status === 413) {
      return { statusCode: 413, body: "File too large for transcription API" };
    }
    if (err.status === 401) {
      return { statusCode: 500, body: "API key not configured or invalid" };
    }

    return { statusCode: 500, body: String(err?.message || err) };
  }
};

function parseMultipart(event, contentType) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ 
      headers: { "content-type": contentType },
      limits: { fileSize: 30 * 1024 * 1024 }
    });
    
    const result = {};

    bb.on("file", (fieldname, stream, info) => {
      const { filename, mimeType } = info;
      const chunks = [];
      
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => {
        result.buffer = Buffer.concat(chunks);
        result.filename = filename;
        result.mimeType = mimeType;
      });
      stream.on("error", reject);
    });

    bb.on("error", reject);
    bb.on("finish", () => resolve(result));

    const body = Buffer.from(
      event.body || "", 
      event.isBase64Encoded ? "base64" : "utf8"
    );
    bb.end(body);
  });
}
