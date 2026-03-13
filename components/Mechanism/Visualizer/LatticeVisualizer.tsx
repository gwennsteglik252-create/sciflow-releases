
import React, { useMemo, useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stage, Float, Html, Sphere } from '@react-three/drei';
import { useProjectContext } from '../../../context/ProjectContext';
import { TheoreticalDescriptors } from '../../../services/gemini/analysis';

// 原子配置：颜色与半径
const ATOM_CONFIG: Record<string, { color: string; radius: number; category: string }> = {
  Co: { color: '#1e3a8a', radius: 0.20, category: 'Metal' },
  Ni: { color: '#4ade80', radius: 0.20, category: 'Metal' },
  O: { color: '#ef4444', radius: 0.14, category: 'Ligand' },
  H: { color: '#ffffff', radius: 0.08, category: 'Proton' },
  W: { color: '#94a3b8', radius: 0.22, category: 'Metal' },
  Fe: { color: '#ca8a04', radius: 0.21, category: 'Metal' },
  Ag: { color: '#e2e8f0', radius: 0.24, category: 'Noble Metal' },
  Pt: { color: '#94a3b8', radius: 0.23, category: 'Noble Metal' },
  Pd: { color: '#cbd5e1', radius: 0.22, category: 'Noble Metal' },
  Cu: { color: '#f97316', radius: 0.21, category: 'Metal' },
  Au: { color: '#fbbf24', radius: 0.24, category: 'Noble Metal' },
  V: { color: '#8b5cf6', radius: 0.21, category: 'Transition' },
  Cr: { color: '#0ea5e9', radius: 0.20, category: 'Transition' },
  Mn: { color: '#c026d3', radius: 0.20, category: 'Transition' },
  Mo: { color: '#64748b', radius: 0.23, category: 'Transition' },
  Ru: { color: '#ec4899', radius: 0.22, category: 'Noble Metal' },
  Ir: { color: '#06b6d4', radius: 0.22, category: 'Noble Metal' },
  Mg: { color: '#a3e635', radius: 0.16, category: 'Metal' },
  Ba: { color: '#fcd34d', radius: 0.27, category: 'Transition' },
  C: { color: '#1e293b', radius: 0.16, category: 'Framework' },
  N: { color: '#3b82f6', radius: 0.13, category: 'Ligand' },
  S: { color: '#84cc16', radius: 0.16, category: 'Ligand' },
  P: { color: '#f97316', radius: 0.17, category: 'Ligand' },
  Cl: { color: '#10b981', radius: 0.18, category: 'Ligand' },
};

type ReactionType = 'OER' | 'ORR' | null;
const REACTION_STEPS = {
  OER: [
    { label: 'H₂O → M-OH* + H⁺ + e⁻', incoming: 'H2O', adsorbate: 'OH', departing: 'H+' },
    { label: 'M-OH* → M-O* + H⁺ + e⁻', incoming: null as string | null, adsorbate: 'O', departing: 'H+' },
    { label: 'M-O* + H₂O → M-OOH*', incoming: 'H2O', adsorbate: 'OOH', departing: 'H+' },
    { label: 'M-OOH* → O₂↑ + H⁺ + e⁻', incoming: null as string | null, adsorbate: null as string | null, departing: 'O2' },
  ],
  ORR: [
    { label: 'O₂ + H⁺ + e⁻ → M-OOH*', incoming: 'O2', adsorbate: 'OOH', departing: null as string | null },
    { label: 'M-OOH* → M-O* + H₂O', incoming: null as string | null, adsorbate: 'O', departing: 'H2O' },
    { label: 'M-O* + H⁺ + e⁻ → M-OH*', incoming: 'H+', adsorbate: 'OH', departing: null as string | null },
    { label: 'M-OH* + H⁺ + e⁻ → H₂O↑', incoming: 'H+', adsorbate: null as string | null, departing: 'H2O' },
  ],
};

interface Atom {
  id: number;
  pos: THREE.Vector3;
  type: string;
  isDopant?: boolean;
  isSACMetal?: boolean;
}

interface BondProps {
  start: THREE.Vector3;
  end: THREE.Vector3;
}

const Bond: React.FC<BondProps> = ({ start, end }) => {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize()
  );

  return (
    <mesh position={midpoint} quaternion={quaternion}>
      <cylinderGeometry args={[0.015, 0.015, length, 6]} />
      <meshStandardMaterial color="#94a3b8" transparent opacity={0.4} roughness={0.1} />
    </mesh>
  );
};

