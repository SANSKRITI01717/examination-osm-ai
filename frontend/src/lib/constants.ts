// Canonical Enums and Labels matching database-schema.md and api-spec.md

export type UserRole = 'admin' | 'examiner' | 'moderator'
export type ExamStatus = 'draft' | 'evaluation' | 'moderation' | 'completed'
export type EvaluationMode = 'standard' | 'reference_grounded'
export type SheetStatus = 'uploaded' | 'mapped'
export type OcrStatus = 'pending' | 'processing' | 'done' | 'failed'
export type AiStatus = 'not_requested' | 'pending' | 'processing' | 'done' | 'failed'
export type MarkingStatus = 'pending' | 'marked' | 'flagged' | 'moderated'
export type FinalSource = 'examiner' | 'moderator' | 'system'
export type EvaluationSource = 'ai_accepted' | 'ai_modified' | 'manual'
export type EvaluationStatus = 'draft' | 'submitted'
export type DocType = 'official_answer' | 'guideline' | 'syllabus' | 'other'
export type DocStatus = 'uploaded' | 'indexing' | 'indexed' | 'failed'
export type AnomalyType =
  | 'UNCHECKED_ANSWER'
  | 'MISSING_MARKS'
  | 'QUESTION_OUTLIER'
  | 'EXAMINER_DEVIATION'
  | 'AI_DISAGREEMENT'
  | 'TOO_FAST'
  | 'SCORE_SHIFT'
  | 'REPEATED_PATTERN'
  | 'UNVERIFIED_OCR'
export type AnomalySeverity = 'low' | 'medium' | 'high'
export type AnomalyStatus = 'open' | 'dismissed' | 'resolved'
export type ModerationDecision = 'confirmed' | 'overridden'
export type ResultStatus = 'draft' | 'published'

export const AI_ASSISTANT_LABEL = 'AI suggestion — you decide'

// Badge color helpers
export const EXAM_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  evaluation: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  moderation: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
}

export const MARKING_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  marked: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  flagged: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  moderated: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
}

export const OCR_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-slate-100', text: 'text-slate-600' },
  processing: { bg: 'bg-blue-100', text: 'text-blue-700' },
  done: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  failed: { bg: 'bg-rose-100', text: 'text-rose-700' },
}

export const AI_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  not_requested: { bg: 'bg-slate-100', text: 'text-slate-600' },
  pending: { bg: 'bg-amber-100', text: 'text-amber-700' },
  processing: { bg: 'bg-blue-100', text: 'text-blue-700' },
  done: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  failed: { bg: 'bg-rose-100', text: 'text-rose-700' },
}

export const ANOMALY_SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  high: { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
}

export const ANOMALY_TYPE_LABELS: Record<string, string> = {
  UNCHECKED_ANSWER: 'Unchecked Answer',
  MISSING_MARKS: 'Missing Marks',
  QUESTION_OUTLIER: 'Question Outlier',
  EXAMINER_DEVIATION: 'Examiner Deviation',
  AI_DISAGREEMENT: 'AI Disagreement',
  TOO_FAST: 'Unusually Fast Marking',
  SCORE_SHIFT: 'Score Shift',
  REPEATED_PATTERN: 'Repeated Pattern',
  UNVERIFIED_OCR: 'Unverified OCR Marking',
}
