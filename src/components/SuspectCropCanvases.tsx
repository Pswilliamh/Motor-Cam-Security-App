import React, {useEffect, useRef, useState} from 'react';
import {ClearestSuspectFrame, Language} from '../types';
import {TRANSLATIONS} from '../i18n';
import {Maximize2, SlidersHorizontal} from 'lucide-react';

interface SuspectCropCanvasesProps {
  frameDataUrl: string;
  frameTimestamp: string;
  clearestSuspect: ClearestSuspectFrame;
  language: Language;
}

/**
 * Clamps normalized [ymin, xmin, ymax, xmax] (0-1000) coordinates and applies optional padding
 */
function normalizeBox(
  box: [number, number, number, number] | undefined,
  fallback: [number, number, number, number],
  paddingPct: number
): [number, number, number, number] {
  const raw =
    Array.isArray(box) && box.length === 4 && box.every((n) => Number.isFinite(n))
      ? box
      : fallback;

  let [ymin, xmin, ymax, xmax] = raw;
  if (ymax <= ymin + 30) {
    ymin = fallback[0];
    ymax = fallback[2];
  }
  if (xmax <= xmin + 30) {
    xmin = fallback[1];
    xmax = fallback[3];
  }

  const h = ymax - ymin;
  const w = xmax - xmin;
  const padY = h * (paddingPct / 100);
  const padX = w * (paddingPct / 100);

  return [
    Math.max(0, Math.round(ymin - padY)),
    Math.max(0, Math.round(xmin - padX)),
    Math.min(1000, Math.round(ymax + padY)),
    Math.min(1000, Math.round(xmax + padX)),
  ];
}

export const SuspectCropCanvases: React.FC<SuspectCropCanvasesProps> = ({
  frameDataUrl,
  frameTimestamp,
  clearestSuspect,
  language,
}) => {
  const t = TRANSLATIONS[language];
  const fullCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bodyCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [paddingPct, setPaddingPct] = useState<number>(12);

  useEffect(() => {
    if (!frameDataUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const natW = img.naturalWidth || 800;
      const natH = img.naturalHeight || 450;

      const faceBox = normalizeBox(
        clearestSuspect.face_head_box,
        [250, 300, 460, 440],
        paddingPct
      );
      const bodyBox = normalizeBox(
        clearestSuspect.full_body_box,
        [240, 270, 780, 480],
        paddingPct
      );

      // 1) Draw Full Reference Frame with Bounding Box Overlays
      if (fullCanvasRef.current) {
        const c = fullCanvasRef.current;
        c.width = natW;
        c.height = natH;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, natW, natH);

          // Draw Full Body Box (Cyan #0891B2)
          const [bYmin, bXmin, bYmax, bXmax] = bodyBox;
          const bx = (bXmin / 1000) * natW;
          const by = (bYmin / 1000) * natH;
          const bw = ((bXmax - bXmin) / 1000) * natW;
          const bh = ((bYmax - bYmin) / 1000) * natH;

          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 3;
          ctx.strokeRect(bx, by, bw, bh);

          // Draw Face/Head Box (Royal Gold #D97706)
          const [fYmin, fXmin, fYmax, fXmax] = faceBox;
          const fx = (fXmin / 1000) * natW;
          const fy = (fYmin / 1000) * natH;
          const fw = ((fXmax - fXmin) / 1000) * natW;
          const fh = ((fYmax - fYmin) / 1000) * natH;

          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 3;
          ctx.strokeRect(fx, fy, fw, fh);
        }
      }

      // 2) Draw Unaltered Original Crop — Face / Head / Helmet
      if (faceCanvasRef.current) {
        const c = faceCanvasRef.current;
        const [fYmin, fXmin, fYmax, fXmax] = faceBox;
        const sx = Math.floor((fXmin / 1000) * natW);
        const sy = Math.floor((fYmin / 1000) * natH);
        const sw = Math.max(32, Math.floor(((fXmax - fXmin) / 1000) * natW));
        const sh = Math.max(32, Math.floor(((fYmax - fYmin) / 1000) * natH));

        const targetW = 360;
        const targetH = Math.max(220, Math.round((sh / sw) * targetW));
        c.width = targetW;
        c.height = targetH;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
        }
      }

      // 3) Draw Unaltered Original Crop — Full Body & Clothing
      if (bodyCanvasRef.current) {
        const c = bodyCanvasRef.current;
        const [bYmin, bXmin, bYmax, bXmax] = bodyBox;
        const sx = Math.floor((bXmin / 1000) * natW);
        const sy = Math.floor((bYmin / 1000) * natH);
        const sw = Math.max(48, Math.floor(((bXmax - bXmin) / 1000) * natW));
        const sh = Math.max(48, Math.floor(((bYmax - bYmin) / 1000) * natH));

        const targetW = 360;
        const targetH = Math.max(260, Math.round((sh / sw) * targetW));
        c.width = targetW;
        c.height = targetH;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
        }
      }
    };
    img.src = frameDataUrl;
  }, [frameDataUrl, clearestSuspect, paddingPct]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <Maximize2 className="w-4 h-4 shrink-0" />
          <span>{t.unalteredCropLabel}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">
            Frame #{clearestSuspect.frame_number} ({frameTimestamp})
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 no-print">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <label htmlFor="crop-pad-slider" className="font-medium">
            {t.cropPaddingLabel}: {paddingPct}%
          </label>
          <input
            id="crop-pad-slider"
            type="range"
            min={0}
            max={35}
            step={2}
            value={paddingPct}
            onChange={(e) => setPaddingPct(Number(e.target.value))}
            className="w-24 accent-cyan-600 cursor-pointer"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Full Reference Frame */}
        <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 p-3 print-break-inside-avoid">
          <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
            <span className="font-semibold">{t.fullFrameRefLabel}</span>
            <span className="font-mono-tabular">
              #{clearestSuspect.frame_number} · {frameTimestamp}
            </span>
          </div>
          <canvas
            ref={fullCanvasRef}
            className="w-full h-auto rounded-lg border border-slate-700 bg-slate-950"
          />
          <p className="mt-2 text-xs text-slate-300 leading-relaxed">
            {clearestSuspect.visibility_notes}
          </p>
        </div>

        {/* Two Zoomed-in HTML5 Canvas Crops */}
        <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 print-break-inside-avoid">
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">
              {t.faceHeadCropLabel}
            </div>
            <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400 mb-2">
              {t.unalteredCropLabel}
            </div>
            <div className="bg-slate-950 rounded-lg p-2 flex items-center justify-center min-h-[180px]">
              <canvas
                ref={faceCanvasRef}
                className="max-h-56 w-auto rounded border border-amber-500/60"
              />
            </div>
            <div className="mt-2 text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">
              Box [ymin,xmin,ymax,xmax]: [{clearestSuspect.face_head_box.join(', ')}]
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 print-break-inside-avoid">
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">
              {t.fullBodyCropLabel}
            </div>
            <div className="text-[11px] font-medium text-cyan-700 dark:text-cyan-400 mb-2">
              {t.unalteredCropLabel}
            </div>
            <div className="bg-slate-950 rounded-lg p-2 flex items-center justify-center min-h-[180px]">
              <canvas
                ref={bodyCanvasRef}
                className="max-h-56 w-auto rounded border border-cyan-500/60"
              />
            </div>
            <div className="mt-2 text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">
              Box [ymin,xmin,ymax,xmax]: [{clearestSuspect.full_body_box.join(', ')}]
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
