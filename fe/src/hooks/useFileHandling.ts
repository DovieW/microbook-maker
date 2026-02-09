import { useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { UploadParams, Job } from '../types';
import { usePdfGenerator } from './usePdfGenerator';
import { useNotifications } from './useNotifications';
import { useJobManagementContext } from '../context/JobManagementContext';
import { JobManagementService } from '../services/jobManagementService';

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
    setFontFamily,
    fileState,
    setFileName,
    setSelectedFile,
    updateFileStats,
    setDisableUpload,
    setLoading,
    setBookInfoLoading,
    fetchBookInfo,
    validateUpload,
    capabilities,
  } = useAppContext();

  const acceptedFormats = capabilities.acceptedFormats;
  const maxSize = capabilities.maxUploadSizeBytes;

  const processFile = useCallback((file: File, clearInput?: () => void) => {
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;

    if (!acceptedFormats.includes(extension)) {
      showError(
        'Invalid File Type',
        `Please select one of: ${acceptedFormats.join(', ')}`
      );
      clearInput?.();
      return;
    }

    if (file.size > maxSize) {
      showError(
        'File Too Large',
        `Please select a file smaller than ${Math.round(maxSize / (1024 * 1024))}MB.`
      );
      clearInput?.();
      return;
    }

    const bookNiceName = file.name.split('.').slice(0, -1).join('.') || file.name;

    if (uploadRef.current) {
      uploadRef.current.value = '';
    }

    setSelectedFile(file);
    setDisableUpload(false);
    setBookName(bookNiceName);
    setFileName(file.name);

    setBookInfoLoading(true);
    fetchBookInfo(bookNiceName)
      .catch(() => {
        showWarning(
          'Book Info Not Found',
          'Could not automatically fetch book information. You can enter it manually.'
        );
      })
      .finally(() => {
        setBookInfoLoading(false);
      });

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string).trim();
      const wordCount = text ? text.split(/\s+/).length : 0;

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
    acceptedFormats,
    maxSize,
    setSelectedFile,
    setDisableUpload,
    setBookName,
    setFileName,
    setBookInfoLoading,
    fetchBookInfo,
    showWarning,
    updateFileStats,
    pdfOptions.fontSize,
    showError,
  ]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      processFile(files[0], () => {
        event.target.value = '';
      });
    }
  }, [processFile]);

  const handleFileDrop = useCallback((file: File) => {
    processFile(file);
  }, [processFile]);

  const handleFontSizeChange = useCallback((newFontSize: string) => {
    setFontSize(newFontSize);
    const hasFile = !!fileState.selectedFile;
    validateUpload(newFontSize, hasFile);

    if (fileState.wordCount > 0) {
      updateFileStats(fileState.wordCount, newFontSize);
    }
  }, [setFontSize, fileState.selectedFile, validateUpload, fileState.wordCount, updateFileStats]);

  const createUploadParams = useCallback((): UploadParams => {
    return {
      bookName: bookInfo.bookName,
      borderStyle: pdfOptions.borderStyle,
      fontFamily: pdfOptions.fontFamily,
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
  }, [bookInfo, pdfOptions, fileState]);

  const startGeneration = useCallback(async (onJobStarted?: () => void) => {
    const file = fileState.selectedFile;

    if (!file) {
      console.warn('No file available for upload');
      return;
    }

    setLoading(true);

    try {
      const generationId = await generatePdf(file, createUploadParams());

      if (!generationId) {
        showError(
          'PDF Generation Failed',
          'Failed to start PDF generation. Please try again.'
        );
        return;
      }

      addNewJob(
        generationId,
        bookInfo.bookName,
        pdfOptions.fontSize,
        pdfOptions.fontFamily,
        file.name,
        pdfOptions.borderStyle,
        bookInfo.author,
        bookInfo.year,
        bookInfo.series
      );

      onJobStarted?.();
    } catch (error) {
      console.error('There was a problem with the PDF generation: ', error);
      showError(
        'PDF Generation Error',
        error instanceof Error ? error.message : 'An unexpected error occurred during PDF generation.'
      );
    } finally {
      setLoading(false);
    }
  }, [
    fileState.selectedFile,
    setLoading,
    generatePdf,
    createUploadParams,
    showError,
    addNewJob,
    bookInfo,
    pdfOptions,
  ]);

  const handleUploadFile = useCallback(async () => {
    await startGeneration();
  }, [startGeneration]);

  const createHandleUploadFile = useCallback((onJobStarted?: () => void) => {
    return async () => {
      await startGeneration(onJobStarted);
    };
  }, [startGeneration]);

  const loadFileFromJob = useCallback(async (job: Job) => {
    if (!job.uploadPath || !job.originalFileName) {
      showError(
        'File Not Available',
        'The original file for this job is not available.'
      );
      return;
    }

    try {
      const fileContent = await JobManagementService.fetchOriginalFileContent(job.uploadPath);
      const extension = `.${job.originalFileName.split('.').pop()?.toLowerCase()}`;

      if (!acceptedFormats.includes(extension)) {
        showError(
          'Unsupported Format',
          `This job uses ${extension} which is not currently enabled.`
        );
        return;
      }

      const blob = new Blob([fileContent], { type: 'text/plain' });
      const file = new File([blob], job.originalFileName, { type: 'text/plain' });
      if (job.fontFamily) {
        setFontFamily(job.fontFamily);
      }
      processFile(file);
    } catch (error) {
      console.error('Failed to load file from job:', error);
      showError(
        'Failed to Load File',
        error instanceof Error ? error.message : 'Could not load the original file from this job.'
      );
    }
  }, [acceptedFormats, processFile, setFontFamily, showError]);

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
