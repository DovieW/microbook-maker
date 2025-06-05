export type PaperCountsType = {
  [key: string]: number;
};

export interface HeaderInfo {
  series: string;
  sheetsCount: string;
  wordCount: number;
  readTime: string;
  author: string;
  year: string;
  fontSize: string;
}

export interface UploadParams {
  bookName: string;
  borderStyle: string;
  headerInfo: HeaderInfo;
}

// State management types
export interface BookInfo {
  bookName: string;
  author: string;
  series: string;
  year: string;
}

export interface PdfOptions {
  fontSize: string;
  borderStyle: string;
}

export interface FileState {
  fileName: string;
  wordCount: number;
  sheetsCount: number;
  readTime: string;
  disableUpload: boolean;
}

export interface GenerationState {
  loading: boolean;
  bookInfoLoading: boolean;
  id: string | null;
}

export interface AppState {
  bookInfo: BookInfo;
  pdfOptions: PdfOptions;
  fileState: FileState;
  generationState: GenerationState;
}

// Action types for reducers
export type BookInfoAction =
  | { type: 'SET_BOOK_NAME'; payload: string }
  | { type: 'SET_AUTHOR'; payload: string }
  | { type: 'SET_SERIES'; payload: string }
  | { type: 'SET_YEAR'; payload: string }
  | { type: 'SET_BOOK_INFO'; payload: Partial<BookInfo> }
  | { type: 'RESET_BOOK_INFO' };

export type PdfOptionsAction =
  | { type: 'SET_FONT_SIZE'; payload: string }
  | { type: 'SET_BORDER_STYLE'; payload: string };

export type FileStateAction =
  | { type: 'SET_FILE_NAME'; payload: string }
  | { type: 'SET_WORD_COUNT'; payload: number }
  | { type: 'SET_SHEETS_COUNT'; payload: number }
  | { type: 'SET_READ_TIME'; payload: string }
  | { type: 'SET_DISABLE_UPLOAD'; payload: boolean }
  | { type: 'UPDATE_FILE_STATS'; payload: { wordCount: number; sheetsCount: number; readTime: string } }
  | { type: 'RESET_FILE_STATE' };

export type GenerationStateAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_BOOK_INFO_LOADING'; payload: boolean }
  | { type: 'SET_GENERATION_ID'; payload: string | null }
  | { type: 'RESET_GENERATION_STATE' };
