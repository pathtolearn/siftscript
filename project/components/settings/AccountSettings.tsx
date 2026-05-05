import { useEffect, useState } from 'react';
import { LogOut, Zap, Loader2, ExternalLink } from 'lucide-react';
import { getCurrentUser, signOut, onAuthStateChange, authEnabled, type AuthUser } from '../../lib/auth/supabase';
import { fetchUsage, createCheckoutSession, type UsageData } from '../../lib/utils/managedAI';
import { LoginModal } from '../auth/LoginModal';

interface AccountSettingsProps {
  onUpgrade?: () => void;
}

export function AccountSettings({ onUpgrade }: AccountSettingsProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    if (!authEnabled) return;

    async function init() {
      const u = await getCurrentUser();
      setUser(u);
      if (u) loadUsage();
    }
    init();

    return onAuthStateChange(u => {
      setUser(u);
      if (u) loadUsage();
      else setUsage(null);
    });
  }, []);

  async function loadUsage() {
    setLoadingUsage(true);
    const data = await fetchUsage();
    setUsage(data);
    setLoadingUsage(false);
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
    setUsage(null);
  }

  async function handleUpgrade(plan: 'monthly' | 'annual') {
    setCheckingOut(true);
    try {
      const url = await createCheckoutSession(plan);
      window.open(url, '_blank');
    } catch {
      // ignore
    } finally {
      setCheckingOut(false);
    }
  }

  if (!authEnabled) {
    return (
      <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4">
        Account features require the app to be deployed with Supabase configured.
      </div>
    );
  }

  if (!user) {
    return (
      <>
        {showLogin && (
          <LoginModal
            onClose={() => setShowLogin(false)}
            onSuccess={() => setShowLogin(false)}
          />
        )}
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-14 h-14 flex items-center justify-center mb-4">
            <img src="/vidsage_logo.png" alt="VidSage" className="w-14 h-14 object-contain" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Sign in to use AI without an API key</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-xs">
            Free tier includes 10 AI analyses and 2 cross-video analyses per month.
          </p>
          <button
            onClick={() => setShowLogin(true)}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Sign in / Create account
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-semibold text-indigo-700">
            {(user.email ?? 'U')[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{user.email}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                usage?.tier === 'pro'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {usage?.tier === 'pro' ? 'Pro' : 'Free'}
              </span>
              {usage?.tier === 'pro' && usage.stripe_period_end && (
                <span className="text-xs text-gray-400">
                  Renews {new Date(usage.stripe_period_end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>

      {/* Usage meters */}
      {loadingUsage ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading usage…
        </div>
      ) : usage ? (
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            This month — {usage.month}
          </p>
          <UsageMeter label="AI analyses" used={usage.usage.ai_calls} limit={usage.limits.ai_calls} />
          <UsageMeter label="Cross-video analyses" used={usage.usage.cross_video_calls} limit={usage.limits.cross_video_calls} />
          <UsageMeter label="Transcripts saved" used={usage.usage.transcripts_saved} limit={usage.limits.transcripts_saved} />
        </div>
      ) : null}

      {/* Upgrade / manage */}
      {usage?.tier === 'free' && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-sm font-semibold text-indigo-900 mb-1">Upgrade to Pro</p>
          <p className="text-xs text-indigo-700 mb-3">Unlimited AI, cross-video analyses, and transcripts.</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleUpgrade('annual')}
              disabled={checkingOut}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {checkingOut && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              $55/year
            </button>
            <button
              onClick={() => handleUpgrade('monthly')}
              disabled={checkingOut}
              className="px-4 py-2 border border-indigo-300 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors disabled:opacity-60"
            >
              $7/month
            </button>
          </div>
        </div>
      )}

      {usage?.tier === 'pro' && (
        <a
          href="https://billing.stripe.com/p/login/vidsage"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          <ExternalLink className="w-4 h-4" />
          Manage subscription
        </a>
      )}
    </div>
  );
}

function UsageMeter({
  label, used, limit,
}: {
  label: string; used: number; limit: number | null;
}) {
  if (limit === null) {
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-400">{used} · Unlimited</span>
      </div>
    );
  }

  const pct = Math.min(Math.round((used / limit) * 100), 100);
  const colour = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-indigo-500';

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className={pct >= 90 ? 'text-red-600 font-medium' : 'text-gray-500'}>
          {used}/{limit}
        </span>
      </div>
      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${colour} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
