import { useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { UploadParams } from '../types';
import { usePdfGenerator } from './usePdfGenerator';
import { useNotifications } from './useNotifications';

export function useFileHandling() {
  const uploadRef = useRef<HTMLInputElement>(null);
  const { generatePdf, loading: pdfGenerationLoading, error: pdfGenerationError } = usePdfGenerator();
  const { showError, showWarning } = useNotifications();
  const {
    bookInfo,
    setBookName,
    pdfOptions,
    setFontSize,
    fileState,
    setFileName,
    updateFileStats,
    setDisableUpload,
    setLoading,
    setBookInfoLoading,
    setGenerationId,
    setProgress,
    fetchBookInfo,
    validateUpload,
  } = useAppContext();

  // Extract file processing logic to reuse for both file input and drag-and-drop
  const processFile = useCallback((file: File, clearInput?: () => void) => {
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.txt')) {
      showError(
        'Invalid File Type',
        'Please select a .txt file. Other file types are not supported.'
      );
      clearInput?.();
      return;
    }

    // Validate file size (e.g., max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      showError(
        'File Too Large',
        'Please select a file smaller than 10MB.'
      );
      clearInput?.();
      return;
    }

    const bookNiceName = file.name.split('.')[0];

    setDisableUpload(false);
    setBookName(bookNiceName);
    setFileName(file.name);

    // Fetch book info asynchronously
    setBookInfoLoading(true);
    fetchBookInfo(bookNiceName).catch(() => {
      showWarning(
        'Book Info Not Found',
        'Could not automatically fetch book information. You can enter it manually.'
      );
    }).finally(() => {
      setBookInfoLoading(false);
    });

    const reader = new FileReader();
    reader.onload = e => {
      const text = (e.target?.result as string).trim();
      const wordCount = text.split(' ').length;

      if (wordCount === 0) {
        showWarning(
          'Empty File',
          'The selected file appears to be empty. Please select a file with content.'
        );
        return;
      }

      if (wordCount < 100) {
        showWarning(
          'Short Content',
          'The file contains very few words. The generated PDF may be very short.'
        );
      }

      updateFileStats(wordCount, pdfOptions.fontSize);
    };

    reader.onerror = () => {
      showError(
        'File Read Error',
        'Failed to read the selected file. Please try again.'
      );
    };

    reader.readAsText(file);
  }, [
    setDisableUpload,
    setBookName,
    setFileName,
    setBookInfoLoading,
    fetchBookInfo,
    updateFileStats,
    pdfOptions.fontSize,
    showError,
    showWarning,
  ]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      processFile(file, () => {
        event.target.value = ''; // Clear the input
      });
    }
  }, [processFile]);

  const handleFileDrop = useCallback((file: File) => {
    processFile(file);
  }, [processFile]);

  const handleFontSizeChange = useCallback((newFontSize: string) => {
    setFontSize(newFontSize);
    validateUpload(newFontSize, !!uploadRef?.current?.files?.length);
    
    if (fileState.wordCount > 0) {
      updateFileStats(fileState.wordCount, newFontSize);
    }
  }, [setFontSize, validateUpload, fileState.wordCount, updateFileStats]);

  const handleUploadFile = useCallback(async () => {
    const files = uploadRef.current?.files;
    if (files && files.length > 0) {
      setLoading(true);

      const file = files[0];
      const params: UploadParams = {
        bookName: bookInfo.bookName,
        borderStyle: pdfOptions.borderStyle,
        headerInfo: {
          series: bookInfo.series,
          sheetsCount: fileState.sheetsCount.toString(),
          wordCount: fileState.wordCount,
          readTime: fileState.readTime,
          author: bookInfo.author,
          year: bookInfo.year,
          fontSize: pdfOptions.fontSize,
        },
      };

      try {
        // Reset progress before starting new generation
        setGenerationId(null);
        setProgress(null);

        const generationId = await generatePdf(file, params);
        console.log('New generation ID:', generationId); // Debug log
        if (generationId) {
          setGenerationId(generationId);
        } else {
          setLoading(false);
          showError(
            'PDF Generation Failed',
            'Failed to start PDF generation. Please try again.'
          );
        }
      } catch (error) {
        console.error('There was a problem with the PDF generation: ', error);
        setLoading(false);
        showError(
          'PDF Generation Error',
          error instanceof Error ? error.message : 'An unexpected error occurred during PDF generation.'
        );
      }
    }
  }, [
    bookInfo,
    pdfOptions,
    fileState,
    setLoading,
    setGenerationId,
    setProgress,
    generatePdf,
    showError,
  ]);

  return {
    uploadRef,
    handleFileChange,
    handleFileDrop,
    handleFontSizeChange,
    handleUploadFile,
    pdfGenerationLoading,
    pdfGenerationError,
  };
}
