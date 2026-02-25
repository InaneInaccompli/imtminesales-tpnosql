import TimeBadge from './TimeBadge';

export default function ResultCard({ label, badgeClass, time, children }) {
  return (
    <div className="result-card">
      <h3>
        <span className={`badge ${badgeClass}`}>{label}</span>
      </h3>
      <TimeBadge ms={time} />
      {children}
    </div>
  );
}
