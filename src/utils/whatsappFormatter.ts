import {GeminiIncidentAnalysis, IncidentMetadata, Language} from '../types';

export function formatWhatsAppIncidentSummary(
  metadata: IncidentMetadata,
  analysis: GeminiIncidentAnalysis,
  language: Language
): string {
  const p = analysis.suspect_visual_profile;
  const v = analysis.accomplice_or_getaway_vehicle;
  const c = analysis.clearest_suspect_frame;

  if (language === 'id') {
    const timelineLines = analysis.timeline
      .map(
        (item) =>
          `• [${item.timestamp_offset} | Frame #${item.frame_number}] ${item.action_summary}`
      )
      .join('\n');

    return [
      `🚨 *LAPORAN VISUAL KEJADIAN CURANMOR (MOTOGUARD / BANTU CEK CURANMOR)*`,
      `_Dokumentasi Visual CCTV/Dashcam Warga (Kepatuhan UU PDP No. 27/2022)_`,
      ``,
      `🏍️ *DATA KENDARAAN & LOKASI*`,
      `• *Waktu Kejadian:* ${metadata.dateTime || '-'}`,
      `• *Lokasi (RT/RW):* ${metadata.location || '-'}`,
      `• *Motor Target:* ${metadata.motorcycleMakeModel || '-'} (${metadata.motorcycleColor || '-'})`,
      `• *Nomor Polisi:* *${metadata.plateNumber || '-'}*`,
      metadata.reporterNotes ? `• *Catatan Pelapor:* ${metadata.reporterNotes}` : '',
      ``,
      `👤 *PROFIL VISUAL TERDUGA PELAKU (Frame Terjelas #${c.frame_number})*`,
      `• *Postur/Perawakan:* ${p.estimated_build_and_posture}`,
      `• *Helm/Penutup Kepala:* ${p.helmet_and_headgear}`,
      `• *Rambut/Area Wajah:* ${p.hair_and_facial_features}`,
      `• *Pakaian Atas:* ${p.upper_clothing}`,
      `• *Pakaian Bawah:* ${p.lower_clothing}`,
      `• *Alas Kaki & Tas:* ${p.footwear_and_bags}`,
      ``,
      `🛵 *KENDARAAN REKAN / SARANA PELARIAN*`,
      `• *Tipe/Model:* ${v.vehicle_type_and_model}`,
      `• *Warna:* ${v.color}`,
      `• *Plat Nomor:* ${v.plate_visibility}`,
      `• *Ciri Khusus:* ${v.distinguishing_marks}`,
      ``,
      `⏱️ *KRONOLOGI REKAMAN CCTV*`,
      timelineLines,
      ``,
      `⚠️ *CATATAN TEKNIS VISUAL:*`,
      `${analysis.technical_caveats}`,
      ``,
      `_Diproses 100% lokal di perangkat melalui MotoGuard Incident Helper (Tanpa Penyimpanan Video Server)._`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  const timelineLinesEn = analysis.timeline
    .map(
      (item) =>
        `• [${item.timestamp_offset} | Frame #${item.frame_number}] ${item.action_summary}`
    )
    .join('\n');

  return [
    `🚨 *MOTOGUARD INCIDENT VISUAL SUMMARY BRIEF*`,
    `_Community CCTV / Dashcam Documentation (UU PDP No. 27/2022 Compliant)_`,
    ``,
    `🏍️ *TARGET MOTORCYCLE & LOCATION*`,
    `• *Date & Time:* ${metadata.dateTime || '-'}`,
    `• *Location:* ${metadata.location || '-'}`,
    `• *Motorcycle:* ${metadata.motorcycleMakeModel || '-'} (${metadata.motorcycleColor || '-'})`,
    `• *Plate Number:* *${metadata.plateNumber || '-'}*`,
    metadata.reporterNotes ? `• *Reporter Notes:* ${metadata.reporterNotes}` : '',
    ``,
    `👤 *SUSPECT VISUAL PROFILE (Clearest Frame #${c.frame_number})*`,
    `• *Build & Posture:* ${p.estimated_build_and_posture}`,
    `• *Helmet & Headgear:* ${p.helmet_and_headgear}`,
    `• *Hair & Facial Area:* ${p.hair_and_facial_features}`,
    `• *Upper Clothing:* ${p.upper_clothing}`,
    `• *Lower Clothing:* ${p.lower_clothing}`,
    `• *Footwear & Bags:* ${p.footwear_and_bags}`,
    ``,
    `🛵 *ACCOMPLICE / GETAWAY VEHICLE*`,
    `• *Type & Model:* ${v.vehicle_type_and_model}`,
    `• *Color:* ${v.color}`,
    `• *Plate Visibility:* ${v.plate_visibility}`,
    `• *Distinguishing Marks:* ${v.distinguishing_marks}`,
    ``,
    `⏱️ *CHRONOLOGICAL ACTION TIMELINE*`,
    timelineLinesEn,
    ``,
    `⚠️ *TECHNICAL CAVEATS:*`,
    `${analysis.technical_caveats}`,
    ``,
    `_Extracted 100% on-device via MotoGuard Incident Helper (Zero Server Video Retention)._`,
  ]
    .filter(Boolean)
    .join('\n');
}
