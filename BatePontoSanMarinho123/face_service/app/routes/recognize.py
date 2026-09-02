from fastapi import APIRouter

from app.models import FaceRecognize

from app.utils_face import (
    decode_image,
    get_face_embedding,
)

from app.database import (
    get_db,
    garantir_tabela_face,
)

from app.offline.face_cache import (
    substituir_faces_empresa,
    carregar_faces_locais,
    info_cache_empresa,
)

import numpy as np
import os
import threading
import time


router = APIRouter()


# ==========================================================
# CONFIGURAÇÕES
# ==========================================================

TOLERANCE = float(
    os.getenv(
        "TOLERANCE",
        "0.45"
    )
)

MIN_DISTANCE_GAP = float(
    os.getenv(
        "MIN_DISTANCE_GAP",
        "0.03"
    )
)

CACHE_SECONDS = int(
    os.getenv(
        "FACE_CACHE_SECONDS",
        "300"
    )
)


# ==========================================================
# CACHE DOS EMBEDDINGS EM MEMÓRIA
#
# Cada empresa possui seu próprio cache.
#
# Esse cache é somente para desempenho.
#
# O SQLite é o cache persistente para funcionamento
# sem internet.
# ==========================================================

_cache = {}

_cache_lock = threading.Lock()


# ==========================================================
# VALIDAR EMPRESA
# ==========================================================

def validar_empresa_id(
    empresa_id
):

    if empresa_id is None:

        raise ValueError(
            "empresa_id é obrigatório."
        )


    try:

        empresa_id = int(
            empresa_id
        )

    except Exception:

        raise ValueError(
            "empresa_id inválido."
        )


    if empresa_id <= 0:

        raise ValueError(
            "empresa_id inválido."
        )


    return empresa_id


# ==========================================================
# CRIAR CACHE VAZIO
# ==========================================================

def criar_cache_vazio(
    empresa_id,
    fonte="nenhuma"
):

    return {

        "embeddings":
            np.empty(
                (
                    0,
                    128
                ),
                dtype=np.float64
            ),

        "foto_ids":
            np.asarray(
                [],
                dtype=np.int64
            ),

        "funcionario_ids":
            np.asarray(
                [],
                dtype=np.int64
            ),

        "nomes":
            [],

        "empresa_ids":
            [],

        "empresa_id":
            int(
                empresa_id
            ),

        "fonte":
            fonte,

        "carregado_em":
            time.time(),
    }


# ==========================================================
# LIMPAR CACHE EM MEMÓRIA
# ==========================================================

def limpar_cache_faces(
    empresa_id=None
):

    global _cache

    with _cache_lock:

        if empresa_id is None:

            _cache = {}

            print(
                "♻️ Cache facial em memória totalmente limpo."
            )

            return


        try:

            chave = int(
                empresa_id
            )

        except Exception:

            print(
                "⚠️ Não foi possível limpar cache. empresa_id inválido:",
                empresa_id
            )

            return


        _cache.pop(
            chave,
            None
        )

        print(
            "♻️ Cache facial em memória limpo para empresa:",
            chave
        )


# ==========================================================
# DIAGNÓSTICO DOS ROSTOS DO POSTGRESQL
# ==========================================================

