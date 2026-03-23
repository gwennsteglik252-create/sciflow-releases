import React, { useState, useEffect, useRef } from 'react';
import { ExperimentLog, ExperimentFile, LogStatus, MatrixDataset, ConsumedReagent, InventoryItem } from '../types';
import { recognizeLabNotebook } from '../services/gemini';
import { callGeminiWithRetry, extractJson, FAST_MODEL, SPEED_CONFIG } from '../services/gemini/core';
import { useProjectContext } from '../context/ProjectContext';
import { handleAiExtractPrompt } from '../services/gemini/analysis';

export interface LogTemplate {
  id: string;
  name: string;
  content: string;
  description: string;
  parameters: { key: string, value: string, unit: string }[];
  scientificData?: Record<string, number>;
  consumedReagents?: ConsumedReagent[];
}

const DEFAULT_LOG_TEMPLATES: LogTemplate[] = [
  {
    id: 'tpl_lsv',
    name: 'LSV 极化性能测试',
    content: '执行 LSV 线性扫描',
    description: '采用标准三电极体系，在 1.0M KOH 电解液中进行 LSV 扫描，评估过电位与动力学参数。',
    parameters: [
      { key: '扫描速度', value: '5', unit: 'mV/s' },
      { key: '电解液浓度', value: '1.0', unit: 'M' },
      { key: '搅拌速度', value: '1600', unit: 'rpm' }
    ],
    scientificData: {
      'Overpotential@10mA/cm² (mV)': 0,
      'Tafel Slope (mV/dec)': 0,
      'Mass Activity (A/g)': 0
    }
  },
  {
    id: 'tpl_stability',
    name: '恒电流稳定性测试',
    content: '长效稳定性服役测试',
    description: '在 10mA/cm² 恒电流条件下观测电压随时间的漂移情况。',
    parameters: [
      { key: '电流密度', value: '10', unit: 'mA/cm²' },
      { key: '预设时长', value: '24', unit: 'h' }
    ],
    scientificData: {
      'Voltage Degradation (mV/h)': 0
    }
  },
  {
    id: 'tpl_cv',
    name: 'CV 循环伏安分析',
    content: '循环伏安扫描',
    description: '执行多圈 CV 扫描以观测材料的氧化还原行为与电化学活性。',
    parameters: [
      { key: '扫描速率', value: '50', unit: 'mV/s' },
      { key: '电位区间', value: '0-1.2', unit: 'V' }
    ],
    scientificData: {
      'Peak Current (Anodic) (mA)': 0,
      'Peak Current (Cathodic) (mA)': 0
    }
  }
];

interface UseLogModalLogicProps {
  show: boolean;
  editingLog: ExperimentLog | null;
  projectMatrices: MatrixDataset[];
  onSave: (logData: any) => void;
  onClose: () => void;
}

