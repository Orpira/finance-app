export type PinGateStatus = 'loading' | 'unlocked' | 'locked'

export function shouldMountProtectedContent(
  status: PinGateStatus,
  hasUnlocked: boolean,
) {
  return status === 'unlocked' || hasUnlocked
}
