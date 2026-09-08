import type { CurrencyCode } from '../types/settings'
import {
  buildWalletAmbiguousAnswer,
  buildWalletBalanceAnswer,
  buildWalletContextDeniedAnswer,
  buildWalletCountAnswer,
  buildWalletDefaultAnswer,
  buildWalletDistributionAnswer,
  buildWalletExtremeBalanceAnswer,
  buildWalletLatestTransferAnswer,
  buildWalletNotFoundAnswer,
  buildWalletPeriodUnresolvableAnswer,
  buildWalletTotalAnswer,
  buildWalletTransfersSummaryAnswer,
  findWalletsByQuery,
  resolveWalletCopilotPeriod,
  resolveWalletCopilotRequest,
  type WalletCopilotAnswer,
  type WalletCopilotResolvedPeriod,
  type WalletCopilotWallet,
} from '../intelligence/deterministic-copilot/walletCopilotEngine'
import { getLatestWalletTransfer, getWalletTransferSummary } from './internalTransferService'
import { resolveActiveUsageMode } from '../utils/usageMode'
import { getSettings } from './settingsService'
import { getPersonalWalletLedger, type PersonalWalletLedger } from './walletService'

function toEngineWallets(ledger: PersonalWalletLedger): WalletCopilotWallet[] {
  return ledger.wallets.map((wallet) => ({
    id: wallet.id,
    name: wallet.name,
    normalizedName: wallet.normalizedName,
    balance: wallet.balance,
    isDefault: wallet.isDefault,
    isArchived: wallet.isArchived,
  }))
}

/**
 * "Este mes" is the copilot's default window for transfer questions that
 * don't name a period ("¿cuánto transferí?" — spec §52), mirroring the
 * monthly framing used everywhere else in the app. Reuses
 * `resolveWalletCopilotPeriod` instead of recomputing month math so the
 * default and the explicit "este mes" phrase can never drift apart.
 */
function defaultTransferPeriod(referenceIso: string): WalletCopilotResolvedPeriod {
  const resolved = resolveWalletCopilotPeriod('este mes', referenceIso)
  if (resolved === null || resolved === 'unresolvable') {
    throw new Error('"este mes" must always resolve to a concrete period.')
  }
  return resolved
}

/**
 * Single read-only entry point for Wallet questions (spec §27): resolves the
 * intent purely, gates on Personal usage mode (checked here — the intent
 * layer — AND again implicitly by only ever reading `basic` data through
 * `getPersonalWalletLedger`/`listInternalTransfers`, spec §25), then
 * delegates every figure to the existing wallet/transfer services. Never
 * writes, never recomputes a balance independently of those services.
 */
export async function answerPersonalWalletCopilotQuery(
  query: string,
  input: { readonly now?: () => Date } = {},
): Promise<WalletCopilotAnswer | null> {
  const now = input.now ?? (() => new Date())
  const nowIso = now().toISOString()
  const request = resolveWalletCopilotRequest(query, nowIso)
  if (request === null) return null

  const settings = await getSettings()
  if (resolveActiveUsageMode(settings) !== 'basic') {
    return buildWalletContextDeniedAnswer()
  }

  const currency: CurrencyCode = settings.defaultCurrency
  const ledger = await getPersonalWalletLedger(currency)
  const wallets = toEngineWallets(ledger)
  const defaultWallet = wallets.find((wallet) => wallet.isDefault) ?? null

  switch (request.intent) {
    case 'wallet_total':
      return buildWalletTotalAnswer(wallets, ledger.total, currency)

    case 'wallet_distribution':
      return buildWalletDistributionAnswer(wallets, ledger.total, currency)

    case 'wallet_count':
      return buildWalletCountAnswer(request.scope, ledger.activeWalletCount, ledger.archivedWalletCount)

    case 'wallet_default':
      return buildWalletDefaultAnswer(defaultWallet)

    case 'wallet_largest_balance':
      return buildWalletExtremeBalanceAnswer(wallets, 'largest', currency)

    case 'wallet_smallest_balance':
      return buildWalletExtremeBalanceAnswer(wallets, 'smallest', currency)

    case 'wallet_balance': {
      if (request.nameQuery.length === 0) return null
      const { matches } = findWalletsByQuery(wallets, request.nameQuery)
      if (matches.length === 0) return buildWalletNotFoundAnswer(request.nameQuery, wallets)
      if (matches.length > 1) return buildWalletAmbiguousAnswer(matches)
      return buildWalletBalanceAnswer(matches[0], currency)
    }

    case 'wallet_transfers_summary': {
      if (request.resolvedPeriod === 'unresolvable') return buildWalletPeriodUnresolvableAnswer()
      const resolved = request.resolvedPeriod ?? defaultTransferPeriod(nowIso)
      const summary = await getWalletTransferSummary(resolved.period, currency)
      return buildWalletTransfersSummaryAnswer({
        transferCount: summary.transferCount,
        totalMoved: summary.totalMoved,
        currency,
        periodLabel: resolved.label,
        latestTransfer: summary.latestTransfer === null ? null : {
          fromWalletName: summary.latestTransfer.fromWalletName,
          toWalletName: summary.latestTransfer.toWalletName,
          amount: summary.latestTransfer.amount,
        },
      })
    }

    case 'wallet_latest_transfer': {
      if (request.resolvedPeriod === 'unresolvable') return buildWalletPeriodUnresolvableAnswer()
      const period = request.resolvedPeriod === null ? 'all' : request.resolvedPeriod.period
      const transfer = await getLatestWalletTransfer(period)
      return buildWalletLatestTransferAnswer(transfer === null ? null : {
        date: transfer.date,
        fromWalletName: transfer.fromWalletName,
        toWalletName: transfer.toWalletName,
        amount: transfer.amount,
        currency: transfer.currency as CurrencyCode,
        note: transfer.note,
      })
    }

    default:
      return null
  }
}
