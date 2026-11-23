import {ExtractedFrame} from '../types';

export interface ExtractionProgress {
  sampledCount: number;
  totalToSample: number;
  currentTimestamp: number;
  percent: number;
}

/**
 * Formats seconds into MM:SS.ms offset string (e.g. "00:04.2s")
 */
export function formatVideoTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds - mins * 60;
  const minsStr = String(mins).padStart(2, '0');
  const wholeSecs = Math.floor(secs);
  const tenths = Math.floor((secs - wholeSecs) * 10);
  const secsStr = String(wholeSecs).padStart(2, '0');
  return `${minsStr}:${secsStr}.${tenths}s`;
}

/**
 * Computes a fast grayscale Laplacian + Sobel edge-sharpness score
 * on an ImageData buffer. Higher variance of Laplacian = sharper edges & less motion blur.
 */
export function calculateFrameSharpness(imageData: ImageData): number {
  const {data, width, height} = imageData;
  const gray = new Float32Array(width * height);

  // Convert RGBA to luminance grayscale
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // Compute 3x3 Laplacian response L = -4*c + top + bottom + left + right
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  // Step by 2 pixels for ultra-fast mobile performance while preserving high accuracy
  for (let y = 1; y < height - 1; y += 2) {
    const rowOffset = y * width;
    for (let x = 1; x < width - 1; x += 2) {
      const idx = rowOffset + x;
      const center = gray[idx];
      const lap =
        gray[idx - width] +
        gray[idx + width] +
        gray[idx - 1] +
        gray[idx + 1] -
        4 * center;

      // Also include horizontal/vertical Sobel gradient magnitude for texture richness
      const gx = gray[idx + 1] - gray[idx - 1];
      const gy = gray[idx + width] - gray[idx - width];
      const metric = Math.abs(lap) + 0.35 * Math.sqrt(gx * gx + gy * gy);

      sum += metric;
      sumSq += metric * metric;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  const variance = Math.max(0, sumSq / count - mean * mean);
  return Math.round(variance * 10) / 10;
}

/**
 * Steps through a local video File/Blob in-browser using an off-screen HTML5 <video> and <canvas>
 * at ~5-10 fps (up to 150 sampled frames), scores sharpness via Laplacian variance,
 * and returns the top 12 sharpest frames spaced at least 0.3 seconds apart, sorted chronologically.
 */
export async function extractSharpestFramesFromVideoFile(
  file: File | Blob,
  onProgress: (progress: ExtractionProgress) => void
): Promise<{
  frames: ExtractedFrame[];
  totalSampled: number;
  videoDuration: number;
}> {
  return new Promise((resolve, reject) => {
    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.src = videoUrl;

    const cleanup = () => {
      URL.revokeObjectURL(videoUrl);
      video.removeAttribute('src');
      video.load();
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to decode video file locally. Please try an MP4, WebM, or MOV clip.'));
    };

    video.onloadedmetadata = async () => {
      try {
        const rawDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 12;
        const duration = Math.min(rawDuration, 60); // Cap scan window to 60s if clip is very long
        // Sample at ~5-10 frames per second, up to 150 sampled frames
        const targetFps = duration <= 15 ? 10 : duration <= 30 ? 5 : 150 / duration;
        const totalSamples = Math.min(150, Math.max(12, Math.floor(duration * targetFps)));
        const stepSec = duration / totalSamples;

        const nativeW = video.videoWidth || 640;
        const nativeH = video.videoHeight || 360;

        // Analysis canvas for fast grayscale Laplacian scoring
        const scoreW = 240;
        const scoreH = Math.max(135, Math.round((nativeH / nativeW) * scoreW));
        const scoreCanvas = document.createElement('canvas');
        scoreCanvas.width = scoreW;
        scoreCanvas.height = scoreH;
        const scoreCtx = scoreCanvas.getContext('2d', {willReadFrequently: true});

        // Output canvas for high-clarity compressed JPEG frame extraction
        const maxOutW = 960;
        const scale = Math.min(1, maxOutW / nativeW);
        const outW = Math.round(nativeW * scale);
        const outH = Math.round(nativeH * scale);
        const outCanvas = document.createElement('canvas');
        outCanvas.width = outW;
        outCanvas.height = outH;
        const outCtx = outCanvas.getContext('2d');

        if (!scoreCtx || !outCtx) {
          cleanup();
          reject(new Error('HTML5 Canvas 2D context unavailable on this device.'));
          return;
        }

        interface CandidateFrame {
          timestampSeconds: number;
          sharpnessScore: number;
          dataUrl: string;
          width: number;
          height: number;
        }

        const candidates: CandidateFrame[] = [];

        const seekToTime = (timeSec: number): Promise<void> => {
          return new Promise((res) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              res();
            };
            video.addEventListener('seeked', onSeeked, {once: true});
            video.currentTime = Math.min(duration - 0.01, Math.max(0, timeSec));
          });
        };

        for (let i = 0; i < totalSamples; i++) {
          const t = Number((i * stepSec).toFixed(3));
          await seekToTime(t);

          scoreCtx.drawImage(video, 0, 0, scoreW, scoreH);
          const imgData = scoreCtx.getImageData(0, 0, scoreW, scoreH);
          const sharpnessScore = calculateFrameSharpness(imgData);

          outCtx.drawImage(video, 0, 0, outW, outH);
          const dataUrl = outCanvas.toDataURL('image/jpeg', 0.84);

          candidates.push({
            timestampSeconds: t,
            sharpnessScore,
            dataUrl,
            width: outW,
            height: outH,
          });

          onProgress({
            sampledCount: i + 1,
            totalToSample: totalSamples,
            currentTimestamp: t,
            percent: Math.round(((i + 1) / totalSamples) * 100),
          });
        }

        cleanup();

        // Sort candidates by sharpness descending and greedily pick top 12 spaced >= 0.3s apart
        const bySharpness = [...candidates].sort((a, b) => b.sharpnessScore - a.sharpnessScore);
        const picked: CandidateFrame[] = [];
        const MIN_SPACING_SEC = 0.3;

        for (const cand of bySharpness) {
          if (picked.length >= 12) break;
          const tooClose = picked.some(
            (existing) => Math.abs(existing.timestampSeconds - cand.timestampSeconds) < MIN_SPACING_SEC
          );
          if (!tooClose) {
            picked.push(cand);
          }
        }

        // If clip was extremely short and < 12 matched 0.3s spacing, fill remaining highest sharpness
        if (picked.length < Math.min(12, candidates.length)) {
          for (const cand of bySharpness) {
            if (picked.length >= 12) break;
            if (!picked.includes(cand)) {
              picked.push(cand);
            }
          }
        }

        // Sort chronologically
        picked.sort((a, b) => a.timestampSeconds - b.timestampSeconds);

        const finalFrames: ExtractedFrame[] = picked.map((item, idx) => ({
          id: `frame-${idx + 1}-${Math.round(item.timestampSeconds * 1000)}`,
          frameNumber: idx + 1,
          timestampSeconds: item.timestampSeconds,
          timestampFormatted: formatVideoTimestamp(item.timestampSeconds),
          sharpnessScore: item.sharpnessScore,
          dataUrl: item.dataUrl,
          selected: true,
          width: item.width,
          height: item.height,
        }));

        resolve({
          frames: finalFrames,
          totalSampled: totalSamples,
          videoDuration: Number(duration.toFixed(1)),
        });
      } catch (err) {
        cleanup();
        reject(err);
      }
    };
  });
}

