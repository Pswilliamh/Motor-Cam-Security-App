import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {
  GoogleGenAI,
  MediaResolution,
  Type,
  GenerateContentResponse,
} from '@google/genai';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure valid PNG PWA icon files exist in public/ so manifest & iOS Safari checks succeed
function createSolidPng(width: number, height: number, r: number, g: number, b: number): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const combined = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(combined), 0);
    return Buffer.concat([len, combined, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowSize = width * 4 + 1;
  const raw = Buffer.alloc(rowSize * height);
  const cx = width / 2;
  const cy = height / 2;
  const outerR = width * 0.36;
  const innerR = width * 0.16;

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize;
    raw[rowStart] = 0; // filter type 0
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (Math.abs(dist - outerR) < width * 0.04) {
        // Gold ring (#D97706)
        raw[px] = 217;
        raw[px + 1] = 119;
        raw[px + 2] = 6;
        raw[px + 3] = 255;
      } else if (dist < innerR) {
        // Cyan lens center (#0891B2)
        raw[px] = 8;
        raw[px + 1] = 145;
        raw[px + 2] = 178;
        raw[px + 3] = 255;
      } else {
        // Deep Navy background (#0F172A)
        raw[px] = r;
        raw[px + 1] = g;
        raw[px + 2] = b;
        raw[px + 3] = 255;
      }
    }
  }

  const idatData = zlib.deflateSync(raw);
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idatData),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function ensurePwaIcons() {
  const publicDir = path.resolve(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, {recursive: true});
  }
  const icons: Array<{name: string; size: number}> = [
    {name: 'apple-touch-icon.png', size: 180},
    {name: 'pwa-192x192.png', size: 192},
    {name: 'pwa-512x512.png', size: 512},
    {name: 'pwa-maskable-512x512.png', size: 512},
  ];
  for (const icon of icons) {
    const filePath = path.join(publicDir, icon.name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, createSolidPng(icon.size, icon.size, 15, 23, 42));
    }
  }
}

ensurePwaIcons();

const SYSTEM_INSTRUCTION =
  "You are an objective digital video incident observer assisting with property theft documentation. Do NOT guess or invent any person's legal name or identity. Analyze the sequential frames chronologically and return a strict JSON object containing:\n" +
  "1) 'timeline': array of { timestamp_offset, frame_number, action_summary }\n" +
  "2) 'clearest_suspect_frame': { frame_number, face_head_box: [ymin, xmin, ymax, xmax] (0-1000 normalized), full_body_box: [ymin, xmin, ymax, xmax] (0-1000 normalized), visibility_notes }\n" +
  "3) 'suspect_visual_profile': { estimated_build_and_posture, hair_and_facial_features, helmet_and_headgear, upper_clothing, lower_clothing, footwear_and_bags }\n" +
  "4) 'accomplice_or_getaway_vehicle': { vehicle_type_and_model, color, plate_visibility, distinguishing_marks }\n" +
  "5) 'technical_caveats': objective notes on lighting, distance, or motion blur.";

const INCIDENT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    timeline: {
      type: Type.ARRAY,
      description: 'Chronological timeline of actions across the analyzed frames.',
      items: {
        type: Type.OBJECT,
        properties: {
          timestamp_offset: {
            type: Type.STRING,
            description: 'Video offset timestamp such as 00:04.2s',
          },
          frame_number: {
            type: Type.INTEGER,
            description: '1-based index of the frame in the submitted batch',
          },
          action_summary: {
            type: Type.STRING,
            description: 'Objective description of observed movement or action in this frame',
          },
        },
        required: ['timestamp_offset', 'frame_number', 'action_summary'],
      },
    },
    clearest_suspect_frame: {
      type: Type.OBJECT,
      description: 'The single frame number where the primary suspect or subject is clearest, with normalized 0-1000 bounding boxes.',
      properties: {
        frame_number: {
          type: Type.INTEGER,
          description: '1-based frame number from the submitted frames that shows the clearest view of the suspect/subject.',
        },
        face_head_box: {
          type: Type.ARRAY,
          description: 'Normalized [ymin, xmin, ymax, xmax] coordinates (0 to 1000) for the head/helmet/face area.',
          items: {type: Type.INTEGER},
        },
        full_body_box: {
          type: Type.ARRAY,
          description: 'Normalized [ymin, xmin, ymax, xmax] coordinates (0 to 1000) for the full body of the suspect.',
          items: {type: Type.INTEGER},
        },
        visibility_notes: {
          type: Type.STRING,
          description: 'Notes explaining why this frame was selected and visibility conditions.',
        },
      },
      required: ['frame_number', 'face_head_box', 'full_body_box', 'visibility_notes'],
    },
    suspect_visual_profile: {
      type: Type.OBJECT,
      properties: {
        estimated_build_and_posture: {type: Type.STRING},
        hair_and_facial_features: {type: Type.STRING},
        helmet_and_headgear: {type: Type.STRING},
        upper_clothing: {type: Type.STRING},
        lower_clothing: {type: Type.STRING},
        footwear_and_bags: {type: Type.STRING},
      },
      required: [
        'estimated_build_and_posture',
        'hair_and_facial_features',
        'helmet_and_headgear',
        'upper_clothing',
        'lower_clothing',
        'footwear_and_bags',
      ],
    },
    accomplice_or_getaway_vehicle: {
      type: Type.OBJECT,
      properties: {
        vehicle_type_and_model: {type: Type.STRING},
        color: {type: Type.STRING},
        plate_visibility: {type: Type.STRING},
        distinguishing_marks: {type: Type.STRING},
      },
      required: ['vehicle_type_and_model', 'color', 'plate_visibility', 'distinguishing_marks'],
    },
    technical_caveats: {
      type: Type.STRING,
      description: 'Objective notes on lighting, distance, camera angle, compression artifacts, or motion blur.',
    },
  },
  required: [
    'timeline',
    'clearest_suspect_frame',
    'suspect_visual_profile',
    'accomplice_or_getaway_vehicle',
    'technical_caveats',
  ],
};