def diagnosticar_faces(
    cur,
    empresa_id
):

    try:

        print(
            ""
        )

        print(
            "=========================================="
        )

        print(
            "🔎 DIAGNÓSTICO FACIAL"
        )

        print(
            "🏢 Empresa solicitada pelo terminal:",
            empresa_id
        )

        print(
            "=========================================="
        )


        cur.execute(
            """
            SELECT
                fe.id,
                fe.funcionario_id,
                f.nome,
                f.empresa_id,
                f.ativo,
                e.nome,
                e.ativo,
                array_length(fe.embedding, 1)
            FROM face_embeddings fe
            INNER JOIN funcionarios f
                ON f.id = fe.funcionario_id
            LEFT JOIN empresas e
                ON e.id = f.empresa_id
            ORDER BY
                f.empresa_id,
                f.nome,
                fe.id;
            """
        )


        registros = cur.fetchall()


        print(
            "📸 Total de imagens/embeddings no banco:",
            len(
                registros
            )
        )


        if not registros:

            print(
                "⚠️ Nenhum registro encontrado em face_embeddings."
            )


        for registro in registros:

            (
                foto_id,
                funcionario_id,
                nome,
                funcionario_empresa_id,
                funcionario_ativo,
                empresa_nome,
                empresa_ativa,
                tamanho_embedding,
            ) = registro


            pertence_empresa = (
                int(
                    funcionario_empresa_id
                )
                ==
                int(
                    empresa_id
                )
            )


            print(
                "------------------------------------------"
            )

            print(
                "📸 FOTO ID:",
                foto_id
            )

            print(
                "👤 FUNCIONÁRIO ID:",
                funcionario_id
            )

            print(
                "👤 NOME:",
                nome
            )

            print(
                "🏢 EMPRESA ID:",
                funcionario_empresa_id
            )

            print(
                "🏢 EMPRESA:",
                empresa_nome
            )

            print(
                "👤 FUNCIONÁRIO ATIVO:",
                funcionario_ativo
            )

            print(
                "🏢 EMPRESA ATIVA:",
                empresa_ativa
            )

            print(
                "🧠 TAMANHO EMBEDDING:",
                tamanho_embedding
            )

            print(
                "🔐 PERTENCE À EMPRESA DO TERMINAL:",
                pertence_empresa
            )


            if not pertence_empresa:

                print(
                    "⛔ IGNORADO: pertence a outra empresa."
                )


            elif funcionario_ativo is not True:

                print(
                    "⛔ IGNORADO: funcionário está inativo."
                )


            elif empresa_ativa is not True:

                print(
                    "⛔ IGNORADO: empresa está inativa."
                )


            elif tamanho_embedding != 128:

                print(
                    "⛔ IGNORADO: embedding inválido."
                )


            else:

                print(
                    "✅ ESTE ROSTO PODE SER USADO NESTE TERMINAL."
                )


        print(
            "=========================================="
        )

        print(
            ""
        )


    except Exception as error:

        print(
            "⚠️ Erro ao executar diagnóstico facial:",
            repr(
                error
            )
        )


# ==========================================================
# MONTAR MATRIZ/CACHE
#
# Essa função recebe uma lista padronizada:
#
# {
#   foto_id,
#   funcionario_id,
#   embedding,
#   nome,
#   empresa_id
# }
#
# Pode vir:
# - PostgreSQL
# - SQLite
#
# O restante do reconhecimento não precisa saber
# de onde os dados vieram.
# ==========================================================

