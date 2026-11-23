export type Language = 'id' | 'en';

export type FontFamilyOption = 'jakarta' | 'public' | 'lexend' | 'hyperlegible';

export type ColorSpectrumMode = 'navy-gold' | 'cyan-emerald';

export type GeminiModelOption = 'gemini-2.5-flash' | 'gemini-2.5-pro';

export interface IncidentMetadata {
  dateTime: string;
  location: string;
  motorcycleMakeModel: string;
  motorcycleColor: string;
  plateNumber: string;
  reporterNotes: string;
  uuPdpConsentChecked: boolean;
  reporterEmail: string;
}

export interface ExtractedFrame {
  id: string;
  frameNumber: number;
  timestampSeconds: number;
  timestampFormatted: string;
  sharpnessScore: number;
  dataUrl: string;
  selected: boolean;
  width: number;
  height: number;
}

export interface TimelineEntry {
  timestamp_offset: string;
  frame_number: number;
  action_summary: string;
}

export interface ClearestSuspectFrame {
  frame_number: number;
  face_head_box: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
  full_body_box: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
  visibility_notes: string;
}

export interface SuspectVisualProfile {
  estimated_build_and_posture: string;
  hair_and_facial_features: string;
  helmet_and_headgear: string;
  upper_clothing: string;
  lower_clothing: string;
  footwear_and_bags: string;
}

export interface AccompliceOrGetawayVehicle {
  vehicle_type_and_model: string;
  color: string;
  plate_visibility: string;
  distinguishing_marks: string;
}

export interface GeminiIncidentAnalysis {
  timeline: TimelineEntry[];
  clearest_suspect_frame: ClearestSuspectFrame;
  suspect_visual_profile: SuspectVisualProfile;
  accomplice_or_getaway_vehicle: AccompliceOrGetawayVehicle;
  technical_caveats: string;
}

export interface SavedIncidentCase {
  id: string;
  updatedAt: string;
  metadata: IncidentMetadata;
  framesCount: number;
  clearestFrameDataUrl?: string;
  analysis?: GeminiIncidentAnalysis;
  modelUsed?: string;
  syncStatus: 'local-draft' | 'queued-offline' | 'synced-analyzed';
}
