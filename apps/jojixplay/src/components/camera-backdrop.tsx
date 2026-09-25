import { useEffect } from "preact/hooks";
import type { RefObject } from "preact";
import type { CameraFrameNormalization } from "../domain/camera";
import { cameraCover } from "../domain/camera-view";

export function CameraBackdrop({
  videoRef,
  normalization,
  visible,
}: {
  videoRef: RefObject<HTMLVideoElement>;
  normalization: CameraFrameNormalization | null;
  visible: boolean;
}) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    function resize() {
      if (!video || !normalization) return;
      const cover = cameraCover(
        normalization.frame.width,
        normalization.frame.height,
        innerWidth,
        innerHeight,
      );
      video.style.width = `${normalization.source.width * cover.scale}px`;
      video.style.height = `${normalization.source.height * cover.scale}px`;
      video.style.transform = `translate(-50%, -50%) scaleX(-1) rotate(${normalization.rotation}deg)`;
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [normalization, videoRef]);
  return (
    <video
      ref={videoRef}
      class={`camera-backdrop ${visible && normalization ? "camera-backdrop--visible" : ""}`}
      muted
      playsInline
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
