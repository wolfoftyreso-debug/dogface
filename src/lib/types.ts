export type PortraitStyle = "split" | "dog";

export type GenerateErrorCode =
  | "no_image"
  | "unsupported"
  | "too_large"
  | "corrupt"
  | "no_human"
  | "ambiguous"
  | "rate_limit"
  | "unavailable"
  | "timeout"
  | "failed"
  | "payment_required"
  | "payment_failed"
  | "payment_unavailable"
  | "busy"
  | "disabled";

export type HistoryItem = {
  id: string;
  createdAt: number;
  breed: string;
  reason: string;
  imageDataUrl: string;
  sourceDataUrl?: string;
  splitDataUrl?: string;
  dogDataUrl?: string;
};

export const MAX_HISTORY = 10;

export const ERROR_MESSAGES: Record<GenerateErrorCode, string> = {
  no_image: "Add a photo first.",
  unsupported: "Use a JPEG, PNG, or HEIC photo.",
  too_large: "That photo is too large. Try a smaller one.",
  corrupt: "That photo looks damaged. Try another.",
  no_human: "We need a clear photo of a person.",
  ambiguous: "Several people are equally clear. Use a photo with one main person.",
  rate_limit: "Too many tries. Wait a minute and try again.",
  unavailable: "The image service isn’t ready. Try again in a moment.",
  timeout: "That took too long. Try again.",
  failed: "Couldn’t make the dog. Try again.",
  payment_required: "Buy 5 photos for $2.99.",
  payment_failed: "Payment didn’t go through.",
  payment_unavailable: "Purchases aren’t available right now.",
  busy: "A photo is already being made.",
  disabled: "Temporarily unavailable.",
};

export type AnalysisResult = {
  validHuman: boolean;
  subjectSelection: "single" | "primary" | "ambiguous" | "none";
  breedId: string;
  breedName: string;
  visibleTraits: string;
  reason: string;
  renderBrief: string;
  rejectionReason: string;
  coat: string;
  eyes: string;
  gaze: string;
  expression: string;
  eyeGeometry: string;
  facialGeometry: string;
  headPose: string;
  hairAndFurnishings: string;
  colorMap: string;
  skinTone: string;
  irisColor: string;
  accentColors: string;
  hairTexture: string;
  identityAnchors: string[];
};

export type QcResult = {
  acceptable: boolean;
  canineAnatomyValid: boolean;
  gazePreserved: boolean;
  eyeRelationshipPreserved: boolean;
  posePreserved: boolean;
  expressionPreserved: boolean;
  identityAnchorsPreserved: number;
  identityAnchorsTotal: number;
  genericBreed: boolean;
  weakestFeatures: string[];
  correctionInstructions: string[];
};

export type GenerateOk = {
  ok: true;
  id: string;
  status: "ready";
  breed: string;
  reason: string;
  imageDataUrl: string;
  splitDataUrl?: string;
  dogDataUrl?: string;
  remaining: number;
};

export type GeneratePending = {
  ok: true;
  id: string;
  status: "reserved" | "analyzing" | "generating";
  remaining: number;
};

export type GenerateErr = {
  ok: false;
  code: GenerateErrorCode;
  message: string;
  remaining?: number;
};

export type GenerateResult = GenerateOk | GeneratePending | GenerateErr;

export type Balance = {
  remaining: number;
  freeRemaining: number;
  paidRemaining: number;
  paymentsReady: boolean;
  aiReady: boolean;
};
