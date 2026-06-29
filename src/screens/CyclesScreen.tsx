import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { completedCodes, currentCycleNumber, MAX_CYCLES, nextProgramCode, PROGRAM_SEQUENCE, totalCycleCompletions } from '../data/cycles';
import { colors } from '../theme';
import { loadGitHubToken, pullAppDataFromGitHub, pushAppDataToGitHub, saveGitHubToken } from '../platform/githubSync';
import type { AppData, GitHubSyncSettings, WorkoutSession } from '../types/training';
import { ActionButton, commonStyles, ScreenTitle } from '../ui';

export function CyclesScreen({ history, data, onDataChange, onExport, onImport }: { history: WorkoutSession[]; data: AppData; onDataChange: (data: AppData) => void; onExport: () => void; onImport: () => void }) {
  const currentCycle = currentCycleNumber(history);
  const currentDone = completedCodes(history, currentCycle);
  const totalDone = totalCycleCompletions(history);
  const totalPlanned = MAX_CYCLES * PROGRAM_SEQUENCE.length;
  const overallPercent = Math.round((totalDone / totalPlanned) * 100);
  const [githubToken, setGithubToken] = useState('');
  const [syncStatus, setSyncStatus] = useState(data.settings.githubSync.lastStatus ?? '');
  const sync = data.settings.githubSync;

  useEffect(() => {
    loadGitHubToken().then(setGithubToken).catch(() => setSyncStatus('Nao foi possivel carregar o token local.'));
  }, []);

  function updateGitHubSync(patch: Partial<GitHubSyncSettings>) {
    onDataChange({ ...data, settings: { ...data.settings, githubSync: { ...data.settings.githubSync, ...patch } } });
  }

  async function persistToken(nextToken: string) {
    setGithubToken(nextToken);
    await saveGitHubToken(nextToken);
  }

  async function pushToGitHub() {
    try {
      setSyncStatus('Enviando para GitHub...');
      const result = await pushAppDataToGitHub(data, githubToken);
      if (result.data) onDataChange(result.data);
      setSyncStatus(result.message);
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Falha ao enviar para GitHub.');
    }
  }

  async function pullFromGitHub() {
    try {
      setSyncStatus('Baixando do GitHub...');
      const result = await pullAppDataFromGitHub(sync, githubToken);
      if (result.data) onDataChange(result.data);
      setSyncStatus(result.message);
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Falha ao baixar do GitHub.');
    }
  }

  return (
    <ScrollView contentContainerStyle={commonStyles.screen}>
      <ScreenTitle eyebrow="JORNADA DE 16 CICLOS" title={`Ciclo ${currentCycle}`} subtitle="Sem calendário fixo: avance no seu próprio ritmo" />

      <View style={styles.hero}>
        <View style={commonStyles.between}>
          <View>
            <Text style={styles.heroLabel}>PROGRESSO DO CICLO ATUAL</Text>
            <Text style={styles.heroValue}>{currentDone.length}<Text style={styles.heroTotal}> / {PROGRAM_SEQUENCE.length}</Text></Text>
          </View>
          <View style={styles.nextBadge}><Text style={styles.nextLabel}>PRÓXIMO</Text><Text style={styles.nextValue}>{nextProgramCode(history)}</Text></View>
        </View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${(currentDone.length / PROGRAM_SEQUENCE.length) * 100}%` }]} /></View>
        <Text style={styles.saveNote}>● Cada treino finalizado é salvo automaticamente neste dispositivo.</Text>
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Treinos do ciclo {currentCycle}</Text>
        <View style={styles.programGrid}>
          {PROGRAM_SEQUENCE.map(code => {
            const done = currentDone.includes(code);
            return (
              <View key={code} style={[styles.program, done && styles.programDone]}>
                <Text style={[styles.programCode, done && styles.programCodeDone]}>{code}</Text>
                <Text style={styles.programStatus}>{done ? 'CONCLUÍDO' : 'PENDENTE'}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={commonStyles.card}>
        <View style={commonStyles.between}>
          <Text style={commonStyles.cardTitle}>Jornada completa</Text>
          <Text style={styles.percent}>{overallPercent}%</Text>
        </View>
        <Text style={[commonStyles.muted, { marginTop: 4 }]}>{totalDone} de {totalPlanned} treinos concluídos</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${overallPercent}%` }]} /></View>
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Backup dos dados</Text>
        <Text style={[commonStyles.muted, { marginTop: 6 }]}>Inclui prescrições, treino ativo, histórico, ciclos, observações e todos os sets registrados. Guarde o arquivo no iCloud ou no app Arquivos.</Text>
        <ActionButton label="EXPORTAR BACKUP COMPLETO" onPress={onExport} />
        <ActionButton label="RESTAURAR BACKUP" tone="secondary" onPress={onImport} />
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Banco no GitHub por usuario</Text>
        <Text style={[commonStyles.muted, { marginTop: 6 }]}>Use um repositorio seu como banco privado. O token fica salvo somente neste aparelho e nao entra no arquivo de sync.</Text>
        <View style={styles.syncGrid}>
          <TextInput value={sync.owner} onChangeText={owner => updateGitHubSync({ owner })} placeholder="usuario ou org" placeholderTextColor={colors.textDim} autoCapitalize="none" style={styles.input} />
          <TextInput value={sync.repo} onChangeText={repo => updateGitHubSync({ repo })} placeholder="repositorio" placeholderTextColor={colors.textDim} autoCapitalize="none" style={styles.input} />
        </View>
        <View style={styles.syncGrid}>
          <TextInput value={sync.branch} onChangeText={branch => updateGitHubSync({ branch })} placeholder="branch" placeholderTextColor={colors.textDim} autoCapitalize="none" style={styles.input} />
          <TextInput value={sync.path} onChangeText={path => updateGitHubSync({ path })} placeholder="data/setlog.json" placeholderTextColor={colors.textDim} autoCapitalize="none" style={styles.input} />
        </View>
        <TextInput value={githubToken} onChangeText={persistToken} placeholder="GitHub fine-grained token (Contents: Read/Write)" placeholderTextColor={colors.textDim} autoCapitalize="none" secureTextEntry style={styles.input} />
        {sync.lastSyncedAt ? <Text style={styles.syncStatus}>Ultimo sync: {new Date(sync.lastSyncedAt).toLocaleString('pt-BR')}</Text> : null}
        {syncStatus ? <Text style={styles.syncStatus}>{syncStatus}</Text> : null}
        <ActionButton label="ENVIAR BANCO PARA GITHUB" onPress={pushToGitHub} />
        <ActionButton label="BAIXAR BANCO DO GITHUB" tone="secondary" onPress={pullFromGitHub} />
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Todos os ciclos</Text>
        {Array.from({ length: MAX_CYCLES }, (_, index) => index + 1).map(cycle => {
          const done = completedCodes(history, cycle);
          const complete = done.length === PROGRAM_SEQUENCE.length;
          return (
            <View key={cycle} style={styles.cycleRow}>
              <View style={[styles.cycleNumber, complete && styles.cycleNumberDone]}><Text style={styles.cycleNumberText}>{cycle}</Text></View>
              <View style={{ flex: 1 }}>
                <View style={commonStyles.between}>
                  <Text style={styles.cycleTitle}>Ciclo {cycle}</Text>
                  <Text style={[styles.cycleCount, complete && styles.complete]}>{done.length}/{PROGRAM_SEQUENCE.length}</Text>
                </View>
                <View style={styles.miniTrack}><View style={[styles.miniFill, { width: `${(done.length / PROGRAM_SEQUENCE.length) * 100}%` }]} /></View>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.card, borderColor: colors.accentBorder, borderWidth: 1, borderRadius: 16, padding: 17, marginTop: 10 },
  heroLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  heroValue: { color: colors.text, fontSize: 34, fontWeight: '800', marginTop: 4 },
  heroTotal: { color: colors.muted, fontSize: 17 },
  nextBadge: { backgroundColor: colors.accentSoft, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 9, alignItems: 'center' },
  nextLabel: { color: colors.muted, fontSize: 8, fontWeight: '800' },
  nextValue: { color: colors.accent, fontSize: 20, fontWeight: '800', marginTop: 2 },
  progressTrack: { height: 8, backgroundColor: colors.elevated, borderRadius: 4, overflow: 'hidden', marginTop: 14 },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 4 },
  saveNote: { color: colors.success, fontSize: 9, marginTop: 11 },
  programGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 },
  program: { width: '22.5%', minHeight: 64, borderColor: colors.border, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  programDone: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  programCode: { color: colors.muted, fontSize: 17, fontWeight: '800' },
  programCodeDone: { color: colors.accent },
  programStatus: { color: colors.textDim, fontSize: 6, fontWeight: '800', marginTop: 4 },
  percent: { color: colors.accent, fontSize: 22, fontWeight: '800' },
  cycleRow: { flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 11, marginTop: 7 },
  cycleNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  cycleNumberDone: { backgroundColor: colors.accent },
  cycleNumberText: { color: colors.text, fontWeight: '800', fontSize: 11 },
  cycleTitle: { color: colors.text, fontSize: 12, fontWeight: '700' },
  cycleCount: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  complete: { color: colors.accent },
  syncGrid: { flexDirection: 'row', gap: 8, marginTop: 10 },
  input: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated, color: colors.text, paddingHorizontal: 12, marginTop: 10, fontSize: 12, fontWeight: '700' },
  syncStatus: { color: colors.muted, fontSize: 10, marginTop: 10, lineHeight: 15 },
  miniTrack: { height: 4, backgroundColor: colors.elevated, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  miniFill: { height: '100%', backgroundColor: colors.accent },
});