async function startServer() {
  const app = express();
  app.use(express.json({limit: '45mb'}));

  // Stateless Gemini Vision proxy route — zero video or image retention on disk or database
  app.post('/api/analyze-incident', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error:
            'GEMINI_API_KEY is not configured. Please check the API key in Settings > Secrets.',
        });
      }

      const {frames, incidentMeta, modelName, language} = req.body as {
        frames: Array<{
          frame_number: number;
          timestamp_offset: string;
          base64Data: string;
          mimeType?: string;
        }>;
        incidentMeta?: {
          dateTime?: string;
          location?: string;
          motorcycleDetails?: string;
          reporterNotes?: string;
        };
        modelName?: string;
        language?: 'id' | 'en';
      };

      if (!Array.isArray(frames) || frames.length === 0) {
        return res.status(400).json({
          error: 'No extracted video frames were provided for analysis.',
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const requestedModel =
        modelName === 'gemini-2.5-pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';

      const langInstruction =
        language === 'id'
          ? 'Write all descriptive string values inside the JSON object in clear, formal Bahasa Indonesia suitable for an RT/RW or Polsek community incident report (Laporan Kejadian Curanmor).'
          : 'Write all descriptive string values inside the JSON object in clear, objective English suitable for a neighborhood watch or police property theft documentation brief.';

      const parts: Array<
        | {text: string}
        | {inlineData: {mimeType: string; data: string}}
      > = [];

      parts.push({
        text: `Incident Context Provided by Lawful Reporter:
- Incident Date & Time: ${incidentMeta?.dateTime || 'Not specified'}
- Location (RT/RW / Street / Area): ${incidentMeta?.location || 'Not specified'}
- Target Motorcycle Details (Make / Color / Plate): ${incidentMeta?.motorcycleDetails || 'Not specified'}
- Additional Reporter Notes: ${incidentMeta?.reporterNotes || 'None'}

Language Requirement: ${langInstruction}

Below are ${frames.length} sequential sharpest frames extracted locally on-device from the CCTV/dashcam clip. Each frame is preceded by its frame_number (1 to ${frames.length}) and exact video timestamp_offset. Ensure 'frame_number' in your response refers to this 1-based index (1..${frames.length}) and bounding boxes are [ymin, xmin, ymax, xmax] normalized from 0 to 1000.`,
      });

      for (const frame of frames) {
        const cleanBase64 = frame.base64Data.includes(',')
          ? frame.base64Data.split(',')[1]
          : frame.base64Data;
        parts.push({
          text: `Frame #${frame.frame_number} (Timestamp Offset: ${frame.timestamp_offset}):`,
        });
        parts.push({
          inlineData: {
            mimeType: frame.mimeType || 'image/jpeg',
            data: cleanBase64,
          },
        });
      }

      const callModel = async (targetModel: string): Promise<GenerateContentResponse> => {
        return await ai.models.generateContent({
          model: targetModel,
          contents: {parts},
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
            responseMimeType: 'application/json',
            responseSchema: INCIDENT_RESPONSE_SCHEMA,
          },
        });
      };

      let response: GenerateContentResponse;
      let usedModel = requestedModel;

      try {
        response = await callModel(requestedModel);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        // Fallback to active gemini-4-hydrogen if gemini-2.5-flash/pro returns 404 NOT_FOUND in this environment
        if (errMsg.includes('404') || errMsg.includes('NOT_FOUND') || errMsg.includes('not found')) {
          usedModel = 'gemini-4-hydrogen';
          response = await callModel(usedModel);
        } else {
          throw err;
        }
      }

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);

      return res.json({
        analysis: parsed,
        modelUsed: usedModel,
        processedAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unexpected error during Gemini Vision analysis';
      console.error('Gemini Vision analysis error:', message);
      return res.status(500).json({
        error: message,
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`MotoGuard Incident Helper server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
