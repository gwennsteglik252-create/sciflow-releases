
import React, { RefObject, useState, useMemo } from 'react';
import { SectionNavigation } from './EditorParts/SectionNavigation';
import { EditorHeader } from './EditorParts/EditorHeader';
import { FormattingToolbar } from './EditorParts/FormattingToolbar';
import { FindReplaceWidget } from './EditorParts/FindReplaceWidget';
import { ContentArea } from './EditorParts/ContentArea';
import { EditorFooter } from './EditorParts/EditorFooter';

interface WritingEditorProps {
  currentSections: { id: string; label: string; icon: string }[];
  activeSectionId: string;
  onSectionSwitch: (id: string) => void;
  editorContent: string;
  onEditorChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onEditorSelect?: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  onCompositionStart?: () => void;
  onCompositionEnd?: (e: React.CompositionEvent<HTMLTextAreaElement>) => void;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  lastSavedTime: string;
  isProcessing: boolean;
  onPolish: (mode: string) => void;
  onGenerateBib: (style: string) => void;
  onSmartWrite: () => void;
  onManualSave: () => void;
  onSwitchToPublishing?: () => void;
  onAddSection?: (title: any) => void;
  onManageSections?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  activeTemplateName: string;
  textareaRef: RefObject<HTMLTextAreaElement>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLTextAreaElement>) => void;
  isRightSidebarVisible?: boolean;
  onToggleRightSidebar?: () => void;
  onFormatText?: (format: 'bold' | 'italic' | 'sub' | 'sup' | 'math' | 'h2' | 'h3') => void;
  viewMode?: 'standard' | 'dual' | 'triple';
}

const DEFAULT_STYLES = ['Nature', 'IEEE', 'APA', 'JACS', 'Science', 'Cell', 'ACS Nano'];

