# 🚀 Como executar o projeto

## 📦 Backend (Python)

1. Instale as dependências:

```bash
pip install -r requirements.txt
```

2. Configure o IP do servidor

> Use o IP da máquina que está rodando o backend

3. Inicie o servidor:

```bash
cd .\backend\
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 💻 Frontend

Em outro terminal:

```bash
cd .\frontend\
npm start
```

---

## 🧪 Testes

### 🌐 Web

```text
http://localhost:8081/
```

### 📱 Mobile (Expo Go)

```text
exp://127.0.0.1:8081
```

---

## 📲 Expo Go (Android e iOS)

1. Instale o **Expo Go**:

   * Android: Google Play
   * iOS: App Store

2. Com o frontend rodando (`npm start`), um **QR Code** será exibido

3. Abra o Expo Go no celular e:

   * Android: usar **Scan QR Code**
   * iOS: escanear com a câmera

4. O app abrirá automaticamente

> ⚠️ Se não funcionar:

* Use o IP da sua máquina (ex: `exp://192.168.0.10:8081`)
* Celular e PC devem estar na mesma rede Wi-Fi
