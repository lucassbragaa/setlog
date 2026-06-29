import type { AppData } from '../types/training';
import { isUpgradeableAppData, upgradeAppData } from '../storage/migrations';

type BackupEnvelope = {
  format: 'setlog-backup';
  version: 2;
  exportedAt: string;
  data: AppData;
};

function parseBackup(value: unknown): AppData | null {
  const restored = value && typeof value === 'object' && 'format' in value && (value as BackupEnvelope).format === 'setlog-backup'
    ? (value as BackupEnvelope).data
    : value;
  if (!isUpgradeableAppData(restored)) return null;
  return upgradeAppData(restored);
}

export async function exportBackup(data: AppData): Promise<void> {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const envelope: BackupEnvelope = {
    format: 'setlog-backup',
    version: 2,
    exportedAt: new Date().toISOString(),
    data,
  };
  const contents = JSON.stringify(envelope, null, 2);
  const filename = `setlog-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([contents], filename, { type: 'application/json' });
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Backup completo do Setlog' });
      return;
    } catch {
      // Se o compartilhamento for cancelado ou indisponivel, oferece o download comum.
    }
  }
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function chooseBackupFile(): Promise<AppData | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        const restored = parseBackup(JSON.parse(await file.text()));
        if (!restored) {
          window.alert('Este arquivo nao e um backup valido do Setlog.');
          return resolve(null);
        }
        const confirmed = window.confirm('Restaurar este backup substituira os dados atuais do Setlog neste aparelho. Continuar?');
        resolve(confirmed ? restored : null);
      } catch {
        window.alert('Nao foi possivel ler este backup.');
        resolve(null);
      } finally {
        input.remove();
      }
    };
    document.body.appendChild(input);
    input.click();
  });
}
