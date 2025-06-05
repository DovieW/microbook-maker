import { useReducer, useCallback } from 'react';
import { PdfOptions, PdfOptionsAction } from '../types';

const initialPdfOptions: PdfOptions = {
  fontSize: '6',
  borderStyle: 'dashed',
};

function pdfOptionsReducer(state: PdfOptions, action: PdfOptionsAction): PdfOptions {
  switch (action.type) {
    case 'SET_FONT_SIZE':
      return { ...state, fontSize: action.payload };
    case 'SET_BORDER_STYLE':
      return { ...state, borderStyle: action.payload };
    default:
      return state;
  }
}

export function usePdfOptions() {
  const [pdfOptions, dispatch] = useReducer(pdfOptionsReducer, initialPdfOptions);

  const setFontSize = useCallback((fontSize: string) => {
    dispatch({ type: 'SET_FONT_SIZE', payload: fontSize });
  }, []);

  const setBorderStyle = useCallback((borderStyle: string) => {
    dispatch({ type: 'SET_BORDER_STYLE', payload: borderStyle });
  }, []);

  return {
    pdfOptions,
    setFontSize,
    setBorderStyle,
  };
}
