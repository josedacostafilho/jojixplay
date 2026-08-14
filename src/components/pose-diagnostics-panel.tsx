import type { PoseLimit } from "../domain/pose-limit";
import type { HandSpreadDiagnostics, PoseDiagnosticsSnapshot } from "../pose/pose-diagnostics";
import { POSE_MODEL } from "../pose/pose-model";

interface PoseDiagnosticsPanelProps {
  diagnostics: PoseDiagnosticsSnapshot | null;
  poseLimit: PoseLimit;
}

function rate(value: number | null | undefined): string {
  return value === null || value === undefined ? "Collecting…" : `${value.toFixed(1)} / second`;
}

function processing(diagnostics: PoseDiagnosticsSnapshot | null): string {
  const medianMs = diagnostics?.processingMedianMs;
  const p95Ms = diagnostics?.processingP95Ms;
  if (medianMs === null || medianMs === undefined || p95Ms === null || p95Ms === undefined) {
    return "Collecting…";
  }
  return `${medianMs.toFixed(0)} ms median · ${p95Ms.toFixed(0)} ms p95`;
}

function handSpread(spread: HandSpreadDiagnostics | null | undefined): string {
  if (spread === null || spread === undefined) {
    return "Keep the complete hand visible to collect samples.";
  }
  return `${spread.centerP95Px.toFixed(1)} px p95 · worst ${spread.worstLandmark} ${spread.worstLandmarkP95Px.toFixed(1)} px`;
}

export function PoseDiagnosticsPanel({ diagnostics, poseLimit }: PoseDiagnosticsPanelProps) {
  const frame = diagnostics?.frame;
  return (
    <details class="pose-diagnostics">
      <summary>Pose diagnostics</summary>
      <div class="pose-diagnostics__body">
        <p>
          Local, temporary aggregates for {POSE_MODEL.label}. Hand spread includes real movement;
          hold one complete hand still for two seconds to read it as jitter.
        </p>
        <dl>
          <div>
            <dt>Camera frame</dt>
            <dd>
              {frame === undefined || frame === null
                ? "Collecting…"
                : `${frame.width} × ${frame.height}`}
            </dd>
          </div>
          <div>
            <dt>Camera callbacks</dt>
            <dd>{rate(diagnostics?.cameraFramesPerSecond)}</dd>
          </div>
          <div>
            <dt>Inference submissions</dt>
            <dd>{rate(diagnostics?.inferenceSubmissionsPerSecond)}</dd>
          </div>
          <div>
            <dt>Inference completions</dt>
            <dd>{rate(diagnostics?.inferenceCompletionsPerSecond)}</dd>
          </div>
          <div>
            <dt>Processing age</dt>
            <dd>{processing(diagnostics)}</dd>
          </div>
          <div>
            <dt>Left coarse hand</dt>
            <dd>
              {poseLimit === 1
                ? handSpread(diagnostics?.leftHand)
                : "Hand spread is measured only in 1-player mode."}
            </dd>
          </div>
          <div>
            <dt>Right coarse hand</dt>
            <dd>
              {poseLimit === 1
                ? handSpread(diagnostics?.rightHand)
                : "Hand spread is measured only in 1-player mode."}
            </dd>
          </div>
        </dl>
        <p>No coordinates, images, or diagnostics leave this phone.</p>
      </div>
    </details>
  );
}