const MoleculeGroup: React.FC<{ type: string; position: THREE.Vector3; opacity?: number }> = ({ type, position, opacity = 1 }) => {
  const M = ({ color, emissive }: { color: string; emissive?: boolean }) => (
    <meshStandardMaterial color={color} transparent opacity={opacity} roughness={0.15} metalness={0.4}
      emissive={emissive ? color : '#000'} emissiveIntensity={emissive ? 0.5 : 0} />
  );
  switch (type) {
    case 'H2O': return (
      <group position={position}>
        <Sphere args={[0.20, 16, 16]}><M color="#ef4444" /></Sphere>
        <Sphere args={[0.10, 12, 12]} position={[0.24, 0.12, 0]}><M color="#e8e8e8" /></Sphere>
        <Sphere args={[0.10, 12, 12]} position={[-0.24, 0.12, 0]}><M color="#e8e8e8" /></Sphere>
      </group>);
    case 'O2': return (
      <group position={position}>
        <Sphere args={[0.20, 16, 16]} position={[0.15, 0, 0]}><M color="#ef4444" /></Sphere>
        <Sphere args={[0.20, 16, 16]} position={[-0.15, 0, 0]}><M color="#ef4444" /></Sphere>
      </group>);
    case 'OH': return (
      <group position={position}>
        <Sphere args={[0.20, 16, 16]}><M color="#ef4444" /></Sphere>
        <Sphere args={[0.10, 12, 12]} position={[0, 0.26, 0]}><M color="#e8e8e8" /></Sphere>
      </group>);
    case 'O': return (
      <group position={position}>
        <Sphere args={[0.22, 16, 16]}><M color="#ef4444" emissive /></Sphere>
      </group>);
    case 'OOH': return (
      <group position={position}>
        <Sphere args={[0.17, 16, 16]}><M color="#ef4444" /></Sphere>
        <Sphere args={[0.17, 16, 16]} position={[0, 0.28, 0]}><M color="#ef4444" /></Sphere>
        <Sphere args={[0.09, 12, 12]} position={[0.17, 0.42, 0]}><M color="#e8e8e8" /></Sphere>
      </group>);
    case 'H+': return (
      <group position={position}>
        <Sphere args={[0.09, 12, 12]}><M color="#fbbf24" emissive /></Sphere>
      </group>);
    default: return null;
  }
};

const ReactionSimulation: React.FC<{
  sitePos: THREE.Vector3; siteNormal: THREE.Vector3;
  reactionType: 'OER' | 'ORR'; step: number;
}> = ({ sitePos, siteNormal, reactionType, step }) => {
  const tRef = useRef(0);
  const [t, setT] = useState(0);
  useEffect(() => { tRef.current = 0; setT(0); }, [step, reactionType]);
  useFrame((_, delta) => {
    tRef.current = Math.min(tRef.current + delta * 0.18, 1);
    setT(tRef.current);
  });

  const stepData = REACTION_STEPS[reactionType][step];
  const norm = siteNormal.clone().normalize();
  const adsorbPos = sitePos.clone().add(norm.clone().multiplyScalar(0.6));
  const farAbove = sitePos.clone().add(norm.clone().multiplyScalar(4.0));
  const tangent = new THREE.Vector3(1, 0, 0);
  if (Math.abs(tangent.dot(norm)) > 0.9) tangent.set(0, 0, 1);
  const sideDir = new THREE.Vector3().crossVectors(norm, tangent).normalize();
  const farSide = adsorbPos.clone().add(sideDir.multiplyScalar(2.5)).add(norm.clone().multiplyScalar(2.0));

  const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
  const easeIn = (x: number) => x * x;
  const inT = Math.min(t / 0.45, 1);
  const inPos = stepData.incoming ? new THREE.Vector3().lerpVectors(farAbove, adsorbPos, easeOut(inT)) : adsorbPos;
  const inOp = stepData.incoming ? (t < 0.5 ? 1 : Math.max(0, 1 - (t - 0.5) / 0.15)) : 0;
  const glowT = t > 0.35 && t < 0.65 ? Math.sin(((t - 0.35) / 0.3) * Math.PI) : 0;
  const adsOp = stepData.adsorbate ? (t > 0.45 ? Math.min((t - 0.45) / 0.15, 1) : 0) : 0;
  const depT = Math.max((t - 0.55) / 0.45, 0);
  const depPos = stepData.departing ? new THREE.Vector3().lerpVectors(adsorbPos, farSide, easeIn(depT)) : farSide;
  const depOp = stepData.departing ? (t > 0.55 ? Math.max(0, 1 - depT * 0.5) : 0) : 0;
  const bondMid = sitePos.clone().add(norm.clone().multiplyScalar(0.3));
  const bondQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), norm);

  return (
    <group>
      {glowT > 0 && <mesh position={adsorbPos}>
        <sphereGeometry args={[0.35 + glowT * 0.25, 16, 16]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={glowT * 0.45} />
      </mesh>}
      {stepData.incoming && inOp > 0.01 && <MoleculeGroup type={stepData.incoming} position={inPos} opacity={inOp} />}
      {stepData.adsorbate && adsOp > 0.01 && <>
        <MoleculeGroup type={stepData.adsorbate} position={adsorbPos} opacity={adsOp} />
        <mesh position={bondMid} quaternion={bondQuat}>
          <cylinderGeometry args={[0.02, 0.02, 0.45, 8]} />
          <meshStandardMaterial color="#ef4444" transparent opacity={adsOp * 0.8} />
        </mesh>
      </>}
      {stepData.departing && depOp > 0.01 && <MoleculeGroup type={stepData.departing} position={depPos} opacity={depOp} />}
      {stepData.departing === 'H+' && depOp > 0.01 && <mesh position={depPos}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={depOp * 0.2} wireframe />
      </mesh>}
      <Html position={adsorbPos.clone().add(norm.clone().multiplyScalar(1.8))} distanceFactor={7} center>
        <div className="px-3 py-1.5 bg-black/85 backdrop-blur text-white text-[9px] font-bold rounded-xl border border-white/25 shadow-2xl whitespace-nowrap pointer-events-none">
          <span className="text-amber-400 mr-1.5 text-[10px]">Step {step + 1}/4</span>{stepData.label}
        </div>
      </Html>
    </group>
  );
};