export const useLogModalLogic = ({ show, editingLog, projectMatrices, onSave, onClose }: UseLogModalLogicProps) => {
  const { showToast, setAiStatus, inventory } = useProjectContext();

  const notebookInputRef = useRef<HTMLInputElement>(null);
  const logFileInputRef = useRef<HTMLInputElement>(null);
  const samplePhotoInputRef = useRef<HTMLInputElement>(null);

  // Core State
  const [logContent, setLogContent] = useState('');
  const [logDescription, setLogDescription] = useState('');
  const [paramList, setParamList] = useState<{ key: string, value: string, unit: string }[]>([]);
  const [scientificData, setScientificData] = useState<Record<string, number>>({});
  const [logFiles, setLogFiles] = useState<ExperimentFile[]>([]);
  const [fileDescInput, setFileDescInput] = useState('');
  const [logResult, setLogResult] = useState<'success' | 'neutral' | 'failure' | 'observation'>('neutral');
  const [logStatus, setLogStatus] = useState<LogStatus>('Pending');
  const [consumedReagents, setConsumedReagents] = useState<ConsumedReagent[]>([]);
  const [logTimestamp, setLogTimestamp] = useState<string>('');
  const [samplePhoto, setSamplePhoto] = useState<ExperimentFile | undefined>(undefined);
  const [sampleAppearanceInsight, setSampleAppearanceInsight] = useState('');
  // 实验组分组
  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [groupLabel, setGroupLabel] = useState<string | undefined>(undefined);

  const [links, setLinks] = useState<{ planId?: string, runIdx?: number, snapshot?: any }>({});

  // UI State
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzingSample, setIsAnalyzingSample] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [newMetricKey, setNewMetricKey] = useState('');
  const [newMetricVal, setNewMetricVal] = useState('');
  const [newMetricUnit, setNewMetricUnit] = useState('');

  // Matrix Sync State
  const [pushToMatrix, setPushToMatrix] = useState(false);
  const [selectedMatrixId, setSelectedMatrixId] = useState<string>('');
  const [matrixSampleId, setMatrixSampleId] = useState('');
  const [matrixNote, setMatrixNote] = useState('');
  const [matrixProcessParams, setMatrixProcessParams] = useState<{ key: string, value: string, unit: string }[]>([]);
  const [matrixResults, setMatrixResults] = useState<{ key: string, value: string, unit: string }[]>([]);

  // Traceability Link
  const [linkedAnalysis, setLinkedAnalysis] = useState<ExperimentLog['linkedAnalysis']>(undefined);

  // Template State
  const [templates, setTemplates] = useState<LogTemplate[]>(() => {
    try {
      const saved = localStorage.getItem('sciflow_log_templates');
      const parsed = saved ? JSON.parse(saved) : [];
      // Combine saved user templates with default system presets
      return [...DEFAULT_LOG_TEMPLATES, ...parsed];
    } catch { return DEFAULT_LOG_TEMPLATES; }
  });
  const [showNamingModal, setShowNamingModal] = useState(false);
  const [tempTemplateName, setTempTemplateName] = useState('');

  useEffect(() => {
    if (showNamingModal && !tempTemplateName && logContent) {
      setTempTemplateName(logContent);
    }
  }, [showNamingModal, logContent]);

  // Initialize
  useEffect(() => {
    if (!show) return;

    if (editingLog) {
      setLogContent(editingLog.content || '');
      setLogDescription(editingLog.description || '');
      setLogTimestamp(editingLog.timestamp || new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'));

      setLinks({
        planId: editingLog.linkedPlanId,
        runIdx: editingLog.linkedRunIdx,
        snapshot: editingLog.planSnapshot
      });

      // 优先使用结构化的 parameterList（精确无损），回退到解析 parameters 字符串（旧数据兼容）
      let parsedParams: { key: string; value: string; unit: string }[] = [];
      if (editingLog.parameterList && editingLog.parameterList.length > 0) {
        parsedParams = editingLog.parameterList.map(p => ({ key: p.key || '', value: p.value || '', unit: p.unit || '' }));
      } else {
        const rawParams = editingLog.parameters || '';
        parsedParams = rawParams ? rawParams.split(/[,;]\s*/).map(p => {
          const [k, v] = p.split(/[:=]\s*/);
          const unitMatch = v?.match(/([a-zA-Z%°℃μΩ/²³·]+)$/);
          let val = v?.trim() || '';
          let unit = '';
          if (unitMatch) {
            unit = unitMatch[1];
            val = val.replace(unit, '').trim();
          }
          return { key: k?.trim() || '', value: val, unit: unit };
        }).filter(p => p.key) : [];
      }
      if (parsedParams.length === 0) parsedParams.push({ key: '', value: '', unit: '' });
      setParamList(parsedParams);

      setScientificData(editingLog.scientificData || {});
      setLogFiles(editingLog.files || []);
      setLogResult(editingLog.result || 'neutral');
      setLogStatus(editingLog.status || 'Pending');
      setConsumedReagents(editingLog.consumedReagents || []);
      setLinkedAnalysis(editingLog.linkedAnalysis);
      setSamplePhoto(editingLog.samplePhoto);
      setSampleAppearanceInsight(editingLog.sampleAppearanceInsight || '');
      setGroupId(editingLog.groupId);
      setGroupLabel(editingLog.groupLabel);
    } else {
      setLogContent('');
      setLogDescription('');
      setParamList([{ key: '', value: '', unit: '' }]);
      setScientificData({});
      setLogFiles([]);
      setLogResult('neutral');
      setLogStatus('Pending');
      setConsumedReagents([]);
      setLogTimestamp(new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'));
      setLinks({});
      setLinkedAnalysis(undefined);
      setSamplePhoto(undefined);
      setSampleAppearanceInsight('');
      setGroupId(undefined);
      setGroupLabel(undefined);
    }
    setFileDescInput('');
    setNewMetricKey('');
    setNewMetricVal('');
    setNewMetricUnit('');
    setPushToMatrix(false);
    setMatrixNote('');
    setMatrixSampleId(`S-${Date.now().toString().slice(-6)}`);

    if (projectMatrices.length > 0) {
      setSelectedMatrixId(projectMatrices[0].id);
    }
  }, [show, editingLog]);

  useEffect(() => {
    if (pushToMatrix) {
      if (matrixProcessParams.length === 0 && matrixResults.length === 0) {
        handleSyncFromMain();
      }
    }
  }, [pushToMatrix]);

  const handleSyncFromMain = () => {
    setMatrixProcessParams(paramList.filter(p => p.key).map(p => ({
      key: p.key,
      value: p.value,
      unit: p.unit
    })));
    setMatrixResults(Object.entries(scientificData).map(([k, v]) => {
      const match = k.match(/(.*)\s*\((.*)\)/);
      return {
        key: match ? match[1].trim() : k,
        value: String(v),
        unit: match ? match[2].trim() : ''
      };
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if ((window as any).electron && (window as any).electron.selectLocalFile) {
      e.preventDefault();
      try {
        const result = await (window as any).electron.selectLocalFile('log-file-upload');
        if (result) {
          // Smart embedding: auto-embed small image files (<2MB) as base64
          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(result.name);
          let embeddedUrl = '';

          if (isImage && (window as any).electron.readFile) {
            try {
              const fileData = await (window as any).electron.readFile(result.path);
              if (fileData && fileData.data) {
                // Check approximate size: base64 string length * 0.75 ≈ original bytes
                const approxBytes = fileData.data.length * 0.75;
                if (approxBytes < 2 * 1024 * 1024) { // < 2MB
                  embeddedUrl = `data:${fileData.mimeType};base64,${fileData.data}`;
                }
              }
            } catch (readErr) {
              console.warn('[SmartEmbed] Could not read file for embedding, using path reference:', readErr);
            }
          }

          setLogFiles(prev => [...prev, {
            name: result.name,
            url: embeddedUrl,
            localPath: result.path,
            description: fileDescInput || (embeddedUrl ? '嵌入式图片附件' : '本地数据附件'),
            lastModified: Date.now()
          }]);
          setFileDescInput('');
        }
      } catch (err) { console.error(err); }
      return;
    }
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setLogFiles(prev => [...prev, {
          name: file.name,
          url: reader.result as string,
          description: fileDescInput || '数据附件',
          lastModified: file.lastModified
        }]);
        setFileDescInput('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLinkExistingLocalFile = async (idx: number) => {
    if ((window as any).electron && (window as any).electron.selectLocalFile) {
      try {
        const result = await (window as any).electron.selectLocalFile('log-link-file');
        if (result) {
          setLogFiles(prev => prev.map((f, i) => i === idx ? {
            ...f,
            name: result.name,
            localPath: result.path,
            lastModified: Date.now()
          } : f));
        }
      } catch (err) { console.error(err); }
    }
  };

  const updateFile = (idx: number, updates: Partial<ExperimentFile>) => {
    setLogFiles(prev => prev.map((f, i) => i === idx ? { ...f, ...updates } : f));
  };

  const handleNotebookScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    showToast({ message: "正在数字化识别实验记录本...", type: 'info' });
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const data = await recognizeLabNotebook(base64);
        if (data) {
          if (data.content) setLogContent(data.content);
          if (data.description) setLogDescription(data.description);
          if (data.parameters) {
            setParamList(data.parameters.map((p: any) => ({ key: p.key, value: String(p.value), unit: p.unit || '' })));
          }
          if (data.scientificData) setScientificData(data.scientificData);
          // 使用已读取的 base64 作为 URL，确保持久化存储
          const newFile: ExperimentFile = { name: `Scan_${Date.now()}.jpg`, url: reader.result as string, description: "实录本识别原图" };
          setLogFiles(prev => [newFile, ...prev]);
          showToast({ message: "实验记录识别成功", type: 'success' });
        }
        setIsScanning(false);
      };
    } catch (err) {
      showToast({ message: "识别失败", type: 'error' });
      setIsScanning(false);
    }
  };

  const addMetric = () => {
    if (!newMetricKey.trim() || isNaN(parseFloat(newMetricVal))) return;
    const finalKey = newMetricUnit.trim() ? `${newMetricKey} (${newMetricUnit})` : newMetricKey;
    setScientificData(prev => ({ ...prev, [finalKey]: parseFloat(newMetricVal) }));
    setNewMetricKey(''); setNewMetricVal(''); setNewMetricUnit('');
  };

  const removeMetric = (key: string) => {
    const next = { ...scientificData };
    delete next[key];
    setScientificData(next);
  };

  const updateMetric = (oldKey: string, newValue: number) => {
    setScientificData(prev => ({ ...prev, [oldKey]: newValue }));
  };

  const renameMetric = (oldKey: string, newKey: string) => {
    setScientificData(prev => {
      const value = prev[oldKey];
      const next = { ...prev };
      delete next[oldKey];
      next[newKey] = value;
      return next;
    });
  };

  const handleAiExtract = async () => {
    if (!logDescription.trim()) return;
    setIsExtracting(true);
    try {
      const prompt = handleAiExtractPrompt(logDescription);
      const rawText = await callGeminiWithRetry(async (ai) => {
        const response = await ai.models.generateContent({
          model: FAST_MODEL,
          contents: prompt,
          config: {
            ...SPEED_CONFIG,
            temperature: 0.2,
          }
        });
        return response.text || '';
      });

      // 从 AI 返回的文本中提取 JSON（兼容 markdown 代码块、多余文字等情况）
      const jsonStr = extractJson(rawText);
      const extracted = JSON.parse(jsonStr);

      if (extracted.metrics) setScientificData(prev => ({ ...prev, ...extracted.metrics }));
      if (extracted.parameters && Array.isArray(extracted.parameters)) {
        setParamList(prev => {
          const filtered = prev.filter(p => (p.key || '').trim() !== '');
          const combined = [...filtered];
          extracted.parameters.forEach((ap: any) => {
            if (!ap || !ap.key) return; // 跳过无效条目
            const apKey = String(ap.key);
            const idx = combined.findIndex(c => c.key === apKey);
            if (idx !== -1) combined[idx] = { key: apKey, value: String(ap.value ?? ''), unit: String(ap.unit || '') };
            else combined.push({ key: apKey, value: String(ap.value ?? ''), unit: String(ap.unit || '') });
          });
          return combined.length > 0 ? combined : [{ key: '', value: '', unit: '' }];
        });
      }
      showToast({ message: "AI 指标捕捉完成", type: 'success' });
    } catch (e) {
      console.error('[handleAiExtract] 解析失败', e);
      showToast({ message: "捕捉解析失败", type: 'error' });
    } finally { setIsExtracting(false); }
  };

  const handleSamplePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputFile = e.target.files?.[0];

    if ((window as any).electron && (window as any).electron.selectLocalFile && !inputFile) {
      try {
        const result = await (window as any).electron.selectLocalFile('log-sample-photo');
        if (!result) return;
        if (!/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(result.name)) {
          showToast({ message: '请选择图片文件作为样品照片', type: 'warning' });
          return;
        }
        let embeddedUrl = '';
        if ((window as any).electron.readFile) {
          const fileData = await (window as any).electron.readFile(result.path);
          if (fileData?.mimeType?.startsWith('image/') && fileData.data) {
            embeddedUrl = `data:${fileData.mimeType};base64,${fileData.data}`;
          }
        }
        setSamplePhoto({
          name: result.name,
          localPath: result.path,
          url: embeddedUrl,
          description: '样品表观照片',
          lastModified: Date.now()
        });
        showToast({ message: '样品照片已上传', type: 'success' });
      } catch (err) {
        console.error(err);
        showToast({ message: '样品照片上传失败', type: 'error' });
      }
      return;
    }

    if (!inputFile) return;
    if (!inputFile.type.startsWith('image/')) {
      showToast({ message: '请选择图片文件作为样品照片', type: 'warning' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSamplePhoto({
        name: inputFile.name,
        url: reader.result as string,
        description: '样品表观照片',
        lastModified: inputFile.lastModified
      });
      showToast({ message: '样品照片已上传', type: 'success' });
    };
    reader.readAsDataURL(inputFile);
  };

  const handleAnalyzeSampleAppearance = async () => {
    if (!samplePhoto) {
      showToast({ message: '请先上传样品照片', type: 'warning' });
      return;
    }
    if (!logDescription.trim() && !logContent.trim()) {
      showToast({ message: '请先填写实验记录描述，再进行表观分析', type: 'warning' });
      return;
    }

    const getInlineData = async (): Promise<{ mimeType: string; data: string } | null> => {
      if (samplePhoto.url?.startsWith('data:image')) {
        const match = samplePhoto.url.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (match) return { mimeType: match[1], data: match[2] };
      }
      if (samplePhoto.localPath && (window as any).electron?.readFile) {
        const fileData = await (window as any).electron.readFile(samplePhoto.localPath);
        if (fileData?.mimeType?.startsWith('image/') && fileData.data) {
          return { mimeType: fileData.mimeType, data: fileData.data };
        }
      }
      return null;
    };

    setIsAnalyzingSample(true);
    setAiStatus('🧪 正在结合实验记录分析样品表观...');
    try {
      const inlineData = await getInlineData();
      if (!inlineData) {
        throw new Error('样品照片数据不可用，请重新上传后重试');
      }

      const prompt = `你是一位资深材料科学家。请结合实验记录文本与样品照片，对样品表观进行专业分析。

要求：
1) 输出中文，采用简洁分点格式。
2) 必须包含：颜色与均匀性、颗粒/片层形貌、团聚或裂纹风险、与实验步骤一致性判断、下一步验证建议。
3) 避免杜撰具体仪器数据，仅做可视观察层面的判断并标注不确定性。

实验名称：
${logContent || '未命名实验'}

实验记录：
${logDescription}
`;

      const analysisText = await callGeminiWithRetry(async (ai) => {
        const response = await ai.models.generateContent({
          model: FAST_MODEL,
          contents: [{
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData }
            ]
          }],
          config: {
            ...SPEED_CONFIG,
            temperature: 0.2
          }
        });
        return response.text || '';
      });

      setSampleAppearanceInsight(String(analysisText || '').trim());
      showToast({ message: '样品表观分析完成', type: 'success' });
    } catch (e) {
      console.error('[handleAnalyzeSampleAppearance] 失败', e);
      showToast({ message: '样品表观分析失败', type: 'error' });
    } finally {
      setIsAnalyzingSample(false);
      setAiStatus(null);
    }
  };

  const removeFile = (idx: number) => {
    setLogFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleConfirmSave = () => {
    const paramsString = paramList
      .filter(p => p.key.trim())
      .map(p => `${p.key}: ${p.value}${p.unit ? ` ${p.unit}` : ''}`)
      .join(', ');

    let matrixEntryData;
    if (pushToMatrix) {
      const pParams: Record<string, any> = {};
      const rResults: Record<string, any> = {};
      matrixProcessParams.forEach(p => { if (p.key) pParams[p.unit ? `${p.key} (${p.unit})` : p.key] = p.value; });
      matrixResults.forEach(r => { if (r.key) rResults[r.unit ? `${r.key} (${r.unit})` : r.key] = parseFloat(r.value) || r.value; });
      matrixEntryData = { targetMatrixId: selectedMatrixId || 'default', sampleId: matrixSampleId, note: matrixNote, processParams: pParams, results: rResults };
    }

    onSave({
      id: editingLog?.id,
      timestamp: logTimestamp || new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
      content: logContent,
      description: logDescription,
      parameters: paramsString,
      parameterList: paramList.filter(p => p.key.trim()).map(p => ({ key: p.key.trim(), value: p.value.trim(), unit: p.unit.trim() })),
      scientificData: scientificData,
      files: logFiles,
      result: logResult,
      status: logStatus,
      matrixEntry: matrixEntryData,
      consumedReagents,
      linkedPlanId: links.planId,
      linkedRunIdx: links.runIdx,
      planSnapshot: links.snapshot,
      linkedAnalysis,
      samplePhoto,
      sampleAppearanceInsight,
      groupId,
      groupLabel
    });
  };

  const handleSaveTemplate = () => {
    if (!tempTemplateName.trim()) return;
    const newTemplate: LogTemplate = { id: Date.now().toString(), name: tempTemplateName.trim(), content: logContent, description: logDescription, parameters: paramList.filter(p => p.key.trim()), scientificData: { ...scientificData }, consumedReagents: [...consumedReagents] };
    const userTemplates = templates.filter(t => !DEFAULT_LOG_TEMPLATES.some(dt => dt.id === t.id));
    const updatedUserTemplates = [newTemplate, ...userTemplates];
    localStorage.setItem('sciflow_log_templates', JSON.stringify(updatedUserTemplates));
    setTemplates([...DEFAULT_LOG_TEMPLATES, ...updatedUserTemplates]);
    setShowNamingModal(false); setTempTemplateName('');
    showToast({ message: `模板 "${newTemplate.name}" 已保存`, type: 'success' });
  };

  const handleLoadTemplate = (tpl: LogTemplate) => {
    setLogContent(prev => prev ? prev : (tpl.content || ''));
    setLogDescription(prev => prev ? (prev + '\n\n' + (tpl.description || '')) : (tpl.description || ''));
    setParamList(prev => {
      const filteredPrev = prev.filter(p => p.key.trim() !== '');
      const toAdd = (tpl.parameters || []).filter(ni => !filteredPrev.some(p => p.key === ni.key));
      const combined = [...filteredPrev, ...toAdd];
      return combined.length > 0 ? combined : [{ key: '', value: '', unit: '' }];
    });
    if (tpl.scientificData) {
      const keysOnly: Record<string, number> = {};
      Object.keys(tpl.scientificData).forEach(k => { if (!(k in scientificData)) keysOnly[k] = 0; });
      setScientificData(prev => ({ ...prev, ...keysOnly }));
    }
    if (tpl.consumedReagents && tpl.consumedReagents.length > 0) {
      setConsumedReagents(prev => {
        const existingIds = new Set(prev.map(r => r.inventoryId));
        const toAdd = tpl.consumedReagents!.filter(r => !existingIds.has(r.inventoryId));
        return [...prev, ...toAdd];
      });
    }
    showToast({ message: "模板已载入", type: 'success' });
  };

  const handleDeleteTemplate = (id: string) => {
    if (DEFAULT_LOG_TEMPLATES.some(dt => dt.id === id)) {
      showToast({ message: "系统预设模板不可删除", type: 'info' });
      return;
    }
    const updated = templates.filter(t => t.id !== id);
    const userTemplates = updated.filter(t => !DEFAULT_LOG_TEMPLATES.some(dt => dt.id === t.id));
    localStorage.setItem('sciflow_log_templates', JSON.stringify(userTemplates));
    setTemplates(updated);
    showToast({ message: "模板已删除", type: 'info' });
  };

  return {
    state: { logContent, setLogContent, logDescription, setLogDescription, paramList, setParamList, scientificData, setScientificData, logFiles, setLogFiles, fileDescInput, setFileDescInput, logResult, setLogResult, logStatus, setLogStatus, consumedReagents, setConsumedReagents, logTimestamp, setLogTimestamp, isExtracting, isAnalyzingSample, isScanning, samplePhoto, setSamplePhoto, sampleAppearanceInsight, setSampleAppearanceInsight, newMetricKey, setNewMetricKey, newMetricVal, setNewMetricVal, newMetricUnit, setNewMetricUnit, pushToMatrix, setPushToMatrix, selectedMatrixId, setSelectedMatrixId, matrixSampleId, setMatrixSampleId, matrixNote, setMatrixNote, matrixProcessParams, setMatrixProcessParams, matrixResults, setMatrixResults, templates, showNamingModal, tempTemplateName, linkedAnalysis, setLinkedAnalysis, groupId, setGroupId, groupLabel, setGroupLabel },
    refs: { notebookInputRef, logFileInputRef, samplePhotoInputRef },
    actions: { handleNotebookScan, handleFileUpload, handleLinkExistingLocalFile, updateFile, handleAiExtract, handleSamplePhotoUpload, handleAnalyzeSampleAppearance, addMetric, removeMetric, updateMetric, renameMetric, removeFile, handleConfirmSave, setShowNamingModal, setTempTemplateName, handleSaveTemplate, handleLoadTemplate, handleDeleteTemplate }
  };
};
