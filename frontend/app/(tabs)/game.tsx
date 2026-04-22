import {
  StyleSheet, Text, View, TouchableOpacity,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Audio } from 'expo-av';
import { API_URL } from './index';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
  withSequence, withRepeat, interpolate, interpolateColor,
  Easing, FadeIn, FadeInDown, ZoomIn, runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const TEMPO_TOTAL = 15;

// ─── Botão de Opção Animado ───────────────────────────────────────────────────
function OpcaoBtn({
  opcao, index, onPress, disabled, status,
}: {
  opcao: string; index: number; onPress: () => void;
  disabled: boolean; status: 'idle' | 'correct' | 'wrong';
}) {
  const scale = useSharedValue(1);
  const borderGlow = useSharedValue(0);

  useEffect(() => {
    if (status === 'correct') {
      borderGlow.value = withRepeat(withSequence(
        withTiming(1, { duration: 300 }), withTiming(0.4, { duration: 300 })
      ), 3);
    } else if (status === 'wrong') {
      scale.value = withSequence(
        withTiming(0.95, { duration: 60 }), withTiming(1.02, { duration: 60 }),
        withTiming(0.97, { duration: 60 }), withSpring(1),
      );
    }
  }, [status]);

  const handlePress = () => {
    scale.value = withSequence(withTiming(0.93, { duration: 80 }), withSpring(1, { damping: 10 }));
    onPress();
  };

  const animStyle = useAnimatedStyle(() => {
    const bg = status === 'correct'
      ? interpolateColor(borderGlow.value, [0, 1], ['#064e3b', '#065f46'])
      : status === 'wrong'
      ? '#3b0000'
      : '#1e293b';

    return {
      transform: [{ scale: scale.value }],
      backgroundColor: bg,
      borderColor: status === 'correct'
        ? interpolateColor(borderGlow.value, [0, 1], ['#10b981', '#34d399'])
        : status === 'wrong' ? '#ef4444' : 'rgba(99,102,241,0.3)',
      opacity: disabled && status === 'idle' ? 0.45 : 1,
    };
  });

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80).springify()}
      style={[styles.btnWrapper, animStyle]}
    >
      <TouchableOpacity
        style={styles.btnInner}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.8}
      >
        {status === 'correct' && <Text style={styles.btnIcon}>✅</Text>}
        {status === 'wrong' && <Text style={styles.btnIcon}>❌</Text>}
        <Text style={[styles.btnTexto, status === 'correct' && { color: '#34d399' }, status === 'wrong' && { color: '#f87171' }]}>
          {opcao}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Barra de Tempo ───────────────────────────────────────────────────────────
