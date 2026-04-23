import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Stepper from '../components/common/Stepper.jsx'
import StepUpload from '../components/rounds/StepUpload.jsx'
import StepExpand from '../components/rounds/StepExpand.jsx'
import StepReview from '../components/rounds/StepReview.jsx'
import { useProject } from '../context/ProjectContext.jsx'

const STEPS = ['Upload', 'AI Expand', 'Review']

export default function CreateRoundPage() {
  const { selected } = useProject()
  const [step, setStep] = useState(0)
  const [uploadResult, setUploadResult] = useState(null)
  const [expanded, setExpanded] = useState(null)

  if (!selected) {
    return (
      <div className="max-w-4xl mx-auto px-8 py-8">
        <div className="card p-8 text-center">
          <h2 className="text-h2 mb-2">No project selected</h2>
          <p className="text-ink-muted">Create or select a project from the top bar first.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/rounds" className="btn btn-sm btn-ghost">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-h2 leading-tight">Create Test Round</h1>
          <p className="text-body-md text-ink-muted">
            Project: <span className="font-mono text-primary">{selected.code || selected.name}</span>
          </p>
        </div>
      </div>

      <div className="mb-8 max-w-2xl">
        <Stepper steps={STEPS} current={step} />
      </div>

      {step === 0 && (
        <StepUpload
          projectCode={selected.code}
          initial={uploadResult}
          onNext={(r) => {
            setUploadResult(r)
            setStep(1)
          }}
        />
      )}
      {step === 1 && uploadResult && (
        <StepExpand
          mapped={uploadResult.mapped}
          initialExpanded={expanded}
          onBack={() => setStep(0)}
          onNext={(e) => {
            setExpanded(e)
            setStep(2)
          }}
        />
      )}
      {step === 2 && expanded && <StepReview expanded={expanded} onBack={() => setStep(1)} />}
    </div>
  )
}
