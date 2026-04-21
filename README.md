Execute o arquivo requirements.txt
pip install -r requirements.txt
Configure o ip do servidor (maquina que está rodando)
abra dois terminais
back
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
front
npm start

Testes
Web
http://localhost:8081/
Androi e IOS
exp://127.0.0.1:8081
