import { Activity, ExternalLink } from 'lucide-react';
import { LogoImg } from '../components/LogoImg';

const OPTIONS_URL =
  typeof chrome !== 'undefined' && chrome.runtime?.getURL
    ? chrome.runtime.getURL('src/options/index.html')
    : '';

function openOptionsWithHash(hash: 'dashboard' | 'library') {
  if (OPTIONS_URL && typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.create({ url: `${OPTIONS_URL}#${hash}` });
  } else {
    chrome.runtime?.openOptionsPage?.();
  }
}

export function Popup() {
  return (
    <div className="popup">
      <header className="popup-header">
        <LogoImg height={38} maxWidth={200} className="popup-logo" alt="Stretchly" />
        <p className="popup-subtitle">Instant relief for desk workers — in under 2 minutes</p>
      </header>
      <button onClick={() => openOptionsWithHash('dashboard')} className="popup-cta" type="button">
        <Activity className="popup-cta-icon" aria-hidden />
        Open Stretchly
      </button>
      <div className="popup-divider" role="presentation" />
      <button onClick={() => openOptionsWithHash('library')} className="popup-link" type="button">
        <ExternalLink className="popup-link-icon" aria-hidden />
        Library, Stats &amp; Settings
      </button>
    </div>
  );
}
