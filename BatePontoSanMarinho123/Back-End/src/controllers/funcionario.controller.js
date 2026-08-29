const pool = require("../database/pool");
const { onlyDigits } = require("../utils/cpf");
const fs = require("fs");
const path = require("path");

/* =========================================
   GARANTIR TABELA FUNÇÕES
========================================= */

async function garantirTabelaFuncoes() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS funcoes (
      id BIGSERIAL PRIMARY KEY,
      nome VARCHAR(150) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

/* =========================================
   GARANTIR TABELA EMPRESA CNPJS
========================================= */

async function garantirTabelaEmpresaCnpjs() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS empresa_cnpjs (
      id BIGSERIAL PRIMARY KEY,

      empresa_id BIGINT NOT NULL
        REFERENCES empresas(id)
        ON DELETE CASCADE,

      cnpj VARCHAR(14) NOT NULL,

      nome_exibicao VARCHAR(200),

      principal BOOLEAN NOT NULL DEFAULT false,

      ativo BOOLEAN NOT NULL DEFAULT true,

      created_at TIMESTAMP DEFAULT NOW(),

      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  /*
   * IMPORTANTE:
   * Se a tabela já existia antes,
   * CREATE TABLE IF NOT EXISTS não cria
   * as novas colunas.
   */

  await pool.query(`
    ALTER TABLE empresa_cnpjs
    ADD COLUMN IF NOT EXISTS nome_exibicao VARCHAR(200);
  `);

  await pool.query(`
    ALTER TABLE empresa_cnpjs
    ADD COLUMN IF NOT EXISTS principal BOOLEAN NOT NULL DEFAULT false;
  `);

  await pool.query(`
    ALTER TABLE empresa_cnpjs
    ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;
  `);

  await pool.query(`
    ALTER TABLE empresa_cnpjs
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    ALTER TABLE empresa_cnpjs
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
      uq_empresa_cnpjs_empresa_cnpj

    ON empresa_cnpjs (
      empresa_id,
      cnpj
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
      idx_empresa_cnpjs_empresa_id

    ON empresa_cnpjs (
      empresa_id
    );
  `);
}

/* =========================================
   GARANTIR TABELA FUNCIONÁRIOS
========================================= */

async function garantirTabelaFuncionarios() {
  await garantirTabelaFuncoes();

  /* =========================================
     TABELA EMPRESAS
  ========================================= */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS empresas (
      id BIGSERIAL PRIMARY KEY,
      nome VARCHAR(200) NOT NULL,
      nome_fantasia VARCHAR(200),
      cnpj VARCHAR(14) UNIQUE,
      ativo BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await garantirTabelaEmpresaCnpjs();

  /* =========================================
     TABELA FUNCIONÁRIOS
  ========================================= */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS funcionarios (
      id BIGSERIAL PRIMARY KEY,

      empresa_id BIGINT,

      numero_empresa BIGINT,

      nome VARCHAR(150) NOT NULL,

      cpf VARCHAR(20) NOT NULL,

      funcao VARCHAR(100),

      funcao_id BIGINT
        REFERENCES funcoes(id)
        ON DELETE SET NULL,

      email VARCHAR(150),

      telefone VARCHAR(50),

      chegada VARCHAR(10),

      intervalo_inicio VARCHAR(10),

      intervalo_fim VARCHAR(10),

      saida VARCHAR(10),

      ativo BOOLEAN NOT NULL DEFAULT true,

      data_inativacao DATE,

      motivo_inativacao TEXT,

      data_admissao DATE,

      cnpj_empresa VARCHAR(30),

      created_at TIMESTAMP DEFAULT NOW(),

      updated_at TIMESTAMP DEFAULT NOW(),

      inativado_em TIMESTAMP
    );
  `);

  /* =========================================
     GARANTIR COLUNAS
  ========================================= */

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS empresa_id BIGINT;
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS numero_empresa BIGINT;
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS funcao VARCHAR(100);
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS funcao_id BIGINT;
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS email VARCHAR(150);
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS telefone VARCHAR(50);
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS chegada VARCHAR(10);
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS intervalo_inicio VARCHAR(10);
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS intervalo_fim VARCHAR(10);
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS saida VARCHAR(10);
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS data_inativacao DATE;
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS motivo_inativacao TEXT;
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS data_admissao DATE;
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS cnpj_empresa VARCHAR(30);
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS inativado_em TIMESTAMP;
  `);

  /* =========================================
     REMOVER UNIQUE ANTIGO DO CPF
  ========================================= */

  await pool.query(`
    DO $$
    DECLARE
      constraint_name TEXT;
    BEGIN

      FOR constraint_name IN

        SELECT con.conname

        FROM pg_constraint con

        JOIN pg_class rel
          ON rel.oid = con.conrelid

        WHERE rel.relname = 'funcionarios'
          AND con.contype = 'u'
          AND pg_get_constraintdef(con.oid)
              = 'UNIQUE (cpf)'

      LOOP

        EXECUTE format(
          'ALTER TABLE funcionarios DROP CONSTRAINT %I',
          constraint_name
        );

      END LOOP;

    END $$;
  `);

  /* =========================================
     REMOVER ÍNDICES UNIQUE ANTIGOS DO CPF
  ========================================= */

  const indicesCpf = await pool.query(`
    SELECT
      indexname,
      indexdef

    FROM pg_indexes

    WHERE tablename = 'funcionarios'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%(cpf)%';
  `);

  for (const indice of indicesCpf.rows) {
    if (
      indice.indexname !==
      "uq_funcionarios_empresa_cpf"
    ) {
      try {
        await pool.query(
          `DROP INDEX IF EXISTS "${indice.indexname}";`
        );
      } catch (erroIndice) {
        console.log(
          "Não foi possível remover índice antigo:",
          indice.indexname
        );
      }
    }
  }

  /* =========================================
     CPF ÚNICO POR EMPRESA
  ========================================= */

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
      uq_funcionarios_empresa_cpf

    ON funcionarios (
      empresa_id,
      cpf
    )

    WHERE empresa_id IS NOT NULL;
  `);

  /* =========================================
     NUMERAR FUNCIONÁRIOS ANTIGOS
  ========================================= */

  await pool.query(`
    WITH numerados AS (
      SELECT
        id,

        ROW_NUMBER() OVER (
          PARTITION BY empresa_id
          ORDER BY id ASC
        ) AS numero

      FROM funcionarios

      WHERE empresa_id IS NOT NULL
    )

    UPDATE funcionarios f

    SET numero_empresa =
      numerados.numero

    FROM numerados

    WHERE f.id = numerados.id
      AND f.numero_empresa IS NULL;
  `);

  /* =========================================
     NÚMERO ÚNICO POR EMPRESA
  ========================================= */

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
      uq_funcionarios_empresa_numero

    ON funcionarios (
      empresa_id,
      numero_empresa
    )

    WHERE
      empresa_id IS NOT NULL
      AND numero_empresa IS NOT NULL;
  `);

  /* =========================================
     FOREIGN KEY EMPRESA
  ========================================= */

  await pool.query(`
    DO $$
    BEGIN

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'funcionarios_empresa_id_fkey'
      ) THEN

        ALTER TABLE funcionarios

        ADD CONSTRAINT
          funcionarios_empresa_id_fkey

        FOREIGN KEY (empresa_id)

        REFERENCES empresas(id)

        ON DELETE RESTRICT;

      END IF;

    END $$;
  `);

  /* =========================================
     FOREIGN KEY FUNÇÃO
  ========================================= */

  await pool.query(`
    DO $$
    BEGIN

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'funcionarios_funcao_id_fkey'
      ) THEN

        ALTER TABLE funcionarios

        ADD CONSTRAINT
          funcionarios_funcao_id_fkey

        FOREIGN KEY (funcao_id)

        REFERENCES funcoes(id)

        ON DELETE SET NULL;

      END IF;

    END $$;
  `);

  /* =========================================
     ÍNDICES
  ========================================= */

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
      idx_funcionarios_empresa_id

    ON funcionarios(empresa_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
      idx_funcionarios_funcao_id

    ON funcionarios(funcao_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
      idx_funcionarios_numero_empresa

    ON funcionarios(numero_empresa);
  `);
}

/* =========================================
   GARANTIR FACE EMBEDDINGS
   VÁRIAS FOTOS POR FUNCIONÁRIO
========================================= */

async function garantirTabelaFaceEmbeddings() {

  /* =========================================
     CRIAR TABELA NOVA
  ========================================= */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS face_embeddings (

      id BIGSERIAL PRIMARY KEY,

      funcionario_id BIGINT NOT NULL
        REFERENCES funcionarios(id)
        ON DELETE CASCADE,

      embedding FLOAT8[],

      foto BYTEA,

      foto_mime VARCHAR(100),

      foto_path TEXT,

      created_at TIMESTAMP
        DEFAULT NOW(),

      updated_at TIMESTAMP
        DEFAULT NOW()
    );
  `);


  /* =========================================
     GARANTIR COLUNAS
  ========================================= */

  await pool.query(`
    ALTER TABLE face_embeddings
    ADD COLUMN IF NOT EXISTS
    id BIGSERIAL;
  `);

  await pool.query(`
    ALTER TABLE face_embeddings
    ADD COLUMN IF NOT EXISTS
    funcionario_id BIGINT;
  `);

  await pool.query(`
    ALTER TABLE face_embeddings
    ADD COLUMN IF NOT EXISTS
    embedding FLOAT8[];
  `);

  await pool.query(`
    ALTER TABLE face_embeddings
    ADD COLUMN IF NOT EXISTS
    foto BYTEA;
  `);

  await pool.query(`
    ALTER TABLE face_embeddings
    ADD COLUMN IF NOT EXISTS
    foto_mime VARCHAR(100);
  `);

  await pool.query(`
    ALTER TABLE face_embeddings
    ADD COLUMN IF NOT EXISTS
    foto_path TEXT;
  `);

  await pool.query(`
    ALTER TABLE face_embeddings
    ADD COLUMN IF NOT EXISTS
    created_at TIMESTAMP
    DEFAULT NOW();
  `);

  await pool.query(`
    ALTER TABLE face_embeddings
    ADD COLUMN IF NOT EXISTS
    updated_at TIMESTAMP
    DEFAULT NOW();
  `);


  /* =========================================
     REMOVER PRIMARY KEY ANTIGA
     DE funcionario_id

     Se o database.py já fez isso,
     simplesmente não encontrará nada.
  ========================================= */

  const pkResult = await pool.query(`
    SELECT
      tc.constraint_name,
      kcu.column_name

    FROM information_schema.table_constraints tc

    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name =
         kcu.constraint_name
     AND tc.table_schema =
         kcu.table_schema

    WHERE
      tc.table_schema = 'public'
      AND tc.table_name =
          'face_embeddings'
      AND tc.constraint_type =
          'PRIMARY KEY';
  `);


  for (const pk of pkResult.rows) {

    if (
      pk.column_name ===
      "funcionario_id"
    ) {

      await pool.query(`
        ALTER TABLE face_embeddings
        DROP CONSTRAINT IF EXISTS
        "${pk.constraint_name}";
      `);
    }
  }


  /* =========================================
     GARANTIR ID NOS REGISTROS ANTIGOS
  ========================================= */

  const sequenceResult =
    await pool.query(`
      SELECT
        pg_get_serial_sequence(
          'face_embeddings',
          'id'
        ) AS sequence_name;
    `);


  const sequenceName =
    sequenceResult.rows[0]
      ?.sequence_name;


  if (sequenceName) {

    await pool.query(
      `
      UPDATE face_embeddings

      SET id =
        nextval($1::regclass)

      WHERE id IS NULL;
      `,
      [sequenceName]
    );
  }


  /* =========================================
     GARANTIR PRIMARY KEY EM ID
  ========================================= */

  const pkIdResult =
    await pool.query(`
      SELECT EXISTS (

        SELECT 1

        FROM information_schema.table_constraints tc

        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name =
             kcu.constraint_name
         AND tc.table_schema =
             kcu.table_schema

        WHERE
          tc.table_schema = 'public'

          AND tc.table_name =
              'face_embeddings'

          AND tc.constraint_type =
              'PRIMARY KEY'

          AND kcu.column_name =
              'id'
      ) AS existe;
    `);


  if (
    !pkIdResult.rows[0].existe
  ) {

    await pool.query(`
      ALTER TABLE face_embeddings

      ADD CONSTRAINT
        face_embeddings_pkey

      PRIMARY KEY (id);
    `);
  }


  /* =========================================
     ÍNDICE POR FUNCIONÁRIO

     NÃO É UNIQUE.

     O mesmo funcionário pode ter
     várias fotos.
  ========================================= */

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
      idx_face_embeddings_funcionario_id

    ON face_embeddings(
      funcionario_id
    );
  `);
}

/* =========================================
   GARANTIR TUDO
========================================= */

async function garantirTabelas() {
  await garantirTabelaFuncoes();
  await garantirTabelaFuncionarios();
  await garantirTabelaFaceEmbeddings();
}

/* =========================================
   BUSCAR OU CRIAR FUNÇÃO
========================================= */

async function findOrCreateFuncao(nomeFuncao) {
  if (!nomeFuncao) {
    return null;
  }

  const nome = String(nomeFuncao)
    .trim()
    .toUpperCase();

  if (!nome) {
    return null;
  }

  const existing = await pool.query(
    `
    SELECT
      id,
      nome

    FROM funcoes

    WHERE UPPER(nome) = UPPER($1)

    LIMIT 1
    `,
    [nome]
  );

  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const insert = await pool.query(
    `
    INSERT INTO funcoes (
      nome
    )

    VALUES ($1)

    RETURNING
      id,
      nome
    `,
    [nome]
  );

  return insert.rows[0].id;
}

/* =========================================
   BUSCAR FUNÇÃO PELO ID
========================================= */

async function buscarFuncaoPorId(id) {
  if (!id) {
    return null;
  }

  const result = await pool.query(
    `
    SELECT
      id,
      nome

    FROM funcoes

    WHERE id = $1

    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

/* =========================================
   GERAR PRÓXIMO NÚMERO DA EMPRESA
========================================= */

async function gerarNumeroEmpresa(
  empresaId,
  client = pool
) {
  const result = await client.query(
    `
    SELECT
      COALESCE(
        MAX(numero_empresa),
        0
      ) + 1 AS proximo_numero

    FROM funcionarios

    WHERE empresa_id = $1
    `,
    [empresaId]
  );

  return Number(
    result.rows[0].proximo_numero
  );
}

/* =========================================
   LISTAR FUNCIONÁRIOS
========================================= */

exports.listar = async (req, res) => {

  try {

    await garantirTabelas();


    const empresaId =
      req.user?.empresa_id;


    const role =
      req.user?.role;


    /* =========================================
       SUPER ADMIN
    ========================================= */

    if (
      role === "super_admin"
    ) {

      const { rows } =
        await pool.query(`
          SELECT

            f.*,

            COALESCE(
              fc.nome,
              f.funcao
            ) AS funcao_nome,

            e.nome AS empresa_nome,

            e.nome_fantasia
              AS empresa_nome_fantasia,


            /* =================================
               POSSUI ROSTO
            ================================= */

            EXISTS (

              SELECT 1

              FROM face_embeddings fe

              WHERE
                fe.funcionario_id = f.id

                AND fe.embedding
                    IS NOT NULL

            ) AS rosto_cadastrado,


            /* =================================
               POSSUI FOTO
            ================================= */

            EXISTS (

              SELECT 1

              FROM face_embeddings fe

              WHERE
                fe.funcionario_id = f.id

                AND fe.foto IS NOT NULL

                AND octet_length(
                  fe.foto
                ) > 0

            ) AS possui_imagem_rosto,


            /* =================================
               FOTO NO BANCO
            ================================= */

            EXISTS (

              SELECT 1

              FROM face_embeddings fe

              WHERE
                fe.funcionario_id = f.id

                AND fe.foto IS NOT NULL

                AND octet_length(
                  fe.foto
                ) > 0

            ) AS foto_banco,


            /* =================================
               QUANTIDADE DE FOTOS
            ================================= */

            (
              SELECT COUNT(*)::INTEGER

              FROM face_embeddings fe

              WHERE
                fe.funcionario_id = f.id

                AND fe.foto IS NOT NULL

                AND octet_length(
                  fe.foto
                ) > 0

            ) AS quantidade_imagens_rosto


          FROM funcionarios f


          LEFT JOIN funcoes fc
            ON fc.id = f.funcao_id


          LEFT JOIN empresas e
            ON e.id = f.empresa_id


          ORDER BY

            e.nome ASC,

            f.ativo DESC,

            f.numero_empresa ASC,

            f.nome ASC,

            f.id ASC;
        `);


      return res.json(
        rows
      );
    }


    /* =========================================
       EMPRESA
    ========================================= */

    if (!empresaId) {

      return res.status(403).json({

        error:
          "Usuário não está vinculado a uma empresa.",

      });
    }


    const { rows } =
      await pool.query(
        `
        SELECT

          f.*,

          COALESCE(
            fc.nome,
            f.funcao
          ) AS funcao_nome,

          e.nome AS empresa_nome,

          e.nome_fantasia
            AS empresa_nome_fantasia,


          /* =================================
             POSSUI ROSTO
          ================================= */

          EXISTS (

            SELECT 1

            FROM face_embeddings fe

            WHERE
              fe.funcionario_id = f.id

              AND fe.embedding
                  IS NOT NULL

          ) AS rosto_cadastrado,


          /* =================================
             POSSUI FOTO
          ================================= */

          EXISTS (

            SELECT 1

            FROM face_embeddings fe

            WHERE
              fe.funcionario_id = f.id

              AND fe.foto IS NOT NULL

              AND octet_length(
                fe.foto
              ) > 0

          ) AS possui_imagem_rosto,


          /* =================================
             FOTO NO BANCO
          ================================= */

          EXISTS (

            SELECT 1

            FROM face_embeddings fe

            WHERE
              fe.funcionario_id = f.id

              AND fe.foto IS NOT NULL

              AND octet_length(
                fe.foto
              ) > 0

          ) AS foto_banco,


          /* =================================
             QUANTIDADE DE IMAGENS
          ================================= */

          (
            SELECT COUNT(*)::INTEGER

            FROM face_embeddings fe

            WHERE
              fe.funcionario_id = f.id

              AND fe.foto IS NOT NULL

              AND octet_length(
                fe.foto
              ) > 0

          ) AS quantidade_imagens_rosto


        FROM funcionarios f


        LEFT JOIN funcoes fc
          ON fc.id = f.funcao_id


        LEFT JOIN empresas e
          ON e.id = f.empresa_id


        WHERE
          f.empresa_id = $1


        ORDER BY

          f.ativo DESC,

          f.numero_empresa ASC,

          f.nome ASC,

          f.id ASC;
        `,
        [
          empresaId,
        ]
      );


    return res.json(
      rows
    );


  } catch (err) {

    console.error(
      "Erro ao listar funcionários:",
      err
    );


    return res.status(500).json({

      error:
        "Erro ao listar funcionários",

    });
  }
};

/* =========================================
   BUSCAR FUNCIONÁRIO POR ID
========================================= */

exports.buscarPorId =
  async (req, res) => {

    try {

      await garantirTabelas();


      const id =
        Number(
          req.params.id
        );


      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {

        return res.status(400).json({
          error:
            "ID inválido.",
        });
      }


      const empresaId =
        req.user?.empresa_id;


      const role =
        req.user?.role;


      if (
        role !== "super_admin" &&
        !empresaId
      ) {

        return res.status(403).json({

          error:
            "Usuário não está vinculado a uma empresa.",

        });
      }


      let query;
      let params;


      const camposFace = `

        EXISTS (

          SELECT 1

          FROM face_embeddings fe

          WHERE
            fe.funcionario_id = f.id

            AND fe.embedding
                IS NOT NULL

        ) AS rosto_cadastrado,


        EXISTS (

          SELECT 1

          FROM face_embeddings fe

          WHERE
            fe.funcionario_id = f.id

            AND fe.foto IS NOT NULL

            AND octet_length(
              fe.foto
            ) > 0

        ) AS possui_imagem_rosto,


        EXISTS (

          SELECT 1

          FROM face_embeddings fe

          WHERE
            fe.funcionario_id = f.id

            AND fe.foto IS NOT NULL

            AND octet_length(
              fe.foto
            ) > 0

        ) AS foto_banco,


        (
          SELECT COUNT(*)::INTEGER

          FROM face_embeddings fe

          WHERE
            fe.funcionario_id = f.id

            AND fe.foto IS NOT NULL

            AND octet_length(
              fe.foto
            ) > 0

        ) AS quantidade_imagens_rosto
      `;


      /* =========================================
         SUPER ADMIN
      ========================================= */

      if (
        role === "super_admin"
      ) {

        query = `

          SELECT

            f.*,

            COALESCE(
              fc.nome,
              f.funcao
            ) AS funcao_nome,

            e.nome AS empresa_nome,

            e.nome_fantasia
              AS empresa_nome_fantasia,

            ${camposFace}

          FROM funcionarios f

          LEFT JOIN funcoes fc
            ON fc.id =
               f.funcao_id

          LEFT JOIN empresas e
            ON e.id =
               f.empresa_id

          WHERE
            f.id = $1

          LIMIT 1;
        `;


        params = [
          id,
        ];

      } else {

        query = `

          SELECT

            f.*,

            COALESCE(
              fc.nome,
              f.funcao
            ) AS funcao_nome,

            e.nome AS empresa_nome,

            e.nome_fantasia
              AS empresa_nome_fantasia,

            ${camposFace}

          FROM funcionarios f

          LEFT JOIN funcoes fc
            ON fc.id =
               f.funcao_id

          LEFT JOIN empresas e
            ON e.id =
               f.empresa_id

          WHERE
            f.id = $1

            AND f.empresa_id = $2

          LIMIT 1;
        `;


        params = [
          id,
          empresaId,
        ];
      }


      const { rows } =
        await pool.query(
          query,
          params
        );


      if (!rows[0]) {

        return res.status(404).json({

          error:
            "Funcionário não encontrado.",

        });
      }


      return res.json(
        rows[0]
      );


    } catch (err) {

      console.error(
        "Erro ao buscar funcionário:",
        err
      );


      return res.status(500).json({

        error:
          "Erro interno.",

      });
    }
  };

  /* =========================================
   LISTAR IMAGENS FACIAIS DO FUNCIONÁRIO
========================================= */

exports.listarImagensRosto =
  async (req, res) => {

    try {

      await garantirTabelas();


      const funcionarioId =
        Number(
          req.params.id
        );


      const empresaId =
        req.user?.empresa_id;


      const role =
        req.user?.role;


      if (
        !Number.isInteger(
          funcionarioId
        ) ||
        funcionarioId <= 0
      ) {

        return res.status(400).json({
          error:
            "ID do funcionário inválido.",
        });
      }


      if (
        role !== "super_admin" &&
        !empresaId
      ) {

        return res.status(403).json({

          error:
            "Usuário não está vinculado a uma empresa.",

        });
      }


      /* =========================================
         VALIDAR FUNCIONÁRIO
      ========================================= */

      let funcionarioResult;


      if (
        role === "super_admin"
      ) {

        funcionarioResult =
          await pool.query(
            `
            SELECT
              id,
              empresa_id,
              numero_empresa,
              nome

            FROM funcionarios

            WHERE id = $1

            LIMIT 1;
            `,
            [
              funcionarioId,
            ]
          );

      } else {

        funcionarioResult =
          await pool.query(
            `
            SELECT
              id,
              empresa_id,
              numero_empresa,
              nome

            FROM funcionarios

            WHERE id = $1

              AND empresa_id = $2

            LIMIT 1;
            `,
            [
              funcionarioId,
              empresaId,
            ]
          );
      }


      if (
        funcionarioResult.rows
          .length === 0
      ) {

        return res.status(404).json({

          error:
            "Funcionário não encontrado.",

        });
      }


      const funcionario =
        funcionarioResult.rows[0];


      /* =========================================
         LISTAR FOTOS

         Não devolvemos BYTEA aqui.
         Somente informações da foto.

         O frontend carregará cada imagem
         pelo endpoint de visualização.
      ========================================= */

      const fotosResult =
        await pool.query(
          `
          SELECT

            id,

            funcionario_id,

            foto_mime,

            octet_length(
              foto
            ) AS tamanho_bytes,

            created_at,

            updated_at

          FROM face_embeddings

          WHERE
            funcionario_id = $1

            AND foto IS NOT NULL

            AND octet_length(
              foto
            ) > 0

          ORDER BY
            created_at DESC,
            id DESC;
          `,
          [
            funcionarioId,
          ]
        );


      return res.json({

        ok: true,

        funcionario: {

          id:
            funcionario.id,

          numero_empresa:
            funcionario.numero_empresa,

          nome:
            funcionario.nome,

        },

        quantidade:
          fotosResult.rows.length,

        imagens:
          fotosResult.rows,

      });


    } catch (err) {

      console.error(
        "Erro ao listar imagens faciais:",
        err
      );


      return res.status(500).json({

        error:
          "Erro ao listar imagens faciais.",

      });
    }
  };/* =========================================
   LISTAR IMAGENS FACIAIS DO FUNCIONÁRIO
========================================= */

exports.listarImagensRosto =
  async (req, res) => {

    try {

      await garantirTabelas();


      const funcionarioId =
        Number(
          req.params.id
        );


      const empresaId =
        req.user?.empresa_id;


      const role =
        req.user?.role;


      if (
        !Number.isInteger(
          funcionarioId
        ) ||
        funcionarioId <= 0
      ) {

        return res.status(400).json({
          error:
            "ID do funcionário inválido.",
        });
      }


      if (
        role !== "super_admin" &&
        !empresaId
      ) {

        return res.status(403).json({

          error:
            "Usuário não está vinculado a uma empresa.",

        });
      }


      /* =========================================
         VALIDAR FUNCIONÁRIO
      ========================================= */

      let funcionarioResult;


      if (
        role === "super_admin"
      ) {

        funcionarioResult =
          await pool.query(
            `
            SELECT
              id,
              empresa_id,
              numero_empresa,
              nome

            FROM funcionarios

            WHERE id = $1

            LIMIT 1;
            `,
            [
              funcionarioId,
            ]
          );

      } else {

        funcionarioResult =
          await pool.query(
            `
            SELECT
              id,
              empresa_id,
              numero_empresa,
              nome

            FROM funcionarios

            WHERE id = $1

              AND empresa_id = $2

            LIMIT 1;
            `,
            [
              funcionarioId,
              empresaId,
            ]
          );
      }


      if (
        funcionarioResult.rows
          .length === 0
      ) {

        return res.status(404).json({

          error:
            "Funcionário não encontrado.",

        });
      }


      const funcionario =
        funcionarioResult.rows[0];


      /* =========================================
         LISTAR FOTOS

         Não devolvemos BYTEA aqui.
         Somente informações da foto.

         O frontend carregará cada imagem
         pelo endpoint de visualização.
      ========================================= */

      const fotosResult =
        await pool.query(
          `
          SELECT

            id,

            funcionario_id,

            foto_mime,

            octet_length(
              foto
            ) AS tamanho_bytes,

            created_at,

            updated_at

          FROM face_embeddings

          WHERE
            funcionario_id = $1

            AND foto IS NOT NULL

            AND octet_length(
              foto
            ) > 0

          ORDER BY
            created_at DESC,
            id DESC;
          `,
          [
            funcionarioId,
          ]
        );


      return res.json({

        ok: true,

        funcionario: {

          id:
            funcionario.id,

          numero_empresa:
            funcionario.numero_empresa,

          nome:
            funcionario.nome,

        },

        quantidade:
          fotosResult.rows.length,

        imagens:
          fotosResult.rows,

      });


    } catch (err) {

      console.error(
        "Erro ao listar imagens faciais:",
        err
      );


      return res.status(500).json({

        error:
          "Erro ao listar imagens faciais.",

      });
    }
  };

/* =========================================
   VISUALIZAR UMA IMAGEM FACIAL
========================================= */

exports.verImagemRosto =
  async (req, res) => {

    try {

      await garantirTabelas();


      const funcionarioId =
        Number(
          req.params.id
        );


      const fotoId =
        Number(
          req.params.fotoId
        );


      const empresaId =
        req.user?.empresa_id;


      const role =
        req.user?.role;


      /* =========================================
         VALIDAR FUNCIONÁRIO
      ========================================= */

      if (
        !Number.isInteger(
          funcionarioId
        ) ||
        funcionarioId <= 0
      ) {

        return res.status(400).json({

          error:
            "ID do funcionário inválido.",

        });
      }


      /* =========================================
         VALIDAR FOTO
      ========================================= */

      if (
        !Number.isInteger(
          fotoId
        ) ||
        fotoId <= 0
      ) {

        return res.status(400).json({

          error:
            "ID da imagem inválido.",

        });
      }


      if (
        role !== "super_admin" &&
        !empresaId
      ) {

        return res.status(403).json({

          error:
            "Usuário não está vinculado a uma empresa.",

        });
      }


      /* =========================================
         BUSCAR FOTO
      ========================================= */

      let result;


      if (
        role === "super_admin"
      ) {

        result =
          await pool.query(
            `
            SELECT

              f.id AS funcionario_id,

              f.nome,

              fe.id AS foto_id,

              fe.foto,

              fe.foto_mime,

              fe.created_at

            FROM funcionarios f

            INNER JOIN face_embeddings fe
              ON fe.funcionario_id =
                 f.id

            WHERE
              f.id = $1

              AND fe.id = $2

            LIMIT 1;
            `,
            [
              funcionarioId,
              fotoId,
            ]
          );

      } else {

        result =
          await pool.query(
            `
            SELECT

              f.id AS funcionario_id,

              f.nome,

              fe.id AS foto_id,

              fe.foto,

              fe.foto_mime,

              fe.created_at

            FROM funcionarios f

            INNER JOIN face_embeddings fe
              ON fe.funcionario_id =
                 f.id

            WHERE
              f.id = $1

              AND fe.id = $2

              AND f.empresa_id = $3

            LIMIT 1;
            `,
            [
              funcionarioId,
              fotoId,
              empresaId,
            ]
          );
      }


      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({

          error:
            "Imagem facial não encontrada.",

        });
      }


      const registro =
        result.rows[0];


      if (
        !registro.foto ||
        registro.foto.length === 0
      ) {

        return res.status(404).json({

          error:
            "Imagem facial não encontrada.",

        });
      }


      const mime =
        registro.foto_mime ||
        "image/jpeg";


      console.log(
        "=========================================="
      );

      console.log(
        "🖼️ IMAGEM FACIAL"
      );

      console.log(
        "Funcionário:",
        registro.nome
      );

      console.log(
        "Foto ID:",
        registro.foto_id
      );

      console.log(
        "Tamanho:",
        registro.foto.length,
        "bytes"
      );

      console.log(
        "=========================================="
      );


      res.setHeader(
        "Content-Type",
        mime
      );


      res.setHeader(
        "Content-Length",
        registro.foto.length
      );


      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
      );


      return res.end(
        registro.foto
      );


    } catch (err) {

      console.error(
        "Erro ao visualizar imagem facial:",
        err
      );


      return res.status(500).json({

        error:
          "Erro ao visualizar imagem facial.",

      });
    }
  };

  /* =========================================
   EXCLUIR UMA IMAGEM FACIAL
========================================= */

