const OPTIONS = [
  { key: 'sql', label: 'PostgreSQL', cls: 'active-pg' },
  { key: 'nosql', label: 'Neo4j', cls: 'active-neo4j' },
  { key: 'both', label: 'Les deux', cls: 'active-both' },
];

export default function DbSelector({ value, onChange }) {
  return (
    <div className="db-selector">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          className={`db-btn ${value === o.key ? o.cls : ''}`}
          onClick={() => onChange(o.key)}
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
