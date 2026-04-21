import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { router, useFocusEffect } from 'expo-router';
import React from 'react';

import ApiConfig from '@/constants/Config';
import { setUser } from '@/store/userStore'; // Importamos sua nova função!

// IP DO SERVIDOR (Agora gerenciado dinamicamente pela aba Admin!)
export const API_URL = ApiConfig.getApiUrl();

export default function HomeScreen() {
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Carrega o ranking sempre que a tela ganha foco
  useFocusEffect(
    React.useCallback(() => {
      fetch(`${API_URL}/ranking`)
        .then(res => res.json())
        .then(data => {
          setRanking(data.ranking);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }, [])
  );

  const iniciarJogo = () => {
    if (!nome.trim() || !sobrenome.trim()) {
      alert("Por favor, digite seu nome e sobrenome para o Placar!");
      return;
    }
    // SALVA NOSSA "GAVETA" GLOBAL PARA O PLACAR E VALIDAÇÃO
    setUser(nome, sobrenome);

    // Vai para a tela de jogo passando o nome e um TS pra forçar reinicio do Game State
    router.push({
      pathname: '/game',
      params: { nome, sobrenome, ts: Date.now() }
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎧 Qual é a Série!</Text>

      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="Seu Nome"
          placeholderTextColor="#64748b"
          value={nome}
          onChangeText={setNome}
        />
        <TextInput
          style={styles.input}
          placeholder="Seu Sobrenome"
          placeholderTextColor="#64748b"
          value={sobrenome}
          onChangeText={setSobrenome}
        />

        <TouchableOpacity style={styles.button} onPress={iniciarJogo}>
          <Text style={styles.buttonText}>▶ JOGAR AGORA</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.rankingTitle}>🏆 Top Melhores Jogadores</Text>
      <View style={styles.rankingContainer}>
        {loading ? <ActivityIndicator color="#6366f1" /> : (
          ranking.length === 0 ? (
            <Text style={styles.rankingVazio}>Seja o primeiro a jogar!</Text>
          ) : (
            <FlatList
              data={ranking}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item, index }) => (
                <View style={styles.rankingRow}>
                  <Text style={styles.rankingPos}>#{index + 1}</Text>
                  <Text style={styles.rankingName}>{item.nome} {item.sobrenome}</Text>
                  <Text style={styles.rankingScore}>{item.pontuacao} pts</Text>
                </View>
              )}
            />
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0f172a', padding: 20, paddingTop: 60,
  },
  title: {
    fontSize: 32, fontWeight: '900', color: '#f8fafc', textAlign: 'center', marginBottom: 20,
  },
  card: {
    backgroundColor: '#1e293b', padding: 20, borderRadius: 16, marginBottom: 30,
  },
  subtitle: {
    color: '#94a3b8', fontSize: 14, fontWeight: '700', marginBottom: 15, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#0f172a', color: '#fff', padding: 15, borderRadius: 8, marginBottom: 15, fontSize: 16, borderWidth: 1, borderColor: '#334155'
  },
  button: {
    backgroundColor: '#6366f1', padding: 18, borderRadius: 8, alignItems: 'center', marginTop: 5,
  },
  buttonText: {
    color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 1,
  },
  rankingTitle: {
    fontSize: 20, color: '#f8fafc', fontWeight: 'bold', marginBottom: 15,
  },
  rankingContainer: {
    flex: 1, backgroundColor: '#1e293b', borderRadius: 16, padding: 15,
  },
  rankingVazio: {
    color: '#94a3b8', textAlign: 'center', marginTop: 20,
  },
  rankingRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  rankingPos: { color: '#fbbf24', fontWeight: 'bold', width: 40 },
  rankingName: { color: '#e2e8f0', flex: 1 },
  rankingScore: { color: '#10b981', fontWeight: 'bold' }
});
