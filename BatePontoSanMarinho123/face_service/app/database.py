import os
import psycopg2


# ==========================================================
# CONEXÃO COM POSTGRESQL
# ==========================================================

def get_db():
    return psycopg2.connect(
        host=os.getenv(
            "PG_HOST",
            "127.0.0.1"
        ),

        database=os.getenv(
            "PG_DB",
            "pontoMultiEmpresa"
        ),

        user=os.getenv(
            "PG_USER",
            "postgres"
        ),

        password=os.getenv(
            "PG_PASS",
            "123456"
        ),

        port=int(
            os.getenv(
                "PG_PORT",
                "5432"
            )
        ),
    )


# ==========================================================
# GARANTIR TABELA DE RECONHECIMENTO FACIAL
# ==========================================================

def garantir_tabela_face():
    conn = None
    cur = None

    try:
        conn = get_db()
        cur = conn.cursor()

        # ==================================================
        # CRIAR TABELA
        # ==================================================

        cur.execute("""
            CREATE TABLE IF NOT EXISTS face_embeddings (
                funcionario_id BIGINT
                PRIMARY KEY
                REFERENCES funcionarios(id)
                ON DELETE CASCADE,

                embedding FLOAT8[],

                foto_path TEXT,

                created_at TIMESTAMP
                NOT NULL
                DEFAULT NOW(),

                updated_at TIMESTAMP
                NOT NULL
                DEFAULT NOW()
            );
        """)

        # ==================================================
        # GARANTIR COLUNAS
        # ==================================================

        cur.execute("""
            ALTER TABLE face_embeddings
            ADD COLUMN IF NOT EXISTS embedding FLOAT8[];
        """)

        cur.execute("""
            ALTER TABLE face_embeddings
            ADD COLUMN IF NOT EXISTS foto_path TEXT;
        """)

        cur.execute("""
            ALTER TABLE face_embeddings
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
            NOT NULL DEFAULT NOW();
        """)

        cur.execute("""
            ALTER TABLE face_embeddings
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
            NOT NULL DEFAULT NOW();
        """)

        # ==================================================
        # PERMITIR EMBEDDING NULL
        # ==================================================

        cur.execute("""
            ALTER TABLE face_embeddings
            ALTER COLUMN embedding DROP NOT NULL;
        """)

        conn.commit()

        print(
            "✅ Tabela face_embeddings verificada."
        )

    except Exception as error:

        if conn:
            conn.rollback()

        print(
            "❌ Erro ao preparar face_embeddings:",
            repr(error)
        )

        raise

    finally:

        if cur:
            cur.close()

        if conn:
            conn.close()