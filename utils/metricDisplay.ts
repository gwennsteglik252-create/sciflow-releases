export const normalizeMetricKey = (key: string): string =>
  String(key || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const stripTrailingUnitParens = (text: string): string => {
  let base = String(text || '').trim();
  while (true) {
    const m = base.match(/\s*\([^()]+\)\s*$/);
    if (!m || m.index == null) break;
    base = base.slice(0, m.index).trim();
  }
  return base;
};

const normalizeMetricCoreKey = (key: string): string =>
  normalizeMetricKey(stripTrailingUnitParens(key));

const PHRASE_LABEL_MAP: Record<string, string> = {
  peakcount: '峰数量',
  strongestpeak2theta: '主峰2θ',
  strongestpeakintensity: '主峰强度',
  crystallitesize: '晶粒尺寸',
  matchedphasecount: '匹配相数量',
  averagediameter: '平均等效粒径',
  avgequivalentdiameter: '平均等效粒径',
  maxdiameter: '最大粒径',
  mindiameter: '最小粒径',
  stddiameter: '标准偏差',
  pdi: 'PDI',
  particlecount: '颗粒总数',
  defectsdensity: '缺陷密度',
  dspacingnm: '晶格间距',
  porosity: '孔隙率',
  edgedensity: '边缘密度',
  bindingenergy: '结合能',
  dbandcenter: 'd带中心',
  rsquared: '拟合R²',
  overpotential10macm2: '过电位',
  oeroverpotential: 'OER过电位',
  tafelslope: '塔菲尔斜率',
  oertafelslope: 'OER塔菲尔斜率',
  halfwavepotential: '半波电位',
  limitingcurrent: '极限电流',
  massactivity: '质量活性',
  oermassactivity: 'OER质量活性',
  onsetpotential: '起始电位',
  oeronsetpotential: 'OER起始电位',
  roughnessfactor: '粗糙度因子',
  kineticcurrent: '动力学电流',
  electrontransfernum: '电子转移数',
  klr2: 'K-L拟合R²',
  klslope: 'K-L斜率',
  klintercept: 'K-L截距',
  peakseparation: '峰电位差',
  anodiccathodicratio: '阳阴极峰电流比',
  contactresistance: '接触电阻',
  throughplaneresistance: '穿透电阻',
  inplaneresistance: '面内电阻',
  compressionpressure: '加载压力',
};

const TOKEN_MAP: Record<string, string> = {
  peak: '峰',
  strongest: '主',
  intensity: '强度',
  theta: 'θ',
  crystallite: '晶粒',
  crystal: '晶体',
  size: '尺寸',
  matched: '匹配',
  phase: '相',
  count: '数量',
  average: '平均',
  avg: '平均',
  equivalent: '等效',
  max: '最大',
  min: '最小',
  std: '标准',
  stdev: '偏差',
  deviation: '偏差',
  particle: '颗粒',
  defects: '缺陷',
  defect: '缺陷',
  density: '密度',
  spacing: '间距',
  porosity: '孔隙率',
  edge: '边缘',
  binding: '结合',
  energy: '能',
  shift: '位移',
  band: '带',
  center: '中心',
  overpotential: '过电位',
  tafel: '塔菲尔',
  slope: '斜率',
  half: '半',
  wave: '波',
  onset: '起始',
  limiting: '极限',
  current: '电流',
  ecsa: '活性面积',
  cdl: '双层电容',
  mass: '质量',
  activity: '活性',
  roughness: '粗糙度',
  factor: '因子',
  kinetic: '动力学',
  electron: '电子',
  transfer: '转移',
  rs: 'Rs',
  rct: 'Rct',
  cpe: 'CPE',
  kl: 'K-L',
  r2: 'R²',
  intercept: '截距',
  separation: '电位差',
  anodic: '阳极',
  cathodic: '阴极',
  ratio: '比',
  oer: 'OER',
  orr: 'ORR',
  contact: '接触',
  through: '穿透',
  in: '面内',
  plane: '',
  resistance: '电阻',
  compression: '加载',
  pressure: '压力',
  warburg: '瓦尔堡',
  exchange: '交换',
  voltage: '电压',
  degradation: '衰减',
  pore: '孔',
  volume: '容积',
  psa: '比表面积',
  ssa: '比表面积',
};

const extractUnitFromKey = (key: string): string => {
  const units = Array.from(String(key || '').matchAll(/\(([^)]+)\)/g))
    .map((m) => m[1]?.trim())
    .filter(Boolean) as string[];
  return units.length ? units[units.length - 1] : '';
};

const splitMetricTokens = (key: string): string[] => {
  const raw = String(key || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
    .replace(/[_/-]+/g, ' ')
    .trim();
  return raw.split(/\s+/).filter(Boolean);
};

const inferUnit = (key: string): string => {
  const nk = normalizeMetricKey(key);
  const raw = String(key || '').toLowerCase();
  if (raw.includes('2θ') || nk.includes('theta')) return '°';
  if (nk.includes('count') || raw.includes('总数') || raw.includes('数量')) return '个';
  if (nk.includes('size') || raw.includes('粒径') || nk.includes('spacing') || raw.includes('标准偏差')) return 'nm';
  if (nk.includes('intensity') || raw.includes('强度')) return 'a.u.';
  if (nk.includes('overpotential') || raw.includes('过电位')) return 'mV';
  if (nk.includes('tafel') || nk.includes('slope') || raw.includes('斜率')) return 'mV/dec';
  if (nk.includes('potential') || raw.includes('电位')) return 'V';
  if (nk.includes('current')) return 'mA/cm²';
  if (nk.includes('ecsa') || raw.includes('活性面积')) return 'cm²';
  if (nk.includes('massactivity') || raw.includes('质量活性')) return 'mA/mg';
  if (nk.includes('resistance') || nk === 'rs' || nk === 'rct' || raw.includes('电阻')) return 'Ω';
  if (nk.includes('porosity') || raw.includes('孔隙率')) return '%';
  if (nk.includes('edgedensity') || raw.includes('边缘密度')) return 'μm⁻¹';
  if (nk.includes('bindingenergy') || nk.includes('dbandcenter') || nk === 'shift') return 'eV';
  return '';
};

export const getMetricDisplay = (key: string) => {
  const nk = normalizeMetricKey(key);
  const coreNk = normalizeMetricCoreKey(key);
  const mappedLabel = PHRASE_LABEL_MAP[nk] || PHRASE_LABEL_MAP[coreNk];
  const unit = extractUnitFromKey(key) || inferUnit(key);

  const label = (() => {
    if (mappedLabel) return mappedLabel;
    const noUnitKey = stripTrailingUnitParens(key);
    if (/[\u4e00-\u9fa5]/.test(noUnitKey)) return noUnitKey.trim();
    const tokens = splitMetricTokens(noUnitKey);
    const translated = tokens
      .map((token) => {
        const lower = token.toLowerCase();
        if (TOKEN_MAP[lower] !== undefined) return TOKEN_MAP[lower];
        if (/^[0-9.]+$/.test(token)) return token;
        if (/^[A-Z]{2,}$/.test(token)) return token;
        return token;
      })
      .filter(Boolean)
      .join('');
    return translated || noUnitKey;
  })();

  const shortLabel = label.length > 10 ? `${label.slice(0, 10)}..` : label;
  return { normalizedKey: nk, label, shortLabel, unit };
};

export const formatMetricNumber = (value: number) => {
  if (!Number.isFinite(value)) return '-';
  return Math.abs(value) >= 100 ? value.toFixed(1) : value.toFixed(3);
};
