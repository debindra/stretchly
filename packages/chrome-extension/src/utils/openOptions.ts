/**
 * Open the options page at `hash` (e.g. `#dashboard?area=neck`), reusing an
 * already-open options tab instead of stacking duplicates. A hash-only change on
 * the reused tab fires `hashchange`, which the options App listens for.
 */
export async function openOptionsTab(hash: string): Promise<void> {
  const baseUrl = chrome.runtime.getURL('src/options/index.html');
  const targetUrl = baseUrl + hash;
  // Match on the base URL and ignore any hash the tab currently has.
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((t) => t.url?.split('#')[0] === baseUrl);
  if (existing?.id != null) {
    await chrome.tabs.update(existing.id, { active: true, url: targetUrl });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: targetUrl });
  }
}
