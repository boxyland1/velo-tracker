from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import sqlite3
from datetime import datetime

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Créer la base de données
def init_db():
    conn = sqlite3.connect('sorties.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS sorties
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  date TEXT,
                  distance REAL,
                  vitesse_moy REAL,
                  vitesse_max REAL,
                  denivele REAL,
                  duree INTEGER,
                  calories REAL,
                  difficulte REAL)''')
    conn.commit()
    conn.close()

@app.on_event("startup")
def startup():
    init_db()

@app.get("/")
def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/save_sortie")
async def save_sortie(data: dict):
    conn = sqlite3.connect('sorties.db')
    c = conn.cursor()
    c.execute('''INSERT INTO sorties 
                 (date, distance, vitesse_moy, vitesse_max, denivele, duree, calories, difficulte)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
              (datetime.now().isoformat(), 
               data.get('distance', 0),
               data.get('vitesse_moy', 0),
               data.get('vitesse_max', 0),
               data.get('denivele', 0),
               data.get('duree', 0),
               data.get('calories', 0),
               data.get('difficulte', 0)))
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.get("/historique")
def get_historique():
    conn = sqlite3.connect('sorties.db')
    c = conn.cursor()
    sorties = c.execute('SELECT * FROM sorties ORDER BY date DESC').fetchall()
    conn.close()
    return {"sorties": sorties}
