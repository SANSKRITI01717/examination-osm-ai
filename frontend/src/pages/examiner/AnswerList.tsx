import React, { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table'
import { MARKING_STATUS_COLORS, type MarkingStatus } from '../../lib/constants'


export const AnswerList: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const examId = Number(id || 1)
  const navigate = useNavigate()

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [ocrReviewOnly, setOcrReviewOnly] = useState<boolean>(false)

  const { data, isLoading } = useQuery({
    queryKey: ['answers', examId, statusFilter, ocrReviewOnly],
    queryFn: () =>
      apiClient.getAnswers({
        exam_id: examId,
        marking_status: statusFilter === 'all' ? undefined : statusFilter,
        ocr_review_required: ocrReviewOnly ? true : undefined,
      }),
  })

  const answers = data?.items || []
  const firstPending = answers.find(a => a.marking_status === 'pending')

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Answer Script Queue</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Blind Marking: Anonymous Student Codes only. Student identities are kept strictly confidential.
          </p>
        </div>

        {firstPending && (
          <Button
            variant="primary"
            onClick={() => navigate(`/examiner/answers/${firstPending.id}`)}
          >
            ➔ Open First Pending (Q{firstPending.question_number} • {firstPending.anon_code})
          </Button>
        )}
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Filter Status:
          </span>
          {['all', 'pending', 'marked', 'flagged'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize cursor-pointer transition-colors ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={ocrReviewOnly}
            onChange={e => setOcrReviewOnly(e.target.checked)}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>Show only answers requiring OCR review</span>
        </label>
      </div>

      {/* Answer List Table */}
      <Card title={`Answer Scripts (${answers.length})`}>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading scripts...</div>
        ) : answers.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No answers match the selected filter.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Anon Code</TableHead>
                <TableHead>OCR Status</TableHead>
                <TableHead>AI Status</TableHead>
                <TableHead>Marking Status</TableHead>
                <TableHead>Awarded Marks</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {answers.map(ans => {
                const statusStyle =
                  MARKING_STATUS_COLORS[ans.marking_status as MarkingStatus] ||
                  MARKING_STATUS_COLORS.pending

                return (
                  <TableRow key={ans.id}>
                    <TableCell className="font-bold text-slate-900">
                      Q{ans.question_number}
                    </TableCell>
                    <TableCell className="font-mono font-bold text-indigo-600">
                      {ans.anon_code}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs text-slate-700 capitalize">{ans.ocr_status}</span>
                        {ans.ocr_review_required && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            Review needed
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-600 capitalize">{ans.ai_status}</span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                      >
                        {ans.marking_status}
                      </span>
                    </TableCell>
                    <TableCell className="font-bold font-mono text-xs text-slate-900">
                      {ans.final_marks !== null ? `${ans.final_marks} / ${ans.max_marks}` : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/examiner/answers/${ans.id}`}>
                        <Button
                          size="sm"
                          variant={ans.marking_status === 'pending' ? 'primary' : 'outline'}
                        >
                          {ans.marking_status === 'pending' ? 'Mark Answer' : 'Review Workspace'}
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
