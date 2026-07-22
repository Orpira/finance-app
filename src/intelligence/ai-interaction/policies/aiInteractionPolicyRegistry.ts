import type { AIInteractionPolicy } from './aiInteractionPolicy'

export class AIInteractionPolicyRegistry {
  private readonly policies = new Map<string, AIInteractionPolicy>()

  constructor(initialPolicies: readonly AIInteractionPolicy[] = []) {
    for (const policy of initialPolicies) {
      this.register(policy)
    }
  }

  register(policy: AIInteractionPolicy): void {
    const key = this.toKey(policy.policyId, policy.policyVersion)
    if (this.policies.has(key)) {
      throw new Error(`AI interaction policy already registered: ${key}`)
    }
    this.policies.set(key, policy)
  }

  resolve(policyId: string, policyVersion: string): AIInteractionPolicy | null {
    return this.policies.get(this.toKey(policyId, policyVersion)) ?? null
  }

  private toKey(policyId: string, policyVersion: string): string {
    return `${policyId.trim()}@${policyVersion.trim()}`
  }
}
