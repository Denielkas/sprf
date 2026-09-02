import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.enroll import router as enroll_router
from app.routes.recognize import router as recognize_router

from app.database import (
    garantir_tabela_face,
)

from app.offline.face_cache import (
    garantir_tabela_faces_offline,
)


app = FastAPI()


# ==========================================================
# CORS
# ==========================================================

origins_env = os.getenv(
    "ALLOW_ORIGINS",
    ""
)

origins = [
    origin.strip()
    for origin in origins_env.split(",")
    if origin.strip()
]


if not origins:

    origins = [

        "http://localhost",

        "http://127.0.0.1",

        "http://localhost:5173",

        "http://127.0.0.1:5173",

        "http://localhost:5174",

        "http://127.0.0.1:5174",

        "https://www.pontosanmarinho.com.br",

        "https://pontosanmarinho.com.br",
    ]


app.add_middleware(

    CORSMiddleware,

    allow_origins=
        origins,

    allow_credentials=
        False,

    allow_methods=[
        "*"
    ],

    allow_headers=[
        "*"
    ],
)


# ==========================================================
# STARTUP
#
# O SQLite local é iniciado primeiro.
#
# Depois tentamos preparar o PostgreSQL.
#
# Se o PostgreSQL estiver indisponível,
# a FaceAPI continua funcionando e o recognize.py
# poderá utilizar o cache SQLite local.
# ==========================================================

@app.on_event(
    "startup"
)
def startup():

    print(
        ""
    )

    print(
        "=========================================="
    )

    print(
        "🚀 INICIANDO FACEAPI"
    )

    print(
        "=========================================="
    )


    # ======================================================
    # SQLITE LOCAL
    # ======================================================

    sqlite_disponivel = False


    try:

        garantir_tabela_faces_offline()

        sqlite_disponivel = True


        print(
            "✅ Cache facial SQLite inicializado."
        )


    except Exception as error:

        print(
            "=========================================="
        )

        print(
            "❌ ERRO NO CACHE FACIAL SQLITE"
        )

        print(
            repr(
                error
            )
        )

        print(
            "=========================================="
        )


    # ======================================================
    # POSTGRESQL
    #
    # IMPORTANTE:
    #
    # Uma falha aqui NÃO pode impedir a FaceAPI
    # de iniciar.
    # ======================================================

    postgres_disponivel = False


    try:

        garantir_tabela_face()

        postgres_disponivel = True


        print(
            "✅ PostgreSQL facial disponível."
        )


    except Exception as error:

        print(
            ""
        )

        print(
            "=========================================="
        )

        print(
            "⚠️ POSTGRESQL INDISPONÍVEL"
        )

        print(
            repr(
                error
            )
        )

        print(
            "📴 FaceAPI continuará em modo offline."
        )

        print(
            "=========================================="
        )

        print(
            ""
        )


    # ======================================================
    # RESULTADO DA INICIALIZAÇÃO
    # ======================================================

    print(
        ""
    )

    print(
        "=========================================="
    )

    print(
        "🚀 FaceAPI iniciada"
    )

    print(
        "⚡ Reconhecimento otimizado"
    )

    print(
        "🗄️ SQLite:",
        (
            "OK"
            if sqlite_disponivel
            else "ERRO"
        )
    )

    print(
        "🌐 PostgreSQL:",
        (
            "ONLINE"
            if postgres_disponivel
            else "OFFLINE"
        )
    )


    if (
        postgres_disponivel
        and
        sqlite_disponivel
    ):

        print(
            "🟢 Modo: ONLINE + CACHE LOCAL"
        )


    elif (
        not postgres_disponivel
        and
        sqlite_disponivel
    ):

        print(
            "🟡 Modo: OFFLINE"
        )


    elif (
        postgres_disponivel
        and
        not sqlite_disponivel
    ):

        print(
            "🟠 Modo: ONLINE SEM CACHE LOCAL"
        )


    else:

        print(
            "🔴 Modo: SEM BANCO FACIAL DISPONÍVEL"
        )


    print(
        "=========================================="
    )

    print(
        ""
    )


# ==========================================================
# STATUS
# ==========================================================

@app.get("/")
def root():

    return {
        "status":
            "FaceAPI online",

        "recognition":
            "optimized",

        "offline_cache":
            True,
    }


# ==========================================================
# ROTAS
# ==========================================================

app.include_router(
    enroll_router
)

app.include_router(
    recognize_router
)