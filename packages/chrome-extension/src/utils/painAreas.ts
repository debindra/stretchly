import { t } from '../i18n';

export type PainArea = 'neck' | 'shoulders' | 'wrists' | 'upperBack' | 'lowerBack' | 'eyes';

export interface PainAreaInfo {
  key: PainArea;
  /** In the active locale; read it at render time, not at module load. */
  readonly label: string;
  /** Cover image; every file in icons/areas/ shares one 480×360 canvas with content at equal visual weight. */
  icon: string;
  /** In the active locale, like `label`. */
  readonly description: string;
}

const area = (key: PainArea, icon: string): PainAreaInfo => ({
  key,
  icon,
  get label() {
    return t(`painArea.${key}`);
  },
  get description() {
    return t(`painArea.${key}.description`);
  },
});

export const PAIN_AREA_INFO: PainAreaInfo[] = [
  area('neck', '/icons/areas/neck.png'),
  area('shoulders', '/icons/areas/shoulders.png'),
  area('wrists', '/icons/areas/wrists.png'),
  area('upperBack', '/icons/areas/upper-back.png'),
  area('lowerBack', '/icons/areas/lower-back.svg'),
  area('eyes', '/icons/areas/eyes.png'),
];

export function isPainArea(value: string | null | undefined): value is PainArea {
  return PAIN_AREA_INFO.some((a) => a.key === value);
}

/** Options-page hash for a view, optionally preselecting a pain area: `#dashboard?area=neck`. */
export function optionsHash(view: string, area?: PainArea): string {
  return area ? `#${view}?area=${area}` : `#${view}`;
}

/** Parse `#view?area=x` into its parts. */
export function parseOptionsHash(hash: string): { view: string; area: PainArea | null } {
  const [view, query = ''] = hash.replace(/^#/, '').split('?');
  const area = new URLSearchParams(query).get('area');
  return { view: view.toLowerCase(), area: isPainArea(area) ? area : null };
}