exports.excluirUmaImagemRosto =
  async (req, res) => {

    try {

      await garantirTabelas();


      const funcionarioId =
        Number(
          req.params.id
        );


      const fotoId =
        Number(
          req.params.fotoId
        );


      const empresaId =
        req.user?.empresa_id;


      const role =
        req.user?.role;


      if (
        !Number.isInteger(
          funcionarioId
        ) ||
        funcionarioId <= 0
      ) {

        return res.status(400).json({
          error:
            "ID do funcionário inválido.",
        });
      }


      if (
        !Number.isInteger(
          fotoId
        ) ||
        fotoId <= 0
      ) {

        return res.status(400).json({
          error:
            "ID da imagem inválido.",
        });
      }


      if (
        role !== "super_admin" &&
        !empresaId
      ) {

        return res.status(403).json({

          error:
            "Usuário não está vinculado a uma empresa.",

        });
      }


      /* =========================================
         VALIDAR FUNCIONÁRIO
      ========================================= */

      let funcionarioResult;


      if (
        role === "super_admin"
      ) {

        funcionarioResult =
          await pool.query(
            `
            SELECT
              id,
              nome

            FROM funcionarios

            WHERE id = $1

            LIMIT 1;
            `,
            [
              funcionarioId,
            ]
          );

      } else {

        funcionarioResult =
          await pool.query(
            `
            SELECT
              id,
              nome

            FROM funcionarios

            WHERE id = $1

              AND empresa_id = $2

            LIMIT 1;
            `,
            [
              funcionarioId,
              empresaId,
            ]
          );
      }


      if (
        funcionarioResult.rows
          .length === 0
      ) {

        return res.status(404).json({

          error:
            "Funcionário não encontrado.",

        });
      }


      /* =========================================
         EXCLUIR SOMENTE ESTA FOTO
      ========================================= */

      const deleteResult =
        await pool.query(
          `
          DELETE FROM face_embeddings

          WHERE
            id = $1

            AND funcionario_id = $2

          RETURNING
            id,
            funcionario_id;
          `,
          [
            fotoId,
            funcionarioId,
          ]
        );


      if (
        deleteResult.rowCount === 0
      ) {

        return res.status(404).json({

          error:
            "Imagem facial não encontrada.",

        });
      }


      /* =========================================
         QUANTIDADE RESTANTE
      ========================================= */

      const quantidadeResult =
        await pool.query(
          `
          SELECT
            COUNT(*)::INTEGER
              AS quantidade

          FROM face_embeddings

          WHERE
            funcionario_id = $1;
          `,
          [
            funcionarioId,
          ]
        );


      const quantidadeRestante =
        quantidadeResult
          .rows[0]
          .quantidade;


      return res.json({

        ok: true,

        message:
          "Imagem facial excluída com sucesso.",

        foto_id:
          fotoId,

        funcionario_id:
          funcionarioId,

        quantidade_restante:
          quantidadeRestante,

      });


    } catch (err) {

      console.error(
        "Erro ao excluir imagem facial:",
        err
      );


      return res.status(500).json({

        error:
          "Erro ao excluir imagem facial.",

      });
    }
  };

