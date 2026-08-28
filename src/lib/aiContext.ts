import type { AIContextInput } from './types'

const SYSTEM_PREFIX = `You are an email deliverability analyst assistant for an ESP Performance Dashboard. You can answer questions about every operational area of this dashboard: per-ESP delivery/open/click/bounce performance (any ESP, provider, domain, or date), Registrations & FTDs, the IP Matrix registry, and the Throttling Matrix. You do not have access to Logs or Users data — if asked about those, say so plainly instead of guessing.

The data below is only a summary (overall totals, ESP rankings, each ESP's top 5 providers/domains, all-time Reg/FTDs per ESP, IP/throttle/partner counts) — it will not cover every provider, domain, specific date, IP, or partner record. Every fact you state must come from this summary or from a tool result — NEVER invent, estimate, round, or extrapolate a number that isn't literally in front of you. If a question needs more than the summary provides, call the matching tool to fetch the exact data. If no tool covers what's being asked (e.g. it's about Logs or Users, or truly isn't tracked anywhere), say plainly that the data isn't available — do not produce a plausible-sounding guess.

Be concise, use concrete numbers, and format tables with markdown when helpful. Beyond directly answering, proactively call out anything notable in the data relevant to the question (a spike, an outlier ESP/provider, a trend worth flagging) in a sentence or two — but don't force it if nothing stands out.

Always include 2-3 short, specific follow-up questions the user could naturally ask next, tailored to this answer and to the data/tools available. Return an empty list only if genuinely nothing sensible fits.`

