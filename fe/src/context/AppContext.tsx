import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useBookInfo } from '../hooks/useBookInfo';
import { usePdfOptions } from '../hooks/usePdfOptions';
import { useFileState } from '../hooks/useFileState';
import { useGenerationState } from '../hooks/useGenerationState';
import { useCapabilities } from '../hooks/useCapabilities';

interface AppContextType {
  // Book Info
  bookInfo: ReturnType<typeof useBookInfo>['bookInfo'];
  setBookName: ReturnType<typeof useBookInfo>['setBookName'];
  setAuthor: ReturnType<typeof useBookInfo>['setAuthor'];
  setSeries: ReturnType<typeof useBookInfo>['setSeries'];
  setYear: ReturnType<typeof useBookInfo>['setYear'];
  updateBookInfo: ReturnType<typeof useBookInfo>['updateBookInfo'];
  resetBookInfo: ReturnType<typeof useBookInfo>['resetBookInfo'];
  fetchBookInfo: ReturnType<typeof useBookInfo>['fetchBookInfo'];
  bookInfoLoading: ReturnType<typeof useBookInfo>['bookInfoLoading'];
  bookInfoError: ReturnType<typeof useBookInfo>['bookInfoError'];

  // PDF Options
  pdfOptions: ReturnType<typeof usePdfOptions>['pdfOptions'];
  setFontSize: ReturnType<typeof usePdfOptions>['setFontSize'];
  setBorderStyle: ReturnType<typeof usePdfOptions>['setBorderStyle'];
  setFontFamily: ReturnType<typeof usePdfOptions>['setFontFamily'];

  // File State
  fileState: ReturnType<typeof useFileState>['fileState'];
  setFileName: ReturnType<typeof useFileState>['setFileName'];
  setSelectedFile: ReturnType<typeof useFileState>['setSelectedFile'];
  setWordCount: ReturnType<typeof useFileState>['setWordCount'];
  setSheetsCount: ReturnType<typeof useFileState>['setSheetsCount'];
  setReadTime: ReturnType<typeof useFileState>['setReadTime'];
  setDisableUpload: ReturnType<typeof useFileState>['setDisableUpload'];
  updateFileStats: ReturnType<typeof useFileState>['updateFileStats'];
  resetFileState: ReturnType<typeof useFileState>['resetFileState'];
  validateUpload: ReturnType<typeof useFileState>['validateUpload'];

  // Generation State
  generationState: ReturnType<typeof useGenerationState>['generationState'];
  setLoading: ReturnType<typeof useGenerationState>['setLoading'];
  setBookInfoLoading: ReturnType<typeof useGenerationState>['setBookInfoLoading'];
  setGenerationId: ReturnType<typeof useGenerationState>['setGenerationId'];
  setProgress: ReturnType<typeof useGenerationState>['setProgress'];
  addNotification: ReturnType<typeof useGenerationState>['addNotification'];
  removeNotification: ReturnType<typeof useGenerationState>['removeNotification'];
  clearNotifications: ReturnType<typeof useGenerationState>['clearNotifications'];
  resetGenerationState: ReturnType<typeof useGenerationState>['resetGenerationState'];

  // Capabilities
  capabilities: ReturnType<typeof useCapabilities>['capabilities'];
  capabilitiesLoading: ReturnType<typeof useCapabilities>['capabilitiesLoading'];
  capabilitiesError: ReturnType<typeof useCapabilities>['capabilitiesError'];
  refreshCapabilities: ReturnType<typeof useCapabilities>['refreshCapabilities'];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const bookInfoHook = useBookInfo();
  const pdfOptionsHook = usePdfOptions();
  const fileStateHook = useFileState();
  const generationStateHook = useGenerationState();
  const capabilitiesHook = useCapabilities();

  useEffect(() => {
    const availableFontValues = capabilitiesHook.capabilities.fontOptions.map((option) => option.value);
    if (availableFontValues.length === 0) {
      return;
    }

    if (!availableFontValues.includes(pdfOptionsHook.pdfOptions.fontFamily)) {
      pdfOptionsHook.setFontFamily(capabilitiesHook.capabilities.defaults.fontFamily);
    }
  }, [
    capabilitiesHook.capabilities.fontOptions,
    capabilitiesHook.capabilities.defaults.fontFamily,
    pdfOptionsHook.pdfOptions.fontFamily,
    pdfOptionsHook.setFontFamily,
  ]);

  const contextValue: AppContextType = {
    // Book Info
    bookInfo: bookInfoHook.bookInfo,
    setBookName: bookInfoHook.setBookName,
    setAuthor: bookInfoHook.setAuthor,
    setSeries: bookInfoHook.setSeries,
    setYear: bookInfoHook.setYear,
    updateBookInfo: bookInfoHook.updateBookInfo,
    resetBookInfo: bookInfoHook.resetBookInfo,
    fetchBookInfo: bookInfoHook.fetchBookInfo,
    bookInfoLoading: bookInfoHook.bookInfoLoading,
    bookInfoError: bookInfoHook.bookInfoError,

    // PDF Options
    pdfOptions: pdfOptionsHook.pdfOptions,
    setFontSize: pdfOptionsHook.setFontSize,
    setBorderStyle: pdfOptionsHook.setBorderStyle,
    setFontFamily: pdfOptionsHook.setFontFamily,

    // File State
    fileState: fileStateHook.fileState,
    setFileName: fileStateHook.setFileName,
    setSelectedFile: fileStateHook.setSelectedFile,
    setWordCount: fileStateHook.setWordCount,
    setSheetsCount: fileStateHook.setSheetsCount,
    setReadTime: fileStateHook.setReadTime,
    setDisableUpload: fileStateHook.setDisableUpload,
    updateFileStats: fileStateHook.updateFileStats,
    resetFileState: fileStateHook.resetFileState,
    validateUpload: fileStateHook.validateUpload,

    // Generation State
    generationState: generationStateHook.generationState,
    setLoading: generationStateHook.setLoading,
    setBookInfoLoading: generationStateHook.setBookInfoLoading,
    setGenerationId: generationStateHook.setGenerationId,
    setProgress: generationStateHook.setProgress,
    addNotification: generationStateHook.addNotification,
    removeNotification: generationStateHook.removeNotification,
    clearNotifications: generationStateHook.clearNotifications,
    resetGenerationState: generationStateHook.resetGenerationState,

    // Capabilities
    capabilities: capabilitiesHook.capabilities,
    capabilitiesLoading: capabilitiesHook.capabilitiesLoading,
    capabilitiesError: capabilitiesHook.capabilitiesError,
    refreshCapabilities: capabilitiesHook.refreshCapabilities,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
