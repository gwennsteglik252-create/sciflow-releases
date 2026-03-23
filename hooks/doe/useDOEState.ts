
import { useState } from 'react';
import { IntensityMode } from '../../components/DOE/constants';
import { SafeModalConfig } from '../../components/SafeModal';

export const useDOEState = () => {
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showAddHistory, setShowAddHistory] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [isBatchSync, setIsBatchSync] = useState(false);
  const [batchSyncMode, setBatchSyncMode] = useState<'unified' | 'split'>('unified');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showArchiveDropdown, setShowArchiveDropdown] = useState(false);
  const [showOEDModal, setShowOEDModal] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<SafeModalConfig | null>(null);

  const [intensityMode, setIntensityMode] = useState<IntensityMode>('standard');
  const [newTemplateTitle, setNewTemplateTitle] = useState('我的工艺实验模板');
  const [targetProjectId, setTargetProjectId] = useState('');
  const [targetMilestoneId, setTargetMilestoneId] = useState('');
  const [saveTitle, setSaveTitle] = useState('');
  const [newRunFactors, setNewRunFactors] = useState<Record<string, number>>({});
  const [newRunResponses, setNewRunResponses] = useState<Record<string, number>>({});
  const [selectedRecommendationIdx, setSelectedRecommendationIdx] = useState<number>(0);

  return {
    modals: {
      showConfigModal, setShowConfigModal,
      showAddHistory, setShowAddHistory,
      // showSyncModal moved to sync
      showSaveModal, setShowSaveModal,
      showArchiveDropdown, setShowArchiveDropdown,
      showOEDModal, setShowOEDModal,
      showSaveTemplateModal, setShowSaveTemplateModal,
      confirmModal, setConfirmModal
    },
    sync: {
      showSyncModal, setShowSyncModal,
      isBatchSync, setIsBatchSync,
      batchSyncMode, setBatchSyncMode,
      targetProjectId, setTargetProjectId,
      targetMilestoneId, setTargetMilestoneId,
      selectedRecommendationIdx, setSelectedRecommendationIdx
    },
    params: {
      intensityMode, setIntensityMode,
      newTemplateTitle, setNewTemplateTitle,
      saveTitle, setSaveTitle,
      newRunFactors, setNewRunFactors,
      newRunResponses, setNewRunResponses
    }
  };
};
