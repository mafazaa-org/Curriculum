export interface Lesson {
  id: string;
  youtubeUrl: string;
  order: number;
  month: number;
  title: string;
  thumbnail_url: string;
  partTitle?: string;
  partNumber?: number;
  startSecond?: number;
  endSecond?: number;
  notification?: string;
}

