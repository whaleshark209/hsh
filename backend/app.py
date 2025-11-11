from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from services import tmdb, omdb

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/popular")
async def popular(page: int = 1):
    movies = await tmdb.get_popular(page)
    return {"results": movies}

@app.get("/search")
async def search(query: str = Query(...)):
    if not query:
        return {"results": []}
    movies = await tmdb.search_tmdb(query)
    return {"results": movies}

@app.get("/trailer/{movie_id}")
async def trailer(movie_id: int):
    key = await tmdb.get_trailer(movie_id)
    return {"youtube_key": key}

@app.get("/omdb")
async def omdb_info(title: str):
    data = await omdb.get_omdb_info(title)
    return {"omdb": data}
