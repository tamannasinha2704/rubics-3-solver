// Imperative Three.js renderer for the cube. React components drive it
// through a small API: setColors, animateMove, setHint, setHighlights.
//
// Cubies always rest at their home positions; a move is animated by rotating
// the turning layer, after which the cubies snap home and the stickers are
// recolored from the new logical state. This keeps the picture and the cube
// model in lock-step with no accumulated drift.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { FACELETS, FACE_NORMALS, type Vec3 } from '../cube/geometry';
import type { Move } from '../cube/moves';
import { COLOR_HEX, EMPTY_HEX, type Face, type Sticker } from '../cube/types';

const ACCENT = '#ff2e93';
const HIGHLIGHT = '#ff2e93';
const DEFAULT_CAMERA = new THREE.Vector3(5.6, 5.0, 8.2);

/** "Up" direction of each face when you look straight at it (matches the 2D editor). */
const FACE_UP: Record<Face, Vec3> = {
  U: [0, 0, -1],
  D: [0, 0, 1],
  F: [0, 1, 0],
  B: [0, 1, 0],
  R: [0, 1, 0],
  L: [0, 1, 0],
};

function roundedSquare(size: number, radius: number): THREE.Shape {
  const h = size / 2;
  const s = new THREE.Shape();
  s.moveTo(-h + radius, -h);
  s.lineTo(h - radius, -h);
  s.quadraticCurveTo(h, -h, h, -h + radius);
  s.lineTo(h, h - radius);
  s.quadraticCurveTo(h, h, h - radius, h);
  s.lineTo(-h + radius, h);
  s.quadraticCurveTo(-h, h, -h, h - radius);
  s.lineTo(-h, -h + radius);
  s.quadraticCurveTo(-h, -h, -h + radius, -h);
  return s;
}

function faceBasis(face: Face): THREE.Matrix4 {
  const normal = new THREE.Vector3(...FACE_NORMALS[face]);
  const up = new THREE.Vector3(...FACE_UP[face]);
  const right = new THREE.Vector3().crossVectors(up, normal);
  return new THREE.Matrix4().makeBasis(right, up, normal);
}

