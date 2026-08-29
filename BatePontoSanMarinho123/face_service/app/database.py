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
#
# NOVA ESTRUTURA:
#
# id | funcionario_id | embedding | foto
# 1  | 2              | ...       | foto 1
# 2  | 2              | ...       | foto 2
# 3  | 2              | ...       | foto 3
#
# Assim o mesmo funcionário pode possuir várias imagens.
# ==========================================================

def garantir_tabela_face():

    conn = None
    cur = None

    try:

        # ==================================================
        # CONECTAR
        # ==================================================

        conn = get_db()

        cur = conn.cursor()


        # ==================================================
        # VERIFICAR SE A TABELA JÁ EXISTE
        # ==================================================

        cur.execute("""
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = 'face_embeddings'
            );
        """)

        tabela_existe = cur.fetchone()[0]


        # ==================================================
        # CASO NÃO EXISTA:
        # CRIAR DIRETAMENTE NA NOVA ESTRUTURA
        # ==================================================

        if not tabela_existe:

            print(
                "📦 Criando face_embeddings..."
            )

            cur.execute("""
                CREATE TABLE face_embeddings (

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


        # ==================================================
        # CASO JÁ EXISTA:
        # MIGRAR ESTRUTURA ANTIGA
        # ==================================================

        else:

            print(
                "🔄 Verificando estrutura antiga de face_embeddings..."
            )


            # ==================================================
            # GARANTIR COLUNA ID
            # ==================================================

            cur.execute("""
                ALTER TABLE face_embeddings
                ADD COLUMN IF NOT EXISTS id BIGSERIAL;
            """)


            # ==================================================
            # GARANTIR QUE TODOS OS REGISTROS POSSUAM ID
            #
            # Normalmente BIGSERIAL já preencherá os registros
            # existentes. Esta parte é uma segurança adicional.
            # ==================================================

            cur.execute("""
                SELECT pg_get_serial_sequence(
                    'face_embeddings',
                    'id'
                );
            """)

            resultado_sequence = cur.fetchone()

            sequence_name = (
                resultado_sequence[0]
                if resultado_sequence
                else None
            )


            if sequence_name:

                cur.execute(
                    f"""
                    UPDATE face_embeddings
                    SET id = nextval(%s)
                    WHERE id IS NULL;
                    """,
                    (
                        sequence_name,
                    )
                )


            # ==================================================
            # DESCOBRIR A PRIMARY KEY ATUAL
            # ==================================================

            cur.execute("""
                SELECT
                    tc.constraint_name,
                    kcu.column_name

                FROM information_schema.table_constraints tc

                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema

                WHERE tc.table_schema = 'public'
                  AND tc.table_name = 'face_embeddings'
                  AND tc.constraint_type = 'PRIMARY KEY';
            """)

            primary_keys = cur.fetchall()


            # ==================================================
            # REMOVER PRIMARY KEY ANTIGA DE funcionario_id
            # ==================================================

            for constraint_name, column_name in primary_keys:

                if column_name == "funcionario_id":

                    print(
                        "🔄 Removendo PRIMARY KEY antiga de funcionario_id..."
                    )

                    cur.execute(
                        f"""
                        ALTER TABLE face_embeddings
                        DROP CONSTRAINT IF EXISTS "{constraint_name}";
                        """
                    )


            # ==================================================
            # VERIFICAR SE EXISTE PRIMARY KEY
            # ==================================================

            cur.execute("""
                SELECT
                    kcu.column_name

                FROM information_schema.table_constraints tc

                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema

                WHERE tc.table_schema = 'public'
                  AND tc.table_name = 'face_embeddings'
                  AND tc.constraint_type = 'PRIMARY KEY';
            """)

            pk_atual = cur.fetchall()


            possui_pk_id = any(
                linha[0] == "id"
                for linha in pk_atual
            )


            # ==================================================
            # CRIAR PRIMARY KEY NO ID
            # ==================================================

            if not possui_pk_id:

                print(
                    "🔑 Criando PRIMARY KEY em id..."
                )

                cur.execute("""
                    ALTER TABLE face_embeddings
                    ADD CONSTRAINT face_embeddings_pkey
                    PRIMARY KEY (id);
                """)


        # ==================================================
        # GARANTIR FUNCIONARIO_ID
        # ==================================================

        cur.execute("""
            ALTER TABLE face_embeddings
            ADD COLUMN IF NOT EXISTS funcionario_id BIGINT;
        """)


        # ==================================================
        # GARANTIR ID
        # ==================================================

        cur.execute("""
            ALTER TABLE face_embeddings
            ADD COLUMN IF NOT EXISTS id BIGSERIAL;
        """)


        # ==================================================
        # GARANTIR EMBEDDING
        # ==================================================

        cur.execute("""
            ALTER TABLE face_embeddings
            ADD COLUMN IF NOT EXISTS embedding FLOAT8[];
        """)


        # ==================================================
        # GARANTIR FOTO BYTEA
        # ==================================================

        cur.execute("""
            ALTER TABLE face_embeddings
            ADD COLUMN IF NOT EXISTS foto BYTEA;
        """)


        # ==================================================
        # GARANTIR MIME
        # ==================================================

        cur.execute("""
            ALTER TABLE face_embeddings
            ADD COLUMN IF NOT EXISTS foto_mime VARCHAR(100);
        """)


        # ==================================================
        # MANTER FOTO_PATH PARA CADASTROS ANTIGOS
        # ==================================================

        cur.execute("""
            ALTER TABLE face_embeddings
            ADD COLUMN IF NOT EXISTS foto_path TEXT;
        """)


        # ==================================================
        # CREATED_AT
        # ==================================================

        cur.execute("""
            ALTER TABLE face_embeddings
            ADD COLUMN IF NOT EXISTS created_at
            TIMESTAMP
            DEFAULT NOW();
        """)


        # ==================================================
        # UPDATED_AT
        # ==================================================

        cur.execute("""
            ALTER TABLE face_embeddings
            ADD COLUMN IF NOT EXISTS updated_at
            TIMESTAMP
            DEFAULT NOW();
        """)


        # ==================================================
        # EMBEDDING PODE SER NULL
        # ==================================================

        cur.execute("""
            ALTER TABLE face_embeddings
            ALTER COLUMN embedding
            DROP NOT NULL;
        """)


        # ==================================================
        # GARANTIR ID NOT NULL
        # ==================================================

        cur.execute("""
            ALTER TABLE face_embeddings
            ALTER COLUMN id
            SET NOT NULL;
        """)


        # ==================================================
        # GARANTIR FOREIGN KEY DE FUNCIONÁRIO
        #
        # Primeiro verificamos se ela já existe.
        # ==================================================

        cur.execute("""
            SELECT EXISTS (

                SELECT 1

                FROM information_schema.table_constraints tc

                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema

                WHERE tc.table_schema = 'public'

                  AND tc.table_name = 'face_embeddings'

                  AND tc.constraint_type = 'FOREIGN KEY'

                  AND kcu.column_name = 'funcionario_id'
            );
        """)

        possui_fk_funcionario = (
            cur.fetchone()[0]
        )


        if not possui_fk_funcionario:

            cur.execute("""
                ALTER TABLE face_embeddings

                ADD CONSTRAINT
                face_embeddings_funcionario_id_fkey

                FOREIGN KEY (
                    funcionario_id
                )

                REFERENCES funcionarios(id)

                ON DELETE CASCADE;
            """)


        # ==================================================
        # ÍNDICE PARA BUSCAR FOTOS DO FUNCIONÁRIO
        #
        # funcionario_id NÃO É UNIQUE.
        #
        # Isso é proposital:
        # um funcionário pode ter várias fotos.
        # ==================================================

        cur.execute("""
            CREATE INDEX IF NOT EXISTS
            idx_face_embeddings_funcionario_id

            ON face_embeddings (
                funcionario_id
            );
        """)


        # ==================================================
        # ÍNDICE PARA RECONHECIMENTO
        # ==================================================

        cur.execute("""
            CREATE INDEX IF NOT EXISTS
            idx_face_embeddings_funcionario_created

            ON face_embeddings (
                funcionario_id,
                created_at
            );
        """)


        # ==================================================
        # COMMIT
        # ==================================================

        conn.commit()


        # ==================================================
        # MOSTRAR ESTRUTURA FINAL
        # ==================================================

        cur.execute("""
            SELECT
                column_name,
                data_type,
                is_nullable,
                column_default

            FROM information_schema.columns

            WHERE table_schema = 'public'

              AND table_name =
                  'face_embeddings'

            ORDER BY ordinal_position;
        """)

        colunas = cur.fetchall()


        print(
            "=========================================="
        )

        print(
            "✅ FACE_EMBEDDINGS PREPARADA"
        )

        print(
            "Agora aceita VÁRIAS imagens por funcionário."
        )

        print(
            "=========================================="
        )


        for coluna in colunas:

            print(
                coluna[0],
                "=>",
                coluna[1],
                "| nullable:",
                coluna[2]
            )


        # ==================================================
        # MOSTRAR REGISTROS EXISTENTES
        # ==================================================

        cur.execute("""
            SELECT

                id,

                funcionario_id,

                array_length(
                    embedding,
                    1
                ) AS embedding,

                octet_length(
                    foto
                ) AS foto_bytes,

                foto_mime,

                foto_path

            FROM face_embeddings

            ORDER BY
                funcionario_id,
                id;
        """)

        registros = cur.fetchall()


        print(
            "=========================================="
        )

        print(
            "📸 CADASTROS FACIAIS EXISTENTES:"
        )


        for registro in registros:

            print(
                "ID FOTO:",
                registro[0],
                "| FUNCIONÁRIO:",
                registro[1],
                "| EMBEDDING:",
                registro[2],
                "| FOTO:",
                registro[3],
                "| MIME:",
                registro[4]
            )


        print(
            "=========================================="
        )


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
            "❌ ERRO AO PREPARAR FACE_EMBEDDINGS"
        )

        print(
            repr(error)
        )

        print(
            "=========================================="
        )


        raise


    # ======================================================
    # FINALIZAR
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