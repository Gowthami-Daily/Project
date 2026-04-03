/** Shared “pay with” parsing for global expense form (mirrors PfExpensesPage). */

export function paymentMethodForAccount(account) {
  if (!account) return 'bank_transfer'
  const t = String(account.account_type || '').toLowerCase()
  if (t.includes('cash') || t.includes('wallet') || t === 'petty' || t === 'hand') return 'cash'
  return 'bank_transfer'
}

export function parsePayWith(value, accounts, instruments, creditCards = []) {
  if (!value || typeof value !== 'string') {
    return {
      accountId: null,
      paymentMethod: null,
      paymentInstrumentId: null,
      creditCardId: null,
      kind: 'none',
    }
  }
  if (value.startsWith('cc:')) {
    const id = Number(value.slice(3))
    const ok = creditCards.some((c) => c.id === id)
    if (!ok || Number.isNaN(id)) {
      return {
        accountId: null,
        paymentMethod: 'credit_card',
        paymentInstrumentId: null,
        creditCardId: null,
        kind: 'invalid',
      }
    }
    return {
      accountId: null,
      paymentMethod: 'credit_card',
      paymentInstrumentId: null,
      creditCardId: id,
      kind: 'cc',
    }
  }
  if (value.startsWith('pi:')) {
    const id = Number(value.slice(3))
    const inst = instruments.find((i) => i.id === id)
    if (!inst || inst.finance_account_id == null) {
      return {
        accountId: null,
        paymentMethod: 'card',
        paymentInstrumentId: null,
        creditCardId: null,
        kind: 'invalid',
      }
    }
    return {
      accountId: inst.finance_account_id,
      paymentMethod: inst.kind,
      paymentInstrumentId: id,
      creditCardId: null,
      kind: 'pi',
    }
  }
  if (value.startsWith('acc:')) {
    const id = Number(value.slice(4))
    const acc = accounts.find((a) => a.id === id)
    if (!acc) {
      return {
        accountId: null,
        paymentMethod: null,
        paymentInstrumentId: null,
        creditCardId: null,
        kind: 'invalid',
      }
    }
    return {
      accountId: id,
      paymentMethod: paymentMethodForAccount(acc),
      paymentInstrumentId: null,
      creditCardId: null,
      kind: 'acc',
    }
  }
  return {
    accountId: null,
    paymentMethod: null,
    paymentInstrumentId: null,
    creditCardId: null,
    kind: 'invalid',
  }
}

export function buildExpensePayWithGroups(accounts, creditCards, paymentStatus) {
  const groups = []
  if (paymentStatus === 'PENDING') {
    groups.push({
      label: 'While pending',
      options: [{ value: '', label: 'Not specified', description: 'Optional until paid' }],
    })
  }
  if (accounts.length) {
    groups.push({
      label: 'Accounts (cash or bank)',
      options: accounts.map((a) => ({
        value: `acc:${a.id}`,
        label: a.account_name,
        description: paymentMethodForAccount(a) === 'cash' ? 'Cash' : 'Bank / transfer',
      })),
    })
  }
  if (creditCards.length) {
    groups.push({
      label: 'Credit cards',
      options: creditCards.map((c) => ({
        value: `cc:${c.id}`,
        label: c.card_name,
        description: c.bank_name || 'Statement balance',
      })),
    })
  }
  if (groups.length === 0) {
    groups.push({
      label: '—',
      options: [
        {
          value: '',
          label: 'No accounts or cards',
          description: 'Add them under Accounts / Credit cards',
          disabled: true,
        },
      ],
    })
  }
  return groups
}
