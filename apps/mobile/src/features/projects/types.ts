export type Note = {
  id: string;
  text: string;
  createdAt: string;
  audioUri?: string;
  transcription?: string;
  images?: string[];
  videos?: string[];
};

export type Project = {
  id: string;
  name: string;
  inspectionDate: string;
  inspector: string;
  notes: Note[];
  report?: string;
};

export const PROJECT_STORAGE_KEY = '@inspection_projects';
