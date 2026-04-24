import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence,
  withTiming, withSpring, interpolate, interpolateColor, Easing, FadeIn,
  FadeInDown, FadeInUp, ZoomIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import ApiConfig from '@/constants/Config';
import { setUser } from '@/store/userStore';

export const API_URL = ApiConfig.getApiUrl();

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Bolhas de Fundo ─────────────────────────────────────────────────────────
function FloatingOrb({ delay, x, size, color }: { delay: number; x: number; size: number; color: string }) {
  const translateY = useSharedValue(SCREEN_H + size);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const duration = 8000 + Math.random() * 6000;
    setTimeout(() => {
      translateY.value = withRepeat(
        withTiming(-size - 100, { duration, easing: Easing.linear }),
        -1,
        false
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.15, { duration: 1000 }),
          withTiming(0.06, { duration: duration - 2000 }),
          withTiming(0, { duration: 1000 }),
        ),
        -1
      );
    }, delay);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{
        position: 'absolute', left: x, width: size, height: size,
        borderRadius: size / 2, backgroundColor: color,
      }, style]} />
  );
}

const ORBS = [
  { x: 20, size: 120, color: '#6366f1', delay: 0 },
  { x: SCREEN_W * 0.5, size: 80, color: '#8b5cf6', delay: 2000 },
  { x: SCREEN_W * 0.75, size: 150, color: '#3b82f6', delay: 4000 },
  { x: SCREEN_W * 0.15, size: 60, color: '#06b6d4', delay: 1500 },
  { x: SCREEN_W * 0.6, size: 100, color: '#6366f1', delay: 3500 },
];

// ─── Linha do Ranking ─────────────────────────────────────────────────────────
function RankingRow({ item, index }: { item: any; index: number }) {
  const medals = ['🥇', '🥈', '🥉'];
  const medal = medals[index] ?? `#${index + 1}`;
  const isTop3 = index < 3;

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()} style={[styles.rankingRow, isTop3 && styles.rankingRowTop]}>
      <Text style={[styles.rankingPos, isTop3 && styles.rankingPosTop]}>{medal}</Text>
      <Text style={styles.rankingName}>{item.nome} {item.sobrenome}</Text>
      <View style={styles.scoreBadge}>
        <Text style={styles.rankingScore}>{item.pontuacao} pts</Text>
      </View>
    </Animated.View>
  );
}

