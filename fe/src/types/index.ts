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
  progress: ProgressInfo | null;
  notifications: Notification[];
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
  | { type: 'SET_PROGRESS'; payload: ProgressInfo | null }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_NOTIFICATIONS' }
  | { type: 'RESET_GENERATION_STATE' };

// API Response types
export interface OpenLibraryBook {
  author_name?: string[];
  first_publish_year?: number;
  title?: string;
}

export interface OpenLibraryResponse {
  docs: OpenLibraryBook[];
  numFound: number;
}

export interface BookInfoResult {
  author: string;
  publishYear: string;
}

export interface PdfGenerationResponse {
  id: string;
  status?: string;
}

// Progress tracking types
export interface ProgressInfo {
  step: string;
  percentage: number;
  currentSheet?: number;
  totalSheets?: number;
  isComplete: boolean;
  isError: boolean;
  errorMessage?: string;
}

export interface ProgressResponse {
  status: 'in_progress' | 'completed' | 'error' | 'not_found';
  progress?: ProgressInfo;
  message?: string;
}

// Notification types
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  autoHide?: boolean;
  duration?: number;
}

// API Error types
export interface ApiErrorInterface {
  message: string;
  status?: number;
  code?: string;
}

// Hook return types
export interface UseOpenLibraryReturn {
  fetchBookInfo: (title: string) => Promise<BookInfoResult | null>;
  loading: boolean;
  error: Error | null;
  clearError: () => void;
}

export interface UsePdfGeneratorReturn {
  generatePdf: (file: File, params: UploadParams) => Promise<string | null>;
  loading: boolean;
  error: Error | null;
  clearError: () => void;
}
