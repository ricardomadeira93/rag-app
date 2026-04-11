export type AiMode = "local" | "cloud";
export type StorageMode = "local" | "cloud";

export type OnboardingState = {
  onboarded: boolean;
  ai_mode: AiMode | null;
  storage_mode: StorageMode | null;
};

const STORAGE_KEY = "rag-app:onboarding";

export function readOnboardingState(): OnboardingState {
  if (typeof window === "undefined") {
    return { onboarded: false, ai_mode: null, storage_mode: null };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { onboarded: false, ai_mode: null, storage_mode: null };
    }
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    return {
      onboarded: Boolean(parsed.onboarded),
      ai_mode: parsed.ai_mode === "local" || parsed.ai_mode === "cloud" ? parsed.ai_mode : null,
      storage_mode: parsed.storage_mode === "local" || parsed.storage_mode === "cloud" ? parsed.storage_mode : null,
    };
  } catch {
    return { onboarded: false, ai_mode: null, storage_mode: null };
  }
}

export function writeOnboardingState(nextState: OnboardingState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}