function letterTexture(letter: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'bold 84px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeText(letter, 64, 70);
  ctx.fillStyle = '#111318';
  ctx.fillText(letter, 64, 70);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Animation {
  axis: THREE.Vector3;
  angle: number;
  start: number;
  duration: number;
  layer: THREE.Object3D[];
  finalColors: readonly Sticker[];
  resolve: () => void;
  /** Fallback in case animation frames are paused (e.g. background tab). */
  timer: number;
}

export class CubeRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  private readonly controls: OrbitControls;
  private readonly cubeGroup = new THREE.Group();
  private readonly pivot = new THREE.Group();
  private readonly cubies: THREE.Mesh[] = [];
  private readonly stickerMeshes: THREE.Mesh[] = [];
  private readonly stickerMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly markers: THREE.Mesh[] = [];
  private readonly labels: THREE.Mesh[] = [];
  private readonly resizeObserver: ResizeObserver;
  private readonly lineMaterial: LineMaterial;
  private hint: { group: THREE.Group; spinner: THREE.Group } | null = null;
  private anim: Animation | null = null;
  private highlighted = new Set<number>();
  private frame = 0;
  private pickHandler: ((index: number) => void) | null = null;
  private pointerDown: { x: number; y: number } | null = null;
  private disposed = false;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    container.appendChild(canvas);

    this.camera.position.copy(DEFAULT_CAMERA);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 18;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(5, 8, 6);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-6, -3, -5);
    this.scene.add(fill);

    this.lineMaterial = new LineMaterial({ color: ACCENT, linewidth: 3, transparent: true, opacity: 0.95 });

    this.buildCube();
    this.scene.add(this.cubeGroup);
    this.cubeGroup.add(this.pivot);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    this.loop();
  }

  private buildCube() {
    const bodyGeo = new RoundedBoxGeometry(0.98, 0.98, 0.98, 3, 0.09);
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#16181d', roughness: 0.6 });
    const stickerGeo = new THREE.ShapeGeometry(roundedSquare(0.84, 0.12), 4);
    const outer = roundedSquare(0.97, 0.16);
    outer.holes.push(new THREE.Path(roundedSquare(0.78, 0.1).getPoints(6).reverse()));
    const markerGeo = new THREE.ShapeGeometry(outer, 4);
    const labelGeo = new THREE.PlaneGeometry(0.62, 0.62);

    const cubieByPos = new Map<string, THREE.Mesh>();
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          const cubie = new THREE.Mesh(bodyGeo, bodyMat);
          cubie.position.set(x, y, z);
          cubie.userData.home = cubie.position.clone();
          this.cubeGroup.add(cubie);
          this.cubies.push(cubie);
          cubieByPos.set(`${x},${y},${z}`, cubie);
        }

    for (const f of FACELETS) {
      const cubie = cubieByPos.get(f.cubie.join(','))!;
      const basis = faceBasis(f.face);
      const offset = new THREE.Vector3(...f.normal);

      const mat = new THREE.MeshStandardMaterial({ color: EMPTY_HEX, roughness: 0.35, metalness: 0 });
      const sticker = new THREE.Mesh(stickerGeo, mat);
      sticker.quaternion.setFromRotationMatrix(basis);
      sticker.position.copy(offset).multiplyScalar(0.492);
      sticker.userData.index = f.index;
      cubie.add(sticker);
      this.stickerMeshes[f.index] = sticker;
      this.stickerMaterials[f.index] = mat;

      const marker = new THREE.Mesh(
        markerGeo,
        new THREE.MeshBasicMaterial({ color: HIGHLIGHT, transparent: true, depthWrite: false }),
      );
      marker.quaternion.copy(sticker.quaternion);
      marker.position.copy(offset).multiplyScalar(0.496);
      marker.visible = false;
      marker.userData.index = f.index;
      cubie.add(marker);
      this.markers[f.index] = marker;

      if (f.index % 9 === 4) {
        const label = new THREE.Mesh(
          labelGeo,
          new THREE.MeshBasicMaterial({ map: letterTexture(f.face), transparent: true, depthWrite: false }),
        );
        label.quaternion.copy(sticker.quaternion);
        label.position.copy(offset).multiplyScalar(0.5);
        label.visible = false;
        label.userData.index = f.index;
        cubie.add(label);
        this.labels.push(label);
      }
    }
  }

  private resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Keep the whole cube in view on narrow (portrait) screens.
    this.camera.zoom = Math.min(1, (w / h) * 0.95);
    this.camera.updateProjectionMatrix();
    this.lineMaterial.resolution.set(w, h);
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const now = performance.now();
    this.controls.update();

    if (this.anim) {
      const t = Math.min(1, (now - this.anim.start) / this.anim.duration);
      this.pivot.quaternion.setFromAxisAngle(this.anim.axis, this.anim.angle * easeInOut(t));
      if (t >= 1) this.finishAnimation();
    }

    if (this.highlighted.size > 0) {
      const opacity = 0.55 + 0.45 * Math.sin(now / 180);
      this.highlighted.forEach((i) => ((this.markers[i].material as THREE.MeshBasicMaterial).opacity = opacity));
    }

    if (this.hint) {
      // Keep the direction arrow on the side of the layer facing the viewer.
      const local = this.hint.group.worldToLocal(this.camera.position.clone());
      if (Math.hypot(local.x, local.y) > 0.3) this.hint.spinner.rotation.z = Math.atan2(local.y, local.x);
    }

    this.renderer.render(this.scene, this.camera);
  };

  // ---------------------------------------------------------------- public API

  setColors(colors: readonly Sticker[]) {
    if (this.anim) return; // the running animation applies its own final colors
    this.applyColors(colors);
  }

  private applyColors(colors: readonly Sticker[]) {
    colors.forEach((c, i) => this.stickerMaterials[i].color.set(c ? COLOR_HEX[c] : EMPTY_HEX));
  }

  setHighlights(indices: Iterable<number>) {
    this.highlighted = new Set(indices);
    this.markers.forEach((m, i) => (m.visible = this.highlighted.has(i)));
  }

  setShowLabels(show: boolean) {
    this.labels.forEach((l) => (l.visible = show));
  }

  setPickHandler(handler: ((index: number) => void) | null) {
    this.pickHandler = handler;
    this.renderer.domElement.style.cursor = handler ? 'pointer' : 'grab';
  }

  resetView() {
    this.camera.position.copy(DEFAULT_CAMERA);
    this.camera.up.set(0, 1, 0);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  /** Show which layer turns next and in which direction (null hides it). */
  setHint(move: Move | null) {
    if (this.hint) {
      this.cubeGroup.remove(this.hint.group);
      this.hint.group.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof LineSegments2) o.geometry.dispose();
      });
      this.hint = null;
    }
    if (!move) return;

    const n = new THREE.Vector3(...FACE_NORMALS[move.face]);
    const group = new THREE.Group();
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    group.position.copy(n);

    // Outline of the layer that turns.
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(3.08, 3.08, 1.08));
    const frame = new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(edges), this.lineMaterial);
    group.add(frame);

    // Curved arrow around the layer. Clockwise (seen from the face) = decreasing angle.
    const spinner = new THREE.Group();
    const arrowMat = new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 0.45 });
    const radius = 2.25;
    const arc = move.turns === 2 ? Math.PI * 1.1 : Math.PI * 0.5;
    const torus = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.05, 10, 64, arc), arrowMat);
    torus.rotation.z = -arc / 2;
    spinner.add(torus);
    const clockwise = move.turns !== 3;
    const headAngles =
      move.turns === 2 ? [-arc / 2, -arc / 2 + 0.38] : clockwise ? [-arc / 2] : [arc / 2];
    for (const a of headAngles) {
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.42, 20), arrowMat);
      const dir = clockwise
        ? new THREE.Vector3(Math.sin(a), -Math.cos(a), 0)
        : new THREE.Vector3(-Math.sin(a), Math.cos(a), 0);
      head.position.set(radius * Math.cos(a), radius * Math.sin(a), 0).addScaledVector(dir, 0.12);
      head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      spinner.add(head);
    }
    group.add(spinner);

    this.cubeGroup.add(group);
    this.hint = { group, spinner };
  }

  /**
   * Animate one move, then show `finalColors` (the state after the move).
   * Starting a new animation finishes any running one immediately.
   */
  animateMove(move: Move, durationMs: number, finalColors: readonly Sticker[]): Promise<void> {
    this.finishAnimation();
    const axis = new THREE.Vector3(...FACE_NORMALS[move.face]);
    const angle = move.turns === 3 ? Math.PI / 2 : -(Math.PI / 2) * move.turns;
    const layer = this.cubies.filter((c) => (c.userData.home as THREE.Vector3).dot(axis) > 0.5);
    layer.forEach((c) => this.pivot.add(c));
    const duration = Math.max(1, move.turns === 2 ? durationMs * 1.5 : durationMs);
    return new Promise((resolve) => {
      this.anim = {
        axis,
        angle,
        start: performance.now(),
        duration,
        layer,
        finalColors,
        resolve,
        timer: window.setTimeout(() => this.finishAnimation(), duration + 150),
      };
    });
  }

  /** Jump to the end of any running animation. */
  finishAnimation() {
    const anim = this.anim;
    if (!anim) return;
    this.anim = null;
    window.clearTimeout(anim.timer);
    if (import.meta.env.DEV) this.checkAnimationMatchesState(anim);
    this.pivot.quaternion.identity();
    for (const c of anim.layer) {
      this.cubeGroup.add(c);
      c.position.copy(c.userData.home as THREE.Vector3);
      c.quaternion.identity();
    }
    this.applyColors(anim.finalColors);
    anim.resolve();
  }

  /**
   * Development self-check: with the layer at its final angle, every sticker
   * must sit exactly where the logical state says its color ends up.
   */
  private checkAnimationMatchesState(anim: Animation) {
    this.pivot.quaternion.setFromAxisAngle(anim.axis, anim.angle);
    this.cubeGroup.updateMatrixWorld(true);
    const pos = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const q = new THREE.Quaternion();
    let mismatches = 0;
    this.stickerMeshes.forEach((sticker) => {
      sticker.getWorldPosition(pos);
      sticker.getWorldQuaternion(q);
      normal.set(0, 0, 1).applyQuaternion(q).round();
      const cubie = pos.clone().sub(normal.clone().multiplyScalar(0.492)).round();
      const target = FACELETS.find(
        (f) => f.cubie.every((v, k) => v === cubie.getComponent(k)) && f.normal.every((v, k) => v === normal.getComponent(k)),
      );
      const shown = '#' + (sticker.material as THREE.MeshStandardMaterial).color.getHexString(THREE.SRGBColorSpace);
      const expected = target ? anim.finalColors[target.index] : undefined;
      const expectedHex = expected ? COLOR_HEX[expected] : EMPTY_HEX;
      if (!target || shown.toLowerCase() !== expectedHex.toLowerCase()) mismatches++;
    });
    (window as unknown as { __cubeAnimationChecks?: { ok: number; failed: number } }).__cubeAnimationChecks ??= { ok: 0, failed: 0 };
    const stats = (window as unknown as { __cubeAnimationChecks: { ok: number; failed: number } }).__cubeAnimationChecks;
    if (mismatches) {
      stats.failed++;
      console.error(`Cube animation does not match the cube state (${mismatches} stickers)`);
    } else stats.ok++;
  }

  // ---------------------------------------------------------------- picking

  private onPointerDown = (e: PointerEvent) => {
    this.pointerDown = { x: e.clientX, y: e.clientY };
  };

  private onPointerUp = (e: PointerEvent) => {
    const start = this.pointerDown;
    this.pointerDown = null;
    if (!start || !this.pickHandler || this.anim) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return; // that was a drag
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    // Only the nearest hit counts; clicking the black gap between stickers does nothing.
    const hit = ray.intersectObjects(this.cubies, true)[0];
    if (hit && hit.object.userData.index !== undefined) this.pickHandler(hit.object.userData.index as number);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    if (this.anim) window.clearTimeout(this.anim.timer);
    this.anim?.resolve();
    this.resizeObserver.disconnect();
    this.controls.dispose();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          (m as THREE.MeshBasicMaterial).map?.dispose();
          m.dispose();
        });
      }
    });
    this.lineMaterial.dispose();
    this.renderer.dispose();
    canvas.remove();
  }
}
