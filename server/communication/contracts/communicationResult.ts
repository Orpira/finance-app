export interface CommunicationSuccessResult {
  success: true
  requestId: string
  provider: 'meta-cloud'
  status: 'accepted' | 'simulated'
  providerMessageId?: string
  simulation?: true
}

export interface CommunicationErrorResult {
  success: false
  requestId?: string
  provider: 'meta-cloud'
  error: {
    code: string
    message: string
  }
}
