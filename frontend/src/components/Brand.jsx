import logo from '../assets/fraudio-logo.png';
import { tr } from '../i18n/tr.js';

export function Brand({ compact = false }) {
  return (
    <span className="brand" aria-label={tr.brand.name}>
      <img src={logo} alt="" width={compact ? 30 : 40} height={compact ? 30 : 40} />
      <span>
        <strong>{tr.brand.name}</strong>
        {!compact && <small>{tr.brand.tagline}</small>}
      </span>
    </span>
  );
}
