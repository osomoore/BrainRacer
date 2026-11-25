import { retireLocalProfile } from '../profileManager';
import { listenForProfileChanges, profileEditTime, publishProfileReplacement, rememberProfileEditTime } from './changes';
import { FamilySyncClient } from './client';
import { FakeFamilyServer } from './fake';
import { FamilyApi } from './protocol';
import { applyLocalProfile, listLocalProfileIds, readLocalProfile, rekeyLocalProfile } from './storage';

const SYNC_KEY = 'hub.familySync.v1';
const FAKE_KEY = 'hub.familySyncFake.v1';
const FAKE_SERVER_KEY = 'hub.familySyncFakeServer.v1';
const params = new URLSearchParams(globalThis.location?.search);
const devFake = (import.meta.env.DEV || import.meta.env.VITE_SYNC_TEST_FAKE === '1') && params.get('syncfake') === '1';
const syncUrl = import.meta.env.VITE_SYNC_URL?.trim();
const enabled = !!syncUrl || devFake;
const storage = () => { try { return globalThis.localStorage; } catch { return undefined; } };

function api(): FamilyApi | undefined {
  if (!enabled) return undefined;
  if (!devFake) return new FamilyApi(syncUrl, globalThis.fetch.bind(globalThis));
  const testUrl = import.meta.env.VITE_SYNC_TEST_FAKE === '1'
    ? (globalThis as typeof globalThis & { __familySyncFakeUrl?: string }).__familySyncFakeUrl
    : undefined;
  if (testUrl) return new FamilyApi(testUrl, globalThis.fetch.bind(globalThis));
  let saved: ConstructorParameters<typeof FakeFamilyServer>[0];
  try { saved = JSON.parse(sessionStorage.getItem(FAKE_SERVER_KEY) ?? 'null') ?? undefined; } catch { /* New fake server. */ }
  const server = new FakeFamilyServer(saved, state => {
    try { sessionStorage.setItem(FAKE_SERVER_KEY, JSON.stringify(state)); } catch { /* In-page fallback. */ }
  });
  return new FamilyApi('http://brainracer-sync.test', server.fetch);
}

const online = () => navigator.onLine !== false;
const client = new FamilySyncClient(api(), {
  ids: listLocalProfileIds, read: readLocalProfile, apply: applyLocalProfile, editTime: profileEditTime,
  hide: (id, mergedInto) => {
    if (retireLocalProfile(id, mergedInto)) publishProfileReplacement(id, mergedInto);
  },
  rekey: (oldId, newId) => {
    if (!rekeyLocalProfile(oldId, newId)) return false;
    publishProfileReplacement(oldId, newId);
    return true;
  },
}, enabled ? storage() : undefined, devFake ? FAKE_KEY : SYNC_KEY, online);
const deviceKey = devFake ? FAKE_KEY : SYNC_KEY;

let started = false;
let debounce: ReturnType<typeof setTimeout> | undefined;

export const familySync = {
  enabled,
  get state() { return client.state; },
  subscribe: (listener: () => void) => client.subscribe(listener),
  subscribeProfiles: (listener: (id: string) => void) => client.subscribeProfiles(listener),
  makeFamily: () => client.makeFamily(),
  joinFamily: (code: string) => client.joinFamily(code),
  leaveFamily: () => client.leaveFamily(),
  deleteFamily: () => client.deleteFamily(),
  syncNow: () => client.syncNow(),
  chooseProfile(id: string) { if (enabled && online()) void client.syncNow(id); },
  start() {
    if (!enabled || started) return;
    started = true;
    let watching = false;
    const watch = () => {
      const enrolled = !!client.state.code;
      if (enrolled === watching) return;
      watching = enrolled;
      listenForProfileChanges(enrolled ? (id, deleted, mergedInto) => {
        client.noteChange(id, deleted, mergedInto);
        clearTimeout(debounce);
        debounce = setTimeout(() => { if (online()) void client.flush(); }, 3000);
      } : undefined, enrolled ? id => client.editTime(id) : undefined);
    };
    client.subscribe(watch);
    client.subscribeProfiles(id => {
      const updatedAt = client.editTime(id);
      if (updatedAt !== undefined && readLocalProfile(id)) rememberProfileEditTime(id, updatedAt);
    });
    watch();
    addEventListener('online', () => { client.refreshView(); void client.syncNow(); });
    addEventListener('offline', () => client.refreshView());
    addEventListener('storage', event => { if (event.key === deviceKey) client.reloadDevice(); });
    addEventListener('pageshow', event => {
      if (!event.persisted) return;
      client.reloadDevice();
      if (online()) void client.syncNow();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) client.hide(); });
    addEventListener('pagehide', () => client.hide());
    if (online()) void client.syncNow();
  },
};