/* =========================================
   EXCLUIR CADASTRO FACIAL
   EMBEDDING + FOTO DO POSTGRESQL
========================================= */

exports.excluirImagemRosto = async (req, res) => {
  const client =
    await pool.connect();

  let transacaoIniciada = false;

  try {
    await garantirTabelas();

    /* =========================================
       DADOS
    ========================================= */

    const id =
      Number(req.params.id);

    const empresaId =
      req.user?.empresa_id;

    const role =
      req.user?.role;


    /* =========================================
       VALIDAR ID
    ========================================= */

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return res.status(400).json({
        error: "ID inválido.",
      });
    }


    /* =========================================
       VALIDAR EMPRESA
    ========================================= */

    if (
      role !== "super_admin" &&
      !empresaId
    ) {
      return res.status(403).json({
        error:
          "Usuário não está vinculado a uma empresa.",
      });
    }


    /* =========================================
       BUSCAR FUNCIONÁRIO
    ========================================= */

    let funcionarioResult;

    if (role === "super_admin") {
      funcionarioResult =
        await client.query(
          `
          SELECT
            id,
            empresa_id,
            numero_empresa,
            nome

          FROM funcionarios

          WHERE id = $1

          LIMIT 1
          `,
          [id]
        );

    } else {
      funcionarioResult =
        await client.query(
          `
          SELECT
            id,
            empresa_id,
            numero_empresa,
            nome

          FROM funcionarios

          WHERE id = $1
            AND empresa_id = $2

          LIMIT 1
          `,
          [
            id,
            empresaId,
          ]
        );
    }


    /* =========================================
       FUNCIONÁRIO NÃO EXISTE
    ========================================= */

    if (
      funcionarioResult.rows.length === 0
    ) {
      return res.status(404).json({
        error:
          "Funcionário não encontrado.",
      });
    }


    const funcionario =
      funcionarioResult.rows[0];


    /* =========================================
       VERIFICAR CADASTRO FACIAL
    ========================================= */

    const faceResult =
      await client.query(
        `
        SELECT
          funcionario_id,

          CASE
            WHEN embedding IS NOT NULL
            THEN true
            ELSE false
          END AS possui_embedding,

          CASE
            WHEN foto IS NOT NULL
              AND octet_length(foto) > 0
            THEN true
            ELSE false
          END AS possui_foto

        FROM face_embeddings

        WHERE funcionario_id = $1

        LIMIT 1
        `,
        [id]
      );


    if (
      faceResult.rows.length === 0
    ) {
      return res.status(404).json({
        error:
          "Funcionário não possui rosto cadastrado.",
      });
    }


    /* =========================================
       TRANSAÇÃO
    ========================================= */

    await client.query(
      "BEGIN"
    );

    transacaoIniciada = true;


    /* =========================================
       EXCLUIR CADASTRO FACIAL
    ========================================= */

    const deleteResult =
      await client.query(
        `
        DELETE FROM face_embeddings

        WHERE funcionario_id = $1

        RETURNING funcionario_id
        `,
        [id]
      );


    if (
      deleteResult.rowCount === 0
    ) {
      await client.query(
        "ROLLBACK"
      );

      transacaoIniciada = false;

      return res.status(404).json({
        error:
          "Cadastro facial não encontrado.",
      });
    }


    /* =========================================
       COMMIT
    ========================================= */

    await client.query(
      "COMMIT"
    );

    transacaoIniciada = false;


    /* =========================================
       LOG
    ========================================= */

    console.log(
      "=========================================="
    );

    console.log(
      "🗑️ CADASTRO FACIAL EXCLUÍDO"
    );

    console.log(
      "Funcionário:",
      funcionario.nome
    );

    console.log(
      "ID:",
      funcionario.id
    );

    console.log(
      "=========================================="
    );


    /* =========================================
       RESPOSTA
    ========================================= */

    return res.json({
      ok: true,

      message:
        "Cadastro facial excluído com sucesso.",

      funcionario_id:
        funcionario.id,

      nome:
        funcionario.nome,
    });

  } catch (err) {
    if (transacaoIniciada) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (_) {}
    }

    console.error(
      "Erro ao excluir cadastro facial:",
      err
    );

    return res.status(500).json({
      error:
        "Erro ao excluir cadastro facial.",
    });

  } finally {
    client.release();
  }
};

