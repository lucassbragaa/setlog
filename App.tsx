import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.shell}>
        <Text style={styles.kicker}>SETLOG</Text>
        <Text style={styles.title}>Rebuild mode</Text>
        <Text style={styles.copy}>
          Tudo foi zerado. A partir daqui vamos reconstruir o aplicativo do zero,
          sem reaproveitar a lógica, telas ou visual anteriores.
        </Text>
        <View style={styles.rule} />
        <Text style={styles.note}>Próximo passo: desenhar a arquitetura nova usando apenas o Hevy como referência.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050505',
  },
  shell: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  kicker: {
    color: '#8A8A8A',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.5,
    marginBottom: 14,
  },
  copy: {
    color: '#D8D8D8',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  rule: {
    height: 1,
    backgroundColor: '#262626',
    marginVertical: 26,
  },
  note: {
    color: '#8A8A8A',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
});
