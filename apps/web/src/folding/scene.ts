import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  applyFold,
  bounds,
  creases,
  flatPaper,
  INITIAL_VIEW,
  hinges,
  type Axis,
  type CameraView,
  type Fold,
  type Paper,
} from './model';
import type { PickedFold } from './interaction';
export type PaperInteraction = {
  selectCrease: (axis: Axis, line: number) => void;
  pickPanel: (id: number, commit: boolean) => PickedFold | undefined;
  preview: (angle: number, direction: 1 | -1) => void;
};
const CW = 8.5 / 4,
  CH = 11 / 4;
// Deliberately exaggerated so a folded sheet's individual layers remain legible.
const depth = 0.11;
const thickness = 0.035;
const world = (x: number, y: number, z = 0) => new THREE.Vector3((x - 2) * CW, (y - 2) * CH, z);

export class PaperScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
  private controls: OrbitControls;
  private panels: THREE.Group[] = [];
  private materials: THREE.MeshStandardMaterial[] = [];
  private textures: THREE.Texture[] = [];
  private geometry = new THREE.PlaneGeometry(CW, CH);
  private edgeGeometry = new THREE.BoxGeometry(CW, CH, thickness);
  private bends = new THREE.Group();
  private bendMaterial = new THREE.MeshStandardMaterial({
    color: '#eadfc9',
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  private lines = new THREE.Group();
  private disposed = false;
  private onLost: (event: Event) => void;
  private onDown: (event: PointerEvent) => void;
  private onUp: (event: PointerEvent) => void;
  private onMove: (event: PointerEvent) => void;
  private onCancel: (event: PointerEvent) => void;
  private onLeave: () => void;
  private interaction?: PaperInteraction;
  private paper: Paper = flatPaper();
  private fold?: Fold;
  private progress = 0;
  private selection?: { axis: Axis; line: number };
  private arrow = new THREE.Group();
  private activePointers = new Set<number>();
  private gesture?: {
    id: number;
    crease?: { axis: Axis; line: number };
    picked?: PickedFold;
    point?: THREE.Vector3;
    angle: number;
    direction: 1 | -1;
  };
  private interactive = true;
  private panMode = false;
  private spreadLayers = false;
  private start: [number, number] = [0, 0];
  private width = 1;
  private height = 1;
  private fitted: { paper: Paper; back: boolean } | null = null;
  constructor(
    readonly canvas: HTMLCanvasElement,
    onCrease?: (axis: Axis, line: number) => void,
    onError?: (message: string) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene.background = new THREE.Color('#0b141e');
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#8795a9', 2.2));
    const light = new THREE.DirectionalLight('#fff4df', 2.5);
    light.position.set(-6, 9, 14);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    Object.assign(light.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 0.1, far: 60 });
    light.shadow.bias = -0.0002;
    light.shadow.normalBias = 0.06;
    this.scene.add(light, this.bends);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = false;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 65;
    this.controls.addEventListener('change', this.draw);
    this.setView(INITIAL_VIEW);
    for (let id = 0; id < 16; id++) {
      const group = new THREE.Group();
      group.userData.id = id;
      const edgeMaterial = new THREE.MeshStandardMaterial({ color: '#d8cdb6', roughness: 1 });
      this.materials.push(edgeMaterial);
      const edge = new THREE.Mesh(this.edgeGeometry, edgeMaterial);
      edge.userData.edge = true;
      edge.castShadow = edge.receiveShadow = true;
      group.add(edge);
      for (const front of [true, false]) {
        const texture = this.labelTexture(id, front);
        this.textures.push(texture);
        const material = new THREE.MeshStandardMaterial({
          map: texture,
          side: THREE.FrontSide,
          roughness: 0.95,
        });
        this.materials.push(material);
        const face = new THREE.Mesh(this.geometry, material);
        face.position.z = (front ? 1 : -1) * (thickness / 2 + 0.001);
        face.receiveShadow = true;
        if (!front) face.rotation.y = Math.PI;
        group.add(face);
      }
      this.panels.push(group);
      this.scene.add(group);
    }
    this.scene.add(this.lines);
    this.onLost = (event) => {
      event.preventDefault();
      onError?.(
        'The 3D graphics context was lost. Close and reopen the simulator to resume your saved draft.',
      );
    };
    canvas.addEventListener('webglcontextlost', this.onLost);
    this.scene.add(this.arrow);
    this.onDown = (e) => {
      this.activePointers.add(e.pointerId);
      if (this.activePointers.size > 1) {
        this.cancelGesture();
        return;
      }
      if (!this.interactive || e.button !== 0 || this.panMode || e.shiftKey || e.ctrlKey || e.metaKey) return;
      this.start = [e.clientX, e.clientY];
      const crease = this.hitCrease(e);
      if (crease && this.progress === 0) {
        this.gesture = { id: e.pointerId, crease, angle: 0, direction: 1 };
      } else if (this.selection && this.interaction) {
        const hit = this.hitPanel(e);
        if (hit) {
          const id = hit.object.parent!.userData.id as number;
          const picked = this.fold?.moving.includes(id)
            ? {
                fold: this.fold,
                directions: this.interaction.pickPanel(id, false)?.directions || [this.fold.direction],
              }
            : this.interaction.pickPanel(id, true);
          if (picked) {
            const point = hit.point.clone();
            if (this.fold?.moving.includes(id)) this.rotatePoint(point, this.fold, -this.progress);
            point.z = 0;
            this.gesture = {
              id: e.pointerId,
              picked,
              point,
              angle: this.fold?.moving.includes(id) ? this.progress * 180 : 0,
              direction: picked.fold.direction,
            };
            // Commit the default flap even when it was only highlighted on hover.
            this.interaction.pickPanel(id, true);
          }
        }
      }
      if (this.gesture) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.controls.enabled = false;
        this.canvas.setPointerCapture(e.pointerId);
        this.canvas.style.cursor = 'grabbing';
      }
    };
    this.onMove = (e) => {
      const g = this.gesture;
      if (g?.id === e.pointerId) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!g.picked || !g.point || Math.hypot(e.clientX - this.start[0], e.clientY - this.start[1]) < 4)
          return;
        const rect = this.canvas.getBoundingClientRect();
        const target = new THREE.Vector2(e.clientX - rect.left, e.clientY - rect.top);
        let best = Infinity,
          angle = g.angle,
          direction = g.direction;
        for (const d of g.picked.directions)
          for (let a = 0; a <= 180; a += 2) {
            const point = this.project(
              this.rotatePoint(g.point.clone(), { ...g.picked.fold, direction: d }, a / 180),
            );
            // A small continuity preference avoids flipping direction where the arcs project together.
            const distance =
              point.distanceToSquared(target) + (d === g.direction ? 0 : 20) + Math.abs(a - g.angle) * 0.05;
            if (distance < best) {
              best = distance;
              angle = a;
              direction = d;
            }
          }
        g.angle = angle;
        g.direction = direction;
        this.interaction?.preview(angle, direction);
        return;
      }
      if (!this.interactive || this.activePointers.size) return;
      if (this.panMode || e.shiftKey || e.ctrlKey || e.metaKey) {
        this.highlightCrease();
        this.canvas.style.cursor = 'move';
        return;
      }
      const crease = this.hitCrease(e);
      if (crease && this.progress === 0) {
        this.canvas.style.cursor = 'pointer';
        this.highlightCrease(crease);
        return;
      }
      this.highlightCrease();
      const hit = this.selection ? this.hitPanel(e) : undefined;
      const hovered = hit ? this.interaction?.pickPanel(hit.object.parent!.userData.id, false) : undefined;
      this.canvas.style.cursor = 'grab';
      if (this.selection && !this.fold) {
        this.paint(this.paper, hovered?.fold, 0, true);
      }
    };
    this.onUp = (e) => {
      const g = this.gesture;
      this.activePointers.delete(e.pointerId);
      if (g?.id !== e.pointerId) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (g.crease && Math.hypot(e.clientX - this.start[0], e.clientY - this.start[1]) < 10) {
        (this.interaction?.selectCrease || onCrease)?.(g.crease.axis, g.crease.line);
      }
      this.cancelGesture();
    };
    this.onCancel = (e) => {
      this.activePointers.delete(e.pointerId);
      if (this.gesture?.id === e.pointerId) this.cancelGesture();
    };
    this.onLeave = () => {
      if (!this.gesture) {
        this.highlightCrease();
        if (this.selection && !this.fold) this.paint(this.paper, undefined, 0, true);
      }
    };
    canvas.addEventListener('pointerdown', this.onDown, true);
    canvas.addEventListener('pointermove', this.onMove, true);
    canvas.addEventListener('pointerup', this.onUp, true);
    canvas.addEventListener('pointercancel', this.onCancel, true);
    canvas.addEventListener('lostpointercapture', this.onCancel);
    canvas.addEventListener('pointerleave', this.onLeave);
  }
  setInteraction(interaction: PaperInteraction, selection?: { axis: Axis; line: number }) {
    this.interaction = interaction;
    this.selection = selection;
  }
  peek(fold?: Fold) {
    this.paint(this.paper, fold || this.fold, this.progress, true);
  }
  facing(): 1 | -1 {
    return this.camera.position.z >= this.controls.target.z ? 1 : -1;
  }
  turnOver() {
    const target = this.controls.target.clone(),
      offset = this.camera.position.clone().sub(target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    const up = this.camera.up.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    this.setView({
      position: target.clone().add(offset).toArray(),
      target: target.toArray(),
      up: up.toArray(),
    });
  }
  rotate(direction: 1 | -1) {
    const axis = this.camera.getWorldDirection(new THREE.Vector3());
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    up.applyAxisAngle(axis, (direction * Math.PI) / 2);
    this.setView({ ...this.getView(), up: up.toArray() });
  }
  private cancelGesture() {
    const id = this.gesture?.id;
    this.gesture = undefined;
    this.controls.enabled = this.interactive;
    if (id !== undefined && this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
    this.canvas.style.cursor = 'grab';
  }
  private project(point: THREE.Vector3) {
    const p = point.clone().project(this.camera);
    return new THREE.Vector2(((p.x + 1) * this.width) / 2, ((1 - p.y) * this.height) / 2);
  }
  private hitPanel(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect(),
      ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((e.clientY - rect.top) / rect.height) * 2,
      ),
      this.camera,
    );
    return ray.intersectObjects(this.panels, true)[0];
  }
  private hitCrease(e: PointerEvent): { axis: Axis; line: number } | undefined {
    const rect = this.canvas.getBoundingClientRect(),
      p = new THREE.Vector2(e.clientX - rect.left, e.clientY - rect.top);
    let nearest = e.pointerType === 'touch' ? 18 : 10,
      result: { axis: Axis; line: number } | undefined;
    for (const line of this.lines.children as THREE.Line[]) {
      const points = line.geometry.getAttribute('position');
      const a = this.project(new THREE.Vector3().fromBufferAttribute(points, 0)),
        b = this.project(new THREE.Vector3().fromBufferAttribute(points, 1));
      const ab = b.clone().sub(a),
        t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
      const distance = p.distanceTo(a.addScaledVector(ab, t));
      if (distance < nearest) {
        nearest = distance;
        result = { axis: line.userData.axis, line: line.userData.line };
      }
    }
    return result;
  }
  private highlightCrease(hover?: { axis: Axis; line: number }) {
    for (const line of this.lines.children as THREE.Line[]) {
      const selected = [hover, this.selection].some(
        (c) => c && c.axis === line.userData.axis && c.line === line.userData.line,
      );
      const material = line.material as THREE.LineBasicMaterial;
      material.color.set(selected ? '#53f1bf' : '#668c85');
      material.opacity = selected ? 1 : 0.65;
    }
    this.draw();
  }
  private rotatePoint(point: THREE.Vector3, fold: Fold, progress: number) {
    const side = Math.sign(this.paper.panels[fold.moving[0]][fold.axis] - fold.line);
    const pivot = world(fold.axis === 'x' ? fold.line : 2, fold.axis === 'y' ? fold.line : 2);
    return point
      .sub(pivot)
      .applyAxisAngle(
        new THREE.Vector3(fold.axis === 'y' ? 1 : 0, fold.axis === 'x' ? 1 : 0, 0),
        Math.PI * progress * fold.direction * side * (fold.axis === 'x' ? -1 : 1),
      )
      .add(pivot);
  }

  private labelTexture(id: number, front: boolean) {
    const c = document.createElement('canvas');
    c.width = 272;
    c.height = 352;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = front ? '#e8f3ee' : '#f2dec4';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = front ? '#658d82' : '#a78c6f';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 270, 350);
    ctx.fillStyle = front ? '#3a7163' : '#8c6238';
    ctx.font = '600 16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(front ? 'FRONT' : 'BACK', 136, 45);
    ctx.fillText('↑', 136, 83);
    ctx.fillStyle = '#172d33';
    ctx.font = '600 68px system-ui';
    ctx.fillText(front ? `F${id + 1}` : `B${Math.floor(id / 4) * 4 + 4 - (id % 4)}`, 136, 196);
    ctx.fillStyle = front ? '#50796d' : '#8b7256';
    ctx.font = '15px system-ui';
    ctx.fillText(`row ${Math.floor(id / 4) + 1} · cell ${front ? (id % 4) + 1 : 4 - (id % 4)}`, 136, 291);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  resize(width: number, height: number) {
    if (width < 1 || height < 1) return;
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.fitted) this.fit(this.fitted.paper, this.fitted.back);
    this.draw();
  }
  getView(): CameraView {
    return {
      position: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
      up: this.camera.up.toArray(),
    };
  }
  setView(view: CameraView) {
    this.fitted = null;
    this.camera.position.fromArray(view.position);
    const up = new THREE.Vector3(...(view.up || [0, 1, 0])).normalize();
    if (this.camera.up.distanceToSquared(up) > 1e-12) {
      // OrbitControls caches the camera's up axis in its constructor.
      this.controls.removeEventListener('change', this.draw);
      this.controls.dispose();
      this.camera.up.copy(up);
      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = false;
      this.controls.minDistance = 3;
      this.controls.maxDistance = 65;
      this.configureNavigation();
      this.controls.enabled = this.interactive && !this.gesture;
      this.controls.addEventListener('change', this.draw);
      this.camera.position.fromArray(view.position);
    }
    this.controls.target.fromArray(view.target);
    this.controls.update();
    this.draw();
  }
  fit(paper: Paper, back = false) {
    const b = bounds(paper);
    const target = world((b.left + b.right) / 2, (b.top + b.bottom) / 2);
    const distance =
      (Math.max(((b.right - b.left) * CW) / this.camera.aspect, (b.top - b.bottom) * CH) /
        (2 * Math.tan(THREE.MathUtils.degToRad(19)))) *
      1.22;
    this.setView({
      position: [target.x, target.y, (back ? -1 : 1) * Math.max(5, distance)],
      target: target.toArray(),
    });
    this.fitted = { paper, back };
  }
  setInteractive(enabled: boolean) {
    this.interactive = enabled;
    this.controls.enabled = enabled && !this.gesture;
  }
  setPanMode(enabled: boolean) {
    this.panMode = enabled;
    this.cancelGesture();
    this.highlightCrease();
    this.configureNavigation();
    this.canvas.style.cursor = enabled ? 'move' : 'grab';
  }
  setSpreadLayers(enabled: boolean) {
    this.spreadLayers = enabled;
    this.paint(this.paper, this.fold, this.progress);
  }
  private configureNavigation() {
    this.controls.mouseButtons.LEFT = this.panMode ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    this.controls.touches.ONE = this.panMode ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
  }
  setPaper(paper: Paper, fold?: Fold, progress = 0, showCreases = true) {
    this.paper = paper;
    this.fold = fold;
    this.progress = progress;
    this.paint(paper, fold, progress, showCreases);
  }
  private paint(paper: Paper, fold?: Fold, progress = 0, showCreases = true) {
    const moving = new Set(fold?.moving);
    const b = bounds(paper);
    const side = fold ? Math.sign(paper.panels[fold.moving[0]][fold.axis] - fold.line) : 1;
    const theta = fold ? Math.PI * progress * fold.direction * side * (fold.axis === 'x' ? -1 : 1) : 0;
    const pivot = fold
      ? world(fold.axis === 'x' ? fold.line : 2, fold.axis === 'y' ? fold.line : 2)
      : new THREE.Vector3();
    const axis = new THREE.Vector3(fold?.axis === 'y' ? 1 : 0, fold?.axis === 'x' ? 1 : 0, 0);
    const turn = new THREE.Quaternion().setFromAxisAngle(axis, theta);
    const heights = (state: Paper) =>
      state.panels.map((p) => {
        const stack = state.order.filter((id) => state.panels[id].x === p.x && state.panels[id].y === p.y);
        return (stack.indexOf(p.id) - (stack.length - 1) / 2) * (this.spreadLayers ? 0.28 : depth);
      });
    const startHeights = heights(paper);
    const endHeights = fold && progress > 0 ? heights(applyFold(paper, fold)) : startHeights;
    const settle = progress * progress * (3 - 2 * progress);
    for (const p of paper.panels) {
      const group = this.panels[p.id];
      const z = startHeights[p.id];
      const position = world(p.x, p.y, z);
      const orientation = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(
          new THREE.Vector3(p.sx, 0, 0),
          new THREE.Vector3(0, p.sy, 0),
          new THREE.Vector3(0, 0, p.sx * p.sy),
        ),
      );
      if (moving.has(p.id)) {
        position.sub(pivot).applyQuaternion(turn).add(pivot);
        orientation.premultiply(turn);
      }
      // Meet the next exact stack height without snapping when a fold finishes.
      position.z += (endHeights[p.id] - (moving.has(p.id) ? -z : z)) * settle;
      group.position.copy(position);
      group.quaternion.copy(orientation);
      for (const face of group.children as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[])
        face.material.color.set(
          moving.has(p.id)
            ? face.userData.edge
              ? '#249f7e'
              : '#7bdec0'
            : face.userData.edge
              ? '#d8cdb6'
              : '#ffffff',
        );
    }
    this.paintBends(paper);
    this.clearLines();
    if (showCreases)
      for (const c of creases(paper)) {
        const selected =
          (fold?.axis === c.axis && fold.line === c.line) ||
          (this.selection?.axis === c.axis && this.selection.line === c.line);
        if (progress > 0 && !selected) continue;
        const endpoints =
          c.axis === 'x'
            ? [world(c.line, b.bottom, 0.16), world(c.line, b.top, 0.16)]
            : [world(b.left, c.line, 0.16), world(b.right, c.line, 0.16)];
        const geometry = new THREE.BufferGeometry().setFromPoints(endpoints);
        const line = new THREE.Line(
          geometry,
          new THREE.LineBasicMaterial({
            color: selected ? '#30e8b6' : '#6c9b93',
            transparent: true,
            opacity: selected ? 1 : 0.5,
            depthTest: false,
          }),
        );
        line.userData = { axis: c.axis, line: c.line };
        line.renderOrder = 2;
        this.lines.add(line);
      }
    this.clearArrow();
    if (fold && showCreases) {
      const selected = paper.panels.filter((p) => moving.has(p.id));
      const center = world(
        selected.reduce((n, p) => n + p.x, 0) / selected.length,
        selected.reduce((n, p) => n + p.y, 0) / selected.length,
      );
      const arc = Array.from({ length: 33 }, (_, i) =>
        this.rotatePoint(center.clone(), fold, 0.06 + (i / 32) * 0.82),
      );
      const curve = new THREE.CatmullRomCurve3(arc);
      const material = new THREE.MeshBasicMaterial({ color: '#48e3b2', depthTest: false });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.025, 6, false), material);
      tube.renderOrder = 3;
      this.arrow.add(tube);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 12), material.clone());
      head.position.copy(arc.at(-1)!);
      head.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        arc.at(-1)!.clone().sub(arc.at(-2)!).normalize(),
      );
      head.renderOrder = 3;
      this.arrow.add(head);
      // Outline where this flap will land, without adding a second sheet of paper.
      for (const p of selected) {
        const corners = [
          [-0.5, -0.5],
          [0.5, -0.5],
          [0.5, 0.5],
          [-0.5, 0.5],
          [-0.5, -0.5],
        ].map(([x, y]) => this.rotatePoint(world(p.x + x, p.y + y, 0), fold, 1));
        const ghost = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(corners),
          new THREE.LineDashedMaterial({
            color: '#7edabe',
            dashSize: 0.12,
            gapSize: 0.1,
            transparent: true,
            opacity: 0.6,
            depthTest: false,
          }),
        );
        ghost.computeLineDistances();
        ghost.renderOrder = 2;
        this.arrow.add(ghost);
      }
    }
    this.draw();
  }
  private paintBends(paper: Paper) {
    for (const mesh of [...this.bends.children] as THREE.Mesh[]) {
      mesh.geometry.dispose();
      this.bends.remove(mesh);
    }
    // Join neighboring source cells around folded edges, making it read as one sheet.
    for (const h of hinges(paper)) {
      const a = this.panels[h.a],
        b = this.panels[h.b];
      a.updateMatrixWorld();
      b.updateMatrixWorld();
      const vertical = h.b - h.a === 1;
      const ends = (group: THREE.Group, first: boolean) =>
        [-1, 1].map((s) =>
          group.localToWorld(
            vertical
              ? new THREE.Vector3(((first ? 1 : -1) * CW) / 2, (s * CH) / 2, 0)
              : new THREE.Vector3((s * CW) / 2, ((first ? -1 : 1) * CH) / 2, 0),
          ),
        );
      const [a0, a1] = ends(a, true),
        [b0, b1] = ends(b, false);
      const gap = a0.distanceTo(b0);
      if (gap < 0.01) continue;
      const center = a0.clone().add(a1).add(b0).add(b1).multiplyScalar(0.25);
      const outward = center.clone().sub(a.position.clone().add(b.position).multiplyScalar(0.5));
      if (outward.lengthSq() > 0.001) outward.normalize();
      const vertices: number[] = [],
        indices: number[] = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        for (const [from, to] of [
          [a0, b0],
          [a1, b1],
        ]) {
          const v = from
            .clone()
            .lerp(to, t)
            .addScaledVector(outward, Math.sin(Math.PI * t) * gap * 0.5);
          vertices.push(v.x, v.y, v.z);
        }
        if (i < 12) {
          const n = i * 2;
          indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, this.bendMaterial);
      mesh.castShadow = mesh.receiveShadow = true;
      this.bends.add(mesh);
    }
  }
  private clearArrow() {
    for (const object of [...this.arrow.children] as THREE.Mesh[]) {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
      this.arrow.remove(object);
    }
  }
  private clearLines() {
    for (const line of [...this.lines.children] as THREE.Line[]) {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
      this.lines.remove(line);
    }
  }
  draw = () => {
    if (!this.disposed) this.renderer.render(this.scene, this.camera);
  };
  dispose() {
    this.disposed = true;
    this.controls.removeEventListener('change', this.draw);
    this.controls.dispose();
    this.clearLines();
    this.clearArrow();
    this.geometry.dispose();
    this.edgeGeometry.dispose();
    for (const mesh of this.bends.children as THREE.Mesh[]) mesh.geometry.dispose();
    this.bendMaterial.dispose();
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.cancelGesture();
    this.canvas.removeEventListener('pointerdown', this.onDown, true);
    this.canvas.removeEventListener('pointerup', this.onUp, true);
    this.canvas.removeEventListener('pointermove', this.onMove, true);
    this.canvas.removeEventListener('pointercancel', this.onCancel, true);
    this.canvas.removeEventListener('lostpointercapture', this.onCancel);
    this.canvas.removeEventListener('pointerleave', this.onLeave);
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
