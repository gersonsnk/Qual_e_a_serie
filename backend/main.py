from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import random
import os
import database
import mimetypes # Importante para Web
import json
import shutil

# Força o Windows/Linux a entender que MP3 é som de verdade, e não arquivo de download genérico
mimetypes.add_type('audio/mpeg', '.mp3')

# Caminhos dos arquivos
BASE_DIR = os.path.dirname(__file__)
MUSICAS_DIR = os.path.join(BASE_DIR, "musicas")
PERGUNTAS_JSON = os.path.join(BASE_DIR, "perguntas.json")
DETALHES_JSON = os.path.join(BASE_DIR, "detalhes.json")

os.makedirs(MUSICAS_DIR, exist_ok=True)

app = FastAPI()

@app.on_event("startup")
def startup_event():
    print("--- Inicializando Banco de Dados ---")
    database.init_db()
    print("--- Banco de Dados OK ---")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/musicas", StaticFiles(directory=MUSICAS_DIR), name="musicas")

def carregar_perguntas():
    try:
        with open(PERGUNTAS_JSON, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def salvar_perguntas(dados):
    with open(PERGUNTAS_JSON, "w", encoding="utf-8") as f:
        json.dump(dados, f, indent=4, ensure_ascii=False)

def carregar_detalhes():
    try:
        with open(DETALHES_JSON, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}

def salvar_detalhes(dados):
    with open(DETALHES_JSON, "w", encoding="utf-8") as f:
        json.dump(dados, f, indent=4, ensure_ascii=False)

# Modelos
class ScoreData(BaseModel):
    nome: str
    sobrenome: str
    pontuacao: int

class AdminLogin(BaseModel):
    username: str
    password: str

class AdminDelete(BaseModel):
    username: str
    password: str
    series_id: int

# --- ENDPOINTS ADMIN ---

@app.post("/admin/login")
def admin_login(data: AdminLogin):
    if database.verificar_admin(data.username, data.password):
        return {"success": True, "message": "Login realizado"}
    raise HTTPException(status_code=401, detail="Credenciais Inválidas")

@app.post("/admin/reset-ranking")
def reset_ranking(data: AdminLogin):
    if database.verificar_admin(data.username, data.password):
        database.reset_ranking()
        return {"success": True, "message": "Ranking zerado"}
    raise HTTPException(status_code=401, detail="Não autorizado")

@app.get("/admin/all-series")
def get_all_series():
    # Retorna o merge de perguntas e detalhes para o admin
    perguntas = carregar_perguntas()
    detalhes = carregar_detalhes()
    
    # Criar um mapeamento rápido por nome_pt para facilitar o merge
    resultado = []
    for p in perguntas:
        det = detalhes.get(p["serie_correta"], {})
        resultado.append({
            **p,
            "detalhes": det
        })
    return {"series": resultado}

@app.post("/admin/delete-series")
def delete_series(data: AdminDelete):
    if not database.verificar_admin(data.username, data.password):
        raise HTTPException(status_code=401, detail="Não autorizado")
    
    # 1. Remover do perguntas.json
    perguntas = carregar_perguntas()
    novas_perguntas = [p for p in perguntas if p["id"] != data.series_id]
    
    # Pegar o nome para remover dos detalhes também
    serie_removida = next((p["serie_correta"] for p in perguntas if p["id"] == data.series_id), None)
    
    if serie_removida:
        salvar_perguntas(novas_perguntas)
        # 2. Remover do detalhes.json (Opcional, mas limpa o banco)
        detalhes = carregar_detalhes()
        if serie_removida in detalhes:
            del detalhes[serie_removida]
            salvar_detalhes(detalhes)
            
        return {"success": True, "message": "Série removida"}
    
    return {"success": False, "message": "Série não encontrada"}

from fastapi import Request

@app.post("/admin/add-series")
async def add_series(request: Request):
    try:
        form = await request.form()
    except Exception as e:
        print(f"Erro ao ler formulário: {e}")
        return {"success": False, "message": "Corpo da requisição inválido"}

    # Extração Manual 
    username = form.get("username", "")
    password = form.get("password", "")
    serie_correta = form.get("serie_correta", "")
    opcoes = form.get("opcoes", "")
    dificuldade = form.get("dificuldade", "1")
    series_id = form.get("series_id")
    
    # Arquivo de Áudio
    audio = form.get("audio") # Pode ser UploadFile ou None
    
    # Detalhes
    nome_en = form.get("nome_en", "")
    genero = form.get("genero", "")
    ano = form.get("ano", "")
    temporadas = form.get("temporadas", "")
    episodios = form.get("episodios", "")
    elenco = form.get("elenco", "")
    curiosidade = form.get("curiosidade", "")

    print(f"DEBUG MANUAL: Recebido - Serie: {serie_correta}, ID: {series_id}, Audio: {audio.filename if audio and hasattr(audio, 'filename') else 'Nenhum'}")
    
    # Validação manual
    if not username or not password or not serie_correta or not opcoes:
        return {"success": False, "message": "Campos obrigatórios ausentes!"}

    # 1. Validar Admin
    if not database.verificar_admin(username, password):
        raise HTTPException(status_code=401, detail="Não autorizado")
    
    perguntas = carregar_perguntas()
    detalhes = carregar_detalhes()
    
    # Modo Edição
    edit_id = int(series_id) if series_id and series_id != 'null' else None
    
    audio_path = None
    if audio and hasattr(audio, 'filename') and audio.filename:
        # Salvar Novo Arquivo Audio
        file_path = os.path.join(MUSICAS_DIR, audio.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)
        audio_path = f"/musicas/{audio.filename}"
    else:
        # Ajusta o caminho automaticamente com o nome da série
        audio_path = f"/musicas/{serie_correta}.mp3"

    if edit_id:
        # 2. Localizar e Atualizar
        for p in perguntas:
            if p["id"] == edit_id:
                p["serie_correta"] = serie_correta
                p["opcoes"] = [o.strip() for o in opcoes.split(",")]
                p["dificuldade"] = int(dificuldade) if dificuldade else 1
                if audio_path:
                   p["audio_url"] = audio_path
                break
    else:
        # 3. Criar Novo
        proximo_id = max([p["id"] for p in perguntas]) + 1 if perguntas else 1
        nova_pergunta = {
            "id": proximo_id,
            "serie_correta": serie_correta,
            "audio_url": audio_path or "", # No novo audio_url é obrigatório
            "opcoes": [o.strip() for o in opcoes.split(",")],
            "dificuldade": int(dificuldade) if dificuldade else 1
        }
        perguntas.append(nova_pergunta)
    
    salvar_perguntas(perguntas)
    
    # 4. Atualizar detalhes.json
    detalhes[serie_correta] = {
        "nome_pt": serie_correta,
        "nome_en": nome_en,
        "genero": genero,
        "ano": ano,
        "temporadas": temporadas,
        "episodios": episodios,
        "elenco": [e.strip() for e in elenco.split(",")],
        "curiosidade": curiosidade
    }
    salvar_detalhes(detalhes)
    
    return {"success": True, "message": f"Série {serie_correta} salva com sucesso!"}

# --- ENDPOINTS JOGO ---

@app.get("/pergunta")
def get_pergunta(acertos: int = 0, tocadas: str = ""):
    PERGUNTAS = carregar_perguntas()
    DETALHES_BBDD = carregar_detalhes()
    # 1. Converte a string de IDs ("1,5,12") para lista de inteiros
    if tocadas.strip():
        # Ignora lixo se vier mal formado
        hist_tocadas = [int(x) for x in tocadas.split(',') if x.isdigit()]
    else:
        hist_tocadas = []
        
    # 2. Filtra Global (elimina todas que já tocaram)
    perguntas_disponiveis = [p for p in PERGUNTAS if p["id"] not in hist_tocadas]
    
    # 3. VERIFICAÇÃO DE VITÓRIA GERAL
    if not perguntas_disponiveis:
        return {"fim_de_jogo": True}

    # 4. Logica de Progressão baseada na Rodada (quantas já foram tocadas)
    rodada = len(hist_tocadas) + 1
    
    if rodada <= 5:
        nivel_alvo = 1
    elif rodada <= 11:
        nivel_alvo = 2
    else:
        nivel_alvo = 3
        
    # 5. Filtra as perguntas pela Dificuldade Alvo
    perguntas_nivel = [p for p in perguntas_disponiveis if p.get("dificuldade", 1) == nivel_alvo]
    
    # 6. Fallback de nível: Se não tiver mais pergunta do Nivel Alvo, libera de QUALQUER nivel disponivel
    if not perguntas_nivel:
        perguntas_nivel = perguntas_disponiveis
        
    pergunta = random.choice(perguntas_nivel)
    
    opcoes_aleatorias = list(pergunta["opcoes"])
    random.shuffle(opcoes_aleatorias)
    
    return {
        "id": pergunta["id"],
        "audio_url": pergunta["audio_url"],
        "opcoes": opcoes_aleatorias,
        "serie_correta": pergunta["serie_correta"],
        "dificuldade": pergunta.get("dificuldade", 1),
        "detalhes": DETALHES_BBDD.get(pergunta["serie_correta"], {})
    }

@app.post("/score")
def salvar_score(data: ScoreData):
    # Chama o Módulo de DB para gravar no Pontuacao.db local!
    database.salvar_score(data.nome, data.sobrenome, data.pontuacao)
    return {"message": "Score gravado com sucesso"}

@app.get("/ranking")
def get_ranking():
    return {"ranking": database.obter_top_ranking(10)}