const WritingEditor: React.FC<WritingEditorProps> = ({
  currentSections,
  activeSectionId,
  onSectionSwitch,
  editorContent,
  onEditorChange,
  onEditorSelect,
  onCompositionStart,
  onCompositionEnd,
  saveStatus,
  lastSavedTime,
  isProcessing,
  onPolish,
  onGenerateBib,
  onSmartWrite,
  onManualSave,
  onSwitchToPublishing,
  onAddSection,
  onManageSections,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  activeTemplateName,
  textareaRef,
  onKeyDown,
  onDoubleClick,
  isRightSidebarVisible,
  onToggleRightSidebar,
  onFormatText,
  viewMode
}) => {
  const [showBibMenu, setShowBibMenu] = useState(false);
  const [styleSearch, setStyleSearch] = useState('');
  const [customStyles, setCustomStyles] = useState<string[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findTerm, setFindTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');

  const [showSymbolMenu, setShowSymbolMenu] = useState(false);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right' | 'justify'>('justify');

  const filteredStyles = useMemo(() => {
    const all = [...new Set([...DEFAULT_STYLES, ...customStyles])];
    if (!styleSearch.trim()) return all;
    return all.filter(s => s.toLowerCase().includes(styleSearch.toLowerCase()));
  }, [styleSearch, customStyles]);

  const handleAddCustomStyle = () => {
    if (styleSearch && !filteredStyles.includes(styleSearch)) {
      setCustomStyles([...customStyles, styleSearch]);
      onGenerateBib(styleSearch);
      setShowBibMenu(false);
      setStyleSearch('');
    }
  };

  const activeLabel = currentSections.find(s => s.id === activeSectionId)?.label || '';

  const performFind = (direction: 'next' | 'prev' = 'next') => {
    if (!textareaRef.current || !findTerm) return;
    const el = textareaRef.current;
    const text = el.value;
    let searchIndex = -1;

    const currentPos = el.selectionEnd;

    if (direction === 'next') {
      searchIndex = text.indexOf(findTerm, currentPos);
      if (searchIndex === -1) searchIndex = text.indexOf(findTerm);
    } else {
      searchIndex = text.lastIndexOf(findTerm, el.selectionStart - 1);
      if (searchIndex === -1) searchIndex = text.lastIndexOf(findTerm);
    }

    if (searchIndex !== -1) {
      el.focus();
      el.setSelectionRange(searchIndex, searchIndex + findTerm.length);
    }
  };

  const performReplace = () => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const currentSelection = el.value.substring(start, end);

    if (currentSelection === findTerm) {
      const newText = el.value.substring(0, start) + replaceTerm + el.value.substring(end);
      onEditorChange({
        target: {
          value: newText,
          selectionStart: start + replaceTerm.length,
          selectionEnd: start + replaceTerm.length
        }
      } as any);

      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + replaceTerm.length, start + replaceTerm.length);
        performFind('next');
      }, 0);
    } else {
      performFind('next');
    }
  };

  const performReplaceAll = () => {
    if (!findTerm) return;
    const newText = editorContent.split(findTerm).join(replaceTerm);
    onEditorChange({ target: { value: newText, selectionStart: 0, selectionEnd: 0 } } as any);
  };

  const insertSymbol = (symbol: string) => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value;
    const newText = text.substring(0, start) + symbol + text.substring(end);

    onEditorChange({
      target: {
        value: newText,
        selectionStart: start + symbol.length,
        selectionEnd: start + symbol.length
      }
    } as any);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + symbol.length, start + symbol.length);
    }, 0);
    setShowSymbolMenu(false);
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-[1.25rem] shadow-xl border border-slate-200 overflow-hidden relative">
      <div className="flex flex-1 min-h-0">
        <SectionNavigation
          currentSections={currentSections}
          activeSectionId={activeSectionId}
          onSectionSwitch={onSectionSwitch}
          onManageSections={onManageSections}
        />

        <div className="flex-1 flex flex-col min-0 overflow-hidden relative">
          <EditorHeader
            isRightSidebarVisible={isRightSidebarVisible}
            onToggleRightSidebar={onToggleRightSidebar}
            activeLabel={activeLabel}
            displayLabel={activeLabel}
            onSwitchToPublishing={onSwitchToPublishing}
            activeSectionId={activeSectionId}
            isProcessing={isProcessing}
            onSmartWrite={onSmartWrite}
            onPolish={onPolish}
            showBibMenu={showBibMenu}
            setShowBibMenu={setShowBibMenu}
            styleSearch={styleSearch}
            setStyleSearch={setStyleSearch}
            filteredStyles={filteredStyles}
            onGenerateBib={onGenerateBib}
            handleAddCustomStyle={handleAddCustomStyle}
            viewMode={viewMode}
          />

          <FormattingToolbar
            onFormatText={onFormatText}
            isPreviewMode={isPreviewMode}
            setIsPreviewMode={setIsPreviewMode}
            showFindReplace={showFindReplace}
            setShowFindReplace={setShowFindReplace}
            showSymbolMenu={showSymbolMenu}
            setShowSymbolMenu={setShowSymbolMenu}
            onInsertSymbol={insertSymbol}
            onUndo={onUndo}
            onRedo={onRedo}
            canUndo={canUndo}
            canRedo={canRedo}
            viewMode={viewMode}
            textAlign={textAlign}
            onTextAlignChange={setTextAlign}
          />

          <FindReplaceWidget
            show={showFindReplace}
            onClose={() => setShowFindReplace(false)}
            findTerm={findTerm}
            setFindTerm={setFindTerm}
            replaceTerm={replaceTerm}
            setReplaceTerm={setReplaceTerm}
            onFind={performFind}
            onReplace={performReplace}
            onReplaceAll={performReplaceAll}
          />

          <ContentArea
            textareaRef={textareaRef}
            isPreviewMode={isPreviewMode}
            editorContent={editorContent}
            activeSectionId={activeSectionId}
            onEditorChange={onEditorChange}
            onEditorSelect={onEditorSelect}
            onCompositionStart={onCompositionStart}
            onCompositionEnd={onCompositionEnd}
            onKeyDown={onKeyDown}
            onDoubleClick={onDoubleClick}
            textAlign={textAlign}
          />

          <EditorFooter
            saveStatus={saveStatus}
            lastSavedTime={lastSavedTime}
            charCount={editorContent.length}
            onManualSave={onManualSave}
          />
        </div>
      </div>
    </div>
  );
};

export default WritingEditor;