def montar_cache_embeddings(
    empresa_id,
    registros,
    fonte
):

    empresa_id = validar_empresa_id(
        empresa_id
    )


    embeddings = []

    foto_ids = []

    funcionario_ids = []

    nomes = []

    empresa_ids = []


    # ======================================================
    # PREPARAR EMBEDDINGS
    # ======================================================

    for registro in registros:

        foto_id = registro.get(
            "foto_id"
        )

        funcionario_id = registro.get(
            "funcionario_id"
        )

        embedding = registro.get(
            "embedding"
        )

        nome = registro.get(
            "nome"
        )

        funcionario_empresa_id = registro.get(
            "empresa_id"
        )


        # ==================================================
        # CAMPOS OBRIGATÓRIOS
        # ==================================================

        if funcionario_id is None:

            print(
                "⚠️ Registro facial sem funcionario_id ignorado."
            )

            continue


        if funcionario_empresa_id is None:

            print(
                "⚠️ Registro facial sem empresa_id ignorado."
            )

            continue


        # ==================================================
        # PROTEÇÃO DE EMPRESA
        # ==================================================

        try:

            funcionario_empresa_id = int(
                funcionario_empresa_id
            )

        except Exception:

            print(
                "⚠️ empresa_id inválido no registro facial."
            )

            continue


        if (
            funcionario_empresa_id
            !=
            empresa_id
        ):

            print(
                "⛔ Rosto ignorado por pertencer a outra empresa."
            )

            print(
                "Funcionário:",
                funcionario_id
            )

            print(
                "Empresa funcionário:",
                funcionario_empresa_id
            )

            print(
                "Empresa terminal:",
                empresa_id
            )

            continue


        # ==================================================
        # EMBEDDING
        # ==================================================

        if embedding is None:

            print(
                "⚠️ Embedding vazio ignorado:",
                foto_id
            )

            continue


        try:

            tamanho_embedding = len(
                embedding
            )

        except Exception:

            tamanho_embedding = 0


        if tamanho_embedding != 128:

            print(
                "⚠️ Embedding inválido ignorado."
            )

            print(
                "Foto:",
                foto_id
            )

            print(
                "Funcionário:",
                funcionario_id
            )

            print(
                "Tamanho:",
                tamanho_embedding
            )

            continue


        # ==================================================
        # NUMPY
        # ==================================================

        try:

            embedding_np = np.asarray(
                embedding,
                dtype=np.float64
            )

        except Exception as error:

            print(
                "⚠️ Erro convertendo embedding:",
                foto_id,
                repr(
                    error
                )
            )

            continue


        if embedding_np.shape != (128,):

            print(
                "⚠️ Formato de embedding inválido:",
                foto_id,
                embedding_np.shape
            )

            continue


        # ==================================================
        # FOTO ID
        #
        # SQLite também possui seu próprio ID.
        # ==================================================

        try:

            foto_id = int(
                foto_id
            )

        except Exception:

            foto_id = 0


        # ==================================================
        # FUNCIONÁRIO ID
        # ==================================================

        try:

            funcionario_id = int(
                funcionario_id
            )

        except Exception:

            print(
                "⚠️ funcionario_id inválido:",
                funcionario_id
            )

            continue


        # ==================================================
        # ADICIONAR
        # ==================================================

        embeddings.append(
            embedding_np
        )

        foto_ids.append(
            foto_id
        )

        funcionario_ids.append(
            funcionario_id
        )

        nomes.append(
            str(
                nome or
                "Funcionário"
            )
        )

        empresa_ids.append(
            funcionario_empresa_id
        )


        print(
            "✅ Rosto carregado:",
            {
                "foto_id":
                    foto_id,

                "funcionario_id":
                    funcionario_id,

                "nome":
                    str(
                        nome or
                        "Funcionário"
                    ),

                "empresa_id":
                    funcionario_empresa_id,

                "fonte":
                    fonte,
            }
        )


    # ======================================================
    # MATRIZ
    # ======================================================

    if embeddings:

        matriz = np.vstack(
            embeddings
        ).astype(
            np.float64
        )

    else:

        matriz = np.empty(
            (
                0,
                128
            ),
            dtype=np.float64
        )


    # ======================================================
    # RESULTADO
    # ======================================================

    resultado = {

        "embeddings":
            matriz,

        "foto_ids":
            np.asarray(
                foto_ids,
                dtype=np.int64
            ),

        "funcionario_ids":
            np.asarray(
                funcionario_ids,
                dtype=np.int64
            ),

        "nomes":
            nomes,

        "empresa_ids":
            empresa_ids,

        "empresa_id":
            empresa_id,

        "fonte":
            fonte,

        "carregado_em":
            time.time(),
    }


    print(
        ""
    )

    print(
        "=========================================="
    )

    print(
        "⚡ CACHE FACIAL CARREGADO"
    )

    print(
        "🏢 EMPRESA:",
        empresa_id
    )

    print(
        "📦 FONTE:",
        fonte
    )

    print(
        "👤 EMBEDDINGS VÁLIDOS:",
        matriz.shape[0]
    )

    print(
        "🧠 FORMATO DA MATRIZ:",
        matriz.shape
    )

    print(
        "=========================================="
    )

    print(
        ""
    )


    return resultado


# ==========================================================
# CARREGAR DO SQLITE
# ==========================================================

