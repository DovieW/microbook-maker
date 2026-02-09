import { useReducer, useCallback } from 'react';
import { FileState, FileStateAction } from '../types';
import { calculatePapers, calculateReadingTime } from '../utils';
import { validateFontSize } from '../utils/validation';

const initialFileState: FileState = {
  fileName: '',
  selectedFile: null,
  wordCount: 0,
  sheetsCount: 0,
  readTime: '--',
  disableUpload: true,
};

function fileStateReducer(state: FileState, action: FileStateAction): FileState {
  switch (action.type) {
    case 'SET_FILE_NAME':
      return { ...state, fileName: action.payload };
    case 'SET_SELECTED_FILE':
      return { ...state, selectedFile: action.payload };
    case 'SET_WORD_COUNT':
      return { ...state, wordCount: action.payload };
    case 'SET_SHEETS_COUNT':
      return { ...state, sheetsCount: action.payload };
    case 'SET_READ_TIME':
      return { ...state, readTime: action.payload };
    case 'SET_DISABLE_UPLOAD':
      return { ...state, disableUpload: action.payload };
    case 'UPDATE_FILE_STATS':
      return {
        ...state,
        wordCount: action.payload.wordCount,
        sheetsCount: action.payload.sheetsCount,
        readTime: action.payload.readTime,
      };
    case 'RESET_FILE_STATE':
      return initialFileState;
    default:
      return state;
  }
}

export function useFileState() {
  const [fileState, dispatch] = useReducer(fileStateReducer, initialFileState);

  const setFileName = useCallback((fileName: string) => {
    dispatch({ type: 'SET_FILE_NAME', payload: fileName });
  }, []);

  const setSelectedFile = useCallback((file: File | null) => {
    dispatch({ type: 'SET_SELECTED_FILE', payload: file });
  }, []);

  const setWordCount = useCallback((wordCount: number) => {
    dispatch({ type: 'SET_WORD_COUNT', payload: wordCount });
  }, []);

  const setSheetsCount = useCallback((sheetsCount: number) => {
    dispatch({ type: 'SET_SHEETS_COUNT', payload: sheetsCount });
  }, []);

  const setReadTime = useCallback((readTime: string) => {
    dispatch({ type: 'SET_READ_TIME', payload: readTime });
  }, []);

  const setDisableUpload = useCallback((disableUpload: boolean) => {
    dispatch({ type: 'SET_DISABLE_UPLOAD', payload: disableUpload });
  }, []);

  const updateFileStats = useCallback((wordCount: number, fontSize: string) => {
    const sheetsCount = calculatePapers(wordCount, fontSize);
    const readTime = calculateReadingTime(wordCount);
    
    dispatch({
      type: 'UPDATE_FILE_STATS',
      payload: { wordCount, sheetsCount, readTime },
    });
  }, []);

  const resetFileState = useCallback(() => {
    dispatch({ type: 'RESET_FILE_STATE' });
  }, []);

  const validateUpload = useCallback((fontSize: string, hasFile: boolean) => {
    const fontSizeValidation = validateFontSize(fontSize);
    const isValidFontSize = fontSizeValidation.isValid;
    const shouldDisable = !isValidFontSize || !hasFile;

    setDisableUpload(shouldDisable);

    if (!isValidFontSize) {
      setSheetsCount(0);
    }
  }, [setDisableUpload, setSheetsCount]);

  return {
    fileState,
    setFileName,
    setSelectedFile,
    setWordCount,
    setSheetsCount,
    setReadTime,
    setDisableUpload,
    updateFileStats,
    resetFileState,
    validateUpload,
  };
}
