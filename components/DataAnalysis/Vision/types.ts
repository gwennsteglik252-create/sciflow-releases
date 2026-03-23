
export type AnalysisMode = 'SEM' | 'TEM' | 'XRD';

export interface ParticleData {
  id: number;
  x: number;
  y: number;
  radius: number; // in pixels (average)
  radiusX?: number; // Ellipse major/minor
  radiusY?: number; // Ellipse major/minor
  rotation?: number;
  realSize?: number; // in nm
}

export interface XrdPeakData {
  id: number;
  x: number; // pixel position
  y: number; // pixel position (intensity peak)
  twoTheta: number; // calculated 2-theta (deg)
  intensity: number; // normalized 0-255 or arbitrary
  fwhm: number; // Full Width at Half Maximum (deg)
  dSpacing: number; // nm
  crystalliteSize: number; // nm (Scherrer)
  shiftAnalysis?: string; // e.g. "Lattice Contraction"
}

export interface LatticeResult {
  dSpacing: number; // nm
  planeFamily?: string; // e.g., "(111)"
  material?: string; // e.g., "Ag"
}

export interface DefectAnalysisResult {
  defectDensity: number; // percentage
  activeSitesEstimate: string; // High/Medium/Low
}

export interface SAEDRing {
  radiusPx: number;       // 衍射环半径 (像素)
  dSpacing: number;       // 对应 d-spacing (nm)
  hkl?: string;           // 晶面指数, e.g. "(111)"
  material?: string;      // 匹配材质
  intensity?: number;     // 相对强度 0-1
}

export interface SAEDResult {
  centerX: number;
  centerY: number;
  rings: SAEDRing[];
  crystalType: 'polycrystalline' | 'single-crystal' | 'amorphous' | 'unknown';
}

export interface AngleResult {
  line1DSpacing: number;   // 线 1 的 d-spacing (nm)
  line2DSpacing: number;   // 线 2 的 d-spacing (nm)
  angleDeg: number;        // 两组晶格条纹的夹角 (度)
  zoneAxis?: string;       // 推测晶带轴, e.g. "[110]"
  line1Plane?: string;     // 线 1 晶面
  line2Plane?: string;     // 线 2 晶面
}

export interface EDSLayerData {
  id: string;
  element: string;         // 元素名, e.g. "Fe", "Co", "N"
  color: string;           // 伪彩色, e.g. "#ff0000"
  imageSrc: string;        // 图像 base64 或 blob URL
  opacity: number;         // 0-1
  visible: boolean;
}
