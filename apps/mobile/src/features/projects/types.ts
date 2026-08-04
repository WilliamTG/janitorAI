export type ReportContributor = {
  name?: string;
  role?: string;
  phone?: string;
  email?: string;
};

export type ReportBuilding = {
  type?: string;
  size?: string;
  buildingYear?: string;
  renovationsDone?: string;
  otherInfo?: string;
  damagedAreaDescription?: string;
  damagedAreaEstimatedValue?: string;
};

/** Metadata the inspector fills in per project; maps 1-to-1 to the Google Doc template keys. */
export type ReportMeta = {
  caseNumber?: string;
  workingNumber?: string;
  inspectionDoneByName?: string;
  inspectionDoneByPhone?: string;
  inspectionDoneByCompany?: string;
  pictureObject?: string;
  insuranceCompany?: string;
  insuranceAgent?: string;
  customerName?: string;
  addressStreet?: string;
  addressPostcodeCity?: string;
  damageDate?: string;
  inspectionDate?: string;
  /** At least one contributor; rendered as report.contributor.1.*, .2.*, … */
  contributors?: ReportContributor[];
  /** At least one building; rendered as bulding.0.*, bulding.1.*, … */
  buildings?: ReportBuilding[];
  possibleRecourse?: string;
  measuresToPreventFutureDamage?: string;
  startedRepairs?: string;
  habitableValueLossPerMonth?: string;
  habitableOtherInfo?: string;
  summaryText?: string;
};

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
  /** Last modification time (ISO). Used for per-note merge across devices. */
  updatedAt?: string;
  audioUri?: string;
  /** ID of the durable audio copy stored on the backend (set after upload). */
  audioRemoteId?: string;
  transcription?: string;
  images?: string[];
  photos?: Photo[];
  /** Local URI for a video clip attached to this note. */
  videoUri?: string;
  /** ID of the durable video copy stored on the backend (set after upload). */
  videoRemoteId?: string;
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
  /**
   * Tombstones for notes deleted on this project: note id -> deletion time
   * (ISO). Lets the per-note merge keep a note deleted on one device deleted
   * everywhere instead of resurrecting it from another device's copy.
   */
  deletedNotes?: Record<string, string>;
  /** Per-project metadata used to populate Google Doc template placeholders. */
  reportMeta?: ReportMeta;
  /** URL of the generated Google Doc (persisted after successful generation). */
  reportUrl?: string;
  /** Lifecycle status of the most recent report generation attempt. */
  reportStatus?: 'processing' | 'ready' | 'failed';
  /** Human-readable error from the last failed generation (shown on the project card). */
  reportError?: string;
};

export const PROJECT_STORAGE_KEY = '@inspection_projects';

// Sentinel-verdier som lagres i prosjektdata når felt står tomme. De er
// engelske av historiske grunner og må aldri vises rått — begge skjermene
// oversetter dem ved visning (nb.projects.dateNotSet/unknownInspector).
export const UNKNOWN_INSPECTOR = 'Unknown inspector';
export const NO_DATE_SET = 'No date set';
