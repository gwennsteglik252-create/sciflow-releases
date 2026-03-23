import React, { useRef, useMemo, useCallback, useState } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, Html, Billboard } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { GraphNode, GraphEdge } from '../../types';

// ─── 力导向 3D 布局算法（已优化：Map索引 + 向量复用） ─────────────
function layoutForceDirected3D(
  nodes: GraphNode[],
  edges: GraphEdge[],
  iterations: number = 150
): Map<string, THREE.Vector3> {
  const spread = 10;
  // 根据节点数量动态调整迭代次数，避免大图卡顿
  const actualIterations = nodes.length > 200 ? 80 : nodes.length > 100 ? 120 : iterations;

  interface N3D { id: string; type: string; pos: THREE.Vector3; vel: THREE.Vector3; }
  const n3d: N3D[] = nodes.map((n) => ({
    id: n.id,
    type: n.type,
    pos: new THREE.Vector3(
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread * 0.6
    ),
    vel: new THREE.Vector3(0, 0, 0),
  }));

  const projectIdx = n3d.findIndex(n => n.type === 'Project');
  if (projectIdx >= 0) n3d[projectIdx].pos.set(0, 0, 0);

  // ★ 关键优化: O(1) 索引查找，替代每条边的 .find()
  const idxMap = new Map<string, number>();
  for (let i = 0; i < n3d.length; i++) idxMap.set(n3d[i].id, i);

  // ★ 预解析 edge 索引对，避免迭代内反复查 Map
  const edgePairs: [number, number][] = [];
  for (const edge of edges) {
    const si = idxMap.get(edge.source);
    const ti = idxMap.get(edge.target);
    if (si !== undefined && ti !== undefined) edgePairs.push([si, ti]);
  }

  const dt = 0.025;
  const repulsion = 4.0;
  const attraction = 0.06;
  const damping = 0.82;
  const linkDist = 3.5;

  // ★ 复用临时向量，避免每次迭代 new Vector3
  const diff = new THREE.Vector3();
  const force = new THREE.Vector3();

  for (let iter = 0; iter < actualIterations; iter++) {
    for (let i = 0; i < n3d.length; i++) {
      for (let j = i + 1; j < n3d.length; j++) {
        diff.subVectors(n3d[i].pos, n3d[j].pos);
        const dist = Math.max(diff.length(), 0.15);
        force.copy(diff).normalize().multiplyScalar(repulsion / (dist * dist) * dt);
        n3d[i].vel.add(force);
        n3d[j].vel.sub(force);
      }
    }
    for (const [si, ti] of edgePairs) {
      diff.subVectors(n3d[ti].pos, n3d[si].pos);
      const dist = diff.length();
      force.copy(diff).normalize().multiplyScalar((dist - linkDist) * attraction * dt);
      n3d[si].vel.add(force);
      n3d[ti].vel.sub(force);
    }
    for (const n of n3d) {
      if (n.type === 'Project') continue;
      n.vel.multiplyScalar(damping);
      n.pos.add(n.vel);
    }
  }

  const result = new Map<string, THREE.Vector3>();
  for (const n of n3d) result.set(n.id, n.pos.clone());
  return result;
}

// ─── 着色器：发光星点 ────────────────────────────────────────────
const starVertexShader = `
  attribute float size;
  attribute vec3 customColor;
  attribute float brightness;
  varying vec3 vColor;
  varying float vBrightness;
  void main() {
    vColor = customColor;
    vBrightness = brightness;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (450.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const starFragmentShader = `
  varying vec3 vColor;
  varying float vBrightness;
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    // 多层发光：硬核心 + 柔辉光 + 宽弥散
    float core = smoothstep(0.10, 0.0, dist);  // 更亮的白核心
    float glow = smoothstep(0.45, 0.0, dist);  // 中层辉光
    float outer = smoothstep(0.5, 0.1, dist) * 0.4; // 更宽外层弥散
    vec3 white = vec3(1.0);
    vec3 color = mix(vColor * (glow + outer), white, core * 0.9);
    float alpha = (core * 1.2 + glow * 0.8 + outer) * vBrightness;
    gl_FragColor = vec4(color * 2.5, alpha);
  }
