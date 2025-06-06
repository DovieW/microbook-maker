import { useReducer, useCallback } from 'react';
import { BookInfo, BookInfoAction } from '../types';
import { useOpenLibrary } from './useOpenLibrary';

const initialBookInfo: BookInfo = {
  bookName: '',
  author: '',
  series: '',
  year: '',
};

function bookInfoReducer(state: BookInfo, action: BookInfoAction): BookInfo {
  switch (action.type) {
    case 'SET_BOOK_NAME':
      return { ...state, bookName: action.payload };
    case 'SET_AUTHOR':
      return { ...state, author: action.payload };
    case 'SET_SERIES':
      return { ...state, series: action.payload };
    case 'SET_YEAR':
      return { ...state, year: action.payload };
    case 'SET_BOOK_INFO':
      return { ...state, ...action.payload };
    case 'RESET_BOOK_INFO':
      return initialBookInfo;
    default:
      return state;
  }
}

export function useBookInfo() {
  const [bookInfo, dispatch] = useReducer(bookInfoReducer, initialBookInfo);
  const { fetchBookInfo: fetchFromApi, loading: bookInfoLoading, error: bookInfoError } = useOpenLibrary();

  const setBookName = useCallback((bookName: string) => {
    dispatch({ type: 'SET_BOOK_NAME', payload: bookName });
  }, []);

  const setAuthor = useCallback((author: string) => {
    dispatch({ type: 'SET_AUTHOR', payload: author });
  }, []);

  const setSeries = useCallback((series: string) => {
    dispatch({ type: 'SET_SERIES', payload: series });
  }, []);

  const setYear = useCallback((year: string) => {
    dispatch({ type: 'SET_YEAR', payload: year });
  }, []);

  const updateBookInfo = useCallback((info: Partial<BookInfo>) => {
    dispatch({ type: 'SET_BOOK_INFO', payload: info });
  }, []);

  const resetBookInfo = useCallback(() => {
    dispatch({ type: 'RESET_BOOK_INFO' });
  }, []);

  const fetchBookInfo = useCallback(async (bookTitle: string) => {
    const info = await fetchFromApi(bookTitle);
    if (info) {
      updateBookInfo({
        author: info.author,
        year: info.publishYear,
      });
    }
  }, [fetchFromApi, updateBookInfo]);

  return {
    bookInfo,
    setBookName,
    setAuthor,
    setSeries,
    setYear,
    updateBookInfo,
    resetBookInfo,
    fetchBookInfo,
    bookInfoLoading,
    bookInfoError,
  };
}
