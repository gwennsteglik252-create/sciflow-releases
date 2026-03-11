
import React from 'react';
import { useGenerativeDesigner } from '../../../hooks/useGenerativeDesigner';
import { GenerativeSidebar } from './GenerativeSidebar';
import { GenerativeLibrary } from './GenerativeLibrary';
import { GenerativeLibraryModal } from './GenerativeLibraryModal';

interface GenerativeViewProps {
  logic: ReturnType<typeof useGenerativeDesigner>;
  inputRef: React.RefObject<HTMLDivElement>;
  libraryRef: React.RefObject<HTMLDivElement>;
}

export const GenerativeView: React.FC<GenerativeViewProps> = ({ logic, inputRef, libraryRef }) => {
  return (
    <div className="flex-1 grid grid-cols-12 gap-4 min-h-0 overflow-hidden">
        <GenerativeSidebar logic={logic} inputRef={inputRef} />
        <GenerativeLibrary logic={logic} libraryRef={libraryRef} />
        <GenerativeLibraryModal logic={logic} />
    </div>
  );
};