`;

// ─── 着色器：背景星尘（★ GPU端闪烁，消除JS端6000次循环） ─────────
const dustVertexShader = `
  attribute float size;
  attribute float alpha;
  attribute float phase;
  uniform float uTime;
  varying float vAlpha;
  void main() {
    // ★ 闪烁在 GPU 端计算，无需 JS 每帧遍历
    float twinkle = sin(uTime * (1.5 + mod(float(gl_VertexID), 7.0) * 0.3) + phase) * 0.5 + 0.5;
    vAlpha = alpha * (0.3 + twinkle * 0.7);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (200.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const dustFragmentShader = `
  varying float vAlpha;
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    float glow = smoothstep(0.5, 0.0, dist);
    float core = smoothstep(0.06, 0.0, dist);
    vec3 color = mix(vec3(0.65, 0.75, 0.95), vec3(1.0), core);
    gl_FragColor = vec4(color * 1.3, glow * vAlpha);
  }
`;

// ─── 多层星空背景（★ 闪烁动画完全移至 GPU） ──────────────────────
function CosmicBackground({ nodeCount = 0 }: { nodeCount?: number }) {
  const dustRef = useRef<THREE.Points>(null!);
  const nebulaRef = useRef<THREE.Points>(null!);
  const dustTimeUniform = useRef({ value: 0 });
  const nebulaTimeUniform = useRef({ value: 0 });

  // ★ 根据节点数量降级背景粒子
  const dustCount = nodeCount > 200 ? 2000 : nodeCount > 100 ? 4000 : 6000;
  const nebulaCount = nodeCount > 200 ? 500 : nodeCount > 100 ? 1000 : 1500;

  // 第一层：微小星尘
  const dustData = useMemo(() => {
    const positions = new Float32Array(dustCount * 3);
    const sizes = new Float32Array(dustCount);
    const alphas = new Float32Array(dustCount);
    const phases = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
      sizes[i] = Math.random() * 0.15 + 0.03;
      alphas[i] = Math.random() * 0.7 + 0.1;
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, sizes, alphas, phases, count: dustCount };
  }, [dustCount]);

  // 第二层：星云团簇
  const nebulaData = useMemo(() => {
    const positions = new Float32Array(nebulaCount * 3);
    const sizes = new Float32Array(nebulaCount);
    const alphas = new Float32Array(nebulaCount);
    const phases = new Float32Array(nebulaCount);
    const clusterCenters = [
      new THREE.Vector3(15, 8, -10),
      new THREE.Vector3(-20, -5, 5),
      new THREE.Vector3(5, -15, -15),
      new THREE.Vector3(-10, 12, 8),
    ];
    for (let i = 0; i < nebulaCount; i++) {
      const center = clusterCenters[i % clusterCenters.length];
      const spread = 8 + Math.random() * 12;
      positions[i * 3] = center.x + (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = center.y + (Math.random() - 0.5) * spread;
      positions[i * 3 + 2] = center.z + (Math.random() - 0.5) * spread;
      sizes[i] = Math.random() * 0.25 + 0.08;
      alphas[i] = Math.random() * 0.4 + 0.05;
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, sizes, alphas, phases, count: nebulaCount };
  }, [nebulaCount]);

  // ★ useFrame 只更新 rotation 和 uniform（不再遍历 6000 alpha）
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    dustTimeUniform.current.value = t;
    nebulaTimeUniform.current.value = t;
    if (dustRef.current) {
      dustRef.current.rotation.y = t * 0.002;
      dustRef.current.rotation.x = Math.sin(t * 0.001) * 0.02;
    }
    if (nebulaRef.current) {
      nebulaRef.current.rotation.y = -t * 0.001;
    }
  });

  return (
    <>
      <points ref={dustRef} renderOrder={-2}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dustData.positions, 3]} />
          <bufferAttribute attach="attributes-size" args={[dustData.sizes, 1]} />
          <bufferAttribute attach="attributes-alpha" args={[dustData.alphas, 1]} />
          <bufferAttribute attach="attributes-phase" args={[dustData.phases, 1]} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={dustVertexShader}
          fragmentShader={dustFragmentShader}
          uniforms={{ uTime: dustTimeUniform.current }}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points ref={nebulaRef} renderOrder={-1}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[nebulaData.positions, 3]} />
          <bufferAttribute attach="attributes-size" args={[nebulaData.sizes, 1]} />
          <bufferAttribute attach="attributes-alpha" args={[nebulaData.alphas, 1]} />
          <bufferAttribute attach="attributes-phase" args={[nebulaData.phases, 1]} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={dustVertexShader}
          fragmentShader={dustFragmentShader}
          uniforms={{ uTime: nebulaTimeUniform.current }}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  );
}