/**
 * Generates a realistic 48-frame simulated residential CCTV parking incident directly on an HTML5 Canvas,
 * runs the exact same Laplacian sharpness filter across all 48 sampled frames (including intentional motion blur
 * on intermediate frames), and returns the top 12 sharpest frames spaced >= 0.3s apart.
 * This allows users testing on a device without a CCTV file to test the entire on-device pipeline immediately.
 */
export async function runOnDeviceSimulatedCctvExtraction(
  metadataContext: {plateNumber: string; location: string; makeModel: string},
  onProgress: (progress: ExtractionProgress) => void
): Promise<{
  frames: ExtractedFrame[];
  totalSampled: number;
  videoDuration: number;
  simulatedVideoUrl?: string;
}> {
  const totalSamples = 48; // 9.6 seconds at 5 fps
  const duration = 9.6;
  const outW = 800;
  const outH = 450;

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  if (!ctx) throw new Error('Canvas 2D unavailable');

  let mediaRecorder: MediaRecorder | null = null;
  const recordedChunks: BlobPart[] = [];
  try {
    const canCapture =
      typeof canvas.captureStream === 'function' &&
      typeof MediaRecorder !== 'undefined';
    if (canCapture) {
      const stream = canvas.captureStream(25);
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordedChunks.push(ev.data);
        }
      };
      mediaRecorder.start();
    }
  } catch {
    mediaRecorder = null;
  }

  interface Candidate {
    timestampSeconds: number;
    sharpnessScore: number;
    dataUrl: string;
    width: number;
    height: number;
  }

  const candidates: Candidate[] = [];

  for (let i = 0; i < totalSamples; i++) {
    const t = Number((i * 0.2).toFixed(2));
    // Simulate periodic CCTV motion blur on certain frames so Laplacian sharpness filter demonstrates real discrimination
    const isBlurryFrame = i % 3 === 1;

    ctx.save();
    if (isBlurryFrame) {
      ctx.filter = 'blur(3.5px)';
    } else {
      ctx.filter = 'none';
    }

    // Background: Nighttime RT/RW residential alley & carport under sodium/LED streetlight
    const bgGrad = ctx.createLinearGradient(0, 0, 0, outH);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.55, '#1e293b');
    bgGrad.addColorStop(1, '#334155');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, outW, outH);

    // Concrete wall & gate grid lines (high frequency edges for Laplacian scoring)
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    for (let gx = 40; gx < outW; gx += 75) {
      ctx.beginPath();
      ctx.moveTo(gx, 70);
      ctx.lineTo(gx, 255);
      ctx.stroke();
    }
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 255, outW, 195);

    // Paving block lines on alley floor
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    for (let py = 270; py < outH; py += 30) {
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(outW, py);
      ctx.stroke();
    }

    // Streetlight cone
    const coneGrad = ctx.createRadialGradient(420, 40, 10, 420, 240, 340);
    coneGrad.addColorStop(0, 'rgba(254, 240, 138, 0.25)');
    coneGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = coneGrad;
    ctx.fillRect(0, 0, outW, outH);

    // Target Parked Motorcycle (center-left)
    const motoOffsetX = t > 7.2 ? (t - 7.2) * 55 : 0; // Being pushed away after 7.2s
    const mx = 230 + motoOffsetX;
    const my = 295;

    // Wheels
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(mx - 65, my + 45, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mx + 65, my + 45, 34, 0, Math.PI * 2);
    ctx.stroke();

    // Scooter Body (Matte Black / Dark Slate with Cyan-Red trim)
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.moveTo(mx - 70, my + 20);
    ctx.lineTo(mx - 20, my - 25);
    ctx.lineTo(mx + 50, my - 35);
    ctx.lineTo(mx + 75, my + 20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Target License Plate Box
    ctx.fillStyle = '#111827';
    ctx.fillRect(mx - 92, my - 2, 48, 20);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mx - 92, my - 2, 48, 20);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 10px monospace';
    ctx.fillText((metadataContext.plateNumber || 'B 4821 KXZ').slice(0, 10), mx - 89, my + 12);

    // Accomplice Getaway Motorcycle idling on right side (x = 640)
    const gx = 635;
    const gy = 285;
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(gx - 50, gy + 40, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(gx + 50, gy + 40, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#991b1b'; // Red-black getaway beat scooter
    ctx.fillRect(gx - 45, gy - 15, 90, 38);

    // Primary Suspect approaching & tampering with ignition lock
    // Moves from x=520 toward x=280 between 0s and 4.5s, crouches near ignition 4.5s-7.2s, pushes bike 7.2s+
    let sx = 520;
    if (t <= 4.4) {
      sx = 520 - (t / 4.4) * 235;
    } else if (t <= 7.2) {
      sx = 285;
    } else {
      sx = 285 + motoOffsetX;
    }
    const sy = t > 4.4 && t <= 7.2 ? 178 : 168; // Slightly crouched while forcing ignition

    // Suspect Lower Clothing (Blue-Gray Denim Jeans & White-Sole Sneakers)
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(sx - 20, sy + 88, 17, 68);
    ctx.fillRect(sx + 4, sy + 88, 17, 68);
    // White-sole black sneakers
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(sx - 24, sy + 154, 22, 12);
    ctx.fillRect(sx + 2, sy + 154, 22, 12);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(sx - 24, sy + 163, 22, 4);
    ctx.fillRect(sx + 2, sy + 163, 22, 4);

    // Suspect Upper Clothing (Charcoal Hoodie Jacket with High-Vis Amber Chest Stripe & Crossbody Sling Bag)
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(sx - 28, sy + 12, 56, 78);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx - 28, sy + 12, 56, 78);

    // Reflective Gold/Amber Horizontal Stripe on Jacket
    ctx.fillStyle = '#d97706';
    ctx.fillRect(sx - 26, sy + 34, 52, 12);

    // Diagonal Black Crossbody Sling Bag
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(sx - 24, sy + 14);
    ctx.lineTo(sx + 24, sy + 82);
    ctx.stroke();

    // Arms reaching toward motorcycle handlebar/ignition key slot
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(sx - 22, sy + 28);
    ctx.lineTo(mx + 35, my - 22);
    ctx.stroke();

    // T-Key Tool glint near ignition lock during 4.4s - 7.0s
    if (t >= 4.2 && t <= 7.2) {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(mx + 35, my - 24, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Suspect Head / Half-Face Gloss White Helmet with Dark Visor & Black Face Mask
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(sx, sy - 14, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dark Tinted Visor
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(sx - 22, sy - 24, 30, 13);

    // Lower Face Mask
    ctx.fillStyle = '#111827';
    ctx.fillRect(sx - 18, sy - 9, 24, 14);

    ctx.restore();

    // Crisp CCTV OSD Timestamp Overlay (Top-Left & Top-Right)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fillRect(16, 14, 365, 30);
    ctx.fillRect(outW - 230, 14, 214, 30);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`CAM-02 RT/RW · ${formatVideoTimestamp(t)}`, 26, 34);
    ctx.fillStyle = '#22d3ee';
    ctx.fillText(`CH02 · 1080P LOCAL`, outW - 218, 34);

    const imgData = ctx.getImageData(0, 0, outW, outH);
    const sharpnessScore = calculateFrameSharpness(imgData);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);

    candidates.push({
      timestampSeconds: t,
      sharpnessScore,
      dataUrl,
      width: outW,
      height: outH,
    });

    onProgress({
      sampledCount: i + 1,
      totalToSample: totalSamples,
      currentTimestamp: t,
      percent: Math.round(((i + 1) / totalSamples) * 100),
    });

    // Yield briefly to render progress smoothly in UI
    await new Promise((r) => setTimeout(r, 12));
  }

  const bySharpness = [...candidates].sort((a, b) => b.sharpnessScore - a.sharpnessScore);
  const picked: Candidate[] = [];
  for (const cand of bySharpness) {
    if (picked.length >= 12) break;
    const tooClose = picked.some((p) => Math.abs(p.timestampSeconds - cand.timestampSeconds) < 0.3);
    if (!tooClose) picked.push(cand);
  }
  picked.sort((a, b) => a.timestampSeconds - b.timestampSeconds);

  const finalFrames: ExtractedFrame[] = picked.map((item, idx) => ({
    id: `sim-frame-${idx + 1}`,
    frameNumber: idx + 1,
    timestampSeconds: item.timestampSeconds,
    timestampFormatted: formatVideoTimestamp(item.timestampSeconds),
    sharpnessScore: item.sharpnessScore,
    dataUrl: item.dataUrl,
    selected: true,
    width: item.width,
    height: item.height,
  }));

  let simulatedVideoUrl: string | undefined;
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    simulatedVideoUrl = await new Promise<string | undefined>((res) => {
      if (!mediaRecorder) {
        res(undefined);
        return;
      }
      mediaRecorder.onstop = () => {
        if (recordedChunks.length > 0) {
          const blob = new Blob(recordedChunks, {type: 'video/webm'});
          res(URL.createObjectURL(blob));
        } else {
          res(undefined);
        }
      };
      mediaRecorder.stop();
    });
  }

  return {
    frames: finalFrames,
    totalSampled: totalSamples,
    videoDuration: duration,
    simulatedVideoUrl,
  };
}
