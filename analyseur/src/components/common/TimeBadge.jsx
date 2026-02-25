import { formatMs } from '../../utils/format';

export default function TimeBadge({ ms }) {
  return <div className="time-badge">{formatMs(ms)}</div>;
}
