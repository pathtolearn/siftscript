import { useState } from 'react';
import { X, Zap, Loader2, Check } from 'lucide-react';
import { createCheckoutSession } from '../../lib/utils/managedAI';

interface UpgradeModalProps {
  reason?: string;
  used?: number;
  limit?: number;
  onClose: () => void;
  onLoginRequired: () => void;
}

export function UpgradeModal({ reason, used, limit, onClose, onLoginRequired }: UpgradeModalProps) {
  const [plan, setPlan] = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleUpgrade() {
    setError('');
    setLoading(true);
    try {
      const url = await createCheckoutSession(plan);
      window.open(url, '_blank');
      onClose();
    } catch (err) {
      if (err instanceof Error && err.message.includes('login_required')) {
        onClose();
        onLoginRequired();
      } else {
        setError('Could not start checkout. Try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-8 py-8">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
            <Zap className="w-6 h-6 text-indigo-600" />
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-1">Upgrade to Pro</h2>

          {reason ? (
            <p className="text-sm text-gray-500 mb-1">{reason}</p>
          ) : (
            <p className="text-sm text-gray-500 mb-1">Unlock unlimited AI analyses and more.</p>
          )}

          {used !== undefined && limit !== undefined && (
            <p className="text-xs text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg mb-4">
              You've used {used}/{limit} this month
            </p>
          )}

          {/* Plan toggle */}
          <div className="flex gap-2 mt-4 mb-5">
            <PlanOption
              label="Monthly"
              price="$7"
              period="/mo"
              selected={plan === 'monthly'}
              onClick={() => setPlan('monthly')}
            />
            <PlanOption
              label="Annual"
              price="$55"
              period="/yr"
              badge="Save 35%"
              selected={plan === 'annual'}
              onClick={() => setPlan('annual')}
            />
          </div>

          {/* Feature list */}
          <ul className="space-y-2 mb-6">
            {[
              'Unlimited AI analyses',
              'Unlimited cross-video analyses',
              'Unlimited saved transcripts',
              'Full knowledge graph',
              'Export to Markdown, CSV, Notion',
              'Bring your own API key (no limits)',
            ].map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</p>
          )}

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Upgrade to Pro — {plan === 'annual' ? '$55/yr' : '$7/mo'}
          </button>

          <p className="text-center text-xs text-gray-400 mt-3">
            Cancel anytime. Billed via Stripe.
          </p>
        </div>
      </div>
    </div>
  );
}

function PlanOption({
  label, price, period, badge, selected, onClick,
}: {
  label: string; price: string; period: string;
  badge?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl border-2 p-3 text-left transition-all ${
        selected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        {badge && (
          <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-1">
        <span className="text-lg font-bold text-gray-900">{price}</span>
        <span className="text-xs text-gray-500">{period}</span>
      </div>
    </button>
  );
}
