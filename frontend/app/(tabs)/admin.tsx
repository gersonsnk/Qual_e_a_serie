import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from 'expo-router';
import { Audio } from 'expo-av';
import ApiConfig from '@/constants/Config';
import { useEffect } from 'react';

export default function AdminScreen() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [tab, setTab] = useState<'import' | 'config'>('import');
  const [loading, setLoading] = useState(false);


  // Carregar IP salvo e Catálogo ao montar/logar
  useEffect(() => {
    ApiConfig.load().then(() => {
      setServerIp(ApiConfig.getRawIp());
      if (isLoggedIn) fetchSeries();
    });
  }, [isLoggedIn]);

  // Estado do IP (Geral)
  const [serverIp, setServerIp] = useState(ApiConfig.getRawIp());
  const API_URL = ApiConfig.getApiUrl();

  // Estados de Login
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');

  // Estados Formulario Importação
  const [serieCorreta, setSerieCorreta] = useState('');
  const [opcoes, setOpcoes] = useState('');
  const [dificuldade, setDificuldade] = useState('1');
  const [audioFile, setAudioFile] = useState<any>(null);

  // Metadados detalhes.json
  const [nomeEn, setNomeEn] = useState('');
  const [genero, setGenero] = useState('');
  const [ano, setAno] = useState('');
  const [temporadas, setTemporadas] = useState('');
  const [episodios, setEpisodios] = useState('');
  const [elenco, setElenco] = useState('');
  const [curiosidade, setCuriosidade] = useState('');

  // Estado da Prévia e Áudio
  const [showPreview, setShowPreview] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Referência para o ScrollView e Estados vivos (para evitar stale closures no focus)
  const scrollRef = React.useRef<ScrollView>(null);
  const soundRef = React.useRef<Audio.Sound | null>(null);
  const showPreviewRef = React.useRef(false);

  // Sincronizar Refs com Estados (para uso no cleanup do focus)
  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => { showPreviewRef.current = showPreview; }, [showPreview]);

  // Estado de Edição e Listagem
  const [editingId, setEditingId] = useState<number | null>(null);
  const [allSeries, setAllSeries] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Confirmação de Senha para Delete e Reset
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [confirmPassword, setConfirmPassword] = useState('');

  // Mensagens de Erro Customizadas (Toast)
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      // TODA VEZ QUE ABRIR A ABA: Força o bloqueio para pedir senha
      setIsLoggedIn(false);
      setUser('');
      setPass('');

      // AO VOLTAR PARA A TELA (foco) - Lógica de Áudio
      async function resumePreview() {
        if (soundRef.current && showPreviewRef.current && !isPlaying) {
          try {
            const status = await soundRef.current.getStatusAsync();
            if (status.isLoaded) {
              await soundRef.current.playAsync();
              setIsPlaying(true);
            }
          } catch (e) {
            console.log("Erro ao retomar áudio:", e);
          }
        }
      }
      resumePreview();

      return () => {
        // AO SAIR DA TELA (blur) - Apenas pausa áudio usando a Ref viva
        async function pausePreview() {
          if (soundRef.current) {
            try {
              const status = await soundRef.current.getStatusAsync();
              if (status.isLoaded) {
                await soundRef.current.pauseAsync();
              }
            } catch (e) {
              console.log("Erro ao pausar áudio:", e);
            }
            setIsPlaying(false);
          }
        }
        pausePreview();
      };
    }, []) // Dependência vazia = Login reset apenas na entrada/saída real
  );

  // 1. Função de Login
  const handleLogin = async () => {
    if (!user || !pass) return;
    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
      });
      console.log("Status da Resposta:", resp.status);

      if (resp.status === 200) {
        setIsLoggedIn(true);
        fetchSeries();
      } else if (resp.status === 401) {
        exibirErro("Usuário ou senha incorretos.");
      } else {
        exibirErro(`Erro no Servidor: ${resp.status}`);
      }
    } catch (err) {
      console.error("Erro na requisição:", err);
      exibirErro("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  };

  const exibirErro = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000); // Some após 4 segundos
  };

  // 2. Buscar Lista de Séries
  const fetchSeries = async () => {
    try {
      const resp = await fetch(`${API_URL}/admin/all-series`);
      const data = await resp.json();
      if (data.series) setAllSeries(data.series);
    } catch (err) {
      console.log("Erro ao buscar séries", err);
    }
  };

  const handleSelectForEdit = (item: any) => {
    setEditingId(item.id);
    setSerieCorreta(item.serie_correta);
    setOpcoes(item.opcoes.join(', '));
    setDificuldade(String(item.dificuldade));

    // Detalhes
    const det = item.detalhes || {};
    setNomeEn(det.nome_en || '');
    setGenero(det.genero || '');
    setAno(det.ano || '');
    setTemporadas(det.temporadas || '');
    setEpisodios(det.episodios || '');
    setElenco(det.elenco ? det.elenco.join(', ') : '');
    setCuriosidade(det.curiosidade || '');

    setAudioFile(null); // Reseta arquivo local, pois usaremos o do servidor
    // Rolagem suave para o topo
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleDelete = (id: number) => {
    setDeleteId(id);
    setConfirmPassword('');
    setShowDeleteModal(true);
  };

  const confirmDeleteSeries = async () => {
    if (confirmPassword !== pass) {
      Alert.alert("Erro", "Senha de confirmação incorreta.");
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/admin/delete-series`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass, series_id: deleteId })
      });
      const data = await resp.json();
      if (data.success) {
        Alert.alert("Sucesso", "Série removida permanentemente.");
        fetchSeries();
        if (editingId === deleteId) resetForm();
        setShowDeleteModal(false);
      }
    } catch (e) {
      Alert.alert("Erro", "Erro ao deletar");
    } finally {
      setLoading(false);
    }
  };

  const handleResetRanking = () => {
    setConfirmPassword('');
    setShowResetModal(true);
  };

  const confirmResetRanking = async () => {
    if (confirmPassword !== pass) {
      Alert.alert("Erro", "Senha de confirmação incorreta.");
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/admin/reset-ranking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
      });
      const data = await resp.json();
      if (data.success) {
        Alert.alert("Sucesso", "O Ranking foi zerado com sucesso!");
        setShowResetModal(false);
      } else {
        Alert.alert("Erro", data.message || "Erro ao zerar ranking.");
      }
    } catch (e) {
      Alert.alert("Erro", "Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setSerieCorreta('');
    setOpcoes('');
    setAudioFile(null);
    setCuriosidade('');
    setNomeEn('');
    setGenero('');
    setAno('');
    setTemporadas('');
    setEpisodios('');
    setElenco('');
    setDificuldade('1');
  };

  // 3. Selecionar Áudio
  const pickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/mpeg',
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        setAudioFile(result.assets[0]);
      }
    } catch (err) {
      console.log(err);
    }
  };

  // 4. Salvar Série (Criação ou Edição)
  const handleSaveSeries = async () => {
    if (!serieCorreta) {
      Alert.alert("Aviso", "O nome da série (Correta) é obrigatório.");
      return;
    }

    const finalOpcoes = opcoes.trim() || `${serieCorreta} - Opção 2, ${serieCorreta} - Opção 3, ${serieCorreta} - Opção 4`;

    setLoading(true);
    const formData = new FormData();
    formData.append('username', user);
    formData.append('password', pass);
    formData.append('serie_correta', serieCorreta);
    formData.append('opcoes', finalOpcoes);
    formData.append('dificuldade', dificuldade);
    formData.append('nome_en', nomeEn);
    formData.append('genero', genero);
    formData.append('ano', ano);
    formData.append('temporadas', temporadas);
    formData.append('episodios', episodios);
    formData.append('elenco', elenco);
    formData.append('curiosidade', curiosidade);

    if (editingId) {
      formData.append('series_id', String(editingId));
    }

    if (audioFile) {
      const fileToUpload = {
        uri: audioFile.uri,
        name: audioFile.name,
        type: audioFile.mimeType || 'audio/mpeg',
      };
      formData.append('audio', fileToUpload as any);
    }

    try {
      const resp = await fetch(`${API_URL}/admin/add-series`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      const data = await resp.json();
      if (data.success) {
        Alert.alert("Sucesso", "Série salva com sucesso!");
        resetForm();
        fetchSeries(); // Atualiza a lista para refletir as mudanças no grid
      } else {
        Alert.alert("Erro", data.detail || "Erro ao salvar.");
      }
    } catch (err) {
      console.log(err);
      Alert.alert("Erro", "Erro na conexão multipart.");
    } finally {
      setLoading(false);
    }
  };

  // 6. Lógica de Áudio na Prévia
  async function togglePlayPreview() {
    if (sound) {
      if (isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        await sound.playAsync();
        setIsPlaying(true);
      }
      return;
    }

    // Tentar carregar
    let sourceUri = "";
    if (audioFile) {
      sourceUri = audioFile.uri;
    } else if (editingId) {
      // Buscar do servidor (precisamos do path original)
      const currentItem = allSeries.find(s => s.id === editingId);
      if (currentItem) sourceUri = `${API_URL}${currentItem.audio_url}`;
    }

    if (!sourceUri) {
      Alert.alert("Erro", "Nenhum áudio disponível para prévia.");
      return;
    }

    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: sourceUri },
        { shouldPlay: true }
      );
      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) setIsPlaying(false);
      });
    } catch (e) {
      Alert.alert("Erro", "Não foi possível carregar o áudio.");
    }
  }

  const handleClosePreview = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
      setIsPlaying(false);
    }
    setShowPreview(false);
  };

  // 7. Salvar IP
  const handleSaveIp = () => {
    ApiConfig.setIp(serverIp);
    Alert.alert("Configuração Salva", "O endereço do servidor foi atualizado para: " + ApiConfig.getApiUrl());
  };

  // TELA DE LOGIN
  if (!isLoggedIn) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.container}>
        <BlurView intensity={80} tint="dark" style={styles.loginBox}>
          <IconSymbol name="lock.fill" size={60} color="#00d2ff" style={{ alignSelf: 'center', marginBottom: 20 }} />
          <Text style={styles.title}>Área do Administrador</Text>

          <TextInput
            style={styles.input}
            placeholder="Usuário"
            placeholderTextColor="#888"
            value={user}
            onChangeText={setUser}
            onSubmitEditing={handleLogin}
          />
          <TextInput
            style={styles.input}
            placeholder="Senha"
            placeholderTextColor="#888"
            secureTextEntry
            value={pass}
            onChangeText={setPass}
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar no Painel</Text>}
          </TouchableOpacity>

          <View style={{ marginTop: 40, paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
            <Text style={{ color: '#00d2ff', fontSize: 12, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>⚙️ CONFIGURAÇÃO DE REDE</Text>
            <TextInput
              style={[styles.input, { height: 45, fontSize: 13 }]}
              placeholder="IP do Servidor (Ex: 192.168.0.10)"
              placeholderTextColor="#555"
              value={serverIp}
              onChangeText={setServerIp}
            />
            <TouchableOpacity
              style={{ padding: 10, alignItems: 'center' }}
              onPress={() => { ApiConfig.setIp(serverIp); Alert.alert("Sucesso", "IP Atualizado!"); }}
            >
              <Text style={{ color: '#aaa', fontSize: 11 }}>Salvar Endereço de Rede</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </LinearGradient>
    );
  }

  // TELA PRINCIPAL ADMIN
  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a2e', '#0f3460']} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manutenção do Game</Text>
        <TouchableOpacity onPress={() => setIsLoggedIn(false)}>
          <IconSymbol name="rectangle.portrait.and.arrow.right" size={24} color="#ff4d4d" />
        </TouchableOpacity>
      </View>

      {/* TABS */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'import' && styles.tabActive]}
          onPress={() => { setTab('import'); fetchSeries(); }}
        >
          <Text style={[styles.tabText, tab === 'import' && styles.tabTextActive]}>Importar/Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'config' && styles.tabActive]}
          onPress={() => setTab('config')}
        >
          <Text style={[styles.tabText, tab === 'config' && styles.tabTextActive]}>Geral</Text>
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        {tab === 'import' ? (
          <View style={styles.form}>
            <Text style={styles.sectionLabel}>
              {editingId ? `📝 Editando Série #${editingId}` : "🆕 Cadastrar Nova Série"}
            </Text>

            {editingId && (
              <View style={styles.editIndicator}>
                <Text style={styles.editIndicatorText}>Dica: Se não quiser mudar a música, deixe o campo de áudio vazio.</Text>
                <TouchableOpacity onPress={resetForm} style={styles.cancelBtn}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Cancelar Edição</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.filePicker} onPress={pickAudio}>
              <IconSymbol name="music.note" size={24} color="#00d2ff" />
              <Text style={styles.filePickerText}>
                {audioFile ? audioFile.name : "Selecionar Música (.mp3)"}
              </Text>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Nome da Série (Correta)"
              placeholderTextColor="#888"
              value={serieCorreta}
              onChangeText={setSerieCorreta}
            />
            <TextInput
              style={styles.input}
              placeholder="Outras Opções (separadas por vírgula)"
              placeholderTextColor="#888"
              value={opcoes}
              onChangeText={setOpcoes}
            />

            <View style={styles.row}>
              <Text style={{ color: '#fff', marginRight: 10 }}>Dificuldade:</Text>
              {['1', '2', '3'].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.miniBtn, dificuldade === n && styles.miniBtnActive]}
                  onPress={() => setDificuldade(n)}
                >
                  <Text style={styles.miniBtnText}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Metadados da Enciclopédia</Text>
            <TextInput style={styles.input} placeholder="Nome Original (Inglês)" placeholderTextColor="#888" value={nomeEn} onChangeText={setNomeEn} />
            <TextInput style={styles.input} placeholder="Gênero" placeholderTextColor="#888" value={genero} onChangeText={setGenero} />
            <TextInput style={styles.input} placeholder="Ano (Ex: 1990 a 2000)" placeholderTextColor="#888" value={ano} onChangeText={setAno} />
            <TextInput style={styles.input} placeholder="Temporadas" placeholderTextColor="#888" value={temporadas} onChangeText={setTemporadas} />
            <TextInput style={styles.input} placeholder="Episódios" placeholderTextColor="#888" value={episodios} onChangeText={setEpisodios} />
            <TextInput style={styles.input} placeholder="Elenco (Separe por vírgula)" placeholderTextColor="#888" value={elenco} onChangeText={setElenco} />
            <TextInput
              style={[styles.input, { height: 100 }]}
              placeholder="Curiosidade Marcante"
              placeholderTextColor="#888"
              multiline
              value={curiosidade}
              onChangeText={setCuriosidade}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity style={[styles.button, { flex: 1, backgroundColor: '#4a4e69' }]} onPress={() => setShowPreview(true)}>
                <Text style={styles.buttonText}>👁️ Prévia</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button, { flex: 2 }]} onPress={handleSaveSeries} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{editingId ? "Salvar Alterações" : "Importar Tudo"}</Text>}
              </TouchableOpacity>
            </View>

            {/* GRID DE SÉRIES EXISTENTES */}
            <View style={{ marginTop: 60 }}>
              <Text style={styles.sectionLabel}>📚 Catálogo Compartilhado ({allSeries.length})</Text>

              <TextInput
                style={[styles.input, { marginBottom: 20 }]}
                placeholder="Filtrar por nome..."
                placeholderTextColor="#888"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />

              <View style={styles.gridContainer}>
                {allSeries.filter(s => s.serie_correta.toLowerCase().includes(searchQuery.toLowerCase())).map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.gridCard, editingId === item.id && styles.gridCardActive]}
                    onPress={() => handleSelectForEdit(item)}
                  >
                    <Text style={styles.cardId}>#{item.id}</Text>
                    <Text style={styles.cardTitleGrid} numberOfLines={1}>{item.serie_correta}</Text>
                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.miniIconBtn} onPress={() => handleSelectForEdit(item)}>
                        <IconSymbol name="pencil" size={14} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.miniIconBtn, { backgroundColor: '#ff4d4d' }]} onPress={() => handleDelete(item.id)}>
                        <IconSymbol name="trash" size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.sectionLabel}>Configuração de Rede</Text>
            <Text style={{ color: '#888', marginBottom: 10 }}>Digite apenas o IP (Ex: 192.168.100.159)</Text>
            <TextInput
              style={styles.input}
              placeholder="IP do Servidor"
              placeholderTextColor="#888"
              value={serverIp}
              onChangeText={setServerIp}
            />
            <TouchableOpacity style={[styles.button, { marginBottom: 30 }]} onPress={handleSaveIp}>
              <Text style={styles.buttonText}>Salvar Endereço IP</Text>
            </TouchableOpacity>

            <Text style={styles.sectionLabel}>Zona Crítica</Text>
            <View style={styles.configBox}>
              <TouchableOpacity style={styles.dangerButton} onPress={handleResetRanking}>
                <IconSymbol name="trash.fill" size={20} color="#fff" />
                <Text style={styles.dangerButtonText}>Zerar Todo o Ranking</Text>
              </TouchableOpacity>
              <Text style={styles.hint}>Esta ação apaga todos os recordes salvos no Banco de Dados.</Text>
            </View>

            {/* Debug de Conexão */}
            <View style={{ marginTop: 40, padding: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 15, borderLeftWidth: 4, borderLeftColor: '#00d2ff' }}>
              <Text style={{ color: '#00d2ff', fontWeight: 'bold', fontSize: 14, marginBottom: 5 }}>ℹ️ Status da Conexão</Text>
              <Text style={{ color: '#fff', fontSize: 12 }}>API URL: {API_URL}</Text>
              <Text style={{ color: '#aaa', fontSize: 12, marginTop: 2 }}>IP Configurado: {serverIp}</Text>
            </View>
          </View>
        )}
      </ScrollView>
      {/* NOTIFICAÇÃO DE ERRO CUSTOMIZADA (TOAST) */}
      {errorMsg && (
        <BlurView intensity={90} tint="dark" style={styles.errorToast}>
          <IconSymbol name="exclamationmark.circle.fill" size={20} color="#ff4d4d" />
          <Text style={styles.errorToastText}>{errorMsg}</Text>
        </BlurView>
      )}

      {/* OVERLAY DE PRÉVIA */}
      {showPreview && (
        <View style={styles.previewOverlay}>
          <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.previewContent}>
            <Text style={styles.previewHint}>Visualização do Card (Enciclopédia)</Text>

            <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.cardPreview}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{serieCorreta || "Título da Série"}</Text>
                <Text style={styles.cardOriginal}>{nomeEn || "Original Name"} • {ano || "Ano"}</Text>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.badgeRow}>
                  <View style={styles.badge}><Text style={styles.badgeText}>{genero || "Gênero"}</Text></View>
                  <View style={styles.badge}><Text style={styles.badgeText}>{temporadas || "X"} Temp.</Text></View>
                </View>

                <Text style={styles.curiosidadeLabel}>Curiosidade Marcante:</Text>
                <Text style={styles.curiosidadeText}>{curiosidade || "Aqui aparecerá a curiosidade que você digitar..."}</Text>

                <Text style={styles.elencoLabel}>Principais Nomes:</Text>
                <Text style={styles.elencoText}>{elenco || "Não informado"}</Text>
              </View>
            </LinearGradient>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 25, width: '100%' }}>
              <TouchableOpacity
                style={[styles.closePreview, { flex: 1, marginTop: 0, backgroundColor: '#00d2ff', flexDirection: 'row', gap: 8, justifyContent: 'center' }]}
                onPress={togglePlayPreview}
              >
                <IconSymbol name={isPlaying ? "pause.fill" : "play.fill"} size={18} color="#fff" />
                <Text style={styles.closePreviewText}>OUVIR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.closePreview, { flex: 1, marginTop: 0 }]}
                onPress={handleClosePreview}
              >
                <Text style={styles.closePreviewText}>VOLTAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE DELETE */}
      {showDeleteModal && (
        <View style={[styles.previewOverlay, { zIndex: 10000 }]}>
          <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
          <BlurView intensity={80} tint="dark" style={[styles.loginBox, { marginTop: 0, width: '90%', padding: 25 }]}>
            <IconSymbol name="exclamationmark.triangle.fill" size={40} color="#ff4d4d" style={{ alignSelf: 'center', marginBottom: 15 }} />
            <Text style={[styles.title, { color: '#ff4d4d', marginBottom: 10 }]}>Confirmar Exclusão</Text>
            <Text style={{ color: '#ccc', textAlign: 'center', marginBottom: 20, fontSize: 13 }}>
              Digite sua senha para apagar permanentemente:
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Sua senha"
              placeholderTextColor="#666"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[styles.button, { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)' }]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.buttonText}>Voltar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, { flex: 2, backgroundColor: '#ff4d4d' }]}
                onPress={confirmDeleteSeries}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sim, Excluir</Text>}
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE RESET RANKING */}
      {showResetModal && (
        <View style={[styles.previewOverlay, { zIndex: 10000 }]}>
          <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
          <BlurView intensity={80} tint="dark" style={[styles.loginBox, { marginTop: 0, width: '90%', padding: 25 }]}>
            <IconSymbol name="trash.fill" size={40} color="#ff4d4d" style={{ alignSelf: 'center', marginBottom: 15 }} />
            <Text style={[styles.title, { color: '#ff4d4d', marginBottom: 10 }]}>ZERAR RANKING</Text>
            <Text style={{ color: '#ccc', textAlign: 'center', marginBottom: 20, fontSize: 13 }}>
              Atenção! Isso apagará TODOS os recordes. Digite sua senha de Admin para confirmar:
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Sua senha de Admin"
              placeholderTextColor="#666"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[styles.button, { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)' }]}
                onPress={() => setShowResetModal(false)}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, { flex: 2, backgroundColor: '#ff4d4d' }]}
                onPress={confirmResetRanking}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sim, Zerar Tudo</Text>}
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loginBox: {
    margin: 30,
    padding: 30,
    borderRadius: 20,
    marginTop: '40%',
    overflow: 'hidden',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 50,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 20,
    borderRadius: 15,
    padding: 5,
    marginBottom: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: '#00d2ff',
  },
  tabText: {
    color: '#888',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  scroll: {
    padding: 20,
  },
  form: {
    paddingBottom: 40,
  },
  sectionLabel: {
    color: '#00d2ff',
    fontWeight: 'bold',
    marginBottom: 15,
    fontSize: 16,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  button: {
    backgroundColor: '#00d2ff',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#00d2ff',
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  filePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,163,255,0.1)',
    padding: 20,
    borderRadius: 15,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#00d2ff',
    marginBottom: 20,
  },
  filePickerText: {
    color: '#00d2ff',
    marginLeft: 10,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  miniBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  miniBtnActive: {
    backgroundColor: '#00d2ff',
  },
  miniBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  configBox: {
    backgroundColor: 'rgba(255,77,77,0.05)',
    padding: 30,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.2)',
    alignItems: 'center',
  },
  warningText: {
    color: '#ff4d4d',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 20,
  },
  dangerButton: {
    flexDirection: 'row',
    backgroundColor: '#ff4d4d',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
  },
  dangerButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  hint: {
    color: '#888',
    textAlign: 'center',
    fontSize: 12,
  },
  // ESTILOS DE EDIÇÃO E GRID
  editIndicator: {
    backgroundColor: 'rgba(255,187,0,0.1)',
    padding: 15,
    borderRadius: 12,
    marginBottom: 25,
    borderLeftWidth: 4,
    borderLeftColor: '#ffbb00',
  },
  editIndicatorText: {
    color: '#ffbb00',
    fontSize: 13,
    marginBottom: 10,
  },
  cancelBtn: {
    backgroundColor: '#ff4d4d',
    alignSelf: 'flex-start',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  gridCard: {
    width: '48%', // Duas colunas
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  gridCardActive: {
    borderColor: '#ffbb00',
    backgroundColor: 'rgba(255,187,0,0.05)',
  },
  cardId: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardTitleGrid: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 5,
  },
  miniIconBtn: {
    backgroundColor: '#00d2ff',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ESTILOS DA PRÉVIA (Mantidos)
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  previewContent: {
    width: '100%',
    maxWidth: 500,
    alignItems: 'center',
  },
  previewHint: {
    color: '#00d2ff',
    fontWeight: 'bold',
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  cardPreview: {
    width: '100%',
    borderRadius: 20,
    padding: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardHeader: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 15,
    marginBottom: 15,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  cardOriginal: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 4,
  },
  cardBody: {
    gap: 15,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 5,
  },
  badge: {
    backgroundColor: 'rgba(99,102,241,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  curiosidadeLabel: {
    color: '#00d2ff',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  curiosidadeText: {
    color: '#e2e8f0',
    fontSize: 15,
    lineHeight: 22,
  },
  elencoLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 10,
  },
  elencoText: {
    color: '#94a3b8',
    fontSize: 13,
    fontStyle: 'italic',
  },
  closePreview: {
    marginTop: 30,
    padding: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  closePreviewText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  floatingPlay: {
    position: 'absolute',
    bottom: 100,
    backgroundColor: '#00d2ff',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#00d2ff',
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  errorToast: {
    position: 'absolute',
    top: 50,
    left: '10%',
    right: '10%',
    backgroundColor: 'rgba(255, 77, 77, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 77, 0.4)',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 99999,
  },
  errorToastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});