// ─── Tela Principal ───────────────────────────────────────────────────────────
export default function HomeScreen() {
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isNavigating = useRef(false);

  // Animações do botão
  const btnScale = useSharedValue(1);
  const btnGlow = useSharedValue(0);
  const titleScale = useSharedValue(0.8);
  const titleOpacity = useSharedValue(0);

  const nomeBorder = useSharedValue(0);
  const sobrenomeBorder = useSharedValue(0);

  const nomeInputStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      nomeBorder.value,
      [0, 1],
      ['#1e293b', '#6366f1']
    ),
  }));

  const sobrenomeInputStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      sobrenomeBorder.value,
      [0, 1],
      ['#1e293b', '#6366f1']
    ),
  }));

  useEffect(() => {
    // Entrada do título
    titleScale.value = withSpring(1, { damping: 12, stiffness: 100 });
    titleOpacity.value = withTiming(1, { duration: 800 });

    // Pulso do botão
    btnGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1
    );
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetch(`${API_URL}/ranking`)
        .then(res => res.json())
        .then(data => { setRanking(data.ranking); setLoading(false); })
        .catch(() => setLoading(false));
    }, [])
  );

  const iniciarJogo = () => {
    if (isNavigating.current) return;

    if (!nome.trim() || !sobrenome.trim()) {
      Alert.alert('Atenção', 'Por favor, digite seu nome e sobrenome para o Placar!');
      // Shake do botão
      btnScale.value = withSequence(
        withTiming(0.95, { duration: 60 }),
        withTiming(1.05, { duration: 60 }),
        withTiming(0.95, { duration: 60 }),
        withSpring(1),
      );
      return;
    }
    // Animação de press
    btnScale.value = withSequence(withTiming(0.92, { duration: 100 }), withSpring(1));
    setUser(nome, sobrenome);
    isNavigating.current = true;
    setTimeout(() => { isNavigating.current = false; }, 2000);
    router.push({ pathname: '/game', params: { nome, sobrenome, ts: Date.now() } });
  };

  const btnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
    shadowOpacity: interpolate(btnGlow.value, [0, 1], [0.3, 0.8]),
    shadowRadius: interpolate(btnGlow.value, [0, 1], [10, 25]),
  }));

  const titleAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: titleScale.value }],
    opacity: titleOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* Fundo com gradiente */}
      <LinearGradient
        pointerEvents="none"
        colors={['#0a0a1a', '#0f172a', '#1a0533']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Orbs flutuantes */}
      {ORBS.map((o, i) => <FloatingOrb key={i} {...o} />)}

      {/* ── Título ── */}
      <Animated.View style={[styles.heroSection, titleAnimStyle]}>
        <Text style={styles.emojiTitle}>🎧</Text>
        <Text style={styles.mainTitle}>Qual é a Série?</Text>
        <Text style={styles.subtitle}>Reconheça a trilha sonora e conquiste o topo!</Text>
      </Animated.View>

      {/* ── Card de entrada ── */}
      <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.card}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(99,102,241,0.15)', 'rgba(139,92,246,0.05)']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />

        <Animated.View style={[styles.inputWrapper, nomeInputStyle]}>
          <Text style={styles.inputIcon}>👤</Text>
          <TextInput
            style={styles.input}
            placeholder="Seu Nome"
            placeholderTextColor="#475569"
            value={nome}
            onChangeText={setNome}
            onFocus={() => {
              nomeBorder.value = withTiming(1, { duration: 180 });
            }}
            onBlur={() => {
              nomeBorder.value = withTiming(0, { duration: 180 });
            }}
          />
        </Animated.View>

        <Animated.View style={[styles.inputWrapper, sobrenomeInputStyle]}>
          <Text style={styles.inputIcon}>✍️</Text>
          <TextInput
            style={styles.input}
            placeholder="Seu Sobrenome"
            placeholderTextColor="#475569"
            value={sobrenome}
            onChangeText={setSobrenome}
            onFocus={() => {
              sobrenomeBorder.value = withTiming(1, { duration: 180 });
            }}
            onBlur={() => {
              sobrenomeBorder.value = withTiming(0, { duration: 180 });
            }}
          />
        </Animated.View>

        <Animated.View style={btnAnimStyle}>
          <TouchableOpacity onPress={iniciarJogo} activeOpacity={0.85} style={styles.playButtonOuter}>
            <LinearGradient
              colors={['#818cf8', '#6366f1', '#4f46e5']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.playButton}
            >
              <Text style={styles.playIcon}>▶</Text>
              <Text style={styles.playText}>JOGAR AGORA</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* ── Ranking ── */}
      <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.rankingSection}>
        <View style={styles.rankingHeader}>
          <Text style={styles.rankingTitle}>🏆 Hall da Fama</Text>
          <View style={styles.rankingBadge}><Text style={styles.rankingBadgeText}>TOP 10</Text></View>
        </View>

        <View style={styles.rankingContainer}>
          {loading ? (
            <ActivityIndicator color="#6366f1" size="large" style={{ marginTop: 20 }} />
          ) : ranking.length === 0 ? (
            <Animated.Text entering={ZoomIn} style={styles.rankingVazio}>
              🎯 Seja o primeiro a jogar!
            </Animated.Text>
          ) : (
            <FlatList
              data={ranking}
              keyExtractor={(_, i) => i.toString()}
              renderItem={({ item, index }) => <RankingRow item={item} index={index} />}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },

  heroSection: { alignItems: 'center', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  emojiTitle: { fontSize: 56, marginBottom: 8 },
  mainTitle: {
    fontSize: 34, fontWeight: '900', color: '#f8fafc', textAlign: 'center',
    letterSpacing: 1, textShadowColor: 'rgba(99,102,241,0.8)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20,
  },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 6, fontStyle: 'italic' },

  card: {
    marginHorizontal: 20, borderRadius: 24, padding: 20,
    backgroundColor: 'rgba(30,41,59,0.8)',
    borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)',
    overflow: 'hidden',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10,
  },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0f172a', borderRadius: 12, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#1e293b', paddingHorizontal: 14,
  },
  inputIcon: { fontSize: 18, marginRight: 10 },
  input: { flex: 1, color: '#f1f5f9', paddingVertical: 14, fontSize: 16 },

  playButtonOuter: {
    borderRadius: 14, marginTop: 4, overflow: 'hidden',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12,
  },
  playButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
  playIcon: { fontSize: 16, color: '#fff' },
  playText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 2 },

  rankingSection: { flex: 1, marginHorizontal: 20, marginTop: 18, marginBottom: 10 },
  rankingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  rankingTitle: { fontSize: 18, color: '#f8fafc', fontWeight: '800' },
  rankingBadge: { backgroundColor: 'rgba(99,102,241,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#6366f1' },
  rankingBadgeText: { color: '#818cf8', fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  rankingContainer: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: 18, padding: 12, borderWidth: 1, borderColor: 'rgba(99,102,241,0.15)' },
  rankingVazio: { color: '#475569', textAlign: 'center', marginTop: 30, fontSize: 15 },

  rankingRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(51,65,85,0.5)',
    borderRadius: 10,
  },
  rankingRowTop: { backgroundColor: 'rgba(99,102,241,0.08)' },
  rankingPos: { color: '#64748b', fontWeight: 'bold', width: 40, fontSize: 14 },
  rankingPosTop: { fontSize: 20 },
  rankingName: { color: '#e2e8f0', flex: 1, fontSize: 14, fontWeight: '600' },
  scoreBadge: { backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
  rankingScore: { color: '#10b981', fontWeight: '800', fontSize: 13 },
});