export function buildAIContext(input: AIContextInput): string {
  const { esps, espData, ipmData, throttleData, regFtdsDaily, dmData } = input

  if (esps.length === 0) {
    return `${SYSTEM_PREFIX}\n\nNo ESP data is currently loaded in the dashboard.`
  }

  const lines: string[] = [SYSTEM_PREFIX, '']

  // 1. Overall totals
  const totalSent = esps.reduce((s, e) => s + e.sent, 0)
  const totalDelivered = esps.reduce((s, e) => s + e.delivered, 0)
  const totalOpened = esps.reduce((s, e) => s + e.opens, 0)
  const totalClicked = esps.reduce((s, e) => s + e.clicks, 0)
  const totalBounced = esps.reduce((s, e) => s + e.bounced, 0)
  const overallDeliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0
  const overallBounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0
  const overallOpenRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0

  lines.push('## Overall Totals (All ESPs)')
  lines.push(`- Total Sent: ${totalSent.toLocaleString()}`)
  lines.push(`- Total Delivered: ${totalDelivered.toLocaleString()}`)
  lines.push(`- Total Opened: ${totalOpened.toLocaleString()}`)
  lines.push(`- Total Clicked: ${totalClicked.toLocaleString()}`)
  lines.push(`- Overall Delivery Rate: ${overallDeliveryRate.toFixed(2)}%`)
  lines.push(`- Overall Bounce Rate: ${overallBounceRate.toFixed(2)}%`)
  lines.push(`- Overall Open Rate: ${overallOpenRate.toFixed(2)}%`)
  lines.push('')

  // 2. ESP summary table
  lines.push('## ESP Summary')
  lines.push('| ESP | Status | Sent | Delivery% | Open% | Bounce% | Unsub% |')
  lines.push('|-----|--------|------|-----------|-------|---------|--------|')
  for (const esp of esps) {
    lines.push(
      `| ${esp.name} | ${esp.status} | ${esp.sent.toLocaleString()} | ${esp.deliveryRate.toFixed(2)}% | ${esp.openRate.toFixed(2)}% | ${esp.bounceRate.toFixed(2)}% | ${esp.unsubRate.toFixed(2)}% |`
    )
  }
  lines.push('')

  // 3. Top/bottom performers (only meaningful with 2+ ESPs)
  if (esps.length > 1) {
    const byDelivery = [...esps].sort((a, b) => b.deliveryRate - a.deliveryRate)
    const byBounce = [...esps].sort((a, b) => a.bounceRate - b.bounceRate)
    lines.push('## Performance Rankings')
    lines.push(`- Best delivery rate: ${byDelivery[0].name} (${byDelivery[0].deliveryRate.toFixed(2)}%)`)
    lines.push(`- Worst delivery rate: ${byDelivery[byDelivery.length - 1].name} (${byDelivery[byDelivery.length - 1].deliveryRate.toFixed(2)}%)`)
    lines.push(`- Lowest bounce rate: ${byBounce[0].name} (${byBounce[0].bounceRate.toFixed(2)}%)`)
    lines.push(`- Highest bounce rate: ${byBounce[byBounce.length - 1].name} (${byBounce[byBounce.length - 1].bounceRate.toFixed(2)}%)`)
    lines.push('')
  }

  // 4. Provider + domain breakdown per ESP
  for (const esp of esps) {
    const data = espData[esp.name]
    if (!data) continue

    const providerEntries = Object.entries(data.providers)
      .filter(([, pd]) => pd.overall && pd.overall.sent > 0)
      .sort(([, a], [, b]) => b.overall.sent - a.overall.sent)
      .slice(0, 5)

    if (providerEntries.length > 0) {
      lines.push(`## ${esp.name} — Top Recipient Providers`)
      lines.push('| Provider | Sent | Delivery% | Bounce% |')
      lines.push('|----------|------|-----------|---------|')
      for (const [name, pd] of providerEntries) {
        lines.push(
          `| ${name} | ${pd.overall.sent.toLocaleString()} | ${pd.overall.deliveryRate.toFixed(2)}% | ${pd.overall.bounceRate.toFixed(2)}% |`
        )
      }
      lines.push('')
    }

    const domainEntries = Object.entries(data.domains)
      .filter(([, pd]) => pd.overall && pd.overall.sent > 0)
      .sort(([, a], [, b]) => b.overall.sent - a.overall.sent)
      .slice(0, 5)

    if (domainEntries.length > 0) {
      lines.push(`## ${esp.name} — Top Sending Domains`)
      lines.push('| Domain | Sent | Delivery% |')
      lines.push('|--------|------|-----------|')
      for (const [name, pd] of domainEntries) {
        lines.push(
          `| ${name} | ${pd.overall.sent.toLocaleString()} | ${pd.overall.deliveryRate.toFixed(2)}% |`
        )
      }
      lines.push('')
    }
  }

  // 5. Reg & FTDs summary by ESP (from daily uploads — the source of truth for FTD figures)
  if (regFtdsDaily.length > 0) {
    const totalsByEsp = new Map<string, { reg: number; ftds: number }>()
    for (const r of regFtdsDaily) {
      const prev = totalsByEsp.get(r.esp) ?? { reg: 0, ftds: 0 }
      totalsByEsp.set(r.esp, { reg: prev.reg + r.registrations, ftds: prev.ftds + r.ftds })
    }
    const ranked = [...totalsByEsp.entries()]
      .map(([esp, v]) => ({ esp, ...v }))
      .sort((a, b) => b.ftds - a.ftds || b.reg - a.reg)

    const totalReg = ranked.reduce((s, r) => s + r.reg, 0)
    const totalFtds = ranked.reduce((s, r) => s + r.ftds, 0)
    const dates = [...new Set(regFtdsDaily.map(r => r.date))].sort()

    lines.push('## Reg & FTDs Summary (by ESP, all-time across uploaded dates)')
    lines.push(`- Date range covered: ${dates[0]} to ${dates[dates.length - 1]}`)
    lines.push(`- Total Registrations: ${totalReg.toLocaleString()}`)
    lines.push(`- Total FTDs: ${totalFtds.toLocaleString()}`)
    lines.push('| ESP | Registrations | FTDs | Reg→FTD Conversion% |')
    lines.push('|-----|---------------|------|----------------------|')
    for (const r of ranked) {
      const conv = r.reg > 0 ? (r.ftds / r.reg) * 100 : 0
      lines.push(`| ${r.esp} | ${r.reg.toLocaleString()} | ${r.ftds.toLocaleString()} | ${conv.toFixed(2)}% |`)
    }
    lines.push('')
  }

  // 6. IP Matrix summary (static per-IP registry figures — for FTD/registration
  // *questions*, prefer the Reg & FTDs Summary above, which comes from daily uploads)
  if (ipmData.length > 0) {
    const totalRegs = ipmData.reduce((s, r) => s + (r.registrations ?? 0), 0)
    const totalFtds = ipmData.reduce((s, r) => s + (r.ftds ?? 0), 0)
    lines.push('## IP Matrix Summary (IP registry — static figures per IP, not daily-tracked)')
    lines.push(`- Total IPs tracked: ${ipmData.length}`)
    lines.push(`- Total Registrations: ${totalRegs.toLocaleString()}`)
    lines.push(`- Total FTDs: ${totalFtds.toLocaleString()}`)
    lines.push('For a specific IP/ESP/domain/MAP-code registry entry, call get_ip_detail.')
    lines.push('')
  }

  // 7. Throttle Matrix — flag non-zero combos only; exact per-provider values need a tool call
  const flagged = throttleData.filter(r => {
    const vals = [r.gmail, r.hotmail, r.outlook, r.yahoo, r.icloud, r.aol, r.live, r.gmx, r.web, r.others]
    return vals.some(v => typeof v === 'number' && v > 0)
  })

  if (flagged.length > 0) {
    lines.push('## Throttling Issues')
    lines.push('The following ESP/IP/domain combinations have at least one active (non-zero) throttle rate. Exact per-mailbox-provider values (gmail, hotmail, outlook, yahoo, icloud, aol, live, gmx, web, others) are not listed here — call get_throttle_detail for the exact numbers.')
    for (const r of flagged) {
      lines.push(`- ${r.esp} | IP: ${r.ip} | Domain: ${r.fromDomain}`)
    }
    lines.push('')
  }

  // 8. Data Management (partner roster) summary
  if (dmData.length > 0) {
    const countryCounts = new Map<string, number>()
    for (const r of dmData) {
      const c = r.country?.trim()
      if (c) countryCounts.set(c, (countryCounts.get(c) ?? 0) + 1)
    }
    const columns = [...new Set(dmData.flatMap(r => Object.keys(r)))]
    lines.push('## Data Management — Partner Roster Summary')
    lines.push(`- Total partner records: ${dmData.length}`)
    lines.push(`- Tracked columns: ${columns.join(', ')}`)
    if (countryCounts.size > 0) {
      const byCountry = [...countryCounts.entries()].sort((a, b) => b[1] - a[1])
      lines.push(`- By country: ${byCountry.map(([c, n]) => `${c} (${n})`).join(', ')}`)
    }
    lines.push('For a specific partner/domain/country record\'s full details, call get_partner_detail.')
    lines.push('')
  }

  return lines.join('\n')
}
