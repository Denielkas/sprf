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
# CACHE DOS EMBEDDINGS
#
# Cada empresa possui seu próprio cache.
#
# Exemplo:
#
# _cache[1] -> rostos da empresa 1
# _cache[6] -> rostos da empresa 6
#
# Nunca misturar rostos entre empresas.
# ==========================================================

_cache = {}

_cache_lock = threading.Lock()


# ==========================================================
# LIMPAR CACHE
# ==========================================================

def limpar_cache_faces(
    empresa_id=None
):

    global _cache

    with _cache_lock:

        if empresa_id is None:

            _cache = {}

            print(
                "♻️ Cache facial totalmente limpo."
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
            "♻️ Cache facial limpo para empresa:",
            chave
        )


# ==========================================================
# DIAGNÓSTICO DOS ROSTOS
#
# Serve para mostrar no terminal:
#
# - foto
# - funcionário
# - empresa
# - funcionário ativo/inativo
# - empresa ativa/inativa
# - tamanho do embedding
#
# Isso NÃO altera o reconhecimento.
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
# CARREGAR EMBEDDINGS
# ==========================================================

def carregar_embeddings(
    empresa_id
):

    conn = None
    cur = None

    try:

        # ==================================================
        # VALIDAR EMPRESA
        # ==================================================

        if empresa_id is None:

            raise ValueError(
                "empresa_id é obrigatório para o reconhecimento facial."
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


        # ==================================================
        # GARANTIR ESTRUTURA
        # ==================================================

        garantir_tabela_face()


        # ==================================================
        # BANCO
        # ==================================================

        conn = get_db()

        cur = conn.cursor()


        # ==================================================
        # DIAGNÓSTICO
        #
        # Mostra TODOS os rostos existentes para podermos
        # verificar a qual empresa pertencem.
        # ==================================================

        diagnosticar_faces(
            cur,
            empresa_id
        )


        # ==================================================
        # BUSCAR SOMENTE ROSTOS DA EMPRESA ATUAL
        #
        # ESTA É A PROTEÇÃO PRINCIPAL.
        #
        # Empresa X nunca carrega funcionário da Empresa Y.
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
            "📋 RESULTADO DO FILTRO DA EMPRESA"
        )

        print(
            "🏢 Empresa:",
            empresa_id
        )

        print(
            "📸 Registros retornados pela consulta:",
            len(
                rows
            )
        )

        print(
            "=========================================="
        )


        embeddings = []

        foto_ids = []

        funcionario_ids = []

        nomes = []

        empresa_ids = []


        # ==================================================
        # PREPARAR EMBEDDINGS
        # ==================================================

        for (
            foto_id,
            funcionario_id,
            embedding,
            nome,
            funcionario_empresa_id
        ) in rows:

            # ==================================================
            # EMBEDDING VAZIO
            # ==================================================

            if embedding is None:

                print(
                    "⚠️ Foto ignorada porque embedding está vazio:",
                    foto_id
                )

                continue


            # ==================================================
            # VALIDAR TAMANHO
            # ==================================================

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
            # SEGUNDA PROTEÇÃO DE EMPRESA
            # ==================================================

            if (
                int(
                    funcionario_empresa_id
                )
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
                    "Empresa do funcionário:",
                    funcionario_empresa_id
                )

                print(
                    "Empresa do terminal:",
                    empresa_id
                )

                continue


            # ==================================================
            # CONVERTER EMBEDDING
            # ==================================================

            try:

                embedding_np = np.asarray(
                    embedding,
                    dtype=np.float64
                )

            except Exception as error:

                print(
                    "⚠️ Erro convertendo embedding da foto:",
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
            # ADICIONAR
            # ==================================================

            embeddings.append(
                embedding_np
            )

            foto_ids.append(
                int(
                    foto_id
                )
            )

            funcionario_ids.append(
                int(
                    funcionario_id
                )
            )

            nomes.append(
                str(
                    nome
                )
            )

            empresa_ids.append(
                int(
                    funcionario_empresa_id
                )
            )


            print(
                "✅ Rosto carregado:",
                {
                    "foto_id":
                        int(
                            foto_id
                        ),

                    "funcionario_id":
                        int(
                            funcionario_id
                        ),

                    "nome":
                        str(
                            nome
                        ),

                    "empresa_id":
                        int(
                            funcionario_empresa_id
                        ),
                }
            )


        # ==================================================
        # MATRIZ
        # ==================================================

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


        # ==================================================
        # RESULTADO DO CACHE
        # ==================================================

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
# OBTER CACHE
# ==========================================================

def obter_embeddings(
    empresa_id
):

    # ======================================================
    # EMPRESA OBRIGATÓRIA
    # ======================================================

    if empresa_id is None:

        raise ValueError(
            "empresa_id é obrigatório para carregar os rostos."
        )


    try:

        chave = int(
            empresa_id
        )

    except Exception:

        raise ValueError(
            "empresa_id inválido."
        )


    if chave <= 0:

        raise ValueError(
            "empresa_id inválido."
        )


    agora = time.time()


    # ======================================================
    # CACHE SEPARADO POR EMPRESA
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
                "⚡ Usando cache facial da empresa:",
                chave
            )

            print(
                "👤 Embeddings no cache:",
                cache_existente[
                    "embeddings"
                ].shape[0]
            )

            return cache_existente


    # ======================================================
    # CARREGAR SOMENTE ESTA EMPRESA
    # ======================================================

    novo_cache = carregar_embeddings(
        chave
    )


    # ======================================================
    # SALVAR CACHE DA EMPRESA
    # ======================================================

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
        # EMPRESA OBRIGATÓRIA
        # ==================================================

        try:

            empresa_id = int(
                data.empresa_id
            )

        except Exception:

            return {
                "matched":
                    False,

                "error":
                    "invalid_empresa_id",
            }


        if empresa_id <= 0:

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
        # OBTER EMBEDDINGS CADASTRADOS
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


        # ==================================================
        # NENHUM CADASTRO PARA ESTA EMPRESA
        # ==================================================

        if embeddings.shape[0] == 0:

            print(
                ""
            )

            print(
                "=========================================="
            )

            print(
                "⚠️ NENHUM ROSTO DISPONÍVEL PARA A EMPRESA"
            )

            print(
                "Empresa:",
                empresa_id
            )

            print(
                "O diagnóstico acima mostra o motivo."
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
                    "no_registered_faces",

                "empresa_id":
                    empresa_id,
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

            print(
                "⚠️ Nenhum candidato válido após proteção de empresa."
            )

            return {
                "matched":
                    False,

                "error":
                    "no_registered_faces",

                "empresa_id":
                    empresa_id,
            }


        # ==================================================
        # MELHOR CANDIDATO
        # ==================================================

        melhor = candidatos[
            0
        ]


        # ==================================================
        # SEGUNDO CANDIDATO
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
        # TEMPO TOTAL
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
        # PROTEÇÃO FINAL DE EMPRESA
        #
        # Mesmo que exista algum erro anterior,
        # nunca devolver funcionário de outra empresa.
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
                "Empresa terminal:",
                empresa_id
            )

            print(
                "Empresa funcionário:",
                melhor[
                    "empresa_id"
                ]
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
                "❌ Rosto encontrado, mas distância acima da tolerância."
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