import sqlite3
import os

# Organizando o banco em uma pasta separada para não causar reload infinito no Uvicorn
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

DB_NAME = os.path.join(DATA_DIR, "Pontuacao.db")

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    # Criar a tabela de ranking se não existir (Deixando tudo genérico para testes locais)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ranking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            sobrenome TEXT NOT NULL,
            pontuacao INTEGER NOT NULL,
            data TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Criar a tabela de usuários admin
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS usuarios_admin (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')
    
    # Criar um usuário default se estiver vazio
    cursor.execute("SELECT count(*) FROM usuarios_admin")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO usuarios_admin (username, password) VALUES (?, ?)", ("admin", "admin123"))

    conn.commit()
    conn.close()

def verificar_admin(user: str, password: str):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM usuarios_admin WHERE username = ? AND password = ?", (user, password))
    res = cursor.fetchone()
    conn.close()
    return res is not None

def reset_ranking():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM ranking")
    conn.commit()
    conn.close()

def salvar_score(nome: str, sobrenome: str, pontuacao: int):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO ranking (nome, sobrenome, pontuacao)
        VALUES (?, ?, ?)
    ''', (nome, sobrenome, pontuacao))
    conn.commit()
    conn.close()

def obter_top_ranking(limite: int = 10):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT nome, sobrenome, pontuacao 
        FROM ranking 
        ORDER BY pontuacao DESC 
        LIMIT ?
    ''', (limite,))
    resultados = cursor.fetchall()
    conn.close()
    
    # Retorna uma lista formatada
    return [{"nome": r[0], "sobrenome": r[1], "pontuacao": r[2]} for r in resultados]