const CrystalScene: React.FC<{ atoms: Atom[], bonds: any[], dopingElement: string }> = ({ atoms, bonds, dopingElement }) => {
  return (
    <group position={[-1.5, -1.5, -1.5]}>
      <mesh position={[1.5, 1.5, 1.5]}>
        <boxGeometry args={[4.2, 4.2, 4.2]} />
        <meshBasicMaterial color="#6366f1" wireframe transparent opacity={0.03} />
      </mesh>

      {bonds.map((bond, i) => (
        <Bond key={`bond-${i}`} start={bond.start} end={bond.end} />
      ))}

      {atoms.map((atom) => (
        <group key={atom.id} position={atom.pos}>
          <Sphere args={[ATOM_CONFIG[atom.type]?.radius || 0.2, 32, 32]}>
            <meshStandardMaterial
              color={ATOM_CONFIG[atom.type]?.color || '#94a3b8'}
              roughness={0.1}
              metalness={0.8}
              emissive={atom.isDopant ? ATOM_CONFIG[atom.type]?.color : '#000'}
              emissiveIntensity={atom.isDopant ? 0.6 : 0}
            />
          </Sphere>

          {atom.isDopant && (
            <Html distanceFactor={8}>
              <div className="px-1.5 py-0.5 bg-indigo-600 text-white text-[6px] font-black rounded border border-white/30 uppercase tracking-widest shadow-xl pointer-events-none">
                {atom.type} SUB
              </div>
            </Html>
          )}
        </group>
      ))}
    </group>
  );
};

interface LatticeVisualizerProps {
  material: string;
  dopingElement: string;
  dopingConcentration: number;
  coDopingElement?: string;
  coDopingConcentration?: number;
  unitCellType: string;
}

