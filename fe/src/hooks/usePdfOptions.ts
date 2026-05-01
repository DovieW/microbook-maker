import { useReducer, useCallback } from 'react';
import { PdfOptions, PdfOptionsAction } from '../types';

const initialPdfOptions: PdfOptions = {
  fontSize: '6',
  borderStyle: 'dashed',
  fontFamily: 'arial',
  foldGaps: false,
};

function pdfOptionsReducer(state: PdfOptions, action: PdfOptionsAction): PdfOptions {
  switch (action.type) {
    case 'SET_FONT_SIZE':
      return { ...state, fontSize: action.payload };
    case 'SET_BORDER_STYLE':
      return { ...state, borderStyle: action.payload };
    case 'SET_FONT_FAMILY':
      return { ...state, fontFamily: action.payload };
    case 'SET_FOLD_GAPS':
      return { ...state, foldGaps: action.payload };
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

  const setFontFamily = useCallback((fontFamily: string) => {
    dispatch({ type: 'SET_FONT_FAMILY', payload: fontFamily });
  }, []);

  const setFoldGaps = useCallback((foldGaps: boolean) => {
    dispatch({ type: 'SET_FOLD_GAPS', payload: foldGaps });
  }, []);

  return {
    pdfOptions,
    setFontSize,
    setBorderStyle,
    setFontFamily,
    setFoldGaps,
  };
}
