import { useState, useEffect } from 'react';
import { X, BookOpen, Network, ArrowRight, CheckCircle2 } from 'lucide-react';
import { setOnboardingComplete, setOnboardingStep } from '../../lib/utils/onboarding';

interface OnboardingFlowProps {
  transcriptCount: number;
  onComplete: () => void;
  onDismiss: () => void;
}

export function OnboardingFlow({ transcriptCount, onComplete, onDismiss }: OnboardingFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Auto-advance to step 3 when user saves 3 transcripts while onboarding is open
  useEffect(() => {
    if (transcriptCount >= 3 && step === 2) {
      setStep(3);
      setOnboardingStep(3);
    }
  }, [transcriptCount, step]);

  async function handleDismiss() {
    await setOnboardingComplete();
    onDismiss();
  }

  async function handleComplete() {
    await setOnboardingComplete();
    onComplete();
  }

  async function advanceTo(next: 2 | 3) {
    setStep(next);
    await setOnboardingStep(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors z-10"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Progress dots */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step
                  ? 'w-5 bg-indigo-600'
                  : s < step
                  ? 'w-1.5 bg-indigo-300'
                  : 'w-1.5 bg-gray-200'
              }`}
            />
          ))}
        </div>

        {step === 1 && <StepOne onNext={() => advanceTo(2)} />}
        {step === 2 && (
          <StepTwo
            transcriptCount={transcriptCount}
            onNext={() => advanceTo(3)}
          />
        )}
        {step === 3 && <StepThree onComplete={handleComplete} />}
      </div>
    </div>
  );
}

function StepOne({ onNext }: { onNext: () => void }) {
  return (
    <div className="px-8 pt-12 pb-8 text-center">
      <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <BookOpen className="w-8 h-8 text-indigo-600" />
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-3">
        You watch. We remember.
      </h2>
      <p className="text-gray-500 leading-relaxed mb-2">
        Most people forget 90% of what they watch on YouTube within a week.
      </p>
      <p className="text-gray-700 font-medium leading-relaxed mb-8">
        VidSage builds a searchable research library from every video you
        save — and connects ideas across them automatically.
      </p>

      <button
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
      >
        Get started
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function StepTwo({
  transcriptCount,
  onNext,
}: {
  transcriptCount: number;
  onNext: () => void;
}) {
  const saved = Math.min(transcriptCount, 3);
  const goal = 3;
  const pct = Math.round((saved / goal) * 100);

  return (
    <div className="px-8 pt-12 pb-8 text-center">
      <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <Network className="w-8 h-8 text-amber-500" />
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-3">
        Save 3 videos to unlock your Knowledge Graph
      </h2>
      <p className="text-gray-500 leading-relaxed mb-6">
        Navigate to any YouTube video and click the VidSage icon to save its
        transcript to your library.
      </p>

      {/* Progress bar */}
      <div className="bg-gray-100 rounded-xl p-5 mb-6 text-left">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Transcripts saved
          </span>
          <span className="text-sm font-semibold text-indigo-600">
            {saved} / {goal}
          </span>
        </div>
        <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex justify-between mt-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                  n <= saved
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {n <= saved ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <span className="text-xs font-semibold">{n}</span>
                )}
              </div>
              <span className="text-xs text-gray-400">Video {n}</span>
            </div>
          ))}
        </div>
      </div>

      {saved >= goal ? (
        <button
          onClick={onNext}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
        >
          See your Knowledge Graph
          <ArrowRight className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={onNext}
          className="w-full px-6 py-3 text-gray-500 text-sm hover:text-gray-700 transition-colors"
        >
          Skip for now
        </button>
      )}
    </div>
  );
}

function StepThree({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="px-8 pt-12 pb-8 text-center">
      <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <Network className="w-8 h-8 text-green-600" />
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-3">
        Your library is ready
      </h2>
      <p className="text-gray-500 leading-relaxed mb-6">
        VidSage is already extracting concepts from your videos in the background.
        Head to the <strong className="text-gray-700">Knowledge Graph</strong> tab to
        explore connections — or select videos in your Library and run{' '}
        <strong className="text-gray-700">Cross-Analyze</strong> for a deep AI synthesis.
      </p>

      <div className="bg-indigo-50 rounded-xl p-4 mb-8 text-left">
        <p className="text-sm font-semibold text-indigo-900 mb-2">
          Your Knowledge Graph includes:
        </p>
        <ul className="space-y-1.5 text-sm text-indigo-700">
          <li className="flex items-center gap-2">
            <span className="text-indigo-400">→</span> Visual graph of concepts &amp; creators
          </li>
          <li className="flex items-center gap-2">
            <span className="text-indigo-400">→</span> Concept clusters across videos
          </li>
          <li className="flex items-center gap-2">
            <span className="text-indigo-400">→</span> Creator overlap — who covers what
          </li>
          <li className="flex items-center gap-2">
            <span className="text-indigo-400">→</span> Topic evolution timeline
          </li>
        </ul>
      </div>

      <button
        onClick={onComplete}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
      >
        Open my Library
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
