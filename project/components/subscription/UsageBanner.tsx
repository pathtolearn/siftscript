import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { fetchUsage, type UsageData } from '../../lib/utils/managedAI';
import { getCurrentUser } from '../../lib/auth/supabase';
import { authEnabled } from '../../lib/auth/supabase';

interface UsageBannerProps {
  onUpgrade: () => void;
}

export function UsageBanner({ onUpgrade }: UsageBannerProps) {
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    if (!authEnabled) return;
    async function load() {
      const user = await getCurrentUser();
      if (!user) return;
      const data = await fetchUsage();
      setUsage(data);
    }
    load();
  }, []);

  // Don't show if: auth not enabled, not logged in, or on Pro (unlimited)
  if (!authEnabled || !usage || usage.tier === 'pro') return null;

  const aiUsed = usage.usage.ai_calls;
  const aiLimit = usage.limits.ai_calls ?? 10;
  const pct = Math.min(Math.round((aiUsed / aiLimit) * 100), 100);
  const nearLimit = pct >= 70;
  const atLimit = aiUsed >= aiLimit;

  if (!nearLimit) return null; // Only show banner when approaching the limit

  return (
    <div className={`flex items-center gap-3 px-4 py-2 text-sm ${
      atLimit ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
    }`}>
      <Zap className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="flex-1">
        {atLimit
          ? `AI limit reached (${aiUsed}/${aiLimit} this month).`
          : `${aiUsed}/${aiLimit} AI analyses used this month.`}
      </span>
      <button
        onClick={onUpgrade}
        className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors whitespace-nowrap ${
          atLimit
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'bg-amber-600 text-white hover:bg-amber-700'
        }`}
      >
        Upgrade to Pro
      </button>
    </div>
  );
}
