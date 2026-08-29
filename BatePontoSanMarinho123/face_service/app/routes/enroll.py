from fastapi import APIRouter
import psycopg2

from app.models import FaceEnroll
from app.database import get_db
from app.utils_face import (
    decode_image,
    get_face_embedding,
    imagem_para_jpeg_bytes,
)


router = APIRouter()


# ==========================================================
# GARANTIR TABELA FACE_EMBEDDINGS
#
# NOVA ESTRUTURA:
#
# id | funcionario_id | embedding | foto
#
# Um funcionário pode possuir várias imagens.
# ==========================================================

def garantir_tabela_face_embeddings(cur):

    # ======================================================
    # CRIAR TABELA CASO NÃO EXISTA
    # ======================================================

    cur.execute("""
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
    """)


    # ======================================================
    # GARANTIR ID
    # ======================================================

    cur.execute("""
        ALTER TABLE face_embeddings
        ADD COLUMN IF NOT EXISTS
        id BIGSERIAL;
    """)


    # ======================================================
    # GARANTIR FUNCIONARIO_ID
    # ======================================================

    cur.execute("""
        ALTER TABLE face_embeddings
        ADD COLUMN IF NOT EXISTS
        funcionario_id BIGINT;
    """)


    # ======================================================
    # GARANTIR EMBEDDING
    # ======================================================

    cur.execute("""
        ALTER TABLE face_embeddings
        ADD COLUMN IF NOT EXISTS
        embedding FLOAT8[];
    """)


    # ======================================================
    # GARANTIR FOTO
    # ======================================================

    cur.execute("""
        ALTER TABLE face_embeddings
        ADD COLUMN IF NOT EXISTS
        foto BYTEA;
    """)


    # ======================================================
    # GARANTIR MIME TYPE
    # ======================================================

    cur.execute("""
        ALTER TABLE face_embeddings
        ADD COLUMN IF NOT EXISTS
        foto_mime VARCHAR(100);
    """)


    # ======================================================
    # FOTO_PATH
    #
    # Mantemos para compatibilidade com registros antigos.
    # Novos cadastros não usam essa coluna.
    # ======================================================

    cur.execute("""
        ALTER TABLE face_embeddings
        ADD COLUMN IF NOT EXISTS
        foto_path TEXT;
    """)


    # ======================================================
    # CREATED_AT
    # ======================================================

    cur.execute("""
        ALTER TABLE face_embeddings
        ADD COLUMN IF NOT EXISTS
        created_at TIMESTAMP
        DEFAULT NOW();
    """)


    # ======================================================
    # UPDATED_AT
    # ======================================================

    cur.execute("""
        ALTER TABLE face_embeddings
        ADD COLUMN IF NOT EXISTS
        updated_at TIMESTAMP
        DEFAULT NOW();
    """)


    # ======================================================
    # EMBEDDING PODE SER NULL
    # ======================================================

    cur.execute("""
        ALTER TABLE face_embeddings
        ALTER COLUMN embedding
        DROP NOT NULL;
    """)


    # ======================================================
    # ÍNDICE PARA BUSCAR FOTOS POR FUNCIONÁRIO
    # ======================================================

    cur.execute("""
        CREATE INDEX IF NOT EXISTS
        idx_face_embeddings_funcionario_id

        ON face_embeddings (
            funcionario_id
        );
    """)


# ==========================================================
# CADASTRAR NOVA IMAGEM FACIAL
# ==========================================================

@router.post("/enroll")
def enroll(data: FaceEnroll):

    conn = None
    cur = None

    try:

        # ==================================================
        # VALIDAR FUNCIONÁRIO
        # ==================================================

        if not data.funcionario_id:

            return {
                "ok": False,
                "error": "Funcionário não informado.",
            }


        # ==================================================
        # VALIDAR IMAGEM
        # ==================================================

        if not data.image_base64:

            return {
                "ok": False,
                "error": "Imagem não informada.",
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
                "ok": False,
                "error": "Nenhum rosto encontrado na imagem.",
            }


        # ==================================================
        # CONVERTER PARA JPEG
        # ==================================================

        foto_bytes = imagem_para_jpeg_bytes(
            img
        )


        if not foto_bytes:

            return {
                "ok": False,
                "error": "Não foi possível processar a imagem facial.",
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
                emb.tolist()
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
        # ==================================================

        cur.execute(
            """
            SELECT
                id,
                nome

            FROM funcionarios

            WHERE id = %s

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
                "ok": False,
                "error": "Funcionário não encontrado.",
            }


        funcionario_id = funcionario[0]
        funcionario_nome = funcionario[1]


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
        # IMPORTANTE:
        #
        # NÃO TEM MAIS:
        #
        # ON CONFLICT (funcionario_id)
        #
        # Cada chamada cria uma NOVA linha.
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

                emb.tolist(),

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
                "ok": False,
                "error": "Não foi possível confirmar o cadastro da imagem.",
            }


        # ==================================================
        # COMMIT
        # ==================================================

        conn.commit()


        # ==================================================
        # DADOS DA NOVA FOTO
        # ==================================================

        foto_id = registro[0]

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
        # RESPOSTA
        # ==================================================

        return {

            "ok": True,

            "message": "Imagem facial cadastrada com sucesso.",

            "foto_id": foto_id,

            "funcionario_id": funcionario_id,

            "funcionario_nome": funcionario_nome,

            "embedding_salvo": (
                tamanho_embedding > 0
            ),

            "tamanho_embedding": tamanho_embedding,

            "foto_salva": (
                tamanho_foto > 0
            ),

            "foto_bytes": tamanho_foto,

            "foto_mime": foto_mime,

            "created_at": (
                created_at.isoformat()
                if created_at
                else None
            ),

            "quantidade_anterior": quantidade_anterior,

            "total_imagens": total_imagens,
        }


    # ======================================================
    # ERRO
    # ======================================================

    except Exception as e:

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
            repr(e)
        )

        print(
            "=========================================="
        )


        return {
            "ok": False,
            "error": str(e),
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