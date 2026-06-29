import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppData, GitHubSyncSettings } from '../types/training';
import { isUpgradeableAppData, upgradeAppData } from '../storage/migrations';

const TOKEN_KEY = '@setlog/github-token/v1';
const API_BASE = 'https://api.github.com';

type ContentsResponse = {
  sha: string;
  content?: string;
  encoding?: string;
};

export type GitHubSyncResult = {
  data?: AppData;
  settings: GitHubSyncSettings;
  message: string;
};

function encodeBase64(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

function decodeBase64(base64: string): string {
  const cleaned = base64.replace(/\n/g, '');
  return decodeURIComponent(escape(atob(cleaned)));
}

function syncUrl(settings: GitHubSyncSettings) {
  const path = settings.path.split('/').map(encodeURIComponent).join('/');
  return `${API_BASE}/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${path}`;
}

function assertConfigured(settings: GitHubSyncSettings, token: string) {
  if (!settings.owner.trim()) throw new Error('Preencha o usuario/owner do GitHub.');
  if (!settings.repo.trim()) throw new Error('Preencha o repositorio do GitHub.');
  if (!settings.branch.trim()) throw new Error('Preencha a branch.');
  if (!settings.path.trim()) throw new Error('Preencha o caminho do arquivo.');
  if (!token.trim()) throw new Error('Cole um token do GitHub com permissao Contents: Read and write.');
}

async function requestJson<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`GitHub ${response.status}: ${detail || response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function saveGitHubToken(token: string): Promise<void> {
  if (!token.trim()) await AsyncStorage.removeItem(TOKEN_KEY);
  else await AsyncStorage.setItem(TOKEN_KEY, token.trim());
}

export async function loadGitHubToken(): Promise<string> {
  return await AsyncStorage.getItem(TOKEN_KEY) ?? '';
}

export async function pushAppDataToGitHub(data: AppData, token: string): Promise<GitHubSyncResult> {
  const settings = data.settings.githubSync;
  assertConfigured(settings, token);
  let sha = settings.lastSha;
  try {
    const current = await requestJson<ContentsResponse>(`${syncUrl(settings)}?ref=${encodeURIComponent(settings.branch)}`, token);
    sha = current.sha;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('GitHub 404')) throw error;
  }

  const syncedAt = new Date().toISOString();
  const dataToSync: AppData = {
    ...data,
    settings: {
      ...data.settings,
      githubSync: {
        ...settings,
        enabled: true,
        lastSyncedAt: syncedAt,
        lastSha: sha,
        lastStatus: 'Enviado para GitHub',
      },
    },
  };
  const body = {
    message: `Setlog sync ${syncedAt.slice(0, 19)}`,
    content: encodeBase64(JSON.stringify(dataToSync, null, 2)),
    branch: settings.branch,
    sha,
  };
  const result = await requestJson<{ content: { sha: string } }>(syncUrl(settings), token, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  const nextSettings = {
    ...settings,
    enabled: true,
    lastSyncedAt: syncedAt,
    lastSha: result.content.sha,
    lastStatus: 'Enviado para GitHub',
  };
  return { data: { ...dataToSync, settings: { ...dataToSync.settings, githubSync: nextSettings } }, settings: nextSettings, message: 'Dados enviados para o GitHub.' };
}

export async function pullAppDataFromGitHub(settings: GitHubSyncSettings, token: string): Promise<GitHubSyncResult> {
  assertConfigured(settings, token);
  const result = await requestJson<ContentsResponse>(`${syncUrl(settings)}?ref=${encodeURIComponent(settings.branch)}`, token);
  if (result.encoding !== 'base64' || !result.content) throw new Error('Arquivo no GitHub nao esta em base64.');
  const parsed = JSON.parse(decodeBase64(result.content)) as unknown;
  if (!isUpgradeableAppData(parsed)) throw new Error('Arquivo encontrado, mas nao e um banco Setlog valido.');
  const upgraded = upgradeAppData(parsed);
  if (!upgraded) throw new Error('Nao foi possivel migrar os dados do GitHub.');
  const nextSettings = {
    ...upgraded.settings.githubSync,
    ...settings,
    enabled: true,
    lastSyncedAt: new Date().toISOString(),
    lastSha: result.sha,
    lastStatus: 'Baixado do GitHub',
  };
  return {
    data: { ...upgraded, settings: { ...upgraded.settings, githubSync: nextSettings } },
    settings: nextSettings,
    message: 'Dados baixados do GitHub.',
  };
}
