# 🚀 Como executar o projeto

## 📦 Backend (Python)

1. Instale as dependências:

```bash
pip install -r requirements.txt
```

2. Configure o IP do servidor

> Use o IP da máquina que está rodando o backend (ex: `127.0.0.1` ou IP da rede)

3. Inicie o servidor:

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 💻 Frontend (React / React Native)

Em outro terminal, execute:

```bash
npm start
```

---

## 🧪 Testes

### 🌐 Web

Acesse no navegador:

```
http://localhost:8081/
```

### 📱 Mobile (Android e iOS)

Abra no Expo:

```
exp://127.0.0.1:8081
```

---

## ⚠️ Observações

* Certifique-se de que backend e frontend estão rodando ao mesmo tempo
* Caso esteja testando em outro dispositivo, use o IP da sua máquina ao invés de `127.0.0.1`
* Verifique se a porta `8000` (backend) e `8081` (frontend) estão liberadas

