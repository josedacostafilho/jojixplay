import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import handUrl from "../assets/hand.glb?url";
import license from "../assets/LICENSE.txt?raw";

export interface HandPoint {
  readonly x: number;
  readonly y: number;
  readonly left: boolean;
}

/** One authored mesh, baked once into its static pose; no finger animation or rig at runtime. */
export async function mountHandView(container: HTMLElement) {
  const gltf = await new GLTFLoader().loadAsync(handUrl);
  gltf.scene.updateMatrixWorld(true);
  const source = gltf.scene.getObjectByProperty("type", "SkinnedMesh");
  if (!(source instanceof THREE.SkinnedMesh)) throw new Error("Hand asset has no mesh.");
  source.skeleton.update();
  const geometry = source.geometry.clone();
  const positions = geometry.getAttribute("position");
  const point = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    source.applyBoneTransform(i, point).applyMatrix4(source.matrixWorld);
    positions.setXYZ(i, point.x, point.y, point.z);
  }
  const bone = (name: string) => {
    const node = gltf.scene.getObjectByName(name);
    if (!node) throw new Error(`Missing hand asset landmark: ${name}`);
    return node.getWorldPosition(new THREE.Vector3());
  };
  const wrist = bone("wrist");
  const up = bone("middle-finger-tip").sub(wrist).normalize();
  const across = bone("index-finger-metacarpal").sub(bone("pinky-finger-metacarpal"));
  across.addScaledVector(up, -across.dot(up)).normalize();
  const normal = new THREE.Vector3().crossVectors(across, up).normalize();
  const palm = wrist
    .clone()
    .add(bone("index-finger-phalanx-proximal"))
    .add(bone("pinky-finger-phalanx-proximal"))
    .multiplyScalar(1 / 3);
  geometry.translate(-palm.x, -palm.y, -palm.z);
  geometry.applyMatrix4(new THREE.Matrix4().makeBasis(across, up, normal).invert());
  geometry.computeBoundingBox();
  const height = geometry.boundingBox?.getSize(new THREE.Vector3()).y;
  if (!height) throw new Error("Hand asset has no size.");
  geometry.scale(1 / height, 1 / height, 1 / height);
  geometry.deleteAttribute("skinIndex");
  geometry.deleteAttribute("skinWeight");
  geometry.computeVertexNormals();
  source.geometry.dispose();
  source.skeleton.dispose();
  for (const material of Array.isArray(source.material) ? source.material : [source.material])
    material.dispose();
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  } catch (error) {
    geometry.dispose();
    throw error;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.domElement.setAttribute("aria-label", "Mãos em 3D");
  renderer.domElement.dataset.assetLicense = license;
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0.1, 1000);
  camera.position.z = 500;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x476783, 2.8));
  const light = new THREE.DirectionalLight(0xfff7e6, 3);
  light.position.set(-100, 200, 400);
  scene.add(light);
  const materials = [0xffce68, 0x8cdbeb].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.05 }),
  );
  const hands = Array.from({ length: 4 }, () => {
    const mesh = new THREE.Mesh(geometry, materials[0]);
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });
  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    renderer.setSize(Math.max(1, width), Math.max(1, height));
    camera.right = width;
    camera.top = height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  return {
    update(points: readonly HandPoint[]) {
      const rect = container.getBoundingClientRect();
      hands.forEach((mesh, i) => {
        const point = points[i];
        mesh.visible = !!point;
        if (!point) return;
        mesh.position.set(point.x - rect.left, rect.height - (point.y - rect.top), 0);
        const size = Math.max(48, Math.min(76, rect.height * 0.18));
        mesh.scale.set(point.left ? -size : size, size, size);
        const material = materials[point.left ? 1 : 0];
        if (material) mesh.material = material;
      });
      renderer.render(scene, camera);
    },
    dispose() {
      observer.disconnect();
      geometry.dispose();
      materials.forEach((material) => {
        material.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