/* =========================================
   CRIAR FUNCIONÁRIO
========================================= */

exports.criar = async (req, res) => {
  const client =
    await pool.connect();

  try {
    await garantirTabelas();

    /* =========================================
       EMPRESA DO USUÁRIO LOGADO
    ========================================= */

    const empresaId =
      Number(req.user?.empresa_id);

    if (
      !Number.isInteger(empresaId) ||
      empresaId <= 0
    ) {
      return res.status(403).json({
        error:
          "Usuário não está vinculado a uma empresa.",
      });
    }

    /* =========================================
       BUSCAR EMPRESA
    ========================================= */

    const empresaResult =
      await client.query(
        `
        SELECT
          id,
          nome,
          nome_fantasia,
          cnpj,
          ativo

        FROM empresas

        WHERE id = $1

        LIMIT 1
        `,
        [empresaId]
      );

    if (
      empresaResult.rows.length === 0
    ) {
      return res.status(404).json({
        error:
          "Empresa vinculada ao usuário não foi encontrada.",
      });
    }

    const empresa =
      empresaResult.rows[0];

    if (!empresa.ativo) {
      return res.status(403).json({
        error:
          "Esta empresa está desativada.",
      });
    }

    /* =========================================
       DADOS
    ========================================= */

    const {
      nome,
      cpf,
      funcao,
      funcao_nome,
      funcao_id,
      email,
      telefone,
      chegada,
      intervalo_inicio,
      intervalo_fim,
      saida,
      data_admissao,
      cnpj_empresa,
    } = req.body;

    /* =========================================
       NOME
    ========================================= */

    const nomeLimpo =
      String(nome || "").trim();

    if (!nomeLimpo) {
      return res.status(400).json({
        error:
          "Nome do funcionário é obrigatório.",
      });
    }

    /* =========================================
       CPF
    ========================================= */

    const cpfLimpo =
      onlyDigits(cpf || "");

    if (!cpfLimpo) {
      return res.status(400).json({
        error:
          "CPF do funcionário é obrigatório.",
      });
    }

    /* =========================================
       CPF ÚNICO POR EMPRESA
    ========================================= */

    const cpfExiste =
      await client.query(
        `
        SELECT
          id,
          numero_empresa,
          nome

        FROM funcionarios

        WHERE empresa_id = $1
          AND cpf = $2

        LIMIT 1
        `,
        [
          empresaId,
          cpfLimpo,
        ]
      );

    if (
      cpfExiste.rows.length > 0
    ) {
      return res.status(409).json({
        error:
          "Já existe um funcionário cadastrado com este CPF nesta empresa.",
      });
    }

    /* =========================================
       FUNÇÃO
    ========================================= */

    let funcaoIdFinal = null;
    let funcaoNomeFinal = null;

    if (funcao_id) {
      const funcaoResult =
        await buscarFuncaoPorId(
          funcao_id
        );

      if (!funcaoResult) {
        return res.status(400).json({
          error:
            "Função selecionada não existe.",
        });
      }

      funcaoIdFinal =
        funcaoResult.id;

      funcaoNomeFinal =
        funcaoResult.nome;

    } else {
      const nomeFuncaoRecebido =
        funcao_nome ||
        funcao;

      if (
        nomeFuncaoRecebido &&
        String(nomeFuncaoRecebido)
          .trim()
      ) {
        funcaoNomeFinal =
          String(
            nomeFuncaoRecebido
          )
            .trim()
            .toUpperCase();

        funcaoIdFinal =
          await findOrCreateFuncao(
            funcaoNomeFinal
          );
      }
    }

    /* =========================================
       CNPJ DA EMPRESA

       Agora não existe CNPJ fixo.

       O CNPJ enviado precisa existir
       em empresa_cnpjs e pertencer à
       empresa do usuário logado.
    ========================================= */

    let cnpjEmpresaFinal = null;

    if (
      cnpj_empresa &&
      String(cnpj_empresa).trim()
    ) {
      cnpjEmpresaFinal =
        onlyDigits(cnpj_empresa);

      const cnpjResult =
        await client.query(
          `
          SELECT
            id,
            empresa_id,
            cnpj,
            nome_exibicao,
            principal,
            ativo

          FROM empresa_cnpjs

          WHERE empresa_id = $1
            AND cnpj = $2
            AND ativo = true

          LIMIT 1
          `,
          [
            empresaId,
            cnpjEmpresaFinal,
          ]
        );

      if (
        cnpjResult.rows.length === 0
      ) {
        return res.status(400).json({
          error:
            "O CNPJ selecionado não pertence a esta empresa ou está inativo.",
        });
      }

    } else {
      /* =========================================
         SE NÃO VEIO CNPJ

         Usa o principal da empresa.

         Se não existir principal, usa o
         primeiro CNPJ ativo.
      ========================================= */

      const cnpjPrincipalResult =
        await client.query(
          `
          SELECT
            cnpj

          FROM empresa_cnpjs

          WHERE empresa_id = $1
            AND ativo = true

          ORDER BY
            principal DESC,
            id ASC

          LIMIT 1
          `,
          [empresaId]
        );

      if (
        cnpjPrincipalResult.rows.length >
        0
      ) {
        cnpjEmpresaFinal =
          onlyDigits(
            cnpjPrincipalResult
              .rows[0]
              .cnpj
          );
      }
    }

    /* =========================================
       INICIAR TRANSAÇÃO
    ========================================= */

    await client.query("BEGIN");

    await client.query(
      `
      SELECT id

      FROM empresas

      WHERE id = $1

      FOR UPDATE
      `,
      [empresaId]
    );

    /* =========================================
       PRÓXIMO NÚMERO
    ========================================= */

    const numeroEmpresa =
      await gerarNumeroEmpresa(
        empresaId,
        client
      );

    /* =========================================
       INSERT
    ========================================= */

    const result =
      await client.query(
        `
        INSERT INTO funcionarios (
          empresa_id,
          numero_empresa,
          nome,
          cpf,
          funcao,
          funcao_id,
          email,
          telefone,
          chegada,
          intervalo_inicio,
          intervalo_fim,
          saida,
          ativo,
          data_admissao,
          cnpj_empresa
        )

        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          true,
          $13,
          $14
        )

        RETURNING *
        `,
        [
          empresaId,
          numeroEmpresa,
          nomeLimpo,
          cpfLimpo,
          funcaoNomeFinal,
          funcaoIdFinal,
          email || null,
          telefone || null,
          chegada || null,
          intervalo_inicio || null,
          intervalo_fim || null,
          saida || null,
          data_admissao || null,
          cnpjEmpresaFinal,
        ]
      );

    await client.query("COMMIT");

    const funcionario =
      result.rows[0];

    return res.status(201).json({
      ok: true,

      message:
        `${funcionario.nome} cadastrado com sucesso!`,

      id:
        funcionario.id,

      numero_empresa:
        funcionario.numero_empresa,

      nome:
        funcionario.nome,

      cpf:
        funcionario.cpf,

      funcao:
        funcionario.funcao,

      funcao_id:
        funcionario.funcao_id,

      funcao_nome:
        funcaoNomeFinal,

      empresa_id:
        funcionario.empresa_id,

      empresa_nome:
        empresa.nome_fantasia ||
        empresa.nome,

      cnpj_empresa:
        funcionario.cnpj_empresa,

      funcionario: {
        ...funcionario,

        funcao_nome:
          funcaoNomeFinal,

        empresa_nome:
          empresa.nome_fantasia ||
          empresa.nome,
      },
    });

  } catch (err) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch (_) { }

    console.error(
      "Erro ao cadastrar funcionário:",
      err
    );

    if (err.code === "23505") {
      if (
        err.constraint ===
        "uq_funcionarios_empresa_cpf" ||
        String(
          err.detail || ""
        )
          .toLowerCase()
          .includes("cpf")
      ) {
        return res.status(409).json({
          error:
            "Já existe um funcionário cadastrado com este CPF nesta empresa.",
        });
      }

      if (
        err.constraint ===
        "uq_funcionarios_empresa_numero"
      ) {
        return res.status(409).json({
          error:
            "Não foi possível gerar o número do funcionário. Tente cadastrar novamente.",
        });
      }

      return res.status(409).json({
        error:
          "Já existe um registro com estes dados.",
      });
    }

    return res.status(500).json({
      error:
        "Erro ao cadastrar funcionário.",
    });

  } finally {
    client.release();
  }
};