def carregar_embeddings_sqlite(
    empresa_id
):

    empresa_id = validar_empresa_id(
        empresa_id
    )


    print(
        ""
    )

    print(
        "=========================================="
    )

    print(
        "📴 CARREGANDO ROSTOS DO CACHE LOCAL"
    )

    print(
        "🏢 Empresa:",
        empresa_id
    )

    print(
        "=========================================="
    )


    faces = carregar_faces_locais(
        empresa_id
    )


    print(
        "📸 Faces encontradas no SQLite:",
        len(
            faces
        )
    )


    registros = []


    for face in faces:

        registros.append(
            {
                "foto_id":
                    face.get(
                        "id"
                    ),

                "funcionario_id":
                    face.get(
                        "funcionario_id"
                    ),

                "embedding":
                    face.get(
                        "embedding"
                    ),

                "nome":
                    face.get(
                        "nome"
                    ),

                "empresa_id":
                    face.get(
                        "empresa_id"
                    ),
            }
        )


    return montar_cache_embeddings(
        empresa_id,
        registros,
        "cache_local"
    )


# ==========================================================
# CARREGAR DO POSTGRESQL
#
# Quando der certo:
# 1. busca dados oficiais;
# 2. monta cache;
# 3. atualiza SQLite.
# ==========================================================

def carregar_embeddings_postgresql(
    empresa_id
):

    empresa_id = validar_empresa_id(
        empresa_id
    )


    conn = None
    cur = None


    try:

        # ==================================================
        # GARANTIR ESTRUTURA
        # ==================================================

        garantir_tabela_face()


        # ==================================================
        # CONECTAR
        # ==================================================

        conn = get_db()

        cur = conn.cursor()


        # ==================================================
        # DIAGNÓSTICO
        # ==================================================

        diagnosticar_faces(
            cur,
            empresa_id
        )


        # ==================================================
        # BUSCAR SOMENTE EMPRESA ATUAL
        # ==================================================

        cur.execute(
            """
            SELECT
                fe.id,
                fe.funcionario_id,
                fe.embedding,
                f.nome,
                f.empresa_id
            FROM face_embeddings fe
            INNER JOIN funcionarios f
                ON f.id = fe.funcionario_id
            INNER JOIN empresas e
                ON e.id = f.empresa_id
            WHERE
                fe.embedding IS NOT NULL
                AND f.ativo = TRUE
                AND f.empresa_id = %s
                AND e.ativo = TRUE
            ORDER BY
                fe.funcionario_id,
                fe.id;
            """,
            (
                empresa_id,
            )
        )


        rows = cur.fetchall()


        print(
            "=========================================="
        )

        print(
            "📋 RESULTADO DO POSTGRESQL"
        )

        print(
            "🏢 Empresa:",
            empresa_id
        )

        print(
            "📸 Registros:",
            len(
                rows
            )
        )

        print(
            "=========================================="
        )


        registros = []


        for (
            foto_id,
            funcionario_id,
            embedding,
            nome,
            funcionario_empresa_id
        ) in rows:

            registros.append(
                {
                    "foto_id":
                        foto_id,

                    "funcionario_id":
                        funcionario_id,

                    "embedding":
                        embedding,

                    "nome":
                        nome,

                    "empresa_id":
                        funcionario_empresa_id,
                }
            )


        # ==================================================
        # MONTAR CACHE
        # ==================================================

        resultado = montar_cache_embeddings(
            empresa_id,
            registros,
            "postgresql"
        )


        # ==================================================
        # ATUALIZAR SQLITE
        #
        # Somente substituímos o cache local depois que
        # a consulta PostgreSQL terminou corretamente.
        #
        # Se PostgreSQL estiver fora do ar, nunca apagamos
        # o cache local antigo.
        # ==================================================

        faces_para_salvar = []


        for indice in range(
            resultado[
                "embeddings"
            ].shape[0]
        ):

            faces_para_salvar.append(
                {
                    "funcionario_id":
                        int(
                            resultado[
                                "funcionario_ids"
                            ][
                                indice
                            ]
                        ),

                    "nome":
                        resultado[
                            "nomes"
                        ][
                            indice
                        ],

                    "embedding":
                        resultado[
                            "embeddings"
                        ][
                            indice
                        ].tolist(),
                }
            )


        try:

            total_salvo = substituir_faces_empresa(
                empresa_id,
                faces_para_salvar
            )


            print(
                "=========================================="
            )

            print(
                "💾 CACHE SQLITE ATUALIZADO"
            )

            print(
                "🏢 Empresa:",
                empresa_id
            )

            print(
                "📸 Faces:",
                total_salvo
            )

            print(
                "=========================================="
            )


        except Exception as error_sqlite:

            print(
                "⚠️ PostgreSQL funcionou, mas houve erro "
                "ao atualizar o cache SQLite:"
            )

            print(
                repr(
                    error_sqlite
                )
            )


        return resultado


    finally:

        if cur:

            try:

                cur.close()

            except Exception:

                pass


        if conn:

            try:

                conn.close()

            except Exception:

                pass

            # ==========================================================
