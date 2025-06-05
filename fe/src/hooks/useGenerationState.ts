import { useReducer, useCallback } from 'react';
import { GenerationState, GenerationStateAction } from '../types';

const initialGenerationState: GenerationState = {
  loading: false,
  bookInfoLoading: false,
  id: null,
};

function generationStateReducer(state: GenerationState, action: GenerationStateAction): GenerationState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_BOOK_INFO_LOADING':
      return { ...state, bookInfoLoading: action.payload };
    case 'SET_GENERATION_ID':
      return { ...state, id: action.payload };
    case 'RESET_GENERATION_STATE':
      return initialGenerationState;
    default:
      return state;
  }
}

export function useGenerationState() {
  const [generationState, dispatch] = useReducer(generationStateReducer, initialGenerationState);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setBookInfoLoading = useCallback((bookInfoLoading: boolean) => {
    dispatch({ type: 'SET_BOOK_INFO_LOADING', payload: bookInfoLoading });
  }, []);

  const setGenerationId = useCallback((id: string | null) => {
    dispatch({ type: 'SET_GENERATION_ID', payload: id });
  }, []);

  const resetGenerationState = useCallback(() => {
    dispatch({ type: 'RESET_GENERATION_STATE' });
  }, []);

  return {
    generationState,
    setLoading,
    setBookInfoLoading,
    setGenerationId,
    resetGenerationState,
  };
}