/* =========================================
   ATUALIZAR FUNCIONÁRIO
========================================= */

exports.atualizar =
  async (req, res) => {
    try {
      await garantirTabelas();

      const id =
        Number(req.params.id);

      const empresaId =
        req.user?.empresa_id;

      const role =
        req.user?.role;

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          error: "ID inválido.",
        });
      }

      if (
        role !== "super_admin" &&
        !empresaId
      ) {
        return res.status(403).json({
          error:
            "Usuário não está vinculado a uma empresa.",
        });
      }

      /* =========================================
         BUSCAR FUNCIONÁRIO
      ========================================= */

      let funcionarioExiste;

      if (role === "super_admin") {
        funcionarioExiste =
          await pool.query(
            `
            SELECT
              id,
              empresa_id,
              numero_empresa,
              funcao,
              funcao_id,
              cnpj_empresa

            FROM funcionarios

            WHERE id = $1

            LIMIT 1
            `,
            [id]
          );

      } else {
        funcionarioExiste =
          await pool.query(
            `
            SELECT
              id,
              empresa_id,
              numero_empresa,
              funcao,
              funcao_id,
              cnpj_empresa

            FROM funcionarios

            WHERE id = $1
              AND empresa_id = $2

            LIMIT 1
            `,
            [
              id,
              empresaId,
            ]
          );
      }

      if (
        funcionarioExiste.rows.length ===
        0
      ) {
        return res.status(404).json({
          error:
            "Funcionário não encontrado.",
        });
      }

      const funcionarioAtual =
        funcionarioExiste.rows[0];

      const empresaDoFuncionario =
        Number(
          funcionarioAtual.empresa_id
        );

      /* =========================================
         BODY
      ========================================= */

      let {
        nome,
        cpf,
        chegada,
        intervalo_inicio,
        intervalo_fim,
        saida,
        funcao,
        funcao_id,
        funcao_nome,
        cnpj_empresa,
        email,
        telefone,
        data_admissao,
      } = req.body;

      /* =========================================
         NOME
      ========================================= */

      if (
        !nome ||
        !String(nome).trim()
      ) {
        return res.status(400).json({
          error:
            "Nome é obrigatório.",
        });
      }

      /* =========================================
         CPF
      ========================================= */

      if (!cpf) {
        return res.status(400).json({
          error:
            "CPF é obrigatório.",
        });
      }

      cpf = onlyDigits(cpf);

      if (!cpf) {
        return res.status(400).json({
          error:
            "CPF inválido.",
        });
      }

      /* =========================================
         CPF DUPLICADO
      ========================================= */

      const cpfExiste =
        await pool.query(
          `
          SELECT id

          FROM funcionarios

          WHERE empresa_id = $1
            AND cpf = $2
            AND id <> $3

          LIMIT 1
          `,
          [
            empresaDoFuncionario,
            cpf,
            id,
          ]
        );

      if (
        cpfExiste.rows.length > 0
      ) {
        return res.status(409).json({
          error:
            "Já existe outro funcionário com este CPF nesta empresa.",
        });
      }

      /* =========================================
         FUNÇÃO
      ========================================= */

      let funcaoIdFinal =
        funcionarioAtual.funcao_id ||
        null;

      let funcaoNomeFinal =
        funcionarioAtual.funcao ||
        null;

      if (funcao_id) {
        const funcaoSelecionada =
          await buscarFuncaoPorId(
            funcao_id
          );

        if (!funcaoSelecionada) {
          return res.status(400).json({
            error:
              "Função selecionada não existe.",
          });
        }

        funcaoIdFinal =
          funcaoSelecionada.id;

        funcaoNomeFinal =
          funcaoSelecionada.nome;

      } else {
        const nomeRecebido =
          funcao_nome ||
          funcao;

        if (
          nomeRecebido &&
          String(nomeRecebido)
            .trim()
        ) {
          funcaoNomeFinal =
            String(nomeRecebido)
              .trim()
              .toUpperCase();

          funcaoIdFinal =
            await findOrCreateFuncao(
              funcaoNomeFinal
            );
        }
      }

      /* =========================================
         CNPJ
      ========================================= */

      let cnpjEmpresaFinal =
        cnpj_empresa
          ? onlyDigits(
            cnpj_empresa
          )
          : funcionarioAtual
            .cnpj_empresa
            ? onlyDigits(
              funcionarioAtual
                .cnpj_empresa
            )
            : null;

      /* =========================================
         VALIDAR CNPJ

         O CNPJ precisa pertencer à mesma
         empresa do funcionário.
      ========================================= */

      if (cnpjEmpresaFinal) {
        const cnpjResult =
          await pool.query(
            `
            SELECT
              id,
              empresa_id,
              cnpj,
              nome_exibicao,
              principal,
              ativo

            FROM empresa_cnpjs

            WHERE empresa_id = $1
              AND cnpj = $2
              AND ativo = true

            LIMIT 1
            `,
            [
              empresaDoFuncionario,
              cnpjEmpresaFinal,
            ]
          );

        if (
          cnpjResult.rows.length === 0
        ) {
          return res.status(400).json({
            error:
              "O CNPJ selecionado não pertence a esta empresa ou está inativo.",
          });
        }
      } else {
        /*
          Se o funcionário antigo não possuir
          CNPJ, tenta usar o principal.
        */

        const cnpjPrincipal =
          await pool.query(
            `
            SELECT cnpj

            FROM empresa_cnpjs

            WHERE empresa_id = $1
              AND ativo = true

            ORDER BY
              principal DESC,
              id ASC

            LIMIT 1
            `,
            [empresaDoFuncionario]
          );

        if (
          cnpjPrincipal.rows.length >
          0
        ) {
          cnpjEmpresaFinal =
            onlyDigits(
              cnpjPrincipal
                .rows[0]
                .cnpj
            );
        }
      }

      /* =========================================
         UPDATE
      ========================================= */

      let result;

      const parametros = [
        String(nome).trim(),
        cpf,
        chegada || null,
        intervalo_inicio || null,
        intervalo_fim || null,
        saida || null,
        funcaoNomeFinal,
        funcaoIdFinal,
        cnpjEmpresaFinal,
        email || null,
        telefone || null,
        data_admissao || null,
        id,
      ];

      if (role === "super_admin") {
        result = await pool.query(
          `
          UPDATE funcionarios

          SET
            nome = $1,
            cpf = $2,
            chegada = $3,
            intervalo_inicio = $4,
            intervalo_fim = $5,
            saida = $6,
            funcao = $7,
            funcao_id = $8,
            cnpj_empresa = $9,
            email = $10,
            telefone = $11,
            data_admissao = $12,
            updated_at = NOW()

          WHERE id = $13

          RETURNING *
          `,
          parametros
        );

      } else {
        result = await pool.query(
          `
          UPDATE funcionarios

          SET
            nome = $1,
            cpf = $2,
            chegada = $3,
            intervalo_inicio = $4,
            intervalo_fim = $5,
            saida = $6,
            funcao = $7,
            funcao_id = $8,
            cnpj_empresa = $9,
            email = $10,
            telefone = $11,
            data_admissao = $12,
            updated_at = NOW()

          WHERE id = $13
            AND empresa_id = $14

          RETURNING *
          `,
          [
            ...parametros,
            empresaId,
          ]
        );
      }

      if (
        result.rowCount === 0
      ) {
        return res.status(404).json({
          error:
            "Funcionário não encontrado.",
        });
      }

      const atualizado =
        result.rows[0];

      return res.json({
        ok: true,

        message:
          `${atualizado.nome} atualizado com sucesso!`,

        id:
          atualizado.id,

        numero_empresa:
          atualizado.numero_empresa,

        nome:
          atualizado.nome,

        cpf:
          atualizado.cpf,

        funcao:
          atualizado.funcao,

        funcao_id:
          atualizado.funcao_id,

        funcao_nome:
          funcaoNomeFinal,

        cnpj_empresa:
          atualizado.cnpj_empresa,

        funcionario: {
          ...atualizado,

          funcao_nome:
            funcaoNomeFinal,
        },
      });

    } catch (err) {
      console.error(
        "Erro ao atualizar funcionário:",
        err
      );

      if (err.code === "23505") {
        return res.status(409).json({
          error:
            "Já existe outro funcionário com este CPF nesta empresa.",
        });
      }

      return res.status(500).json({
        error:
          "Erro ao atualizar funcionário.",
      });
    }
  };

