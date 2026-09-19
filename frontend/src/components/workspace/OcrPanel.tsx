import React, { useState, useEffect } from 'react'
import { Button } from '../ui/Button'
import { ConfidenceBadge } from './ConfidenceBadge'
import { OcrWarningBanner } from './OcrWarningBanner'
import type { OcrStatus } from '../../lib/constants'

interface OcrPanelProps {
  ocr: {
    status: OcrStatus
    text: string
    verified_text: string | null
    confidence: number
    review_required: boolean
    verified: boolean
  }
  onSaveText: (text: string, verify: boolean) => Promise<void>
  readOnly?: boolean
}

export const OcrPanel: React.FC<OcrPanelProps> = ({ ocr, onSaveText, readOnly = false }) => {
  const [currentText, setCurrentText] = useState(ocr.verified_text || ocr.text || '')
  const [isSaving, setIsSaving] = useState(false)
  const isDirty = currentText !== (ocr.verified_text || ocr.text || '')

  useEffect(() => {
    setCurrentText(ocr.verified_text || ocr.text || '')
  }, [ocr.verified_text, ocr.text])

  const handleSave = async (markVerified: boolean = false) => {
    setIsSaving(true)
    try {
      await onSaveText(currentText, markVerified || ocr.verified)
    } finally {
      setIsSaving(false)
    }
  }

  const handleVerify = async () => {
    setIsSaving(true)
    try {
      await onSaveText(currentText, true)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            OCR Extracted Text
          </h4>
          {ocr.verified && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
              ✓ Verified
            </span>
          )}
        </div>
        <ConfidenceBadge confidence={ocr.confidence} label="OCR Conf" />
      </div>

      <OcrWarningBanner
        confidence={ocr.confidence}
        reviewRequired={ocr.review_required}
        isVerified={ocr.verified}
        onVerify={handleVerify}
        isSubmitting={isSaving}
      />

      <div className="relative">
        <textarea
          rows={4}
          readOnly={readOnly}
          value={currentText}
          onChange={e => setCurrentText(e.target.value)}
          placeholder="No text extracted..."
          className={`w-full p-3 rounded-lg border text-sm font-mono text-slate-800 bg-slate-50/50 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all ${
            ocr.review_required && !ocr.verified
              ? 'border-amber-300 ring-1 ring-amber-200'
              : 'border-slate-200'
          }`}
        />
      </div>

      {!readOnly && (
        <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
          <span>{isDirty ? 'Unsaved edits' : 'Text synchronized with server'}</span>
          <div className="flex items-center space-x-2">
            {isDirty && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleSave(true)}
                isLoading={isSaving}
              >
                Save & Verify Text
              </Button>
            )}
            {!ocr.verified && !isDirty && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleVerify}
                isLoading={isSaving}
              >
                Confirm Verified
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
