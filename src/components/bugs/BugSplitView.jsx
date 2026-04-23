import { useState } from 'react'
import { CheckCircle2, XCircle, X } from 'lucide-react'

export default function BugSplitView({ testCase, bug }) {
  const [lightbox, setLightbox] = useState(null)

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        {/* Expected */}
        <div className="card overflow-hidden border-l-4 border-l-secondary">
          <div className="px-5 py-3 bg-secondary/10 border-b border-outline-variant/40 flex items-center gap-2">
            <CheckCircle2 className="text-secondary" size={16} />
            <span className="label-sm text-secondary">Expected Behavior</span>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <div className="label-sm mb-2">Test Case Steps</div>
              <ol className="list-decimal pl-5 space-y-1.5 text-body-md">
                {(testCase?.expandedSteps || []).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
                {(!testCase?.expandedSteps || testCase.expandedSteps.length === 0) && (
                  <li className="text-ink-dim italic">No steps documented.</li>
                )}
              </ol>
            </div>
            <div>
              <div className="label-sm mb-2 text-secondary">Expected Result</div>
              <p className="text-body-md">{testCase?.expectedResult || '—'}</p>
            </div>
          </div>
        </div>

        {/* Actual */}
        <div className="card overflow-hidden border-l-4 border-l-danger">
          <div className="px-5 py-3 bg-danger/10 border-b border-outline-variant/40 flex items-center gap-2">
            <XCircle className="text-danger" size={16} />
            <span className="label-sm text-danger">Actual Behavior</span>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <div className="label-sm mb-2">Tester Description</div>
              <blockquote className="italic text-body-md text-ink-muted border-l-2 border-danger/40 pl-3">
                "{bug?.actualBehavior}"
              </blockquote>
            </div>
            {(bug?.screenshots || []).length > 0 && (
              <div>
                <div className="label-sm mb-2 text-danger">Visual Evidence</div>
                <div className="grid grid-cols-2 gap-2">
                  {bug.screenshots.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setLightbox(url)}
                      className="relative aspect-video rounded overflow-hidden border border-outline-variant/40 hover:border-primary transition-colors group"
                    >
                      <img src={url} alt="evidence" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <span className="text-white opacity-0 group-hover:opacity-100 text-[11px] font-semibold">
                          Click to enlarge
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {bug?.additionalNotes && (
              <div>
                <div className="label-sm mb-2">Additional Notes</div>
                <p className="text-body-md text-ink-muted">{bug.additionalNotes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8 animate-fade-in"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-6 right-6 btn btn-sm btn-ghost text-white">
            <X size={20} />
          </button>
          <img src={lightbox} alt="evidence" className="max-w-full max-h-full object-contain rounded" />
        </div>
      )}
    </>
  )
}
