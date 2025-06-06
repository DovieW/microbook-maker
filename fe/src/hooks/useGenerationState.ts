import { useReducer, useCallback } from 'react';
import { GenerationState, GenerationStateAction, ProgressInfo, Notification } from '../types';

const initialGenerationState: GenerationState = {
  loading: false,
  bookInfoLoading: false,
  id: null,
  progress: null,
  notifications: [],
};

function generationStateReducer(state: GenerationState, action: GenerationStateAction): GenerationState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_BOOK_INFO_LOADING':
      return { ...state, bookInfoLoading: action.payload };
    case 'SET_GENERATION_ID':
      return { ...state, id: action.payload };
    case 'SET_PROGRESS':
      return { ...state, progress: action.payload };
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, action.payload]
      };
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      };
    case 'CLEAR_NOTIFICATIONS':
      return { ...state, notifications: [] };
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

  const setProgress = useCallback((progress: ProgressInfo | null) => {
    dispatch({ type: 'SET_PROGRESS', payload: progress });
  }, []);

  const addNotification = useCallback((notification: Notification) => {
    dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
  }, []);

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, []);

  const clearNotifications = useCallback(() => {
    dispatch({ type: 'CLEAR_NOTIFICATIONS' });
  }, []);

  const resetGenerationState = useCallback(() => {
    dispatch({ type: 'RESET_GENERATION_STATE' });
  }, []);

  return {
    generationState,
    setLoading,
    setBookInfoLoading,
    setGenerationId,
    setProgress,
    addNotification,
    removeNotification,
    clearNotifications,
    resetGenerationState,
  };
}
