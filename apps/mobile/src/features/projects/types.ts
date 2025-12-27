export type Photo = {
  id: string;
  uri: string;
  caption: string;
  aiGenerated?: boolean;
};

export type Note = {
  id: string;
  text: string;
  createdAt: string;
  audioUri?: string;
  transcription?: string;
  images?: string[];
  photos?: Photo[];
};

export type Project = {
  id: string;
  name: string;
  inspectionDate: string;
  inspector: string;
  notes: Note[];
  report?: string;
  projectDescriptionText?: string;
  projectDescriptionAudioUri?: string;
  projectDescriptionTranscription?: string;
  projectDescriptionUpdatedAt?: string;
};

export const PROJECT_STORAGE_KEY = '@inspection_projects';
