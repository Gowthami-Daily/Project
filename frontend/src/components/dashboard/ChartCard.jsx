import GlassCard from '../ui/GlassCard.jsx'
import { SectionHeader } from '../ui/PageHeader.jsx'

export default function ChartCard({ title, subtitle, action, children, className = '' }) {
  return (
    <GlassCard padding="default" hoverLift={false} className={className}>
      {title ? <SectionHeader title={title} subtitle={subtitle} action={action} /> : null}
      {children}
    </GlassCard>
  )
}
