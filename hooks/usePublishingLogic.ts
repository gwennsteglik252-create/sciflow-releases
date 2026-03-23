
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ResearchProject, Literature, ManuscriptMeta } from '../types';
import { TemplateConfig } from '../components/Writing/WritingConfig';
import { usePublishingState } from './usePublishingState';
import { usePublishingCitations } from './usePublishingCitations';
import { usePublishingPagination } from './usePublishingPagination';

interface UsePublishingLogicProps {
  project: ResearchProject | undefined;
  resources: Literature[];
  projectMedia: any[];
  currentSections: { id: string; label: string; icon: string }[];
  activeTemplate: TemplateConfig;
  manuscriptMeta: ManuscriptMeta;
  activeSectionId?: string;
  cursorPosition?: number | null;
  activeSectionContent?: string;
  viewMode?: 'standard' | 'dual' | 'triple';
  isFocusMode?: boolean;
  isJumpingManual?: boolean;
  language?: 'zh' | 'en';
}

export const usePublishingLogic = (props: UsePublishingLogicProps) => {
  const {
    isSidebarOpen, setIsSidebarOpen, zoom, setZoom, isAutoZoom, setIsAutoZoom, scrollerRef, isTransitioning
  } = usePublishingState({
    activeTemplate: props.activeTemplate,
    viewMode: props.viewMode,
    isFocusMode: props.isFocusMode
  });

  const [isHorizontalLocked, setIsHorizontalLocked] = useState(true);
  const [isVerticalLocked, setIsVerticalLocked] = useState(true);

  const lastScrollPos = useRef({ left: 0, top: 0 });
  const isMultiColumn = props.viewMode === 'dual' || props.viewMode === 'triple';

  const isTypingRef = useRef(false);
  const typingTimer = useRef<any>(null);

  useEffect(() => {
    if (props.activeSectionContent !== undefined) {
      isTypingRef.current = true;
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        isTypingRef.current = false;
      }, 500);
    }
  }, [props.activeSectionContent]);

  useEffect(() => {
    if ((isMultiColumn || props.isFocusMode) && props.cursorPosition !== null && props.cursorPosition !== undefined) {
      if (!props.isJumpingManual) {
        setIsHorizontalLocked(true);
        setIsVerticalLocked(true);
      }
    }
  }, [props.cursorPosition, isMultiColumn, props.isFocusMode, props.isJumpingManual]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || (!isMultiColumn && !props.isFocusMode)) return;

    const handleScroll = () => {
      if (props.isJumpingManual) return;

      const currentLeft = scroller.scrollLeft;
      const currentTop = scroller.scrollTop;
      const deltaX = Math.abs(currentLeft - lastScrollPos.current.left);
      const deltaY = Math.abs(currentTop - lastScrollPos.current.top);

      const threshold = isTypingRef.current ? 40 : 15;
      if (deltaX > threshold) setIsHorizontalLocked(false);
      if (deltaY > threshold) setIsVerticalLocked(false);

      lastScrollPos.current = { left: currentLeft, top: currentTop };
    };

    scroller.addEventListener('scroll', handleScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', handleScroll);
  }, [isMultiColumn, scrollerRef, props.isJumpingManual]);

  const orderedCitations = usePublishingCitations({
    project: props.project,
    resources: props.resources,
    currentSections: props.currentSections,
    activeSectionId: props.activeSectionId,
    activeSectionContent: props.activeSectionContent,
    manuscriptMeta: props.manuscriptMeta
  });

  const pages = usePublishingPagination({
    project: props.project,
    projectMedia: props.projectMedia,
    activeTemplate: props.activeTemplate,
    manuscriptMeta: props.manuscriptMeta,
    activeSectionId: props.activeSectionId,
    cursorPosition: props.cursorPosition,
    activeSectionContent: props.activeSectionContent,
    orderedCitations,
    currentSections: props.currentSections,
    language: props.language
  });

  const scrollToSection = (id: string) => {
    const el = document.getElementById(`sec-title-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if ((!isMultiColumn && !props.isFocusMode) || props.cursorPosition === undefined || props.cursorPosition === null || isTransitioning || props.isJumpingManual) {
      return;
    }

    let rafId: number;
    const centerCursorSmooth = () => {
      const anchor = document.getElementById('publishing-cursor-anchor');
      const scroller = scrollerRef.current;
      const canvasContainer = scroller?.querySelector('.publishing-canvas-container');

      if (anchor && scroller && canvasContainer) {
        const anchorRect = anchor.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        const canvasRect = canvasContainer.getBoundingClientRect();

        if (anchorRect.top === 0 || anchorRect.width === 0) {
          rafId = requestAnimationFrame(centerCursorSmooth);
          return;
        }

        let diffY = 0;
        if (isVerticalLocked) {
          diffY = (anchorRect.top + anchorRect.height / 2) - (scrollerRect.top + scrollerRect.height / 2);
        }

        let diffX = 0;
        if (props.isFocusMode && isHorizontalLocked) {
          diffX = (anchorRect.left + anchorRect.width / 2) - (scrollerRect.left + scrollerRect.width / 2);
        } else if (isHorizontalLocked) {
          diffX = (canvasRect.left + canvasRect.width / 2) - (scrollerRect.left + scrollerRect.width / 2);
        }

        const deadzone = isTypingRef.current ? 12 : 3;

        if (Math.abs(diffY) > deadzone || Math.abs(diffX) > deadzone) {
          const damping = isTypingRef.current ? 0.08 : 0.2;
          const moveY = isVerticalLocked ? diffY * damping : 0;
          const moveX = isHorizontalLocked ? diffX * damping : 0;

          lastScrollPos.current.left = scroller.scrollLeft + moveX;
          lastScrollPos.current.top = scroller.scrollTop + moveY;

          scroller.scrollBy({ top: moveY, left: moveX, behavior: 'auto' });
        }
      }
      rafId = requestAnimationFrame(centerCursorSmooth);
    };

    rafId = requestAnimationFrame(centerCursorSmooth);
    return () => cancelAnimationFrame(rafId);
  }, [pages, props.activeSectionId, props.cursorPosition, props.isFocusMode, scrollerRef, isHorizontalLocked, isVerticalLocked, isTransitioning, isMultiColumn, props.isJumpingManual]);

  return { isSidebarOpen, setIsSidebarOpen, zoom, setZoom, isAutoZoom, setIsAutoZoom, scrollerRef, pages, scrollToSection };
};
