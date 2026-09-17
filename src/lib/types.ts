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
};

export const MAX_HISTORY = 10;

export const ERROR_MESSAGES: Record<GenerateErrorCode, string> = {
  no_image: "Lägg till ett foto först.",
  unsupported: "Använd ett foto i JPEG, PNG eller HEIC.",
  too_large: "Fotot är för stort. Prova ett mindre.",
  corrupt: "Fotot ser trasigt ut. Prova ett annat.",
  no_human: "Vi behöver ett tydligt foto av en person.",
  ambiguous: "Flera personer syns lika tydligt. Ta ett foto med en huvudperson.",
  rate_limit: "För många försök. Vänta en minut och prova igen.",
  unavailable: "Bildtjänsten är inte redo just nu. Prova igen om en stund.",
  timeout: "Det tog för lång tid. Fotot är kvar — prova igen.",
  failed: "Kunde inte skapa hunden. Fotot är kvar — prova igen.",
  payment_required: "Din första bild är förbrukad. Köp 5 bilder för 2,99 USD.",
  payment_failed: "Betalningen slutfördes inte. Fotot är kvar.",
  payment_unavailable: "Köp är inte tillgängliga just nu. Prova senare.",
  busy: "En bild skapas redan. Vänta tills den är klar.",
  disabled: "Nya bilder är tillfälligt avstängda.",
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
