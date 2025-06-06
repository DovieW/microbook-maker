import { useState, useCallback, useRef, useEffect } from 'react';

interface DragAndDropState {
  isDragOver: boolean;
  isDragActive: boolean;
}

interface DragAndDropOptions {
  onFileDrop: (file: File) => void;
  acceptedFileTypes?: string[];
  maxFileSize?: number;
  onError?: (error: string) => void;
}

export function useDragAndDrop({
  onFileDrop,
  acceptedFileTypes = ['.txt'],
  maxFileSize = 10 * 1024 * 1024, // 10MB
  onError,
}: DragAndDropOptions) {
  const [dragState, setDragState] = useState<DragAndDropState>({
    isDragOver: false,
    isDragActive: false,
  });

  const dragCounter = useRef(0);

  const validateFile = useCallback((file: File): boolean => {
    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedFileTypes.includes(fileExtension)) {
      onError?.(`Invalid file type. Only ${acceptedFileTypes.join(', ')} files are supported.`);
      return false;
    }

    // Check file size
    if (file.size > maxFileSize) {
      onError?.(`File too large. Maximum size is ${Math.round(maxFileSize / (1024 * 1024))}MB.`);
      return false;
    }

    // Check for empty file
    if (file.size === 0) {
      onError?.('File appears to be empty.');
      return false;
    }

    return true;
  }, [acceptedFileTypes, maxFileSize, onError]);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounter.current++;
    
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setDragState(prev => ({ ...prev, isDragActive: true }));
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounter.current--;
    
    if (dragCounter.current === 0) {
      setDragState(prev => ({ ...prev, isDragActive: false, isDragOver: false }));
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    
    setDragState(prev => ({ ...prev, isDragOver: true }));
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragState({ isDragActive: false, isDragOver: false });
    dragCounter.current = 0;
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      if (validateFile(file)) {
        onFileDrop(file);
      }
    }
  }, [validateFile, onFileDrop]);

  const bindDragEvents = useCallback((element: HTMLElement | null) => {
    if (!element) return;

    element.addEventListener('dragenter', handleDragEnter);
    element.addEventListener('dragleave', handleDragLeave);
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('drop', handleDrop);

    return () => {
      element.removeEventListener('dragenter', handleDragEnter);
      element.removeEventListener('dragleave', handleDragLeave);
      element.removeEventListener('dragover', handleDragOver);
      element.removeEventListener('drop', handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  return {
    ...dragState,
    bindDragEvents,
  };
}