// ─── 节点颜色 ────────────────────────────────────────────────────
const NODE_COLORS: Record<string, THREE.Color> = {
  Project: new THREE.Color('#7c8aff'),   // 偏白蓝 (中心)
  Literature: new THREE.Color('#4ade80'), // 绿色
  Characterization: new THREE.Color('#fb7185'), // 粉红
  TRL_Milestone: new THREE.Color('#fbbf24'), // 金黄
  Patent: new THREE.Color('#38bdf8'),
  Cost: new THREE.Color('#a78bfa'),
  Metric: new THREE.Color('#22d3ee'),
};

function getNodeSize(type: string): number {
  if (type === 'Project') return 3.8;
  if (type === 'TRL_Milestone') return 2.2;
  if (type === 'Literature') return 1.6;
  return 1.3;
}

// ─── 知识图谱星点（统一用 Points + ShaderMaterial） ──────────────
interface GraphStarsProps {
  nodes: GraphNode[];
  posMap: Map<string, THREE.Vector3>;
  selectedNode: GraphNode | null;
  highlightedPath: Set<string>;
  onSelectNode: (node: GraphNode) => void;
}

function GraphStars({ nodes, posMap, selectedNode, highlightedPath, onSelectNode }: GraphStarsProps) {
  const pointsRef = useRef<THREE.Points>(null!);

  const { positions, sizes, colors, brightnesses, count } = useMemo(() => {
    const positions: number[] = [];
    const sizes: number[] = [];
    const colors: number[] = [];
    const brightnesses: number[] = [];

    for (const node of nodes) {
      const pos = posMap.get(node.id);
      if (!pos) continue;
      positions.push(pos.x, pos.y, pos.z);

      const isSelected = selectedNode?.id === node.id;
      const isHighlighted = highlightedPath.has(node.id);

      const baseSize = getNodeSize(node.type);
      sizes.push(isSelected ? baseSize * 2.0 : isHighlighted ? baseSize * 1.5 : baseSize);

      const col = NODE_COLORS[node.type] || new THREE.Color('#ffffff');
      if (isSelected) {
        colors.push(1, 1, 1); // 选中时变白
      } else {
        colors.push(col.r, col.g, col.b);
      }

      brightnesses.push(isSelected ? 1.5 : isHighlighted ? 1.2 : 0.9);
    }

    return {
      positions: new Float32Array(positions),
      sizes: new Float32Array(sizes),
      colors: new Float32Array(colors),
      brightnesses: new Float32Array(brightnesses),
      count: nodes.length,
    };
  }, [nodes, posMap, selectedNode, highlightedPath]);

  // 呼吸动画
  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const sizeAttr = geo.getAttribute('size') as THREE.BufferAttribute;
    const t = clock.getElapsedTime();
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const baseSize = getNodeSize(node.type);
      const isSelected = selectedNode?.id === node.id;
      const isHighlighted = highlightedPath.has(node.id);
      const pulse = 1 + Math.sin(t * 1.5 + i * 0.7) * 0.15;
      const targetSize = isSelected ? baseSize * 2.2 : isHighlighted ? baseSize * 1.5 : baseSize;
      sizeAttr.array[i] = targetSize * pulse;
    }
    sizeAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} renderOrder={5}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-customColor" args={[colors, 3]} />
        <bufferAttribute attach="attributes-brightness" args={[brightnesses, 1]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={starVertexShader}
        fragmentShader={starFragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ─── 可点击的隐形命中区域 + 标签（全部可见） ──────────────────────
// ★ 关键优化: 仅对 重要/选中/悬停 节点渲染 HTML 标签，其余不渲染标签
// 大幅减少 DOM 节点数量，消除 3D→DOM 的帧率瓶颈
function NodeHitAreas({ nodes, posMap, selectedNode, highlightedPath, onSelectNode }: GraphStarsProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  // ★ 只对以下节点渲染 HTML 标签（最多约 20-30 个 DOM 元素）
  const shouldShowLabel = useCallback((node: GraphNode) => {
    if (node.type === 'Project') return true;           // 中心节点始终显示
    if (selectedNode?.id === node.id) return true;      // 选中节点
    if (hovered === node.id) return true;               // 悬停节点
    if (highlightedPath.has(node.id)) return true;      // 高亮路径上的节点
    if (node.type === 'TRL_Milestone') return true;     // 里程碑始终显示
    // 节点少于 50 时全部显示；否则只显示重要类型
    if (nodes.length <= 50) return true;
    return false;
  }, [selectedNode, hovered, highlightedPath, nodes.length]);

  return (
    <>
      {nodes.map(node => {
        const pos = posMap.get(node.id);
        if (!pos) return null;
        const isSelected = selectedNode?.id === node.id;
        const isHighlighted = highlightedPath.has(node.id);
        const isHovered = hovered === node.id;
        const col = NODE_COLORS[node.type] || new THREE.Color('#ffffff');
        const showLabel = shouldShowLabel(node);

        let fontSize = '9px';
        let labelOpacity = 0.55;
        if (node.type === 'Project') { fontSize = '11px'; labelOpacity = 1; }
        else if (isSelected) { fontSize = '12px'; labelOpacity = 1; }
        else if (isHighlighted || isHovered) { fontSize = '11px'; labelOpacity = 0.9; }
        else if (node.type === 'TRL_Milestone') { fontSize = '10px'; labelOpacity = 0.65; }

        return (
          <group key={node.id} position={pos}>
            {/* 隐形点击区域 */}
            <mesh
              onClick={(e) => { e.stopPropagation(); onSelectNode(node); }}
              onPointerOver={() => { setHovered(node.id); document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { setHovered(null); document.body.style.cursor = 'default'; }}
              visible={false}
            >
              <sphereGeometry args={[0.6, 8, 8]} />
              <meshBasicMaterial />
            </mesh>

            {/* 选中光环动画 */}
            {isSelected && (
              <mesh renderOrder={3}>
                <ringGeometry args={[0.7, 0.85, 48]} />
                <meshBasicMaterial
                  color="#ffffff"
                  transparent
                  opacity={0.6}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
            )}

            {/* ★ 文字标签 — 仅重要节点渲染 HTML */}
            {showLabel && (
              <Billboard>
                <Html
                  center
                  distanceFactor={14}
                  style={{ pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}
                >
                  <div style={{
                    color: isSelected ? '#ffffff' : isHighlighted ? '#6ee7b7' : `#${col.getHexString()}`,
                    fontSize,
                    fontWeight: isSelected || node.type === 'Project' ? '900' : '700',
                    textShadow: `0 0 10px rgba(0,0,0,1), 0 0 20px rgba(0,0,0,0.9), 0 0 6px #${col.getHexString()}44`,
                    letterSpacing: node.type === 'Project' ? '1.5px' : '0.5px',
                    transform: 'translateY(24px)',
                    opacity: labelOpacity,
                    transition: 'all 0.3s ease',
                  }}>
                    {node.label}
                  </div>
                </Html>
              </Billboard>
            )}
          </group>
        );
      })}
    </>
  );
}

// ─── 连线（贝塞尔曲线） ──────────────────────────────────────────
interface EdgeLinesProps {
  edges: GraphEdge[];
  posMap: Map<string, THREE.Vector3>;
  highlightedPath: Set<string>;
  selectedNode: GraphNode | null;
}

// 生成贝塞尔曲线的点序列
function makeCurvePoints(start: THREE.Vector3, end: THREE.Vector3, segments: number = 24): number[] {
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  // 计算垂直于连线的偏移方向，产生弧度
  const dir = new THREE.Vector3().subVectors(end, start);
  const dist = dir.length();
  // 用 cross product 找到垂直方向
  const up = new THREE.Vector3(0, 1, 0);
  const perp = new THREE.Vector3().crossVectors(dir.normalize(), up);
  if (perp.length() < 0.01) perp.set(1, 0, 0);
  perp.normalize();
  // 弧度大小与距离成正比，加一点随机性让每条线略有不同
  const curvature = dist * 0.15 + (Math.sin(start.x * 7 + end.z * 3) * 0.5 + 0.5) * dist * 0.1;
  const controlPoint = mid.clone().add(perp.multiplyScalar(curvature));

  const curve = new THREE.QuadraticBezierCurve3(start, controlPoint, end);
  const points = curve.getPoints(segments);
  const arr: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    arr.push(points[i].x, points[i].y, points[i].z);
    arr.push(points[i + 1].x, points[i + 1].y, points[i + 1].z);
  }
  return arr;
}

function EdgeLines({ edges, posMap, highlightedPath, selectedNode }: EdgeLinesProps) {
  const { normalGeo, highlightGeo, activeGeo } = useMemo(() => {
    const normal: number[] = [];
    const highlight: number[] = [];
    const active: number[] = [];

    for (const edge of edges) {
      const sPos = posMap.get(edge.source);
      const tPos = posMap.get(edge.target);
      if (!sPos || !tPos) continue;

      const isHighlighted = highlightedPath.has(edge.source) && highlightedPath.has(edge.target);
      const isActive = selectedNode && (edge.source === selectedNode.id || edge.target === selectedNode.id);

      const curvePoints = makeCurvePoints(sPos, tPos, 20);

      if (isHighlighted) {
        highlight.push(...curvePoints);
      } else if (isActive) {
        active.push(...curvePoints);
      } else {
        normal.push(...curvePoints);
      }
    }

    const makeGeo = (arr: number[]) => {
      if (arr.length === 0) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      return geo;
    };

    return {
      normalGeo: makeGeo(normal),
      highlightGeo: makeGeo(highlight),
      activeGeo: makeGeo(active),
    };
  }, [edges, posMap, highlightedPath, selectedNode]);

  return (
    <>
      {normalGeo && (
        <lineSegments geometry={normalGeo} renderOrder={1}>
          <lineBasicMaterial color="#2a5580" transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
        </lineSegments>
      )}
      {highlightGeo && (
        <lineSegments geometry={highlightGeo} renderOrder={2}>
          <lineBasicMaterial color="#34d399" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
        </lineSegments>
      )}
      {activeGeo && (
        <lineSegments geometry={activeGeo} renderOrder={2}>
          <lineBasicMaterial color="#7dd3fc" transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} />
        </lineSegments>
      )}
    </>
  );
}

// ─── 聚焦射线爆发（粗发光线束） ──────────────────────────────────
const rayVertexShader = `
  attribute float alpha;
  varying float vAlpha;
  void main() {
    vAlpha = alpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const rayFragmentShader = `
  uniform vec3 color;
  uniform float time;
  varying float vAlpha;
  void main() {
    float pulse = 0.6 + sin(time * 3.0) * 0.4;
    gl_FragColor = vec4(color * 2.0, vAlpha * pulse);
  }
`;

function FocusRays({ selectedNode, edges, posMap }: {
  selectedNode: GraphNode | null;
  edges: GraphEdge[];
  posMap: Map<string, THREE.Vector3>;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const timeUniform = useRef({ value: 0 });

  const geometry = useMemo(() => {
    if (!selectedNode) return null;
    const center = posMap.get(selectedNode.id);
    if (!center) return null;

    const connectedEdges = edges.filter(
      e => e.source === selectedNode.id || e.target === selectedNode.id
    );
    if (connectedEdges.length === 0) return null;

    // 使用三角形面片创建粗光束
    const positions: number[] = [];
    const alphas: number[] = [];
    const width = 0.04; // 光束宽度

    for (const edge of connectedEdges) {
      const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
      const otherPos = posMap.get(otherId);
      if (!otherPos) continue;

      const dir = new THREE.Vector3().subVectors(otherPos, center);
      const perp = new THREE.Vector3(0, 1, 0).cross(dir).normalize().multiplyScalar(width);
      if (perp.length() < 0.001) {
        perp.set(width, 0, 0);
      }

      // 两个三角形组成一个面片光束
      const p0 = center.clone().add(perp);
      const p1 = center.clone().sub(perp);
      const p2 = otherPos.clone().add(perp.clone().multiplyScalar(0.3));
      const p3 = otherPos.clone().sub(perp.clone().multiplyScalar(0.3));

      positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      positions.push(p1.x, p1.y, p1.z, p3.x, p3.y, p3.z, p2.x, p2.y, p2.z);
      alphas.push(0.8, 0.8, 0.1, 0.8, 0.1, 0.1);
    }

    if (positions.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1));
    return geo;
  }, [selectedNode, edges, posMap]);

  useFrame(({ clock }) => {
    timeUniform.current.value = clock.getElapsedTime();
  });

  if (!geometry) return null;

  const col = selectedNode ? (NODE_COLORS[selectedNode.type] || new THREE.Color('#ffffff')) : new THREE.Color('#4fc3f7');

  return (
    <mesh geometry={geometry} renderOrder={4}>
      <shaderMaterial
        vertexShader={rayVertexShader}
        fragmentShader={rayFragmentShader}
        uniforms={{
          color: { value: col },
          time: timeUniform.current,
        }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ─── 选中节点周围的飞散粒子光晕 ─────────────────────────────────
function FocusParticles({ selectedNode, posMap }: {
  selectedNode: GraphNode | null;
  posMap: Map<string, THREE.Vector3>;
}) {
  const ref = useRef<THREE.Points>(null!);
  const count = 200;

  const offsets = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.3 + Math.random() * 1.5;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current || !selectedNode) return;
    const center = posMap.get(selectedNode.id);
    if (!center) return;
    ref.current.position.copy(center);
    ref.current.rotation.y = clock.getElapsedTime() * 0.5;
    ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.3) * 0.3;
  });

  if (!selectedNode) return null;

  const col = NODE_COLORS[selectedNode.type] || new THREE.Color('#4fc3f7');

  return (
    <points ref={ref} renderOrder={3}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[offsets, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color={col}
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ─── 连线上的流动能量粒子 ────────────────────────────────────────
function FlowingParticles({ edges, posMap }: { edges: GraphEdge[]; posMap: Map<string, THREE.Vector3>; }) {
  const ref = useRef<THREE.Points>(null!);
  const count = 200;

  // 预计算每个粒子所在的曲线
  const curveData = useMemo(() => {
    const curves: THREE.QuadraticBezierCurve3[] = [];
    for (const edge of edges) {
      const s = posMap.get(edge.source);
      const t = posMap.get(edge.target);
      if (!s || !t) continue;
      const mid = new THREE.Vector3().addVectors(s, t).multiplyScalar(0.5);
      const dir = new THREE.Vector3().subVectors(t, s);
      const dist = dir.length();
      const up = new THREE.Vector3(0, 1, 0);
      const perp = new THREE.Vector3().crossVectors(dir.normalize(), up);
      if (perp.length() < 0.01) perp.set(1, 0, 0);
      perp.normalize();
      const curvature = dist * 0.15 + (Math.sin(s.x * 7 + t.z * 3) * 0.5 + 0.5) * dist * 0.1;
      const cp = mid.clone().add(perp.multiplyScalar(curvature));
      curves.push(new THREE.QuadraticBezierCurve3(s.clone(), cp, t.clone()));
    }

    // 每个粒子分配到一条边，并记录其初始t值
    const assignments = new Array(count);
    const offsets = new Float32Array(count);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      assignments[i] = curves.length > 0 ? i % curves.length : 0;
      offsets[i] = Math.random();
      speeds[i] = 0.03 + Math.random() * 0.07;
    }
    return { curves, assignments, offsets, speeds };
  }, [edges, posMap]);

  const positions = useMemo(() => new Float32Array(count * 3), [count]);

  useFrame(({ clock }) => {
    if (!ref.current || curveData.curves.length === 0) return;
    const t = clock.getElapsedTime();
    const posAttr = ref.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      const curve = curveData.curves[curveData.assignments[i]];
      if (!curve) continue;
      const progress = (curveData.offsets[i] + t * curveData.speeds[i]) % 1;
      const point = curve.getPoint(progress);
      posAttr.array[i * 3] = point.x;
      posAttr.array[i * 3 + 1] = point.y;
      posAttr.array[i * 3 + 2] = point.z;
    }
    posAttr.needsUpdate = true;
  });

  if (curveData.curves.length === 0) return null;

  return (
    <points ref={ref} renderOrder={4}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#88ccff"
        transparent
        opacity={0.7}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ─── 中心节点辐射光球 ────────────────────────────────────────────
function CentralRadiance({ nodes, posMap }: { nodes: GraphNode[]; posMap: Map<string, THREE.Vector3>; }) {
  const ref = useRef<THREE.Mesh>(null!);
  const projectNode = nodes.find(n => n.type === 'Project');
  const pos = projectNode ? posMap.get(projectNode.id) : null;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const pulse = 1 + Math.sin(t * 0.8) * 0.2;
    ref.current.scale.setScalar(pulse);
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.06 + Math.sin(t * 1.2) * 0.02;
  });

  if (!pos) return null;

  return (
    <mesh ref={ref} position={pos} renderOrder={0}>
      <sphereGeometry args={[1.8, 32, 32]} />
      <meshBasicMaterial
        color="#6366f1"
        transparent
        opacity={0.03}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
      />
    </mesh>
  );
}

// ─── 自动旋转 ────────────────────────────────────────────────────
function AutoRotateGroup({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  const ref = useRef<THREE.Group>(null!);
  const prevTimeRef = useRef<number | null>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    if (enabled) {
      if (prevTimeRef.current !== null) {
        const delta = t - prevTimeRef.current;
        ref.current.rotation.y += delta * 0.05;
      }
      prevTimeRef.current = t;
    } else {
      // 停止旋转时重置前一帧时间，这样恢复时不会跳变
      prevTimeRef.current = null;
    }
  });
  return <group ref={ref}>{children}</group>;
}

// ─── 主场景 ──────────────────────────────────────────────────────
interface StarfieldGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNode: GraphNode | null;
  highlightedPath: Set<string>;
  onSelectNode: (node: GraphNode) => void;
}

function SceneContent({ nodes, edges, selectedNode, highlightedPath, onSelectNode }: StarfieldGraphProps) {
  const [autoRotate, setAutoRotate] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const posMap = useMemo(
    () => layoutForceDirected3D(nodes, edges, 180),
    [nodes, edges]
  );

  const handleInteraction = useCallback(() => {
    setAutoRotate(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setAutoRotate(true), 8000);
  }, []);

  return (
    <>
      <color attach="background" args={['#020510']} />
      <fog attach="fog" args={['#020510', 18, 55]} />

      <CosmicBackground nodeCount={nodes.length} />

      <AutoRotateGroup enabled={autoRotate}>
        <CentralRadiance nodes={nodes} posMap={posMap} />

        <EdgeLines
          edges={edges}
          posMap={posMap}
          highlightedPath={highlightedPath}
          selectedNode={selectedNode}
        />

        <FlowingParticles edges={edges} posMap={posMap} />

        <FocusRays
          selectedNode={selectedNode}
          edges={edges}
          posMap={posMap}
        />

        <FocusParticles
          selectedNode={selectedNode}
          posMap={posMap}
        />

        <GraphStars
          nodes={nodes}
          posMap={posMap}
          selectedNode={selectedNode}
          highlightedPath={highlightedPath}
          onSelectNode={onSelectNode}
        />

        <NodeHitAreas
          nodes={nodes}
          posMap={posMap}
          selectedNode={selectedNode}
          highlightedPath={highlightedPath}
          onSelectNode={onSelectNode}
        />
      </AutoRotateGroup>

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        dampingFactor={0.06}
        enableDamping
        minDistance={4}
        maxDistance={35}
        rotateSpeed={0.5}
        onStart={handleInteraction}
      />

      {/* ★ 节点多时关闭 Bloom 后处理，大幅提升帧率 */}
      {nodes.length <= 150 && (
        <EffectComposer>
          <Bloom
            intensity={3.0}
            luminanceThreshold={0.15}
            luminanceSmoothing={0.95}
            radius={0.85}
            mipmapBlur
          />
        </EffectComposer>
      )}
    </>
  );
}

// ─── 导出画布容器 ────────────────────────────────────────────────
export default function StarfieldGraph(props: StarfieldGraphProps) {
  return (
    <Canvas
      camera={{ position: [0, 2, 16], fov: 55, near: 0.1, far: 120 }}
      gl={{
        antialias: props.nodes.length <= 100, // ★ 节点多时关闭抗锯齿
        alpha: false,
        powerPreference: 'high-performance',
        toneMapping: THREE.NoToneMapping,
      }}
      style={{ width: '100%', height: '100%', background: '#020510' }}
      dpr={props.nodes.length > 100 ? [1, 1] : [1, 2]} // ★ 节点多时降低分辨率
    >
      <SceneContent {...props} />
    </Canvas>
  );
}