# CARREGAR EMBEDDINGS
#
# Estratégia:
#
# 1. tenta PostgreSQL;
# 2. se funcionar, atualiza SQLite;
# 3. se PostgreSQL falhar, usa SQLite.
# ==========================================================

def carregar_embeddings(
    empresa_id
):

    empresa_id = validar_empresa_id(
        empresa_id
    )


    # ======================================================
    # TENTAR POSTGRESQL
    # ======================================================

    try:

        print(
            ""
        )

        print(
            "=========================================="
        )

        print(
            "🌐 TENTANDO CARREGAR ROSTOS DO POSTGRESQL"
        )

        print(
            "🏢 Empresa:",
            empresa_id
        )

        print(
            "=========================================="
        )


        return carregar_embeddings_postgresql(
            empresa_id
        )


    except Exception as error_postgres:

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
                error_postgres
            )
        )

        print(
            "📴 Tentando cache facial local..."
        )

        print(
            "=========================================="
        )


    # ======================================================
    # FALLBACK SQLITE
    # ======================================================

    try:

        cache_local = carregar_embeddings_sqlite(
                empresa_id
            )


        if (
            cache_local[
                "embeddings"
            ].shape[0]
            >
            0
        ):

            print(
                ""
            )

            print(
                "=========================================="
            )

            print(
                "✅ RECONHECIMENTO OFFLINE DISPONÍVEL"
            )

            print(
                "🏢 Empresa:",
                empresa_id
            )

            print(
                "📸 Embeddings:",
                cache_local[
                    "embeddings"
                ].shape[0]
            )

            print(
                "=========================================="
            )

            print(
                ""
            )


            return cache_local


        print(
            "⚠️ Cache SQLite está vazio para esta empresa."
        )


        return cache_local


    except Exception as error_local:

        print(
            ""
        )

        print(
            "=========================================="
        )

        print(
            "❌ ERRO AO CARREGAR CACHE LOCAL"
        )

        print(
            repr(
                error_local
            )
        )

        print(
            "=========================================="
        )


        return criar_cache_vazio(
            empresa_id,
            "cache_local"
        )


# ==========================================================
# OBTER CACHE
# ==========================================================

def obter_embeddings(
    empresa_id
):

    chave = validar_empresa_id(
        empresa_id
    )


    agora = time.time()


    # ======================================================
    # CACHE EM MEMÓRIA
    # ======================================================

    with _cache_lock:

        cache_existente = _cache.get(
            chave
        )


        if (
            cache_existente
            and
            (
                agora
                -
                cache_existente[
                    "carregado_em"
                ]
            )
            <
            CACHE_SECONDS
        ):

            print(
                "⚡ Usando cache facial em memória."
            )

            print(
                "🏢 Empresa:",
                chave
            )

            print(
                "📦 Fonte original:",
                cache_existente.get(
                    "fonte",
                    "desconhecida"
                )
            )

            print(
                "👤 Embeddings:",
                cache_existente[
                    "embeddings"
                ].shape[0]
            )


            return cache_existente


    # ======================================================
    # CACHE EXPIRADO / NÃO EXISTE
    # ======================================================

    novo_cache = carregar_embeddings(
        chave
    )


    with _cache_lock:

        _cache[
            chave
        ] = novo_cache


    return novo_cache


