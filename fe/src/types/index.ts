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
