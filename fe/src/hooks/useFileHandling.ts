import { useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { UploadParams, Job } from '../types';
import { usePdfGenerator } from './usePdfGenerator';
import { useNotifications } from './useNotifications';
import { useJobManagementContext } from '../context/JobManagementContext';
import { JobManagementService } from '../services/jobManagementService';

// Module-level storage for dropped files to persist across re-renders
let droppedFileStorage: File | null = null;

// Module-level storage for files loaded from jobs to persist across re-renders
let loadedFileStorage: File | null = null;

export function useFileHandling() {
  const uploadRef = useRef<HTMLInputElement>(null);
  const { generatePdf, loading: pdfGenerationLoading, error: pdfGenerationError } = usePdfGenerator();
  const { showError, showWarning } = useNotifications();
  const { addNewJob } = useJobManagementContext();
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
    fetchBookInfo,
    validateUpload,
  } = useAppContext();

  // Extract file processing logic to reuse for both file input, drag-and-drop, and loaded files
  const processFile = useCallback((file: File, clearInput?: () => void, isDropped = false, isLoaded = false) => {
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

    // Store the file reference for later use
    if (isDropped) {
      droppedFileStorage = file;
      loadedFileStorage = null; // Clear loaded file when using drag-and-drop
      // Clear the file input to avoid conflicts
      if (uploadRef.current) {
        uploadRef.current.value = '';
      }
    } else if (isLoaded) {
      loadedFileStorage = file;
      droppedFileStorage = null; // Clear dropped file when loading from job
      // Clear the file input to avoid conflicts
      if (uploadRef.current) {
        uploadRef.current.value = '';
      }
    } else {
      // Clear dropped and loaded files when using file input
      droppedFileStorage = null;
      loadedFileStorage = null;
    }

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
    processFile(file, undefined, true); // Mark as dropped file
  }, [processFile]);

  const handleFontSizeChange = useCallback((newFontSize: string) => {
    setFontSize(newFontSize);
    // Check for file from any source: file input, drag-and-drop, or loaded from job
    const hasInputFile = !!uploadRef?.current?.files?.length;
    const hasDroppedFile = !!droppedFileStorage;
    const hasLoadedFile = !!loadedFileStorage;
    const hasFile = hasInputFile || hasDroppedFile || hasLoadedFile;
    validateUpload(newFontSize, hasFile);

    if (fileState.wordCount > 0) {
      updateFileStats(fileState.wordCount, newFontSize);
    }
  }, [setFontSize, validateUpload, fileState.wordCount, updateFileStats]);

  const handleUploadFile = useCallback(async () => {
    // Check for file from file input, drag-and-drop, or loaded from job
    const files = uploadRef.current?.files;
    const inputFile = files && files.length > 0 ? files[0] : null;
    const droppedFile = droppedFileStorage;
    const loadedFile = loadedFileStorage;
    const file = inputFile || droppedFile || loadedFile;

    if (file) {
      setLoading(true);
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
        const generationId = await generatePdf(file, params);
        if (generationId) {
          // Only add the job to the job list - don't use old generation state
          addNewJob(generationId, bookInfo.bookName, pdfOptions.fontSize, file.name, pdfOptions.borderStyle, bookInfo.author, bookInfo.year, bookInfo.series);
          setLoading(false);
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
    } else {
      console.warn('No file available for upload - neither from input nor drag-and-drop');
    }
  }, [
    bookInfo,
    pdfOptions,
    fileState,
    setLoading,
    generatePdf,
    showError,
    addNewJob,
  ]);

  const createHandleUploadFile = useCallback((onJobStarted?: () => void) => {
    return async () => {
      // Check for file from file input, drag-and-drop, or loaded from job
      const files = uploadRef.current?.files;
      const inputFile = files && files.length > 0 ? files[0] : null;
      const droppedFile = droppedFileStorage;
      const loadedFile = loadedFileStorage;
      const file = inputFile || droppedFile || loadedFile;

      if (file) {
        setLoading(true);
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
          const generationId = await generatePdf(file, params);
          if (generationId) {
            // Only add the job to the job list - don't use old generation state
            addNewJob(generationId, bookInfo.bookName, pdfOptions.fontSize, file.name, pdfOptions.borderStyle, bookInfo.author, bookInfo.year, bookInfo.series);
            setLoading(false);
            // Notify that a job was started
            onJobStarted?.();
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
      } else {
        console.warn('No file available for upload - no file from input, drag-and-drop, or loaded from job');
      }
    };
  }, [
    bookInfo,
    pdfOptions,
    fileState,
    setLoading,
    generatePdf,
    showError,
    addNewJob,
  ]);

  const loadFileFromJob = useCallback(async (job: Job) => {
    if (!job.uploadPath || !job.originalFileName) {
      showError(
        'File Not Available',
        'The original file for this job is not available.'
      );
      return;
    }

    try {
      // Fetch the file content from the server
      const fileContent = await JobManagementService.fetchOriginalFileContent(job.uploadPath);

      // Create a File object from the content
      const blob = new Blob([fileContent], { type: 'text/plain' });
      const file = new File([blob], job.originalFileName, { type: 'text/plain' });

      // Process the file as loaded from job
      processFile(file, undefined, false, true);

    } catch (error) {
      console.error('Failed to load file from job:', error);
      showError(
        'Failed to Load File',
        error instanceof Error ? error.message : 'Could not load the original file from this job.'
      );
    }
  }, [processFile, showError]);

  return {
    uploadRef,
    handleFileChange,
    handleFileDrop,
    handleFontSizeChange,
    handleUploadFile,
    createHandleUploadFile,
    loadFileFromJob,
    pdfGenerationLoading,
    pdfGenerationError,
  };
}