# ==========================================================
# RECONHECER ROSTO
# ==========================================================

@router.post(
    "/recognize"
)
def recognize(
    data: FaceRecognize
):

    inicio_total = time.perf_counter()


    try:

        # ==================================================
        # VALIDAR IMAGEM
        # ==================================================

        if not data.image_base64:

            return {
                "matched":
                    False,

                "error":
                    "image_not_provided",
            }


        # ==================================================
        # EMPRESA
        # ==================================================

        try:

            empresa_id = validar_empresa_id(
                data.empresa_id
            )

        except Exception:

            return {
                "matched":
                    False,

                "error":
                    "invalid_empresa_id",
            }


        print(
            ""
        )

        print(
            "=========================================="
        )

        print(
            "🏢 RECONHECIMENTO SOLICITADO"
        )

        print(
            "Empresa recebida:",
            empresa_id
        )

        print(
            "=========================================="
        )


        # ==================================================
        # DECODIFICAR IMAGEM
        # ==================================================

        inicio = time.perf_counter()


        img = decode_image(
            data.image_base64
        )


        tempo_decode = (
            time.perf_counter()
            -
            inicio
        )


        # ==================================================
        # GERAR EMBEDDING DA CÂMERA
        # ==================================================

        inicio = time.perf_counter()


        emb = get_face_embedding(
            img,
            reduzir=True
        )


        tempo_embedding = (
            time.perf_counter()
            -
            inicio
        )


        # ==================================================
        # SEM ROSTO
        # ==================================================

        if emb is None:

            print(
                "⚠️ Nenhum rosto encontrado no frame."
            )


            return {
                "matched":
                    False,

                "error":
                    "no_face",
            }


        emb = np.asarray(
            emb,
            dtype=np.float64
        )


        if emb.shape != (128,):

            print(
                "⚠️ Embedding da câmera inválido:",
                emb.shape
            )


            return {
                "matched":
                    False,

                "error":
                    "invalid_camera_embedding",
            }


        # ==================================================
        # OBTER EMBEDDINGS
        # ==================================================

        inicio = time.perf_counter()


        dados = obter_embeddings(
            empresa_id
        )


        tempo_cache = (
            time.perf_counter()
            -
            inicio
        )


        embeddings = dados[
            "embeddings"
        ]


        fonte = dados.get(
            "fonte",
            "desconhecida"
        )


        print(
            "📦 Fonte dos rostos:",
            fonte
        )


        # ==================================================
        # NENHUM ROSTO
        # ==================================================

        if embeddings.shape[0] == 0:

            print(
                ""
            )

            print(
                "=========================================="
            )

            print(
                "⚠️ NENHUM ROSTO DISPONÍVEL"
            )

            print(
                "Empresa:",
                empresa_id
            )

            print(
                "Fonte:",
                fonte
            )

            print(
                "=========================================="
            )


            return {
                "matched":
                    False,

                "error":
                    "no_registered_faces",

                "empresa_id":
                    empresa_id,

                "fonte":
                    fonte,
            }


        # ==================================================
        # COMPARAÇÃO VETORIZADA
        # ==================================================

        inicio = time.perf_counter()


        diferencas = (
            embeddings
            -
            emb
        )


        distancias = np.linalg.norm(
            diferencas,
            axis=1
        )


        tempo_comparacao = (
            time.perf_counter()
            -
            inicio
        )


        # ==================================================
        # MELHOR FOTO POR FUNCIONÁRIO
        # ==================================================

        funcionarios = {}


        funcionario_ids = dados[
            "funcionario_ids"
        ]

        foto_ids = dados[
            "foto_ids"
        ]

        nomes = dados[
            "nomes"
        ]

        empresa_ids = dados[
            "empresa_ids"
        ]


        for indice in range(
            len(
                distancias
            )
        ):

            funcionario_id = int(
                funcionario_ids[
                    indice
                ]
            )


            distancia = float(
                distancias[
                    indice
                ]
            )


            foto_id = int(
                foto_ids[
                    indice
                ]
            )


            nome = str(
                nomes[
                    indice
                ]
            )


            funcionario_empresa_id = int(
                empresa_ids[
                    indice
                ]
            )


            # ==================================================
            # PROTEÇÃO ADICIONAL
            # ==================================================

            if (
                funcionario_empresa_id
                !=
                empresa_id
            ):

                print(
                    "⛔ Embedding ignorado durante comparação."
                )

                print(
                    "Funcionário:",
                    funcionario_id
                )

                print(
                    "Empresa funcionário:",
                    funcionario_empresa_id
                )

                print(
                    "Empresa terminal:",
                    empresa_id
                )

                continue


            # ==================================================
            # PRIMEIRO EMBEDDING DO FUNCIONÁRIO
            # ==================================================

            if (
                funcionario_id
                not in funcionarios
            ):

                funcionarios[
                    funcionario_id
                ] = {

                    "funcionario_id":
                        funcionario_id,

                    "nome":
                        nome,

                    "empresa_id":
                        funcionario_empresa_id,

                    "distance":
                        distancia,

                    "foto_id":
                        foto_id,

                    "total_embeddings":
                        1,
                }


            # ==================================================
            # OUTRA FOTO DO MESMO FUNCIONÁRIO
            # ==================================================

            else:

                funcionarios[
                    funcionario_id
                ][
                    "total_embeddings"
                ] += 1


                if (
                    distancia
                    <
                    funcionarios[
                        funcionario_id
                    ][
                        "distance"
                    ]
                ):

                    funcionarios[
                        funcionario_id
                    ][
                        "distance"
                    ] = distancia


                    funcionarios[
                        funcionario_id
                    ][
                        "foto_id"
                    ] = foto_id


        # ==================================================
        # CANDIDATOS
        # ==================================================

        candidatos = sorted(
            funcionarios.values(),
            key=lambda x:
                x[
                    "distance"
                ]
        )


        if not candidatos:

            return {
                "matched":
                    False,

                "error":
                    "no_registered_faces",

                "empresa_id":
                    empresa_id,

                "fonte":
                    fonte,
            }


        # ==================================================
        # MELHOR CANDIDATO
        # ==================================================

        melhor = candidatos[
            0
        ]


        # ==================================================
        # SEGUNDO
        # ==================================================

        segundo = (
            candidatos[
                1
            ]
            if len(
                candidatos
            ) > 1
            else None
        )


        melhor_distancia = float(
            melhor[
                "distance"
            ]
        )


        segunda_distancia = (
            float(
                segundo[
                    "distance"
                ]
            )
            if segundo
            else None
        )


        # ==================================================
        # GAP
        # ==================================================

        gap = (
            (
                segunda_distancia
                -
                melhor_distancia
            )
            if segunda_distancia
            is not None
            else None
        )


        # ==================================================
        # TEMPO
        # ==================================================

        tempo_total = (
            time.perf_counter()
            -
            inicio_total
        )


        # ==================================================
        # LOG
        # ==================================================

        print(
            ""
        )

        print(
            "=========================================="
        )

        print(
            "⚡ RESULTADO DO RECONHECIMENTO"
        )

        print(
            "🏢 Empresa terminal:",
            empresa_id
        )

        print(
            "📦 Fonte:",
            fonte
        )

        print(
            "👤 Funcionário:",
            melhor[
                "funcionario_id"
            ],
            "-",
            melhor[
                "nome"
            ]
        )

        print(
            "🏢 Empresa funcionário:",
            melhor[
                "empresa_id"
            ]
        )

        print(
            "📸 Foto utilizada:",
            melhor[
                "foto_id"
            ]
        )

        print(
            "📚 Fotos deste funcionário:",
            melhor[
                "total_embeddings"
            ]
        )

        print(
            "📏 Distância:",
            round(
                melhor_distancia,
                4
            )
        )

        print(
            "📏 Tolerância:",
            TOLERANCE
        )

        print(
            "📐 Segunda distância:",
            (
                round(
                    segunda_distancia,
                    4
                )
                if segunda_distancia
                is not None
                else None
            )
        )

        print(
            "📐 Gap:",
            (
                round(
                    gap,
                    4
                )
                if gap is not None
                else None
            )
        )

        print(
            "⏱ Decode:",
            round(
                tempo_decode *
                1000,
                1
            ),
            "ms"
        )

        print(
            "⏱ Embedding:",
            round(
                tempo_embedding *
                1000,
                1
            ),
            "ms"
        )

        print(
            "⏱ Cache:",
            round(
                tempo_cache *
                1000,
                1
            ),
            "ms"
        )

        print(
            "⏱ Comparação:",
            round(
                tempo_comparacao *
                1000,
                1
            ),
            "ms"
        )

        print(
            "⏱ TOTAL:",
            round(
                tempo_total *
                1000,
                1
            ),
            "ms"
        )

        print(
            "=========================================="
        )

        print(
            ""
        )


        # ==================================================
        # PROTEÇÃO FINAL DA EMPRESA
        # ==================================================

        if (
            int(
                melhor[
                    "empresa_id"
                ]
            )
            !=
            empresa_id
        ):

            print(
                "=========================================="
            )

            print(
                "⛔ BLOQUEADO"
            )

            print(
                "Funcionário pertence a outra empresa."
            )

            print(
                "=========================================="
            )


            return {
                "matched":
                    False,

                "error":
                    "employee_from_another_company",

                "empresa_id":
                    empresa_id,

                "fonte":
                    fonte,
            }


        # ==================================================
        # FORA DA TOLERÂNCIA
        # ==================================================

        if (
            melhor_distancia
            >
            TOLERANCE
        ):

            print(
                "❌ Distância acima da tolerância."
            )


            return {
                "matched":
                    False,

                "empresa_id":
                    empresa_id,

                "distance":
                    melhor_distancia,

                "second_distance":
                    segunda_distancia,

                "gap":
                    gap,

                "reason":
                    "distance_above_tolerance",

                "fonte":
                    fonte,
            }


        # ==================================================
        # AMBÍGUO
        # ==================================================

        if (
            segunda_distancia
            is not None
            and
            gap is not None
            and
            gap < MIN_DISTANCE_GAP
        ):

            print(
                "⚠️ Reconhecimento ambíguo."
            )


            return {
                "matched":
                    False,

                "empresa_id":
                    empresa_id,

                "distance":
                    melhor_distancia,

                "second_distance":
                    segunda_distancia,

                "gap":
                    gap,

                "reason":
                    "ambiguous_match",

                "fonte":
                    fonte,
            }


        # ==================================================
        # RECONHECIDO
        # ==================================================

        print(
            "=========================================="
        )

        print(
            "✅ ROSTO RECONHECIDO"
        )

        print(
            "Funcionário:",
            melhor[
                "funcionario_id"
            ],
            "-",
            melhor[
                "nome"
            ]
        )

        print(
            "Empresa:",
            melhor[
                "empresa_id"
            ]
        )

        print(
            "Fonte:",
            fonte
        )

        print(
            "=========================================="
        )


        return {
            "matched":
                True,

            "funcionario_id":
                melhor[
                    "funcionario_id"
                ],

            "nome":
                melhor[
                    "nome"
                ],

            "empresa_id":
                melhor[
                    "empresa_id"
                ],

            "distance":
                melhor_distancia,

            "second_distance":
                segunda_distancia,

            "gap":
                gap,

            "foto_id":
                melhor[
                    "foto_id"
                ],

            "total_embeddings":
                melhor[
                    "total_embeddings"
                ],

            "fonte":
                fonte,

            "processing_ms":
                round(
                    tempo_total *
                    1000,
                    1
                ),
        }


    except Exception as error:

        print(
            ""
        )

        print(
            "=========================================="
        )

        print(
            "❌ ERRO RECOGNIZE"
        )

        print(
            repr(
                error
            )
        )

        print(
            "=========================================="
        )

        print(
            ""
        )


        return {
            "matched":
                False,

            "error":
                str(
                    error
                ),
        }