const LatticeVisualizer: React.FC<LatticeVisualizerProps> = (props) => {
  const { updateMechanismSession } = useProjectContext();
  const [isUnfolded, setIsUnfolded] = useState(false);
  const [unfoldProgress, setUnfoldProgress] = useState(0); // 0 = wrapped, 1 = unfolded
  const unfoldRef = useRef(0);

  const isMofOrSac = props.unitCellType.includes('MOF') || props.unitCellType.includes('SAC');

  // 展开/折叠动画
  useEffect(() => {
    const target = isUnfolded ? 1 : 0;
    let running = true;
    const animate = () => {
      if (!running) return;
      const diff = target - unfoldRef.current;
      if (Math.abs(diff) < 0.005) {
        unfoldRef.current = target;
        setUnfoldProgress(target);
        return;
      }
      unfoldRef.current += diff * 0.07;
      setUnfoldProgress(unfoldRef.current);
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    return () => { running = false; };
  }, [isUnfolded]);

  // === OER/ORR Reaction Simulation ===
  const [reactionType, setReactionType] = useState<ReactionType>(null);
  const [reactionStep, setReactionStep] = useState(0);
  useEffect(() => { if (reactionType) setReactionStep(0); }, [reactionType]);
  useEffect(() => {
    if (!reactionType) return;
    const timer = setTimeout(() => setReactionStep(prev => (prev + 1) % 4), 6000);
    return () => clearTimeout(timer);
  }, [reactionType, reactionStep]);
  const toggleReaction = (type: 'OER' | 'ORR') => {
    if (reactionType === type) { setReactionType(null); setReactionStep(0); }
    else { setReactionType(type); setReactionStep(0); }
  };

  // ═══ 阶段1：结构生成（只在材料参数变化时重算，不依赖 unfoldProgress）═══
  const structureData = useMemo(() => {
    const R = 2.8;
    const metalSitesFlat: THREE.Vector3[] = [];
    const auxiliarySitesFlat: THREE.Vector3[] = [];
    // 标记哪些辅助位点是 MOF/SAC 生成的 (需要 wrap)
    let mofAuxStartIdx = -1;
    let mofMetalStartIdx = -1;
    const spacing = 1.2;
    const size = 3;
    let idCounter = 0;
    const isMofSac = props.unitCellType.includes('MOF') || props.unitCellType.includes('SAC');
    const isSAC = props.unitCellType.includes('SAC');

    // 记录需要 wrap 的 flat 坐标
    const flatCoordsForWrap: { target: 'metal' | 'aux'; flatPos: THREE.Vector3 }[] = [];

    if (props.unitCellType.includes('Layered')) {
      for (let x = 0; x < 4; x++) {
        for (let z = 0; z < 4; z++) {
          metalSitesFlat.push(new THREE.Vector3(x * spacing, 0, z * spacing));
          auxiliarySitesFlat.push(new THREE.Vector3(x * spacing + 0.4, 0.6, z * spacing + 0.4));
          auxiliarySitesFlat.push(new THREE.Vector3(x * spacing - 0.4, -0.6, z * spacing - 0.4));
        }
      }
    } else if (isMofSac) {
      const a = 0.65;
      const cGridFlat: THREE.Vector3[] = [];

      for (let i = -7; i <= 7; i++) {
        for (let j = -8; j <= 8; j++) {
          const cx = i * Math.sqrt(3) * a + (j % 2 !== 0 ? Math.sqrt(3) / 2 * a : 0);
          const cz = j * 1.5 * a;
          cGridFlat.push(new THREE.Vector3(cx, 0, cz - 0.5 * a));
          cGridFlat.push(new THREE.Vector3(cx, 0, cz + 0.5 * a));
        }
      }

      const potentialCentersFlat = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(2.5 * Math.sqrt(3) * a, 0, 4.5 * a),
        new THREE.Vector3(-2.5 * Math.sqrt(3) * a, 0, -4.5 * a),
        new THREE.Vector3(-1.5 * Math.sqrt(3) * a, 0, 6 * a),
        new THREE.Vector3(3 * Math.sqrt(3) * a, 0, -3 * a)
      ];

      mofAuxStartIdx = auxiliarySitesFlat.length;
      mofMetalStartIdx = metalSitesFlat.length;

      let currentC = [...cGridFlat];
      potentialCentersFlat.forEach(target => {
        currentC.sort((A, B) => A.distanceTo(target) - B.distanceTo(target));
        const p1 = currentC[0];
        const p2 = currentC.find(p => p.distanceTo(p1) > 0.1 && p.distanceTo(p1) < 1.2 * a) || currentC[1];
        const mCenterFlat = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

        currentC = currentC.filter(p => p.distanceTo(p1) > 0.1 && p.distanceTo(p2) > 0.1);
        currentC.sort((A, B) => A.distanceTo(mCenterFlat) - B.distanceTo(mCenterFlat));

        for (let k = 0; k < 4; k++) {
          flatCoordsForWrap.push({ target: 'aux', flatPos: currentC[k].clone() });
        }
        currentC = currentC.slice(4);
        flatCoordsForWrap.push({ target: 'metal', flatPos: mCenterFlat.clone() });
      });

      currentC.forEach(p => {
        flatCoordsForWrap.push({ target: 'aux', flatPos: p.clone() });
      });
    } else {
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          for (let z = 0; z < size; z++) {
            const base = new THREE.Vector3(x * spacing, y * spacing, z * spacing);
            metalSitesFlat.push(base);
            if (x < size - 1) auxiliarySitesFlat.push(new THREE.Vector3((x + 0.5) * spacing, y * spacing, z * spacing));
            if (y < size - 1) auxiliarySitesFlat.push(new THREE.Vector3(x * spacing, (y + 0.5) * spacing, z * spacing));
            if (z < size - 1) auxiliarySitesFlat.push(new THREE.Vector3(x * spacing, y * spacing, (z + 0.5) * spacing));
            if (props.unitCellType.includes('BCC')) {
              if (x < size - 1 && y < size - 1 && z < size - 1) {
                metalSitesFlat.push(new THREE.Vector3((x + 0.5) * spacing, (y + 0.5) * spacing, (z + 0.5) * spacing));
              }
            } else if (props.unitCellType.includes('FCC')) {
              if (x < size - 1 && y < size - 1) metalSitesFlat.push(new THREE.Vector3((x + 0.5) * spacing, (y + 0.5) * spacing, z * spacing));
              if (x < size - 1 && z < size - 1) metalSitesFlat.push(new THREE.Vector3((x + 0.5) * spacing, y * spacing, (z + 0.5) * spacing));
              if (y < size - 1 && z < size - 1) metalSitesFlat.push(new THREE.Vector3(x * spacing, (y + 0.5) * spacing, (z + 0.5) * spacing));
            }
          }
        }
      }
    }

    // 预计算掺杂映射
    const totalMetalCount = metalSitesFlat.length + (isMofSac ? flatCoordsForWrap.filter(f => f.target === 'metal').length : 0);
    const isCoDopingLigand = ['S', 'P', 'N', 'O'].includes(props.coDopingElement || '');
    const dopingCount1 = Math.round(totalMetalCount * (props.dopingConcentration / 100));
    const dopingCount2 = props.coDopingElement && props.coDopingElement !== 'None' && !isCoDopingLigand
      ? Math.round(totalMetalCount * ((props.coDopingConcentration || 0) / 100))
      : 0;
    const indices = Array.from({ length: totalMetalCount }, (_, i) => i);
    // 使用确定性种子以避免每次 random 不同
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const dopedSet1 = new Set(indices.slice(0, dopingCount1));
    const dopedSet2 = new Set(indices.slice(dopingCount1, dopingCount1 + dopingCount2));

    return {
      metalSitesFlat, auxiliarySitesFlat, flatCoordsForWrap,
      mofAuxStartIdx, mofMetalStartIdx, spacing, isMofSac, isSAC, R,
      dopedSet1, dopedSet2, isCoDopingLigand, totalMetalCount,
    };
  }, [props.dopingConcentration, props.dopingElement, props.coDopingElement, props.coDopingConcentration, props.material, props.unitCellType]);

  // ═══ 阶段2：坐标变换 + 键连计算（依赖 unfoldProgress，但使用缓存的结构数据）═══
  const { atoms, bonds, stats } = useMemo(() => {
    const { metalSitesFlat, auxiliarySitesFlat, flatCoordsForWrap, mofAuxStartIdx, mofMetalStartIdx, spacing, isMofSac, isSAC, R, dopedSet1, dopedSet2, isCoDopingLigand } = structureData;
    let idCounter = 0;

    const wrap = (v: THREE.Vector3) => {
      const flat = new THREE.Vector3(v.x, 0, v.z);
      const theta = v.x / R;
      const wave = 0.15 * Math.sin(v.z * 1.5) * Math.cos(v.x * 1.2);
      const wrapped = new THREE.Vector3(v.z, (R + wave) * Math.cos(theta), (R + wave) * Math.sin(theta));
      if (unfoldProgress <= 0) return wrapped;
      if (unfoldProgress >= 1) return flat;
      return new THREE.Vector3().lerpVectors(wrapped, flat, unfoldProgress);
    };

    // 构建最终的金属和辅助位点
    const metalSites: THREE.Vector3[] = [...metalSitesFlat.map(p => p.clone())];
    const auxiliarySites: THREE.Vector3[] = [...auxiliarySitesFlat.map(p => p.clone())];

    if (isMofSac) {
      flatCoordsForWrap.forEach(fc => {
        if (fc.target === 'metal') metalSites.push(wrap(fc.flatPos));
        else auxiliarySites.push(wrap(fc.flatPos));
      });

      if (!isSAC) {
        const wrappedCenterY = R - 0.8;
        const flatCenterY = 0.8;
        const clusterY = wrappedCenterY + (flatCenterY - wrappedCenterY) * unfoldProgress;
        const clusterCenter = new THREE.Vector3(1.0, clusterY, 0.5);
        for (let k = 0; k < 12; k++) {
          const phi = Math.acos(-1 + (2 * k) / 12);
          const theta = Math.sqrt(12 * Math.PI) * phi;
          const r = 0.6;
          metalSites.push(new THREE.Vector3(
            clusterCenter.x + r * Math.sin(phi) * Math.cos(theta),
            clusterCenter.y + r * Math.sin(phi) * Math.sin(theta),
            clusterCenter.z + r * Math.cos(phi)
          ));
        }
      }
    }

    const totalMetalCount = metalSites.length;

    const metalAtoms: Atom[] = metalSites.map((pos, idx) => {
      const isDoped1 = dopedSet1.has(idx);
      const isDoped2 = dopedSet2.has(idx);
      const isDoped = isDoped1 || isDoped2;
      let type = props.material;

      const config = (TheoreticalDescriptors as any)[props.material];
      if (config && config.primaryMetal) type = config.primaryMetal;

      if (!isDoped && props.material === 'NiFe-LDH') {
        type = (Math.floor(pos.x / spacing) + Math.floor(pos.z / spacing)) % 2 === 0 ? 'Ni' : 'Fe';
      }
      if (!isDoped && props.material.includes('HEA')) {
        const heaElements = ['Fe', 'Co', 'Ni', 'Mn', 'Cr'];
        type = heaElements[Math.floor(Math.random() * heaElements.length)];
      }
      if (isDoped1) type = props.dopingElement;
      if (isDoped2) type = props.coDopingElement!;

      const isSACMetal = isMofSac && idx < 5;
      return { id: idCounter++, pos: pos.clone(), type, isDopant: isDoped, isSACMetal };
    });

    const auxiliaryAtoms: Atom[] = auxiliarySites.map((pos, idx) => {
      let type = 'O';
      if (isMofSac) {
        const m4SitesCount = 5 * 4;
        type = idx < m4SitesCount ? 'N' : 'C';
      }
      return { id: idCounter++, pos: pos.clone(), type };
    });

    if (isCoDopingLigand && isMofSac) {
      const ligandConcentration = (props.coDopingConcentration || 0) / 100;
      for (let i = 0; i < 5; i++) {
        if (Math.random() < ligandConcentration * 5) {
          const sacPos = metalSites[i];
          const normal = new THREE.Vector3(0, sacPos.y, sacPos.z).normalize();
          const axialPos = sacPos.clone().add(normal.multiplyScalar(1.15));
          auxiliaryAtoms.push({ id: idCounter++, pos: axialPos, type: props.coDopingElement! });
        }
      }
    }

    const distortionThreshold = 1.0;
    const shiftScale = 0.08;
    metalAtoms.forEach((atom, i) => {
      if (atom.isDopant) {
        const selfShift = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).normalize().multiplyScalar(shiftScale * 0.4);
        atom.pos.add(selfShift);
        metalAtoms.forEach((nb, j) => {
          if (i === j) return;
          const dist = atom.pos.distanceTo(nb.pos);
          if (dist < distortionThreshold) {
            const push = new THREE.Vector3().subVectors(nb.pos, atom.pos).normalize().multiplyScalar(shiftScale);
            nb.pos.add(push);
          }
        });
      }
    });

    const finalAtoms = [...metalAtoms, ...auxiliaryAtoms];

    // ═══ 空间哈希加速键连计算 ═══
    const maxBondDist = isMofSac ? 1.45 : 1.25;
    const cellSize = maxBondDist + 0.01;
    const spatialHash = new Map<string, number[]>();

    finalAtoms.forEach((atom, i) => {
      const cx = Math.floor(atom.pos.x / cellSize);
      const cy = Math.floor(atom.pos.y / cellSize);
      const cz = Math.floor(atom.pos.z / cellSize);
      const key = `${cx},${cy},${cz}`;
      if (!spatialHash.has(key)) spatialHash.set(key, []);
      spatialHash.get(key)!.push(i);
    });

    const bondList: { start: THREE.Vector3; end: THREE.Vector3 }[] = [];
    const bondCountMap: Record<number, number> = {};
    const coordinationLimits: Record<string, number> = {
      'O': 3, 'C': 3, 'N': 3,
      'default': isMofSac ? 8 : (props.unitCellType.includes('Layered') ? 6 : 12)
    };
    const processedPairs = new Set<string>();

    finalAtoms.forEach((a1, i) => {
      const cx = Math.floor(a1.pos.x / cellSize);
      const cy = Math.floor(a1.pos.y / cellSize);
      const cz = Math.floor(a1.pos.z / cellSize);

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const neighborKey = `${cx + dx},${cy + dy},${cz + dz}`;
            const neighbors = spatialHash.get(neighborKey);
            if (!neighbors) continue;

            for (const j of neighbors) {
              if (j <= i) continue;
              const pairKey = `${i}-${j}`;
              if (processedPairs.has(pairKey)) continue;
              processedPairs.add(pairKey);

              const a2 = finalAtoms[j];
              if ((bondCountMap[a1.id] || 0) >= (coordinationLimits[a1.type] || coordinationLimits.default)) continue;
              if ((bondCountMap[a2.id] || 0) >= (coordinationLimits[a2.type] || coordinationLimits.default)) continue;
              const dist = a1.pos.distanceTo(a2.pos);
              const isMetal1 = a1.type !== 'O';
              const isMetal2 = a2.type !== 'O';
              let shouldBond = false;
              if (isMofSac) {
                const isLF1 = ['C', 'N', 'S', 'P', 'O', 'Cl'].includes(a1.type);
                const isLF2 = ['C', 'N', 'S', 'P', 'O', 'Cl'].includes(a2.type);
                if (!isLF1 && !isLF2 && dist < 0.75) {
                  shouldBond = true;
                } else if ((!isLF1 && isLF2) || (isLF1 && !isLF2)) {
                  const mAtom = isLF2 ? a1 : a2;
                  const cnAtom = isLF2 ? a2 : a1;
                  if (mAtom.isSACMetal) {
                    if (['N', 'S', 'P', 'O', 'Cl'].includes(cnAtom.type) && dist < 1.45) shouldBond = true;
                  } else {
                    if (cnAtom.type === 'C' && dist < 1.05) shouldBond = true;
                  }
                } else if (isLF1 && isLF2 && dist < 0.95) {
                  shouldBond = true;
                }
              } else if ((isMetal1 && !isMetal2) || (!isMetal1 && isMetal2)) {
                if (dist > 0.4 && dist < 1.0) shouldBond = true;
              } else if (isMetal1 && isMetal2) {
                const sameLayer = Math.abs(a1.pos.y - a2.pos.y) < 0.1;
                if (dist > 0.8 && dist < 1.25) {
                  if (props.unitCellType.includes('Layered')) {
                    if (sameLayer) shouldBond = true;
                  } else {
                    shouldBond = true;
                  }
                }
              }
              if (shouldBond) {
                bondList.push({ start: a1.pos, end: a2.pos });
                bondCountMap[a1.id] = (bondCountMap[a1.id] || 0) + 1;
                bondCountMap[a2.id] = (bondCountMap[a2.id] || 0) + 1;
              }
            }
          }
        }
      }
    });

    const typeCounts: Record<string, number> = {};
    finalAtoms.forEach(a => { typeCounts[a.type] = (typeCounts[a.type] || 0) + 1; });
    const statsList = Object.entries(typeCounts).map(([type, count]) => ({
      type, count, percent: (count / finalAtoms.length) * 100
    })).sort((a, b) => b.count - a.count);

    return { atoms: finalAtoms, bonds: bondList, stats: statsList };
  }, [structureData, unfoldProgress, props.material, props.unitCellType, props.dopingElement, props.coDopingElement, props.coDopingConcentration]);

  // Compute SAC site position and surface normal for reaction simulation
  const sacSitePos = useMemo(() => atoms.find(a => a.isSACMetal)?.pos || null, [atoms]);
  const sacSiteNormal = useMemo(() => {
    if (!sacSitePos) return new THREE.Vector3(0, 1, 0);
    if (unfoldProgress >= 1) return new THREE.Vector3(0, 1, 0);
    const radial = new THREE.Vector3(0, sacSitePos.y, sacSitePos.z);
    if (radial.length() < 0.01) return new THREE.Vector3(0, 1, 0);
    const wN = radial.normalize();
    return new THREE.Vector3().lerpVectors(wN, new THREE.Vector3(0, 1, 0), unfoldProgress).normalize();
  }, [sacSitePos, unfoldProgress]);

  return (
    <div className="w-full h-full min-h-[500px] bg-white rounded-[3rem] overflow-hidden relative border border-slate-200 shadow-xl group/canvas flex flex-col">
      <div className="flex-1 relative">
        <Canvas shadows camera={{ position: [7, 5, 7], fov: 30 }}>
          <color attach="background" args={['#ffffff']} />
          <ambientLight intensity={1.5} />
          <pointLight position={[10, 10, 10]} intensity={1.5} castShadow />
          <pointLight position={[-10, -10, -10]} intensity={0.4} color="#6366f1" />

          <Stage intensity={0.6} environment="city" adjustCamera={false}>
            <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.3}>
              <CrystalScene atoms={atoms} bonds={bonds} dopingElement={props.dopingElement} />
              {reactionType && sacSitePos && (
                <group position={[-1.5, -1.5, -1.5]}>
                  <ReactionSimulation sitePos={sacSitePos} siteNormal={sacSiteNormal} reactionType={reactionType} step={reactionStep} />
                </group>
              )}
            </Float>
          </Stage>

          <OrbitControls makeDefault enableDamping dampingFactor={0.05} minDistance={0.5} maxDistance={80} />
        </Canvas>

        <div className="absolute top-4 left-4 flex flex-col gap-1.5 pointer-events-none">
          <div className="px-3 py-1 bg-white/80 backdrop-blur-md rounded-full border border-indigo-100 flex items-center gap-2 w-fit shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest leading-none">STRUCTURAL ENGINE v4.5</span>
          </div>
          <div className="px-2 py-0.5 bg-slate-50/80 rounded border border-slate-200 text-[6px] font-black text-slate-500 uppercase tracking-tighter ml-1">
            Optimized Coordination Model
          </div>
        </div>

        <div className="absolute top-4 right-4 z-20">
          <div className="px-3 py-1.5 bg-white/90 backdrop-blur-xl rounded-xl border border-slate-200 shadow-lg flex items-center gap-2 group/select hover:border-indigo-300 transition-all">
            <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <i className="fa-solid fa-cube text-[10px]"></i>
            </div>
            <div className="flex flex-col">
              <span className="text-[6px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-0.5">Topology</span>
              <select
                className="bg-transparent text-[9px] font-black text-slate-800 outline-none cursor-pointer appearance-none pr-4"
                value={props.unitCellType}
                onChange={(e) => updateMechanismSession({ unitCellType: e.target.value })}
              >
                <option value="Layered (LDH)" className="bg-white">Layered (LDH)</option>
                <option value="MOF (Porous Framework)" className="bg-white">MOF (Framework)</option>
                <option value="SAC (Carbon Framework)" className="bg-white">SAC (Carbon)</option>
                <option value="Simple Cubic" className="bg-white">Simple Cubic</option>
                <option value="BCC (体心立方)" className="bg-white">BCC</option>
                <option value="FCC (面心立方)" className="bg-white">FCC</option>
                <option value="Rutile" className="bg-white">Rutile</option>
                <option value="Perovskite" className="bg-white">Perovskite</option>
              </select>
            </div>
            <i className="fa-solid fa-chevron-down text-[6px] text-slate-400 absolute right-3 bottom-2.5"></i>
          </div>

          {isMofOrSac && (
            <button
              onClick={() => setIsUnfolded(u => !u)}
              className={`mt-2 px-3 py-1.5 rounded-xl border shadow-lg flex items-center gap-2 transition-all duration-300 backdrop-blur-xl ${isUnfolded
                ? 'bg-indigo-500 border-indigo-400 text-white hover:bg-indigo-600'
                : 'bg-white/90 border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
                }`}
              title={isUnfolded ? '卷回管状' : '展开为平面'}
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${isUnfolded ? 'bg-indigo-400/40' : 'bg-indigo-50'
                }`}>
                <i className={`fa-solid ${isUnfolded ? 'fa-circle' : 'fa-up-right-and-down-left-from-center'} text-[10px] ${isUnfolded ? 'text-white' : 'text-indigo-600'
                  }`}></i>
              </div>
              <div className="flex flex-col">
                <span className={`text-[6px] font-black uppercase tracking-tighter leading-none mb-0.5 ${isUnfolded ? 'text-indigo-200' : 'text-slate-400'
                  }`}>Tube View</span>
                <span className={`text-[9px] font-black tracking-tight ${isUnfolded ? 'text-white' : 'text-slate-800'
                  }`}>{isUnfolded ? 'Unfolded' : 'Wrapped'}</span>
              </div>
            </button>
          )}

          {isMofOrSac && (
            <div className="mt-2 flex gap-1.5">
              {(['OER', 'ORR'] as const).map(type => (
                <button key={type} onClick={() => toggleReaction(type)}
                  className={`px-2.5 py-1.5 rounded-xl border shadow-lg flex items-center gap-1.5 transition-all duration-300 backdrop-blur-xl text-[9px] font-black ${reactionType === type
                    ? 'bg-amber-500 border-amber-400 text-white hover:bg-amber-600'
                    : 'bg-white/90 border-slate-200 text-slate-700 hover:border-amber-300 hover:bg-amber-50'
                    }`}
                  title={`${type === 'OER' ? '析氧反应' : '氧还原反应'}演示`}
                >
                  <i className={`fa-solid ${type === 'OER' ? 'fa-arrow-up-from-water-pump' : 'fa-wind'} text-[9px]`} />
                  {type}{reactionType === type && <i className="fa-solid fa-circle-play text-[8px] animate-pulse" />}
                </button>
              ))}
            </div>
          )}

          {reactionType && (
            <div className="mt-1.5 px-2.5 py-1.5 bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-700 shadow-lg">
              <div className="text-[6px] font-black text-amber-400 uppercase tracking-widest mb-1">
                {reactionType} Simulation
              </div>
              <div className="flex gap-1">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className={`w-5 h-1 rounded-full transition-all duration-500 ${i === reactionStep ? 'bg-amber-400' : i < reactionStep ? 'bg-amber-400/30' : 'bg-slate-600'
                    }`} />
                ))}
              </div>
              <div className="text-[6px] text-slate-300 font-bold mt-1 whitespace-nowrap">
                {REACTION_STEPS[reactionType][reactionStep].label}
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-100 px-4 py-3 flex items-center gap-4 overflow-x-auto no-scrollbar z-10 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
          {stats.map((s) => {
            const cfg = ATOM_CONFIG[s.type];
            const isDoped = s.type === props.dopingElement;
            return (
              <div key={s.type} className="flex items-center gap-3 shrink-0 group/legend bg-slate-50 p-1.5 rounded-xl border border-slate-100 pr-3 shadow-sm">
                <div className="w-4 h-4 rounded-full shadow-sm border border-black/5" style={{ backgroundColor: cfg?.color || '#94a3b8' }} />
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-2 leading-none">
                    <span className="text-[10px] font-black text-slate-800 tracking-tighter">{s.type}</span>
                    <span className={`text-[7px] font-mono font-bold ${isDoped ? 'text-rose-500' : 'text-indigo-500'}`}>{s.percent.toFixed(1)}%</span>
                  </div>
                  <div className="w-14 h-0.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                    <div className={`h-full transition-all duration-1000 ${isDoped ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${s.percent}%` }}></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LatticeVisualizer;
