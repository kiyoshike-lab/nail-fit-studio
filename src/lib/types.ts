export type NailShape = "natural" | "round" | "oval" | "squoval" | "almond" | "coffin" | "square" | "stiletto";
export type NailFinish = "gloss" | "sheer" | "pearl" | "chrome" | "sparkle";
export type NailPattern = "solid" | "gradient" | "french" | "floral" | "marble" | "patterned";
export type NailMaterial = "cream" | "jelly" | "glitter" | "metallic" | "shimmer" | "sheer";

export type NailPose = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  confidence?: number;
};

export type NailDesign = {
  color: string;
  shape: NailShape;
  finish: NailFinish;
  pattern: NailPattern;
  material: NailMaterial;
  motif: string;
  motifColor: string;
  tipColor: string;
  tipAmount: number;
  length: number;
  thickness: number;
  realism: number;
  textureUrl?: string;
};

export type DesignPreset = {
  id: string;
  name: string;
  material: NailMaterial;
  pattern: NailPattern;
  colorHint: string;
  finish: string;
  genre?: string;
  mood?: string;
  proRecommended?: boolean;
  motif?: string;
  motifColor?: string;
  motifDensity?: number;
  textureImage?: string;
  previewImage?: string;
  license?: string;
};

export type SourceMode = "empty" | "photo" | "camera";

export type SavedNailLook = {
  id: string;
  designId?: string;
  design: NailDesign;
  nails: NailPose[];
  savedAt: string;
};

export type TryOnHistory = SavedNailLook & {
  createdAt: string;
};

export type DiagnosisResult = {
  title: string;
  description: string;
  shape: NailShape;
  color: string;
  length: "short" | "medium" | "long";
  pattern: NailPattern;
  tags: string[];
  completedAt: string;
};
