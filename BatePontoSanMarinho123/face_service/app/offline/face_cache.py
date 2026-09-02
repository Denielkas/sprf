import os
import sqlite3
import json
from datetime import datetime


# =========================================================
# CAMINHO DO BANCO LOCAL
#
# Pode ser alterado posteriormente pelo Electron para
# uma pasta própria do aplicativo.
# =========================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__)
        )
    )
)

DATA_DIR = os.path.join(
    BASE_DIR,
    "data"
)

DB_PATH = os.path.join(
    DATA_DIR,
    "faces_offline.db"
)


# =========================================================
# GARANTIR PASTA
# =========================================================

def garantir_pasta():
    os.makedirs(
        DATA_DIR,
        exist_ok=True
    )


# =========================================================
# CONEXÃO SQLITE
# =========================================================

def get_local_db():
    garantir_pasta()

    conn = sqlite3.connect(
        DB_PATH,
        timeout=30
    )

    conn.row_factory = sqlite3.Row

    return conn


# =========================================================
# GARANTIR TABELA
# =========================================================

def garantir_tabela_faces_offline():
    conn = get_local_db()

    try:
        cur = conn.cursor()

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS faces_offline (
                id INTEGER PRIMARY KEY AUTOINCREMENT,

                empresa_id INTEGER NOT NULL,

                funcionario_id INTEGER NOT NULL,

                funcionario_nome TEXT NOT NULL,

                embedding TEXT NOT NULL,

                ativo INTEGER NOT NULL DEFAULT 1,

                atualizado_em TEXT NOT NULL
            )
            """
        )

        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_faces_offline_empresa
            ON faces_offline (
                empresa_id
            )
            """
        )

        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_faces_offline_funcionario
            ON faces_offline (
                funcionario_id
            )
            """
        )

        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_faces_offline_empresa_funcionario
            ON faces_offline (
                empresa_id,
                funcionario_id
            )
            """
        )

        conn.commit()

    finally:
        conn.close()


# =========================================================
# SALVAR UMA FACE
# =========================================================

def salvar_face_local(
    empresa_id,
    funcionario_id,
    funcionario_nome,
    embedding
):
    garantir_tabela_faces_offline()

    empresa_id = int(
        empresa_id
    )

    funcionario_id = int(
        funcionario_id
    )

    funcionario_nome = str(
        funcionario_nome or
        "Funcionário"
    ).strip()

    embedding_lista = [
        float(valor)
        for valor in embedding
    ]

    if len(embedding_lista) != 128:
        raise ValueError(
            "Embedding facial deve possuir 128 valores."
        )

    embedding_json = json.dumps(
        embedding_lista
    )

    atualizado_em = (
        datetime.now()
        .isoformat(
            timespec="seconds"
        )
    )

    conn = get_local_db()

    try:
        cur = conn.cursor()

        # -------------------------------------------------
        # IMPORTANTE:
        #
        # O sistema permite várias fotos/embeddings do
        # mesmo funcionário.
        #
        # Portanto NÃO usamos UNIQUE em funcionario_id.
        # -------------------------------------------------

        cur.execute(
            """
            INSERT INTO faces_offline (
                empresa_id,
                funcionario_id,
                funcionario_nome,
                embedding,
                ativo,
                atualizado_em
            )
            VALUES (?, ?, ?, ?, 1, ?)
            """,
            (
                empresa_id,
                funcionario_id,
                funcionario_nome,
                embedding_json,
                atualizado_em,
            )
        )

        conn.commit()

        return cur.lastrowid

    finally:
        conn.close()


# =========================================================
# SUBSTITUIR TODAS AS FACES DE UMA EMPRESA
#
# Essa será a principal função usada na sincronização.
#
# Primeiro apagamos somente a empresa recebida.
# Depois colocamos a cópia atual enviada pelo servidor.
# =========================================================

