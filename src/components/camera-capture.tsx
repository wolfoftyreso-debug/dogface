import { useEffect, useRef, useState } from "react";
import { SwitchCamera, X } from "lucide-react";

type Facing = "user" | "environment";

type CameraCaptureProps = {
  onCapture: (file: File) => void;
  onClose: () => void;
  onUnavailable: () => void;
};

function hasLiveCamera(): boolean {
  return typeof navigator.mediaDevices?.getUserMedia === "function";
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function facingFromLabel(label: string): Facing | null {
  const text = label.toLowerCase();
  if (/(back|rear|environment|world|bakre)/.test(text)) return "environment";
  if (/(front|user|face|selfie|främre)/.test(text)) return "user";
  return null;
}

function facingFromStream(stream: MediaStream): Facing | null {
  const mode = stream.getVideoTracks()[0]?.getSettings().facingMode;
  if (mode === "user" || mode === "environment") return mode;
  return null;
}

async function listVideoDevices(): Promise<MediaDeviceInfo[]> {
  if (typeof navigator.mediaDevices?.enumerateDevices !== "function") return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "videoinput" && device.deviceId);
}

function pickDeviceId(
  devices: MediaDeviceInfo[],
  facing: Facing,
  currentId: string | undefined,
): string | undefined {
  const labeled = devices.find((device) => facingFromLabel(device.label) === facing);
  if (labeled) return labeled.deviceId;
  return devices.find((device) => device.deviceId !== currentId)?.deviceId;
}

async function openFacing(
  next: Facing,
  deviceId: string | undefined,
  allowAny: boolean,
): Promise<MediaStream> {
  const attempts: MediaTrackConstraints[] = [];
  if (deviceId) {
    attempts.push({
      deviceId: { exact: deviceId },
      width: { ideal: 1280 },
      height: { ideal: 1280 },
    });
  }
  attempts.push(
    { facingMode: { exact: next }, width: { ideal: 1280 }, height: { ideal: 1280 } },
    { facingMode: { ideal: next }, width: { ideal: 1280 }, height: { ideal: 1280 } },
    { facingMode: next },
  );
  if (allowAny) attempts.push({ width: { ideal: 1280 }, height: { ideal: 1280 } });

  let lastError: unknown;
  for (const video of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: false, video });
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("camera");
}

export function CameraCapture({ onCapture, onClose, onUnavailable }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const devicesRef = useRef<MediaDeviceInfo[]>([]);
  const [facing, setFacing] = useState<Facing>("user");
  const [previewFacing, setPreviewFacing] = useState<Facing>("user");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function attach(stream: MediaStream, requested: Facing) {
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopStream(stream);
        return;
      }
      video.srcObject = stream;
      await video.play();
      const actual = facingFromStream(stream) ?? requested;
      setPreviewFacing(actual);
      devicesRef.current = await listVideoDevices();
      if (!cancelled) {
        setReady(true);
      }
    }

    async function start(next: Facing) {
      setReady(false);
      const previous = streamRef.current;
      const currentId = previous?.getVideoTracks()[0]?.getSettings().deviceId;
      stopStream(previous);
      streamRef.current = null;
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      if (cancelled) return;

      const deviceId = pickDeviceId(devicesRef.current, next, currentId);
      try {
        const stream = await openFacing(next, deviceId, devicesRef.current.length === 0);
        if (cancelled) {
          stopStream(stream);
          return;
        }
        await attach(stream, next);
      } catch {
        const other: Facing = next === "user" ? "environment" : "user";
        try {
          const fallback = await openFacing(other, undefined, true);
          if (cancelled) {
            stopStream(fallback);
            return;
          }
          await attach(fallback, other);
        } catch {
          if (!cancelled) onUnavailableRef.current();
        }
      }
    }

    if (!hasLiveCamera()) {
      onUnavailableRef.current();
      return;
    }

    void start(facing);
    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
    // facing is toggled by the flip button; restart the stream for that facing.
  }, [facing]);

  async function takePhoto() {
    const video = videoRef.current;
    if (!video || !ready || busy) return;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width < 32 || height < 32) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.84),
      );
      if (!blob) return;
      onCapture(new File([blob], "kamera.jpg", { type: "image/jpeg" }));
    } finally {
      setBusy(false);
    }
  }

  function flipCamera() {
    if (busy) return;
    setFacing((current) => (current === "user" ? "environment" : "user"));
  }

  return (
    <div className="camera-sheet" role="dialog" aria-label="Camera" aria-modal="true">
      <div className="camera-stage">
        <video
          ref={videoRef}
          className={previewFacing === "user" ? "camera-video is-front" : "camera-video"}
          playsInline
          muted
          autoPlay
        />
        {!ready ? (
          <p className="camera-waiting">Starting camera …</p>
        ) : null}
        <div className="camera-guide" aria-hidden="true">
          <div className="camera-guide-oval" />
        </div>
      </div>
      <div className="camera-footer">
        <div className="camera-bar">
        <button
          type="button"
          className="camera-icon-btn justify-self-start"
          onClick={onClose}
          aria-label="Close camera"
        >
          <X className="size-5" strokeWidth={2} />
        </button>
        <button
          type="button"
          className="camera-shutter justify-self-center disabled:opacity-50"
          onClick={() => void takePhoto()}
          disabled={!ready || busy}
          aria-label="Take photo"
        />
        <button
          type="button"
          className="camera-icon-btn justify-self-end"
          onClick={flipCamera}
          disabled={!ready || busy}
          aria-label={previewFacing === "user" ? "Switch to back camera" : "Switch to selfie"}
        >
          <SwitchCamera className="size-5" strokeWidth={1.75} />
        </button>
      </div>
      </div>
    </div>
  );
}