function TimerBar({ timeLeft, isRunning }: { timeLeft: number; isRunning: boolean }) {
  const shakeX = useSharedValue(0);
  const prevTimeLeft = useRef(timeLeft);

  useEffect(() => {
    if (timeLeft <= 5 && timeLeft > 0 && isRunning && timeLeft !== prevTimeLeft.current) {
      shakeX.value = withSequence(
        withTiming(-3, { duration: 60 }), withTiming(3, { duration: 60 }),
        withTiming(-2, { duration: 60 }), withTiming(0, { duration: 60 }),
      );
    }
    prevTimeLeft.current = timeLeft;
  }, [timeLeft]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const pct = (timeLeft / TEMPO_TOTAL) * 100;
  const isCritical = timeLeft <= 5;

  const fillStyle = useAnimatedStyle(() => ({
    width: `${pct}%` as any,
    backgroundColor: isCritical ? '#ef4444' : '#6366f1',
  }));

  return (
    <Animated.View style={[styles.timerWrapper, containerStyle]}>
      <View style={styles.timerRow}>
        <Text style={styles.timerLabel}>⏱</Text>
        <Text style={[styles.timerNum, isCritical && { color: '#ef4444' }]}>
          00:{timeLeft.toString().padStart(2, '0')}
        </Text>
      </View>
      <View style={styles.progressBg}>
        <Animated.View style={[styles.progressFill, fillStyle]} />
      </View>
    </Animated.View>
  );
}

// ─── Tela do Jogo ─────────────────────────────────────────────────────────────
export default function GameScreen() {
  const { nome, sobrenome, ts } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isSmall = width < 600;

  const [loading, setLoading] = useState(true);
  const [pergunta, setPergunta] = useState<any>(null);
  const [pontos, setPontos] = useState(0);
  const [qtdAcertos, setQtdAcertos] = useState(0);
  const [tocadas, setTocadas] = useState<number[]>([]);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [statusAviso, setStatusAviso] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [acertouIndex, setAcertouIndex] = useState<number | null>(null);
  const [errouIndex, setErrouIndex] = useState<number | null>(null);

  const soundRef = useRef<Audio.Sound | null>(null);
  const transitioning = useRef(false);

  // Cronômetro
  const [timeLeft, setTimeLeft] = useState(TEMPO_TOTAL);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Animações de UI
  const headerScore = useSharedValue(1);
  const modalScale = useSharedValue(0.8);
  const modalOpacity = useSharedValue(0);

  // ── Focus / Blur ──
  useFocusEffect(
    useCallback(() => {
      async function resumeSound() {
        if (transitioning.current) return;
        const cur = soundRef.current;
        if (cur) {
          try {
            const st = await cur.getStatusAsync();
            if (st.isLoaded && !st.isPlaying && !statusAviso.includes('✅') && !statusAviso.includes('❌')) {
              await cur.playAsync();
              setIsTimerRunning(true);
            }
          } catch (e) {}
        }
      }
      resumeSound();
      return () => {
        async function pauseSound() {
          const cur = soundRef.current;
          if (cur) {
            try { const st = await cur.getStatusAsync(); if (st.isLoaded && st.isPlaying) await cur.pauseAsync(); } catch (e) {}
            setIsTimerRunning(false);
          }
        }
        pauseSound();
      };
    }, [statusAviso])
  );

  // ── Timer ──
  useEffect(() => {
    let iv: ReturnType<typeof setInterval>;
    if (isTimerRunning && timeLeft > 0) {
      iv = setInterval(() => setTimeLeft(p => p - 1), 1000);
    } else if (isTimerRunning && timeLeft === 0) {
      responder('TEMPO_ESGOTADO');
    }
    return () => clearInterval(iv);
  }, [isTimerRunning, timeLeft]);

  // ── Buscar Pergunta ──
  const buscarPergunta = async (acertos: number, hist: number[]) => {
    transitioning.current = true;
    setLoading(true);
    setIsTimerRunning(false);
    setTimeLeft(TEMPO_TOTAL);
    setStatusAviso('');
    setAcertouIndex(null);
    setErrouIndex(null);

    try {
      const res = await fetch(`${API_URL}/pergunta?acertos=${acertos}&tocadas=${hist.join(',')}`);
      const data = await res.json();

      if (data.fim_de_jogo) {
        setLoading(false);
        setStatusAviso('🏆 INCRÍVEL! VOCÊ ZEROU NOSSO BANCO DE MÚSICAS!');
        try {
          await fetch(`${API_URL}/score`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, sobrenome, pontuacao: pontos }),
          });
        } catch (e) {}
        setTimeout(() => router.back(), 4000);
        return;
      }

      setPergunta(data);
      setLoading(false);
      setIsTimerRunning(true);
      tocarAudio(data.audio_url);
    } catch (err) {
      console.error('Erro buscarPergunta:', err);
      setLoading(false);
      transitioning.current = false;
    }
  };

  const tocarAudio = async (url: string) => {
    const safety = setTimeout(() => {
      transitioning.current = false;
      setLoading(false);
      setIsTimerRunning(true);
    }, 3000);

    const prev = soundRef.current;
    if (prev) { try { await prev.unloadAsync(); } catch (e) {} soundRef.current = null; }

    try {
      const { sound: ns } = await Audio.Sound.createAsync(
        { uri: encodeURI(`${API_URL}${url}`) },
        { shouldPlay: true, volume: 1.0 }
      );
      soundRef.current = ns;
      setSound(ns);
      clearTimeout(safety);
      transitioning.current = false;
      setIsTimerRunning(true);
      setLoading(false);
    } catch (err) {
      clearTimeout(safety);
      transitioning.current = false;
      setIsTimerRunning(true);
      setLoading(false);
    }
  };

  // ── Init / Cleanup ──
  useEffect(() => {
    setPontos(0); setQtdAcertos(0); setTocadas([]); setStatusAviso('');
    buscarPergunta(0, []);
    return () => {
      if (soundRef.current) { soundRef.current.unloadAsync().catch(() => {}); soundRef.current = null; }
    };
  }, [ts]);

  // ── Responder ──
  const responder = async (opcao: string) => {
    if (!pergunta) return;
    setIsTimerRunning(false);

    if (opcao === pergunta.serie_correta) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const idx = pergunta.opcoes.indexOf(opcao);
      setAcertouIndex(idx);

      let pts = 100;
      if (timeLeft < TEMPO_TOTAL - 2) pts = Math.round((timeLeft / (TEMPO_TOTAL - 2)) * 100);
      const np = pontos + pts, na = qtdAcertos + 1, nh = [...tocadas, pergunta.id];

      // Score animado
      headerScore.value = withSequence(withSpring(1.3, { damping: 5 }), withSpring(1));

      setPontos(np); setQtdAcertos(na); setTocadas(nh);
      setStatusAviso(`✅ Acertou! +${pts} pontos`);
      setTimeout(() => buscarPergunta(na, nh), 1200);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (opcao !== 'TEMPO_ESGOTADO') {
        const idx = pergunta.opcoes.indexOf(opcao);
        setErrouIndex(idx);
      }
      setStatusAviso(opcao === 'TEMPO_ESGOTADO'
        ? `⏰ Tempo!\nEra: ${pergunta.serie_correta}`
        : `❌ Errou!\nEra: ${pergunta.serie_correta}`);

      const cur = soundRef.current;
      if (cur) { try { await cur.stopAsync(); } catch (e) {} }

      try {
        await fetch(`${API_URL}/score`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome, sobrenome, pontuacao: pontos }),
        });
      } catch (e) {}

      // Abre modal com animação
      modalScale.value = 0.7; modalOpacity.value = 0;
      setTimeout(() => {
        setShowModal(true);
        modalScale.value = withSpring(1, { damping: 12 });
        modalOpacity.value = withTiming(1, { duration: 300 });
      }, 600);
    }
  };

  const voltarParaMenu = () => { setShowModal(false); router.back(); };

  const scoreStyle = useAnimatedStyle(() => ({ transform: [{ scale: headerScore.value }] }));
  const modalStyle = useAnimatedStyle(() => ({ transform: [{ scale: modalScale.value }], opacity: modalOpacity.value }));

  const isCritical = timeLeft <= 5;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0a0a1a', '#0f172a', '#120a24']} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <Animated.View entering={FadeIn} style={styles.header}>
        <LinearGradient colors={['rgba(30,41,59,0.9)', 'rgba(15,23,42,0.9)']} style={styles.headerGrad}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerLabel}>JOGADOR</Text>
            <Text style={styles.playerName}>🎮 {nome}</Text>
          </View>
          <Animated.View style={[styles.scoreBox, scoreStyle]}>
            <LinearGradient colors={['#fbbf24', '#f59e0b']} style={styles.scoreGrad}>
              <Text style={styles.scoreLabel}>SCORE</Text>
              <Text style={styles.scoreValue}>{pontos}</Text>
            </LinearGradient>
          </Animated.View>
        </LinearGradient>
      </Animated.View>

      {/* Título */}
      <Animated.View entering={FadeIn.delay(100)} style={styles.titleArea}>
        <Text style={styles.title}>🎵 Qual é a Série?</Text>
        {!!statusAviso && (
          <Animated.View entering={ZoomIn} style={[styles.statusBox, statusAviso.includes('✅') && styles.statusBoxOk, statusAviso.includes('❌') && styles.statusBoxErr, statusAviso.includes('⏰') && styles.statusBoxErr]}>
            <Text style={styles.statusText}>{statusAviso}</Text>
          </Animated.View>
        )}
      </Animated.View>

      {/* Timer */}
      <View style={styles.timerSection}>
        {loading
          ? <ActivityIndicator size="small" color="#6366f1" />
          : <TimerBar timeLeft={timeLeft} isRunning={isTimerRunning} />
        }
      </View>

      {/* Opções */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Carregando música...</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {pergunta?.opcoes.map((opcao: string, i: number) => (
            <OpcaoBtn
              key={i} opcao={opcao} index={i}
              onPress={() => responder(opcao)}
              disabled={loading || !!statusAviso}
              status={i === acertouIndex ? 'correct' : i === errouIndex ? 'wrong' : 'idle'}
            />
          ))}
        </View>
      )}

      {/* Modal Game Over */}
      {showModal && (
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalCard, modalStyle]}>
            <LinearGradient colors={['#1e293b', '#0f172a']} style={StyleSheet.absoluteFillObject} />
            <Text style={styles.modalEmoji}>🎬</Text>
            <Text style={styles.modalTitle}>Você Sabia?</Text>

            {pergunta?.detalhes?.nome_pt ? (
              <>
                <Text style={styles.modalSerie}>{pergunta.detalhes.nome_pt}</Text>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoChip}>📺 {pergunta.detalhes.genero}</Text>
                  <Text style={styles.modalInfoChip}>📅 {pergunta.detalhes.ano}</Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoChip}>🎞 {pergunta.detalhes.temporadas} Temp.</Text>
                  <Text style={styles.modalInfoChip}>📺 {pergunta.detalhes.episodios} Eps.</Text>
                </View>
                <Text style={styles.modalElenco}>⭐ {pergunta.detalhes.elenco?.join(' • ')}</Text>
                <View style={styles.curiosityBox}>
                  <Text style={styles.curiosityText}>"{pergunta.detalhes.curiosidade}"</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalSerie}>{pergunta?.serie_correta}</Text>
                <View style={styles.curiosityBox}>
                  <Text style={styles.curiosityText}>Um Clássico Absoluto da Televisão!</Text>
                </View>
              </>
            )}

            <TouchableOpacity onPress={voltarParaMenu} activeOpacity={0.85}>
              <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.modalBtn}>
                <Text style={styles.modalBtnText}>🏆 FINALIZAR E VER RANKING</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },

  // Header
  header: { marginTop: 50, marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', elevation: 8, shadowColor: '#6366f1', shadowOpacity: 0.2, shadowRadius: 12 },
  headerGrad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)', borderRadius: 18 },
  headerLeft: {},
  headerLabel: { color: '#475569', fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  playerName: { color: '#f1f5f9', fontSize: 16, fontWeight: '800', marginTop: 2 },
  scoreBox: { borderRadius: 14, overflow: 'hidden' },
  scoreGrad: { paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' },
  scoreLabel: { color: 'rgba(0,0,0,0.5)', fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  scoreValue: { color: '#0f172a', fontSize: 22, fontWeight: '900' },

  // Título e status
  titleArea: { alignItems: 'center', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 4 },
  title: { fontSize: 24, color: '#f8fafc', fontWeight: '900', letterSpacing: 0.5, textShadowColor: 'rgba(99,102,241,0.6)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  statusBox: { marginTop: 10, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' },
  statusBoxOk: { backgroundColor: 'rgba(4,120,87,0.2)', borderColor: '#10b981' },
  statusBoxErr: { backgroundColor: 'rgba(127,29,29,0.2)', borderColor: '#ef4444' },
  statusText: { color: '#f1f5f9', fontSize: 14, fontWeight: '700', textAlign: 'center' },

  // Timer
  timerSection: { height: 70, justifyContent: 'center', paddingHorizontal: 16, marginTop: 8 },
  timerWrapper: {},
  timerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  timerLabel: { fontSize: 16 },
  timerNum: { fontSize: 22, fontWeight: '900', color: '#f8fafc' },
  progressBg: { height: 10, backgroundColor: '#1e293b', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)' },
  progressFill: { height: '100%', borderRadius: 10 },

  // Opções
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#475569', fontSize: 14, marginTop: 8 },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 6, justifyContent: 'space-between', alignContent: 'flex-start' },
  btnWrapper: { width: '48%', marginBottom: 12, borderRadius: 16, borderWidth: 1.5, overflow: 'hidden', shadowColor: '#6366f1', shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  btnInner: { paddingVertical: 26, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  btnIcon: { fontSize: 16 },
  btnTexto: { color: '#f1f5f9', fontSize: 15, fontWeight: '800', textAlign: 'center' },

  // Modal
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,10,24,0.92)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 50 },
  modalCard: { width: '100%', maxWidth: 480, borderRadius: 24, padding: 24, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(99,102,241,0.5)', elevation: 20, shadowColor: '#6366f1', shadowOpacity: 0.5, shadowRadius: 20 },
  modalEmoji: { fontSize: 40, textAlign: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#fbbf24', textAlign: 'center', marginBottom: 12 },
  modalSerie: { fontSize: 22, color: '#f8fafc', fontWeight: '900', textAlign: 'center', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 },
  modalInfoRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 6 },
  modalInfoChip: { backgroundColor: 'rgba(99,102,241,0.15)', color: '#94a3b8', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, fontSize: 13, fontWeight: '600', borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' },
  modalElenco: { color: '#64748b', textAlign: 'center', fontSize: 13, marginTop: 8, marginBottom: 4 },
  curiosityBox: { backgroundColor: 'rgba(3,105,161,0.15)', borderRadius: 14, padding: 14, marginTop: 12, borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)' },
  curiosityText: { color: '#38bdf8', fontSize: 14, fontStyle: 'italic', textAlign: 'center', lineHeight: 22 },
  modalBtn: { borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginTop: 20 },
  modalBtnText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
});
