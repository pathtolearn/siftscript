import { db } from '../db/schema';
import { transcriptRepository } from '../db/repositories/transcriptRepository';

export interface OnboardingState {
  complete: boolean;
  step: number;
  transcriptCount: number;
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const [complete, step, stats] = await Promise.all([
    db.settings.get('onboardingComplete'),
    db.settings.get('onboardingStep'),
    transcriptRepository.getStats(),
  ]);

  return {
    complete: (complete?.value as boolean) ?? false,
    step: (step?.value as number) ?? 0,
    transcriptCount: stats.total,
  };
}

export async function setOnboardingComplete(): Promise<void> {
  await db.settings.put({ key: 'onboardingComplete', value: true });
}

export async function setOnboardingStep(step: number): Promise<void> {
  await db.settings.put({ key: 'onboardingStep', value: step });
}

export async function shouldShowOnboarding(): Promise<boolean> {
  const state = await getOnboardingState();
  if (state.complete) return false;
  // Skip if user is clearly not new
  if (state.transcriptCount >= 3) {
    await setOnboardingComplete();
    return false;
  }
  return true;
}
