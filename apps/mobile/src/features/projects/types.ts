export type Photo = {
  id: string;
  uri: string;
  caption: string;
  aiGenerated?: boolean;
  /** ID of the durable copy stored on the backend (set after upload). */
  remoteId?: string;
};

export type Note = {
  id: string;
  text: string;
  createdAt: string;
  audioUri?: string;
  /** ID of the durable audio copy stored on the backend (set after upload). */
  audioRemoteId?: string;
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
  projectDescriptionAudioRemoteId?: string;
  projectDescriptionTranscription?: string;
  projectDescriptionUpdatedAt?: string;
  /** Last modification time (ISO). Used for last-write-wins sync. */
  updatedAt?: string;
};

export const PROJECT_STORAGE_KEY = '@inspection_projects';
