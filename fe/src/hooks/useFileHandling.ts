import { useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { UploadParams } from '../types';
import { usePdfGenerator } from './usePdfGenerator';

export function useFileHandling() {
  const uploadRef = useRef<HTMLInputElement>(null);
  const { generatePdf, loading: pdfGenerationLoading, error: pdfGenerationError } = usePdfGenerator();
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
    fetchBookInfo,
    validateUpload,
  } = useAppContext();

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file.name.endsWith('.txt')) {
        alert('Invalid file type. Please select a .txt file.');
        return;
      }

      const bookNiceName = file.name.split('.')[0];

      setDisableUpload(false);
      setBookName(bookNiceName);
      setFileName(file.name);
      
      // Fetch book info asynchronously
      setBookInfoLoading(true);
      fetchBookInfo(bookNiceName).finally(() => {
        setBookInfoLoading(false);
      });

      const reader = new FileReader();
      reader.onload = e => {
        const text = (e.target?.result as string).trim();
        const wordCount = text.split(' ').length;
        updateFileStats(wordCount, pdfOptions.fontSize);
      };
      reader.readAsText(file);
    }
  }, [
    setDisableUpload,
    setBookName,
    setFileName,
    setBookInfoLoading,
    fetchBookInfo,
    updateFileStats,
    pdfOptions.fontSize,
  ]);

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
        const generationId = await generatePdf(file, params);
        if (generationId) {
          setGenerationId(generationId);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('There was a problem with the PDF generation: ', error);
        setLoading(false);
      }
    }
  }, [
    bookInfo,
    pdfOptions,
    fileState,
    setLoading,
    setGenerationId,
    generatePdf,
  ]);

  return {
    uploadRef,
    handleFileChange,
    handleFontSizeChange,
    handleUploadFile,
    pdfGenerationLoading,
    pdfGenerationError,
  };
}
