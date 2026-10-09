import type { CameraImage, Silhouette } from "@jojixplay/game-sdk";
import {
  DataTexture,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RedFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector4,
  VideoTexture,
  WebGLRenderer,
} from "three";
import type { Cover } from "./figures";

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// Each screen pixel is traced back to the camera image through the same mirrored cover mapping
// the host uses, so the silhouette lands exactly on the person.
const FRAGMENT = `
uniform sampler2D uMask;
uniform sampler2D uVideo;
uniform vec4 uCover;
uniform vec2 uViewport;
uniform int uRotation;
uniform bool uCutout;
uniform bool uHasVideo;
varying vec2 vUv;
void main() {
  vec2 pixel = vec2(vUv.x, 1.0 - vUv.y) * uViewport;
  vec2 camera = vec2(1.0 - (pixel.x - uCover.x) / uCover.z, (pixel.y - uCover.y) / uCover.w);
  if (camera.x < 0.0 || camera.y < 0.0 || camera.x > 1.0 || camera.y > 1.0) discard;
  // The grid is coarse; a narrow ramp around half confidence gives a clean, soft edge.
  float person = smoothstep(0.35, 0.65, texture2D(uMask, camera).r);
  if (!uCutout) {
    gl_FragColor = vec4(1.0, 0.824, 0.247, person * 0.6);
    return;
  }
  vec3 color = vec3(1.0);
  if (uHasVideo) {
    vec2 source = camera;
    if (uRotation == 90) source = vec2(camera.y, 1.0 - camera.x);
    else if (uRotation == 180) source = vec2(1.0 - camera.x, 1.0 - camera.y);
    else if (uRotation == 270) source = vec2(1.0 - camera.y, camera.x);
    color = texture2D(uVideo, vec2(source.x, 1.0 - source.y)).rgb;
  }
  gl_FragColor = vec4(color, person);
}`;

/** The largest backing store worth paying for: the silhouette grid is far coarser than this. */
const MAX_PIXEL_RATIO = 2;

/**
 * Draws a silhouette over the whole viewport: as a tint to lay over the host's camera image, or
 * as a cut-out showing only the person's own live camera pixels.
 */
export function createSilhouetteLayer(parent: HTMLElement) {
  const renderer = new WebGLRenderer({ alpha: true, antialias: false, premultipliedAlpha: false });
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "sense-silhouette";
  renderer.domElement.setAttribute("aria-hidden", "true");
  parent.prepend(renderer.domElement);

  let mask = new DataTexture(new Uint8Array(1), 1, 1, RedFormat, UnsignedByteType);
  let video: VideoTexture | null = null;
  const uniforms = {
    uMask: { value: mask },
    uVideo: { value: video as VideoTexture | null },
    uCover: { value: new Vector4() },
    uViewport: { value: new Vector2() },
    uRotation: { value: 0 },
    uCutout: { value: false },
    uHasVideo: { value: false },
  };
  const material = new ShaderMaterial({
    transparent: true,
    depthTest: false,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms,
  });
  const geometry = new PlaneGeometry(2, 2);
  const scene = new Scene();
  scene.add(new Mesh(geometry, material));
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    draw(silhouette: Silhouette, cover: Cover, cutout: boolean, image: CameraImage | null) {
      if (mask.image.width !== silhouette.width || mask.image.height !== silhouette.height) {
        mask.dispose();
        mask = new DataTexture(
          silhouette.alpha,
          silhouette.width,
          silhouette.height,
          RedFormat,
          UnsignedByteType,
        );
        mask.minFilter = LinearFilter;
        mask.magFilter = LinearFilter;
        // Rows of a one-byte grid are not padded to four bytes.
        mask.unpackAlignment = 1;
        uniforms.uMask.value = mask;
      } else {
        mask.image.data = silhouette.alpha;
      }
      mask.needsUpdate = true;

      if (video?.image !== image?.video) {
        video?.dispose();
        video = image ? new VideoTexture(image.video) : null;
        uniforms.uVideo.value = video;
      }
      const pixelRatio = Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
      if (
        renderer.getPixelRatio() !== pixelRatio ||
        renderer.domElement.width !== Math.floor(innerWidth * pixelRatio) ||
        renderer.domElement.height !== Math.floor(innerHeight * pixelRatio)
      ) {
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(innerWidth, innerHeight, false);
      }
      uniforms.uCover.value.set(cover.left, cover.top, cover.width, cover.height);
      uniforms.uViewport.value.set(innerWidth, innerHeight);
      uniforms.uRotation.value = image?.rotation ?? 0;
      uniforms.uCutout.value = cutout;
      uniforms.uHasVideo.value = video !== null;
      renderer.render(scene, camera);
    },
    clear() {
      renderer.clear();
    },
    dispose() {
      mask.dispose();
      video?.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
