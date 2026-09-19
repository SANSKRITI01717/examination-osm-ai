import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'

export const Processing: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const examId = Number(id)
  const queryClient = useQueryClient()
  const { toast, errorToast } = useToast()

  // Polling 10s per frontend-plan.md §5
  const { data: status } = useQuery({
    queryKey: ['processingStatus', examId],
    queryFn: () => apiClient.getProcessingStatus(examId),
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  })

  const batchOcrMutation = useMutation({
    mutationFn: () => apiClient.runBatchOcr(examId),
    onSuccess: res => {
      queryClient.invalidateQueries({ queryKey: ['processingStatus', examId] })
      toast(`Queued OCR processing for ${res.queued} answer scripts`, 'success')
    },
    onError: err => errorToast(err),
  })

  const batchAiMutation = useMutation({
    mutationFn: () => apiClient.runBatchAi(examId),
    onSuccess: res => {
      queryClient.invalidateQueries({ queryKey: ['processingStatus', examId] })
      toast(`Queued AI evaluation for ${res.queued} answer scripts`, 'success')
    },
    onError: err => errorToast(err),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Link to={`/admin/exams/${examId}`} className="text-xs text-indigo-600 hover:underline">
              ← Back to Exam
            </Link>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Processing Pipeline & Polling</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Trigger batch OCR digitization and AI evaluation. Counters poll every 10 seconds.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => batchOcrMutation.mutate()}
            isLoading={batchOcrMutation.isPending}
          >
            ▶ Run Batch OCR
          </Button>
          <Button
            variant="primary"
            onClick={() => batchAiMutation.mutate()}
            isLoading={batchAiMutation.isPending}
          >
            ★ Run AI Evaluation
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* OCR Status Box */}
        <Card title="OCR Digitization">
          <div className="space-y-2 mt-2 text-xs">
            <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-100">
              <span className="text-slate-600">Pending:</span>
              <span className="font-bold font-mono">{status?.ocr.pending ?? 0}</span>
            </div>
            <div className="flex justify-between p-2 bg-blue-50 text-blue-800 rounded border border-blue-100">
              <span className="font-medium">In Processing:</span>
              <span className="font-bold font-mono">{status?.ocr.processing ?? 0}</span>
            </div>
            <div className="flex justify-between p-2 bg-emerald-50 text-emerald-800 rounded border border-emerald-100">
              <span className="font-medium">Done:</span>
              <span className="font-bold font-mono">{status?.ocr.done ?? 0}</span>
            </div>
            <div className="flex justify-between p-2 bg-rose-50 text-rose-800 rounded border border-rose-100">
              <span className="font-medium">Failed:</span>
              <span className="font-bold font-mono">{status?.ocr.failed ?? 0}</span>
            </div>
          </div>
        </Card>

        {/* AI Evaluation Box */}
        <Card title="AI Evaluation">
          <div className="space-y-2 mt-2 text-xs">
            <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-100">
              <span className="text-slate-600">Not Requested:</span>
              <span className="font-bold font-mono">{status?.ai.not_requested ?? 0}</span>
            </div>
            <div className="flex justify-between p-2 bg-blue-50 text-blue-800 rounded border border-blue-100">
              <span className="font-medium">Processing:</span>
              <span className="font-bold font-mono">{status?.ai.processing ?? 0}</span>
            </div>
            <div className="flex justify-between p-2 bg-indigo-50 text-indigo-800 rounded border border-indigo-100">
              <span className="font-medium">Completed:</span>
              <span className="font-bold font-mono">{status?.ai.done ?? 0}</span>
            </div>
            <div className="flex justify-between p-2 bg-rose-50 text-rose-800 rounded border border-rose-100">
              <span className="font-medium">Failed:</span>
              <span className="font-bold font-mono">{status?.ai.failed ?? 0}</span>
            </div>
          </div>
        </Card>

        {/* OCR Verification Review */}
        <Card title="OCR Verification">
          <div className="text-center py-4">
            <span className="text-3xl font-black text-amber-600 font-mono">
              {status?.review_required ?? 0}
            </span>
            <p className="text-xs text-slate-500 mt-1">
              Low-confidence handwriting answers requiring examiner verification
            </p>
          </div>
        </Card>

        {/* Marking Status Box */}
        <Card title="Marking Progress">
          <div className="space-y-2 mt-2 text-xs">
            <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-100">
              <span className="text-slate-600">Pending:</span>
              <span className="font-bold font-mono">{status?.marking.pending ?? 0}</span>
            </div>
            <div className="flex justify-between p-2 bg-emerald-50 text-emerald-800 rounded border border-emerald-100">
              <span className="font-medium">Marked by Examiner:</span>
              <span className="font-bold font-mono">{status?.marking.marked ?? 0}</span>
            </div>
            <div className="flex justify-between p-2 bg-rose-50 text-rose-800 rounded border border-rose-100">
              <span className="font-medium">Flagged Anomalies:</span>
              <span className="font-bold font-mono">{status?.marking.flagged ?? 0}</span>
            </div>
            <div className="flex justify-between p-2 bg-purple-50 text-purple-800 rounded border border-purple-100">
              <span className="font-medium">Moderated:</span>
              <span className="font-bold font-mono">{status?.marking.moderated ?? 0}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
