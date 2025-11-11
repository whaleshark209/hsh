import httpx
from settings import TMDB_API_KEY

BASE_URL = "https://api.themoviedb.org/3"

async def search_tmdb(query: str):
    async with httpx.AsyncClient() as client:
        url = f"{BASE_URL}/search/movie"
        params = {"api_key": TMDB_API_KEY, "language": "ko-KR", "query": query}
        res = await client.get(url, params=params)
        data = res.json()
        return data.get("results", [])

async def get_popular(page: int = 1):
    async with httpx.AsyncClient() as client:
        url = f"{BASE_URL}/movie/popular"
        params = {"api_key": TMDB_API_KEY, "language": "ko-KR", "page": page}
        res = await client.get(url, params=params)
        data = res.json()
        return data.get("results", [])

async def get_trailer(movie_id: int):
    async with httpx.AsyncClient() as client:
        url = f"{BASE_URL}/movie/{movie_id}/videos"
        params = {"api_key": TMDB_API_KEY, "language": "ko-KR"}
        res = await client.get(url, params=params)
        data = res.json()
        videos = data.get("results", [])
        yt = [v for v in videos if v["site"] == "YouTube"]
        return yt[0]["key"] if yt else None