/* =========================================
   INATIVAR / REATIVAR FUNCIONÁRIO
========================================= */

exports.alterarStatus =
  async (req, res) => {
    try {
      await garantirTabelas();

      const id =
        Number(req.params.id);

      const empresaId =
        req.user?.empresa_id;

      const role =
        req.user?.role;

      const { ativo } =
        req.body;

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          error: "ID inválido.",
        });
      }

      if (
        typeof ativo !== "boolean"
      ) {
        return res.status(400).json({
          error:
            "O campo ativo deve ser true ou false.",
        });
      }

      if (
        role !== "super_admin" &&
        !empresaId
      ) {
        return res.status(403).json({
          error:
            "Usuário não está vinculado a uma empresa.",
        });
      }

      let result;

      if (role === "super_admin") {
        result = await pool.query(
          `
          UPDATE funcionarios

          SET
            ativo = $1,

            inativado_em =
              CASE
                WHEN $1 = false
                THEN NOW()
                ELSE NULL
              END,

            data_inativacao =
              CASE
                WHEN $1 = false
                THEN CURRENT_DATE
                ELSE NULL
              END,

            updated_at = NOW()

          WHERE id = $2

          RETURNING
            id,
            empresa_id,
            numero_empresa,
            nome,
            cpf,
            funcao,
            funcao_id,
            ativo,
            data_inativacao,
            inativado_em,
            cnpj_empresa
          `,
          [
            ativo,
            id,
          ]
        );

      } else {
        result = await pool.query(
          `
          UPDATE funcionarios

          SET
            ativo = $1,

            inativado_em =
              CASE
                WHEN $1 = false
                THEN NOW()
                ELSE NULL
              END,

            data_inativacao =
              CASE
                WHEN $1 = false
                THEN CURRENT_DATE
                ELSE NULL
              END,

            updated_at = NOW()

          WHERE id = $2
            AND empresa_id = $3

          RETURNING
            id,
            empresa_id,
            numero_empresa,
            nome,
            cpf,
            funcao,
            funcao_id,
            ativo,
            data_inativacao,
            inativado_em,
            cnpj_empresa
          `,
          [
            ativo,
            id,
            empresaId,
          ]
        );
      }

      if (
        result.rowCount === 0
      ) {
        return res.status(404).json({
          error:
            "Funcionário não encontrado.",
        });
      }

      const funcionario =
        result.rows[0];

      return res.json({
        ok: true,

        message:
          ativo
            ? `${funcionario.nome} reativado com sucesso.`
            : `${funcionario.nome} inativado com sucesso.`,

        id:
          funcionario.id,

        numero_empresa:
          funcionario.numero_empresa,

        nome:
          funcionario.nome,

        funcionario,
      });

    } catch (err) {
      console.error(
        "Erro ao alterar status do funcionário:",
        err
      );

      return res.status(500).json({
        error:
          "Erro ao alterar status do funcionário.",
      });
    }
  };