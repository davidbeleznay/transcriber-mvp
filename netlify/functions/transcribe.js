import OpenAI from "openai";
import Busboy from "busboy";

export const handler = async (event) => {
  // Add CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const contentType = event.headers["content-type"] || event.headers["Content-Type"];
  if (!contentType?.includes("multipart/form-data")) {
    return { 
      statusCode: 400, 
      headers,
      body: JSON.stringify({ error: "Expected multipart/form-data" }) 
    };
  }

  // Check if body exists and log its size
  if (!event.body) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "No request body received" })
    };
  }

  const bodySize = event.isBase64Encoded 
    ? Buffer.from(event.body, 'base64').length 
    : event.body.length;
  
  console.log(`Received request body: ${(bodySize / 1024 / 1024).toFixed(2)} MB, base64: ${event.isBase64Encoded}`);

  // Netlify has ~6MB limit on sync functions
  if (bodySize > 6 * 1024 * 1024) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        error: `File too large for Netlify (${(bodySize / 1024 / 1024).toFixed(1)} MB). Try a file under 6 MB or ~4 minutes of audio.` 
      })
    };
  }

  try {
    const audio = await parseMultipart(event, contentType);
    
    if (!audio?.buffer) {
      return { 
        statusCode: 400, 
        headers,
        body: JSON.stringify({ error: "No audio file found in upload. Field name should be 'audio'." })
      };
    }

    console.log(`Parsed file: ${audio.filename} (${(audio.buffer.length / 1024 / 1024).toFixed(2)} MB)`);

    // Check OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "OPENAI_API_KEY not configured in environment variables" })
      };
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const file = new File(
      [audio.buffer], 
      audio.filename || "audio.m4a", 
      { type: audio.mimeType || "audio/mp4" }
    );

    console.log(`Sending to OpenAI Whisper...`);

    const result = await client.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
    });

    console.log(`Transcription complete: ${result.text.length} characters`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ text: result.text, filename: audio.filename }),
    };

  } catch (err) {
    console.error("Transcription error:", err);
    
    let errorMessage = err?.message || String(err);
    
    if (err.status === 413) {
      errorMessage = "File too large for OpenAI API (max 25 MB)";
    } else if (err.status === 401) {
      errorMessage = "OpenAI API key is invalid or expired";
    } else if (err.code === "ECONNRESET" || err.code === "ETIMEDOUT") {
      errorMessage = "Request timed out. Try a shorter recording.";
    }

    return { 
      statusCode: err.status || 500, 
      headers,
      body: JSON.stringify({ error: errorMessage })
    };
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
      
      console.log(`Parsing file field: ${fieldname}, filename: ${filename}, type: ${mimeType}`);
      
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => {
        result.buffer = Buffer.concat(chunks);
        result.filename = filename;
        result.mimeType = mimeType;
      });
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        reject(err);
      });
    });

    bb.on("error", (err) => {
      console.error("Busboy error:", err);
      reject(err);
    });
    
    bb.on("finish", () => {
      console.log("Busboy parsing complete");
      resolve(result);
    });

    const body = Buffer.from(
      event.body || "", 
      event.isBase64Encoded ? "base64" : "utf8"
    );
    bb.end(body);
  });
}
