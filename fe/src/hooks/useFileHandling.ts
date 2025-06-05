import { useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { UploadParams } from '../types';

export function useFileHandling() {
  const uploadRef = useRef<HTMLInputElement>(null);
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
      const formData = new FormData();
      formData.append('file', file);

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

      formData.append('params', JSON.stringify(params));

      try {
        const response = await fetch(`/api/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setGenerationId(data.id);
      } catch (error) {
        console.error('There was a problem with the fetch operation: ', error);
        setLoading(false);
      }
    }
  }, [
    bookInfo,
    pdfOptions,
    fileState,
    setLoading,
    setGenerationId,
  ]);

  return {
    uploadRef,
    handleFileChange,
    handleFontSizeChange,
    handleUploadFile,
  };
}
