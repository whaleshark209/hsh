import os
from dotenv import load_dotenv

load_dotenv()

TMDB_API_KEY = os.getenv("TMDB_API_KEY", "ddd654eb8622a67e04f93f613653426d")
OMDB_API_KEY = os.getenv("OMDB_API_KEY", "f1b92691")

DEFAULT_LANG = "ko-KR"      # 기본 언어 설정
DEFAULT_REGION = "KR"       # 기본 지역 설정
POSTER_BASE = "https://image.tmdb.org/t/p/w500"
HTTP_TIMEOUT = 10