from fastapi import APIRouter
import psycopg2

from app.models import FaceEnroll

from app.database import (
    get_db,
)

from app.utils_face import (
    decode_image,
    get_face_embedding,
    imagem_para_jpeg_bytes,
)


router = APIRouter()


# ==========================================================
# GARANTIR TABELA FACE_EMBEDDINGS
#
# ESTRUTURA:
#
# id | funcionario_id | embedding | foto
#
# Um funcionário pode possuir várias imagens.
# ==========================================================

def garantir_tabela_face_embeddings(
    cur
):

    # ======================================================
    # CRIAR TABELA CASO NÃO EXISTA
    # ======================================================

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS face_embeddings (

            id BIGSERIAL
            PRIMARY KEY,

            funcionario_id BIGINT
            NOT NULL
            REFERENCES funcionarios(id)
            ON DELETE CASCADE,

            embedding FLOAT8[],

            foto BYTEA,

            foto_mime VARCHAR(100),

            foto_path TEXT,

            created_at TIMESTAMP
            NOT NULL
            DEFAULT NOW(),

            updated_at TIMESTAMP
            NOT NULL
            DEFAULT NOW()
        );
        """
    )


    # ======================================================
    # GARANTIR ID
    # ======================================================

    cur.execute(
        """
        ALTER TABLE face_embeddings
        ADD COLUMN IF NOT EXISTS
        id BIGSERIAL;
        """
    )


    # ======================================================
    # GARANTIR FUNCIONARIO_ID
    # ======================================================

    cur.execute(
        """
        ALTER TABLE face_embeddings
        ADD COLUMN IF NOT EXISTS
        funcionario_id BIGINT;
        """
    )


    # ======================================================
    # GARANTIR EMBEDDING
    # ======================================================

    cur.execute(
        """
        ALTER TABLE face_embeddings
        ADD COLUMN IF NOT EXISTS
        embedding FLOAT8[];
        """
    )


    # ======================================================
    # GARANTIR FOTO
    # ======================================================

    cur.execute(
        """
        ALTER TABLE face_embeddings
        ADD COLUMN IF NOT EXISTS
        foto BYTEA;
        """
    )


    # ======================================================
    # GARANTIR MIME TYPE
    # ======================================================

    cur.execute(
        """
        ALTER TABLE face_embeddings
        ADD COLUMN IF NOT EXISTS
        foto_mime VARCHAR(100);
        """
    )


    # ======================================================
    # FOTO_PATH
    #
    # Mantido para compatibilidade com registros antigos.
    # ======================================================

    cur.execute(
        """
        ALTER TABLE face_embeddings
        ADD COLUMN IF NOT EXISTS
        foto_path TEXT;
        """
    )


    # ======================================================
    # CREATED_AT
    # ======================================================

    cur.execute(
        """
        ALTER TABLE face_embeddings
        ADD COLUMN IF NOT EXISTS
        created_at TIMESTAMP
        DEFAULT NOW();
        """
    )


    # ======================================================
    # UPDATED_AT
    # ======================================================

    cur.execute(
        """
        ALTER TABLE face_embeddings
        ADD COLUMN IF NOT EXISTS
        updated_at TIMESTAMP
        DEFAULT NOW();
        """
    )


    # ======================================================
    # EMBEDDING PODE SER NULL
    # ======================================================

    cur.execute(
        """
        ALTER TABLE face_embeddings
        ALTER COLUMN embedding
        DROP NOT NULL;
        """
    )


    # ======================================================
    # ÍNDICE
    # ======================================================

    cur.execute(
        """
        CREATE INDEX IF NOT EXISTS
        idx_face_embeddings_funcionario_id

        ON face_embeddings (
            funcionario_id
        );
        """
    )


# ==========================================================
# ATUALIZAR CACHE FACIAL DA EMPRESA
#
# IMPORTANTE:
#
# Esse import é feito dentro da função para evitar
# importação circular entre:
#
# enroll.py
# recognize.py
# ==========================================================

def atualizar_cache_empresa(
    empresa_id
):

    try:

        # ==================================================
        # IMPORTS INTERNOS
        #
        # Evita importação circular.
        # ==================================================

        from app.routes.recognize import (
            limpar_cache_faces,
        )

        from app.offline.face_cache import (
            substituir_faces_empresa,
        )


        # ==================================================
        # LIMPAR CACHE EM MEMÓRIA
        #
        # Isso já garante que o próximo reconhecimento
        # carregará os dados atualizados.
        # ==================================================

        limpar_cache_faces(
            empresa_id
        )


        print(
            ""
        )

        print(
            "=========================================="
        )

        print(
            "♻️ CACHE RAM INVALIDADO"
        )

        print(
            "🏢 Empresa:",
            empresa_id
        )

        print(
            "=========================================="
        )


        # ==================================================
        # ATUALIZAR SQLITE
        #
        # Aqui NÃO chamamos:
        #
        # garantir_tabela_face()
        #
        # nem:
        #
        # carregar_embeddings_postgresql()
        #
        # porque a estrutura já foi preparada no startup.
        # ==================================================

        conn_cache = None
        cur_cache = None


        try:

            conn_cache = get_db()

            cur_cache = conn_cache.cursor()


            cur_cache.execute(
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


            rows = cur_cache.fetchall()


            faces_para_salvar = []


            for (
                foto_id,
                funcionario_id,
                embedding,
                funcionario_nome,
                funcionario_empresa_id
            ) in rows:

                if embedding is None:

                    continue


                try:

                    if len(
                        embedding
                    ) != 128:

                        continue

                except Exception:

                    continue


                if (
                    int(
                        funcionario_empresa_id
                    )
                    !=
                    int(
                        empresa_id
                    )
                ):

                    continue


                faces_para_salvar.append(
                    {
                        "funcionario_id":
                            int(
                                funcionario_id
                            ),

                        "nome":
                            str(
                                funcionario_nome
                            ),

                        "embedding":
                            list(
                                embedding
                            ),
                    }
                )


            # ==================================================
            # SUBSTITUIR CACHE SQLITE DA EMPRESA
            # ==================================================

            total_salvo = substituir_faces_empresa(
                empresa_id,
                faces_para_salvar
            )


            print(
                ""
            )

            print(
                "=========================================="
            )

            print(
                "💾 CACHE OFFLINE ATUALIZADO"
            )

            print(
                "🏢 Empresa:",
                empresa_id
            )

            print(
                "📸 Embeddings:",
                total_salvo
            )

            print(
                "=========================================="
            )

            print(
                ""
            )


            return True


        finally:

            if cur_cache:

                try:

                    cur_cache.close()

                except Exception:

                    pass


            if conn_cache:

                try:

                    conn_cache.close()

                except Exception:

                    pass


    except Exception as error:

        # ==================================================
        # A FOTO JÁ ESTÁ SALVA.
        #
        # Portanto erro no cache não deve transformar
        # o cadastro em erro.
        # ==================================================

        print(
            ""
        )

        print(
            "=========================================="
        )

        print(
            "⚠️ FOTO SALVA, MAS CACHE OFFLINE "
            "NÃO FOI ATUALIZADO"
        )

        print(
            "🏢 Empresa:",
            empresa_id
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


        return False

# ==========================================================
# CADASTRAR NOVA IMAGEM FACIAL
# ==========================================================

@router.post(
    "/enroll"
)
def enroll(
    data: FaceEnroll
):

    conn = None
    cur = None


    try:

        # ==================================================
        # VALIDAR FUNCIONÁRIO
        # ==================================================

        if not data.funcionario_id:

            return {
                "ok":
                    False,

                "error":
                    "Funcionário não informado.",
            }


        # ==================================================
        # VALIDAR IMAGEM
        # ==================================================

        if not data.image_base64:

            return {
                "ok":
                    False,

                "error":
                    "Imagem não informada.",
            }


        # ==================================================
        # DECODIFICAR IMAGEM
        # ==================================================

        img = decode_image(
            data.image_base64
        )


        # ==================================================
        # GERAR EMBEDDING
        # ==================================================

        emb = get_face_embedding(
            img
        )


        if emb is None:

            return {
                "ok":
                    False,

                "error":
                    "Nenhum rosto encontrado na imagem.",
            }


        # ==================================================
        # VALIDAR EMBEDDING
        # ==================================================

        try:

            embedding_lista = emb.tolist()

        except Exception:

            return {
                "ok":
                    False,

                "error":
                    "Embedding facial inválido.",
            }


        if (
            len(
                embedding_lista
            )
            !=
            128
        ):

            return {
                "ok":
                    False,

                "error":
                    "Embedding facial possui tamanho inválido.",
            }


        # ==================================================
        # CONVERTER PARA JPEG
        # ==================================================

        foto_bytes = imagem_para_jpeg_bytes(
            img
        )


        if not foto_bytes:

            return {
                "ok":
                    False,

                "error":
                    "Não foi possível processar a imagem facial.",
            }


        # ==================================================
        # LOG
        # ==================================================

        print(
            "=========================================="
        )

        print(
            "📸 CADASTRANDO NOVA IMAGEM FACIAL"
        )

        print(
            "Funcionário:",
            data.funcionario_id
        )

        print(
            "Embedding:",
            len(
                embedding_lista
            ),
            "valores"
        )

        print(
            "Foto:",
            len(
                foto_bytes
            ),
            "bytes"
        )

        print(
            "=========================================="
        )


        # ==================================================
        # CONECTAR AO POSTGRESQL
        # ==================================================

        conn = get_db()

        cur = conn.cursor()


        # ==================================================
        # GARANTIR TABELA
        # ==================================================

        garantir_tabela_face_embeddings(
            cur
        )


        # ==================================================
        # VERIFICAR FUNCIONÁRIO
        #
        # Também pegamos:
        #
        # - empresa_id
        # - funcionário ativo
        # - empresa ativa
        #
        # Assim não dependemos de empresa_id enviado
        # pelo navegador.
        # ==================================================

        cur.execute(
            """
            SELECT
                f.id,
                f.nome,
                f.empresa_id,
                f.ativo,
                e.ativo

            FROM funcionarios f

            INNER JOIN empresas e
                ON e.id = f.empresa_id

            WHERE
                f.id = %s

            LIMIT 1;
            """,
            (
                data.funcionario_id,
            )
        )


        funcionario = cur.fetchone()


        if not funcionario:

            conn.rollback()

            return {
                "ok":
                    False,

                "error":
                    "Funcionário não encontrado.",
            }


        funcionario_id = int(
            funcionario[0]
        )

        funcionario_nome = str(
            funcionario[1]
        )

        empresa_id = int(
            funcionario[2]
        )

        funcionario_ativo = funcionario[3]

        empresa_ativa = funcionario[4]


        # ==================================================
        # FUNCIONÁRIO INATIVO
        # ==================================================

        if funcionario_ativo is not True:

            conn.rollback()

            return {
                "ok":
                    False,

                "error":
                    "Não é possível cadastrar rosto para funcionário inativo.",
            }


        # ==================================================
        # EMPRESA INATIVA
        # ==================================================

        if empresa_ativa is not True:

            conn.rollback()

            return {
                "ok":
                    False,

                "error":
                    "Não é possível cadastrar rosto para empresa inativa.",
            }


        print(
            "👤 Funcionário:",
            funcionario_id,
            "-",
            funcionario_nome
        )

        print(
            "🏢 Empresa:",
            empresa_id
        )


        # ==================================================
        # CONTAR IMAGENS JÁ CADASTRADAS
        # ==================================================

        cur.execute(
            """
            SELECT
                COUNT(*)

            FROM face_embeddings

            WHERE funcionario_id = %s;
            """,
            (
                funcionario_id,
            )
        )


        resultado_contagem = cur.fetchone()


        quantidade_anterior = (
            resultado_contagem[0]
            if resultado_contagem
            else 0
        )


        print(
            "Imagens já cadastradas:",
            quantidade_anterior
        )


        # ==================================================
        # CADASTRAR NOVA IMAGEM
        #
        # NÃO UTILIZAMOS:
        #
        # ON CONFLICT (funcionario_id)
        #
        # Cada chamada cria uma nova linha.
        # ==================================================

        cur.execute(
            """
            INSERT INTO face_embeddings (

                funcionario_id,

                embedding,

                foto,

                foto_mime,

                foto_path,

                created_at,

                updated_at

            )

            VALUES (

                %s,

                %s,

                %s,

                %s,

                NULL,

                NOW(),

                NOW()

            )

            RETURNING
                id,
                funcionario_id,
                array_length(
                    embedding,
                    1
                ) AS tamanho_embedding,
                octet_length(
                    foto
                ) AS tamanho_foto,
                foto_mime,
                created_at;
            """,
            (
                funcionario_id,

                embedding_lista,

                psycopg2.Binary(
                    foto_bytes
                ),

                "image/jpeg",
            )
        )


        # ==================================================
        # PEGAR REGISTRO CRIADO
        # ==================================================

        registro = cur.fetchone()


        if not registro:

            conn.rollback()

            return {
                "ok":
                    False,

                "error":
                    "Não foi possível confirmar o cadastro da imagem.",
            }


        # ==================================================
        # COMMIT
        # ==================================================

        conn.commit()


        # ==================================================
        # DADOS DA NOVA FOTO
        # ==================================================

        foto_id = int(
            registro[0]
        )


        tamanho_embedding = (
            registro[2]
            if registro[2] is not None
            else 0
        )


        tamanho_foto = (
            registro[3]
            if registro[3] is not None
            else 0
        )


        foto_mime = registro[4]

        created_at = registro[5]


        # ==================================================
        # CONTAR TOTAL DE IMAGENS
        # ==================================================

        cur.execute(
            """
            SELECT
                COUNT(*)

            FROM face_embeddings

            WHERE funcionario_id = %s;
            """,
            (
                funcionario_id,
            )
        )


        resultado_total = cur.fetchone()


        total_imagens = (
            resultado_total[0]
            if resultado_total
            else 0
        )


        # ==================================================
        # LOG DE SUCESSO
        # ==================================================

        print(
            "=========================================="
        )

        print(
            "✅ NOVA IMAGEM FACIAL SALVA"
        )

        print(
            "ID da foto:",
            foto_id
        )

        print(
            "Funcionário:",
            funcionario_id,
            "-",
            funcionario_nome
        )

        print(
            "Empresa:",
            empresa_id
        )

        print(
            "Embedding:",
            tamanho_embedding
        )

        print(
            "Foto:",
            tamanho_foto,
            "bytes"
        )

        print(
            "MIME:",
            foto_mime
        )

        print(
            "Total de imagens:",
            total_imagens
        )

        print(
            "=========================================="
        )


        # ==================================================
        # ATUALIZAR CACHE
        #
        # A foto já está salva oficialmente no PostgreSQL.
        #
        # Agora:
        #
        # 1. limpa cache RAM;
        # 2. recarrega rostos da empresa;
        # 3. atualiza SQLite.
        # ==================================================

        cache_atualizado = atualizar_cache_empresa(
            empresa_id
        )


        # ==================================================
        # RESPOSTA
        # ==================================================

        return {

            "ok":
                True,

            "message":
                "Imagem facial cadastrada com sucesso.",

            "foto_id":
                foto_id,

            "funcionario_id":
                funcionario_id,

            "funcionario_nome":
                funcionario_nome,

            "empresa_id":
                empresa_id,

            "embedding_salvo":
                (
                    tamanho_embedding > 0
                ),

            "tamanho_embedding":
                tamanho_embedding,

            "foto_salva":
                (
                    tamanho_foto > 0
                ),

            "foto_bytes":
                tamanho_foto,

            "foto_mime":
                foto_mime,

            "created_at":
                (
                    created_at.isoformat()
                    if created_at
                    else None
                ),

            "quantidade_anterior":
                quantidade_anterior,

            "total_imagens":
                total_imagens,

            "cache_atualizado":
                cache_atualizado,
        }


    # ======================================================
    # ERRO
    # ======================================================

    except Exception as error:

        if conn:

            try:

                conn.rollback()

            except Exception:

                pass


        print(
            "=========================================="
        )

        print(
            "❌ ERRO NO CADASTRO FACIAL"
        )

        print(
            repr(
                error
            )
        )

        print(
            "=========================================="
        )


        return {
            "ok":
                False,

            "error":
                str(
                    error
                ),
        }


    # ======================================================
    # FECHAR CONEXÃO
    # ======================================================

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