def substituir_faces_empresa(
    empresa_id,
    faces
):
    garantir_tabela_faces_offline()

    empresa_id = int(
        empresa_id
    )

    conn = get_local_db()

    try:
        cur = conn.cursor()

        cur.execute(
            """
            DELETE FROM faces_offline
            WHERE empresa_id = ?
            """,
            (
                empresa_id,
            )
        )

        atualizado_em = (
            datetime.now()
            .isoformat(
                timespec="seconds"
            )
        )

        total = 0

        for face in faces:
            funcionario_id = int(
                face["funcionario_id"]
            )

            funcionario_nome = str(
                face.get(
                    "nome",
                    "Funcionário"
                )
            ).strip()

            embedding = face.get(
                "embedding"
            )

            if embedding is None:
                continue

            embedding_lista = [
                float(valor)
                for valor in embedding
            ]

            if len(
                embedding_lista
            ) != 128:
                print(
                    "⚠️ Embedding ignorado:",
                    funcionario_id,
                    "tamanho:",
                    len(
                        embedding_lista
                    )
                )

                continue

            cur.execute(
                """
                INSERT INTO faces_offline (
                    empresa_id,
                    funcionario_id,
                    funcionario_nome,
                    embedding,
                    ativo,
                    atualizado_em
                )
                VALUES (?, ?, ?, ?, 1, ?)
                """,
                (
                    empresa_id,
                    funcionario_id,
                    funcionario_nome,
                    json.dumps(
                        embedding_lista
                    ),
                    atualizado_em,
                )
            )

            total += 1

        conn.commit()

        print(
            f"💾 {total} face(s) salva(s) "
            f"localmente para empresa {empresa_id}."
        )

        return total

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


# =========================================================
# CARREGAR FACES DE UMA EMPRESA
# =========================================================

def carregar_faces_locais(
    empresa_id
):
    garantir_tabela_faces_offline()

    empresa_id = int(
        empresa_id
    )

    conn = get_local_db()

    try:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                id,
                empresa_id,
                funcionario_id,
                funcionario_nome,
                embedding,
                atualizado_em

            FROM faces_offline

            WHERE empresa_id = ?
              AND ativo = 1

            ORDER BY
                funcionario_id ASC,
                id ASC
            """,
            (
                empresa_id,
            )
        )

        rows = cur.fetchall()

        faces = []

        for row in rows:
            try:
                embedding = json.loads(
                    row["embedding"]
                )

                if (
                    not isinstance(
                        embedding,
                        list
                    ) or
                    len(
                        embedding
                    ) != 128
                ):
                    continue

                faces.append(
                    {
                        "id":
                            row["id"],

                        "empresa_id":
                            row["empresa_id"],

                        "funcionario_id":
                            row["funcionario_id"],

                        "nome":
                            row[
                                "funcionario_nome"
                            ],

                        "embedding":
                            embedding,

                        "atualizado_em":
                            row[
                                "atualizado_em"
                            ],
                    }
                )

            except Exception as error:
                print(
                    "⚠️ Erro ao ler embedding local:",
                    error
                )

        return faces

    finally:
        conn.close()


# =========================================================
# CONTAR FACES
# =========================================================

def contar_faces_locais(
    empresa_id
):
    garantir_tabela_faces_offline()

    conn = get_local_db()

    try:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                COUNT(*) AS total

            FROM faces_offline

            WHERE empresa_id = ?
              AND ativo = 1
            """,
            (
                int(
                    empresa_id
                ),
            )
        )

        row = cur.fetchone()

        return int(
            row["total"] or 0
        )

    finally:
        conn.close()


# =========================================================
# VERIFICAR SE EMPRESA POSSUI CACHE
# =========================================================

def empresa_tem_cache(
    empresa_id
):
    return (
        contar_faces_locais(
            empresa_id
        ) > 0
    )


# =========================================================
# REMOVER CACHE DA EMPRESA
# =========================================================

def limpar_faces_empresa(
    empresa_id
):
    garantir_tabela_faces_offline()

    conn = get_local_db()

    try:
        cur = conn.cursor()

        cur.execute(
            """
            DELETE FROM faces_offline
            WHERE empresa_id = ?
            """,
            (
                int(
                    empresa_id
                ),
            )
        )

        quantidade = (
            cur.rowcount
        )

        conn.commit()

        return quantidade

    finally:
        conn.close()


# =========================================================
# INFORMAÇÕES DO CACHE
# =========================================================

def info_cache_empresa(
    empresa_id
):
    garantir_tabela_faces_offline()

    conn = get_local_db()

    try:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                COUNT(*) AS total_faces,
                COUNT(
                    DISTINCT funcionario_id
                ) AS total_funcionarios,
                MAX(
                    atualizado_em
                ) AS ultima_atualizacao

            FROM faces_offline

            WHERE empresa_id = ?
              AND ativo = 1
            """,
            (
                int(
                    empresa_id
                ),
            )
        )

        row = cur.fetchone()

        return {
            "empresa_id":
                int(
                    empresa_id
                ),

            "total_faces":
                int(
                    row[
                        "total_faces"
                    ] or 0
                ),

            "total_funcionarios":
                int(
                    row[
                        "total_funcionarios"
                    ] or 0
                ),

            "ultima_atualizacao":
                row[
                    "ultima_atualizacao"
                ],
        }

    finally:
        conn.close()