// Importar useWindowDimensions na primeira linha
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Audio } from 'expo-av';
import { API_URL } from './index';

const TEMPO_TOTAL = 15; // 15 Segundos

export default function GameScreen() {
  const { nome, sobrenome, ts } = useLocalSearchParams();
  const { width } = useWindowDimensions(); // Pega o tamanho da janela em tempo real!
  const isSmallScreen = width < 600; // Define se a janela está apertada
  
  const [loading, setLoading] = useState(true);
  const [pergunta, setPergunta] = useState<any>(null);
  const [pontos, setPontos] = useState(0);
  const [qtdAcertos, setQtdAcertos] = useState(0); 
  const [tocadas, setTocadas] = useState<number[]>([]); // Historico de IDs
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [statusAviso, setStatusAviso] = useState('');
  const [showModal, setShowModal] = useState(false);

  // ESTA FUNÇÃO CONTROLA O PAUSE/RESUME AO ENTIDAR/SAIR DA TELA
  useFocusEffect(
    useCallback(() => {
      // AO VOLTAR PARA A TELA (foco)
      async function resumeSound() {
          if (sound && !loading && !statusAviso.includes('✅') && !statusAviso.includes('❌')) {
              try {
                  const status = await sound.getStatusAsync();
                  if (status.isLoaded && !status.isPlaying) {
                      console.log("Voltando... retomando áudio.");
                      await sound.playAsync();
                      setIsTimerRunning(true);
                  }
              } catch (e) {
                  console.log("Erro ao retomar som:", e);
              }
          }
      }
      
      resumeSound();

      return () => {
        // AO SAIR DA TELA (blur)
        async function pauseSound() {
            if (sound) {
                try {
                    const status = await sound.getStatusAsync();
                    if (status.isLoaded) {
                        console.log("Saindo... pausando áudio.");
                        await sound.pauseAsync();
                    }
                } catch (e) {
                    console.log("Erro ao pausar som:", e);
                }
                setIsTimerRunning(false); // Pausa o cronômetro também!
            }
        }
        pauseSound();
      };
    }, [sound, loading, statusAviso])
  );

  // Estados do Cronômetro
  const [timeLeft, setTimeLeft] = useState(TEMPO_TOTAL);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Hook que controla a contagem do tempo a cada 1 segundo
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isTimerRunning && timeLeft === 0) {
      // O tempo zerou, chamamos a função de resposta indicando erro por tempo
      responder('TEMPO_ESGOTADO');
    }

    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);


  // 1. Carrega a pergunta e reseta tudo
  const buscarPergunta = async (acertosParaUsar: number, historicoVetor: number[]) => {
    setLoading(true);
    setIsTimerRunning(false);
    setTimeLeft(TEMPO_TOTAL);
    setStatusAviso('');
    
    try {
      const res = await fetch(`${API_URL}/pergunta?acertos=${acertosParaUsar}&tocadas=${historicoVetor.join(',')}`);
      const data = await res.json();
      
      // VITÓRIA! TODAS AS MÚSICAS FORAM TOCADAS
      if (data.fim_de_jogo) {
        setLoading(false);
        setStatusAviso("🏆 INCRÍVEL! VOCÊ ZEROU NOSSO BANCO DE MÚSICAS!");
        
        // Envia o placar épico e finaliza o jogo
        try {
          await fetch(`${API_URL}/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nome: nome,
              sobrenome: sobrenome,
              pontuacao: pontos
            })
          });
        } catch(e) {}
        
        setTimeout(() => { router.back(); }, 4000); // 4 segundos de glória e volta
        return;
      }

      setPergunta(data);
      
      setLoading(false);
      setIsTimerRunning(true); // Força o início do tempo junto com a pergunta
      tocarAudio(data.audio_url); 
      
    } catch (err) {
      console.error("Erro buscarPergunta:", err);
      setLoading(false); // Libera mesmo se houver erro!
    }
  };

  // 2. Tocar a Musica e INICIAR o Tempo após baixar
  const tocarAudio = async (url_mp3: string) => {
    // Timeout de Segurança Máxima
    const safetyTimeout = setTimeout(() => {
        setLoading(false);
        setIsTimerRunning(true);
    }, 3000);

    if (sound) {
      try { await sound.unloadAsync(); } catch (e) {}
    }
    
    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: encodeURI(`${API_URL}${url_mp3}`) },
        { shouldPlay: true, volume: 1.0 }
      );
      setSound(newSound);
      clearTimeout(safetyTimeout);
      setIsTimerRunning(true); 
      setLoading(false); 
    } catch (err) {
      console.log("Falha Áudio:", err);
      clearTimeout(safetyTimeout);
      setIsTimerRunning(true);
      setLoading(false);
    }
  };

  // Limpa tudo ao iniciar UM NOVO JOGO (quando 'ts' mudar que significa novo clique da home)
  useEffect(() => {
    setPontos(0); 
    setQtdAcertos(0);
    setTocadas([]); // Zera o histórico!
    setStatusAviso(''); 
    buscarPergunta(0, []);
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [ts]);

  // 3. Processamento de Fim de Jogo ou Avanço
  const responder = async (opcaoEscolhida: string) => {
    if (!pergunta) return;

    // Para o temporizador IMEDIATAMENTE
    setIsTimerRunning(false); 

    if (opcaoEscolhida === pergunta.serie_correta) {
      // ACERTOU!
      // Dá 2 segundos de lambuja antes de começar a descontar nota (15s totais - 2s = 13s de decaimento)
      let pontosGanhos = 100;
      if (timeLeft < (TEMPO_TOTAL - 2)) {
        pontosGanhos = Math.round((timeLeft / (TEMPO_TOTAL - 2)) * 100);
      }

      const novosPontos = pontos + pontosGanhos;
      const novosAcertos = qtdAcertos + 1;
      const novoHistorico = [...tocadas, pergunta.id];
      
      setPontos(novosPontos);
      setQtdAcertos(novosAcertos);
      setTocadas(novoHistorico); // Marca essa música para nunca mais repetir neste round!
      setStatusAviso(`✅ Acertou rápido! +${pontosGanhos} pontos`);
      
      setTimeout(() => buscarPergunta(novosAcertos, novoHistorico), 1000);
      
    } else {
      // GAME OVER (Errou a escolha ou tempo Estourou)
      if (opcaoEscolhida === 'TEMPO_ESGOTADO') {
        setStatusAviso(`⏰ Tempo Esgotado!\nEra: ${pergunta.serie_correta}`);
      } else {
        setStatusAviso(`❌ Errou!\nA série certa era: ${pergunta.serie_correta}`);
      }
      
      if (sound) await sound.stopAsync();
      
      // Envia os pontos (Mas ainda NÃO volta pra Home, apenas mostra o modal)
      try {
        await fetch(`${API_URL}/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: nome, sobrenome: sobrenome, pontuacao: pontos })
        });
      } catch(e) {}

      setShowModal(true); // Exibe enciclopédia!
    }
  };

  const voltarParaMenu = () => {
    setShowModal(false);
    router.back();
  };

  // Cores dinâmicas para a barra dependendo de quanto tempo falta
  const isTimeCritical = timeLeft <= 5;
  const barColor = isTimeCritical ? '#ef4444' : '#3b82f6';
  const progressPercent = (timeLeft / TEMPO_TOTAL) * 100;

  return (
    <View style={styles.container}>
      {/* Cabeçalho do Jogador */}
      <View style={styles.header}>
        <Text style={styles.playerName}>Jogador: {nome}</Text>
        <Text style={styles.scoreText}>🔥 Score: {pontos}</Text>
      </View>

      <Text style={styles.title}>🎵 Qual é a Série?</Text>
      <Text style={[styles.aviso, isTimeCritical && isTimerRunning && styles.avisoPerigo]}>
        {statusAviso}
      </Text>

      {/* MODAL DE CURIOSIDADES ENCICLOPÉDICO */}
      {showModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🎬 Você Sabia?</Text>
            
            {pergunta?.detalhes?.nome_pt ? (
              <>
                <Text style={styles.modalSerie}>{pergunta.detalhes.nome_pt}</Text>
                <Text style={styles.modalInfo}>📺 Gênero: <Text style={styles.modalInfoBold}>{pergunta.detalhes.genero}</Text> | 📅 <Text style={styles.modalInfoBold}>{pergunta.detalhes.ano}</Text></Text>
                <Text style={styles.modalInfo}>⏱ Duração: <Text style={styles.modalInfoBold}>{pergunta.detalhes.temporadas} Temporadas</Text> ({pergunta.detalhes.episodios} Episódios)</Text>
                <Text style={styles.modalInfo}>⭐ Elenco Central: {'\n'}{pergunta.detalhes.elenco.join(' • ')}</Text>
                
                <Text style={styles.modalCuriosity}>
                  "{pergunta.detalhes.curiosidade}"
                </Text>
              </>
            ) : (
                <>
                   <Text style={styles.modalSerie}>{pergunta.serie_correta}</Text>
                   <Text style={styles.modalCuriosity}>Um Clássico Absoluto da Televisão que cravou seu espaço nessa Arena!</Text>
                </>
            )}

            <TouchableOpacity style={styles.modalButton} onPress={voltarParaMenu}>
               <Text style={styles.modalButtonText}>FINALIZAR E ENVIAR SCORE 🏆</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ÁREA DA BARRA DE TEMPO (Aguarde ou Barra Rodando) */}
      <View style={styles.timerZone}>
        {loading ? (
            <ActivityIndicator size="small" color="#fbbf24" />
        ) : (
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBg}>
                <View 
                  style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: barColor }]} 
                />
              </View>
              <Text style={[styles.timeNumber, isTimeCritical && {color: '#ef4444'}]}>
                00:{timeLeft.toString().padStart(2, '0')}
              </Text>
            </View>
        )}
      </View>

      {/* GRID DOS BOTÕES */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      ) : (
        <View style={styles.gridOcoes}>
          {pergunta?.opcoes.map((opcao: string, index: number) => (
            <TouchableOpacity 
              key={index} 
              style={[
                styles.btnOpcao, 
                { width: isSmallScreen ? '100%' : '48%' }, // Em janelas pequenas, ocupa 100% virando uma coluna!
                !isTimerRunning && !statusAviso.includes('Over') && {opacity: 0.5}
              ]}
              disabled={loading} // Agora libera o clique assim que carregar a pergunta!
              onPress={() => responder(opcao)}
            >
              <Text style={styles.btnTexto}>{opcao}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 20, paddingTop: 50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, borderBottomWidth: 1, borderColor: '#334155', paddingBottom: 15 },
  playerName: { color: '#94a3b8', fontSize: 16 },
  scoreText: { color: '#fbbf24', fontSize: 18, fontWeight: 'bold' },
  title: { fontSize: 28, color: '#f8fafc', textAlign: 'center', marginBottom: 5, fontWeight: '900' },
  aviso: { fontSize: 16, textAlign: 'center', color: '#10b981', marginBottom: 5, height: 25, fontWeight: 'bold' },
  avisoPerigo: { color: '#ef4444' }, // Vermelho na tensão
  
  // Estilos da Barra de Tempo
  timerZone: { height: 60, justifyContent: 'center', marginBottom: 15 },
  aguardeTexto: { color: '#f59e0b', fontSize: 18, textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase' },
  progressContainer: { alignItems: 'center' },
  progressBarBg: { width: '100%', height: 12, backgroundColor: '#1e293b', borderRadius: 10, overflow: 'hidden', marginBottom: 8 },
  progressBarFill: { height: '100%', borderRadius: 10 },
  timeNumber: { fontSize: 24, fontWeight: '900', color: '#f8fafc' },

  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  gridOcoes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10 },
  btnOpcao: {
    backgroundColor: '#1e293b',
    paddingVertical: 25,
    borderRadius: 16,
    marginBottom: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#334155',
  },
  btnTexto: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },

  // Estilos do Card Enciclopédico
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center', alignItems: 'center',
    padding: 20, zIndex: 50
  },
  modalCard: {
    backgroundColor: '#1e293b', padding: 25, borderRadius: 20, width: '100%',
    maxWidth: 600, borderWidth: 2, borderColor: '#6366f1',
    elevation: 10, shadowColor: '#6366f1', shadowOpacity: 0.6, shadowRadius: 15
  },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#fbbf24', textAlign: 'center', marginBottom: 15 },
  modalSerie: { fontSize: 24, color: '#f8fafc', fontWeight: '900', textAlign: 'center', marginBottom: 20, textTransform: 'uppercase' },
  modalInfo: { fontSize: 16, color: '#94a3b8', marginBottom: 8, lineHeight: 22 },
  modalInfoBold: { color: '#e2e8f0', fontWeight: 'bold' },
  modalCuriosity: { fontSize: 16, fontStyle: 'italic', fontWeight: 'bold', color: '#38bdf8', marginTop: 15, textAlign: 'center', padding: 15, backgroundColor: '#0f172a', borderRadius: 10, borderWidth: 1, borderColor: '#0369a1', lineHeight: 24 },
  modalButton: { backgroundColor: '#6366f1', padding: 20, borderRadius: 12, marginTop: 25, alignItems: 'center' },
  modalButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 }
});
