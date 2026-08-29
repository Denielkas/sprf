const pool = require("../database/pool");

/* =========================================================
   ROLES
========================================================= */

const ROLES = {
  SUPER_ADMIN: "super_admin",
  RH_EMPRESA: "rh_empresa",
  PONTO_EMPRESA: "ponto_empresa",
  ADMIN_EMPRESA_ANTIGO: "admin_empresa",
};

/* =========================================================
   OBTER EMPRESA DA REQUISIÇÃO
========================================================= */

function obterEmpresaIdDaRequisicao(req) {
  const role = req.user?.role;

  const rolesEmpresa = [
    ROLES.RH_EMPRESA,
    ROLES.PONTO_EMPRESA,
    ROLES.ADMIN_EMPRESA_ANTIGO,
  ];

  /* =======================================================
     USUÁRIO NORMAL DA EMPRESA

     Sempre pega empresa_id do TOKEN.
  ======================================================= */

  if (rolesEmpresa.includes(role)) {
    const empresaId = Number(
      req.user?.empresa_id
    );

    if (
      Number.isInteger(empresaId) &&
      empresaId > 0
    ) {
      return empresaId;
    }

    return null;
  }

  /* =======================================================
     SUPER ADMIN

     Pode informar empresa_id pela query ou body.
  ======================================================= */

  if (role === ROLES.SUPER_ADMIN) {
    const valorEmpresa =
      req.query?.empresa_id ??
      req.body?.empresa_id;

    const empresaId = Number(
      valorEmpresa
    );

    if (
      Number.isInteger(empresaId) &&
      empresaId > 0
    ) {
      return empresaId;
    }

    return null;
  }

  return null;
}

/* =========================================================
   GARANTIR TABELA EMPRESAS
========================================================= */

async function garantirTabelaEmpresas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS empresas (
      id BIGSERIAL PRIMARY KEY,

      nome VARCHAR(200)
        NOT NULL,

      nome_fantasia VARCHAR(200),

      cnpj VARCHAR(14),

      ativo BOOLEAN
        NOT NULL
        DEFAULT true,

      created_at TIMESTAMP
        DEFAULT NOW(),

      updated_at TIMESTAMP
        DEFAULT NOW()
    );
  `);
}

/* =========================================================
   GARANTIR TABELA FUNÇÕES
========================================================= */

async function garantirTabelaFuncoes() {
  await garantirTabelaEmpresas();

  /* =======================================================
     CRIAR TABELA
  ======================================================= */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS funcoes (
      id BIGSERIAL PRIMARY KEY,

      empresa_id BIGINT,

      nome VARCHAR(150)
        NOT NULL,

      created_at TIMESTAMP
        DEFAULT NOW(),

      updated_at TIMESTAMP
        DEFAULT NOW()
    );
  `);

  /* =======================================================
     GARANTIR COLUNAS
  ======================================================= */

  await pool.query(`
    ALTER TABLE funcoes
    ADD COLUMN IF NOT EXISTS
      empresa_id BIGINT;
  `);

  await pool.query(`
    ALTER TABLE funcoes
    ADD COLUMN IF NOT EXISTS
      nome VARCHAR(150);
  `);

  await pool.query(`
    ALTER TABLE funcoes
    ADD COLUMN IF NOT EXISTS
      created_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    ALTER TABLE funcoes
    ADD COLUMN IF NOT EXISTS
      updated_at TIMESTAMP DEFAULT NOW();
  `);

  /* =======================================================
     REMOVER UNIQUE ANTIGO DE nome

     Antigamente:
       nome UNIQUE

     Isso impediria:
       Empresa 1 -> RECEPCIONISTA
       Empresa 2 -> RECEPCIONISTA

     Agora a função é única POR EMPRESA.
  ======================================================= */

  await pool.query(`
    DO $$
    DECLARE
      registro RECORD;
    BEGIN

      FOR registro IN

        SELECT
          con.conname

        FROM pg_constraint con

        JOIN pg_class rel
          ON rel.oid =
             con.conrelid

        WHERE rel.relname =
              'funcoes'

          AND con.contype =
              'u'

          AND pg_get_constraintdef(
                con.oid
              ) = 'UNIQUE (nome)'

      LOOP

        EXECUTE format(
          'ALTER TABLE funcoes DROP CONSTRAINT IF EXISTS %I',
          registro.conname
        );

      END LOOP;

    END $$;
  `);

  /* =======================================================
     REMOVER ÍNDICE UNIQUE ANTIGO APENAS EM nome
  ======================================================= */

  const indices =
    await pool.query(`
      SELECT
        indexname,
        indexdef

      FROM pg_indexes

      WHERE tablename =
            'funcoes'

        AND indexdef ILIKE
            '%UNIQUE%';
    `);

  for (
    const indice of
    indices.rows
  ) {
    const definicao =
      String(
        indice.indexdef || ""
      )
        .toLowerCase()
        .replace(/\s+/g, " ");

    const somenteNome =
      definicao.includes("(nome)") &&
      !definicao.includes("empresa_id");

    if (somenteNome) {
      try {
        await pool.query(
          `DROP INDEX IF EXISTS "${indice.indexname}";`
        );

        console.log(
          "Índice antigo removido:",
          indice.indexname
        );

      } catch (erro) {
        console.log(
          "Não foi possível remover índice:",
          indice.indexname,
          erro.message
        );
      }
    }
  }

  /* =======================================================
     MIGRAR FUNÇÕES ANTIGAS

     Caso uma função antiga esteja com empresa_id NULL,
     tentamos descobrir a empresa pelos funcionários.
  ======================================================= */

  const migracao =
    await pool.query(`
      UPDATE funcoes fn

      SET empresa_id =
        origem.empresa_id

      FROM (
        SELECT
          funcao_id,
          MIN(empresa_id)
            AS empresa_id

        FROM funcionarios

        WHERE funcao_id
              IS NOT NULL

          AND empresa_id
              IS NOT NULL

        GROUP BY
          funcao_id
      ) origem

      WHERE fn.id =
            origem.funcao_id

        AND fn.empresa_id
            IS NULL;
    `);

  if (
    migracao.rowCount > 0
  ) {
    console.log(
      `Funções antigas migradas: ${migracao.rowCount}`
    );
  }

  /* =======================================================
     FOREIGN KEY
  ======================================================= */

  await pool.query(`
    DO $$
    BEGIN

      IF NOT EXISTS (
        SELECT 1

        FROM pg_constraint

        WHERE conname =
          'funcoes_empresa_id_fkey'
      ) THEN

        ALTER TABLE funcoes

        ADD CONSTRAINT
          funcoes_empresa_id_fkey

        FOREIGN KEY (
          empresa_id
        )

        REFERENCES empresas(id)

        ON DELETE RESTRICT;

      END IF;

    END $$;
  `);

  /* =======================================================
     ÍNDICE EMPRESA
  ======================================================= */

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
      idx_funcoes_empresa_id

    ON funcoes(
      empresa_id
    );
  `);

  /* =======================================================
     FUNÇÃO ÚNICA POR EMPRESA
  ======================================================= */

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
      idx_funcoes_empresa_nome_unique

    ON funcoes (
      empresa_id,
      LOWER(TRIM(nome))
    )

    WHERE empresa_id
          IS NOT NULL;
  `);
}

/* =========================================================
   BUSCAR EMPRESA
========================================================= */

async function buscarEmpresa(
  empresaId
) {
  const { rows } =
    await pool.query(
      `
      SELECT
        id,
        nome,
        nome_fantasia,
        ativo

      FROM empresas

      WHERE id = $1

      LIMIT 1
      `,
      [empresaId]
    );

  return rows[0] || null;
}

/* =========================================================
   VALIDAR EMPRESA
========================================================= */

async function validarEmpresaDaRequisicao(
  req,
  res
) {
  const empresaId =
    obterEmpresaIdDaRequisicao(
      req
    );

  if (!empresaId) {
    console.log(
      "Empresa não identificada:",
      {
        role:
          req.user?.role,

        empresa_id_token:
          req.user?.empresa_id,

        empresa_id_query:
          req.query?.empresa_id,

        empresa_id_body:
          req.body?.empresa_id,
      }
    );

    res
      .status(400)
      .json({
        error:
          req.user?.role ===
          ROLES.SUPER_ADMIN
            ? "Selecione uma empresa."
            : "Usuário não possui empresa vinculada.",
      });

    return null;
  }

  const empresa =
    await buscarEmpresa(
      empresaId
    );

  if (!empresa) {
    res
      .status(404)
      .json({
        error:
          "Empresa não encontrada.",
      });

    return null;
  }

  if (!empresa.ativo) {
    res
      .status(403)
      .json({
        error:
          "Empresa desativada.",
      });

    return null;
  }

  return {
    empresaId,
    empresa,
  };
}

/* =========================================================
   LISTAR FUNÇÕES
========================================================= */

exports.listar =
  async (req, res) => {
    try {
      await garantirTabelaFuncoes();

      const validacao =
        await validarEmpresaDaRequisicao(
          req,
          res
        );

      if (!validacao) {
        return;
      }

      const {
        empresaId,
      } = validacao;

      const { rows } =
        await pool.query(
          `
          SELECT
            fn.id,

            fn.empresa_id,

            fn.nome,

            fn.created_at,

            fn.updated_at,

            COUNT(f.id)::integer
              AS total_funcionarios

          FROM funcoes fn

          LEFT JOIN funcionarios f
            ON f.funcao_id =
               fn.id

            AND f.empresa_id =
                fn.empresa_id

          WHERE fn.empresa_id =
                $1

          GROUP BY
            fn.id,
            fn.empresa_id,
            fn.nome,
            fn.created_at,
            fn.updated_at

          ORDER BY
            fn.nome ASC
          `,
          [empresaId]
        );

      return res.json(
        rows
      );

    } catch (err) {
      console.error(
        "Erro ao listar funções:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            "Erro ao listar funções.",
        });
    }
  };

/* =========================================================
   BUSCAR FUNÇÃO POR ID
========================================================= */

exports.buscarPorId =
  async (req, res) => {
    try {
      await garantirTabelaFuncoes();

      const funcaoId =
        Number(
          req.params.id
        );

      if (
        !Number.isInteger(
          funcaoId
        ) ||
        funcaoId <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "ID da função inválido.",
          });
      }

      const validacao =
        await validarEmpresaDaRequisicao(
          req,
          res
        );

      if (!validacao) {
        return;
      }

      const {
        empresaId,
      } = validacao;

      const { rows } =
        await pool.query(
          `
          SELECT
            id,
            empresa_id,
            nome,
            created_at,
            updated_at

          FROM funcoes

          WHERE id = $1
            AND empresa_id = $2

          LIMIT 1
          `,
          [
            funcaoId,
            empresaId,
          ]
        );

      if (
        rows.length === 0
      ) {
        return res
          .status(404)
          .json({
            error:
              "Função não encontrada.",
          });
      }

      return res.json(
        rows[0]
      );

    } catch (err) {
      console.error(
        "Erro ao buscar função:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            "Erro ao buscar função.",
        });
    }
  };

/* =========================================================
   CRIAR FUNÇÃO
========================================================= */

exports.criar =
  async (req, res) => {
    try {
      await garantirTabelaFuncoes();

      const nome =
        String(
          req.body?.nome || ""
        ).trim();

      if (!nome) {
        return res
          .status(400)
          .json({
            error:
              "Nome da função é obrigatório.",
          });
      }

      if (
        nome.length > 150
      ) {
        return res
          .status(400)
          .json({
            error:
              "O nome da função deve possuir no máximo 150 caracteres.",
          });
      }

      const validacao =
        await validarEmpresaDaRequisicao(
          req,
          res
        );

      if (!validacao) {
        return;
      }

      const {
        empresaId,
      } = validacao;

      /* =====================================================
         PADRONIZAR NOME

         Isso evita:
         recepcionista
         RECEPCIONISTA
         Recepcionista

         virarem funções diferentes.
      ===================================================== */

      const nomeFinal =
        nome.toUpperCase();

      /* =====================================================
         VERIFICAR DUPLICIDADE
      ===================================================== */

      const existe =
        await pool.query(
          `
          SELECT
            id

          FROM funcoes

          WHERE empresa_id = $1

            AND LOWER(
                  TRIM(nome)
                ) =
                LOWER(
                  TRIM($2)
                )

          LIMIT 1
          `,
          [
            empresaId,
            nomeFinal,
          ]
        );

      if (
        existe.rows.length > 0
      ) {
        return res
          .status(409)
          .json({
            error:
              "Esta função já existe nesta empresa.",
          });
      }

      /* =====================================================
         INSERIR
      ===================================================== */

      const { rows } =
        await pool.query(
          `
          INSERT INTO funcoes (
            empresa_id,
            nome,
            created_at,
            updated_at
          )

          VALUES (
            $1,
            $2,
            NOW(),
            NOW()
          )

          RETURNING
            id,
            empresa_id,
            nome,
            created_at,
            updated_at
          `,
          [
            empresaId,
            nomeFinal,
          ]
        );

      return res
        .status(201)
        .json({
          ok: true,

          message:
            "Função cadastrada com sucesso.",

          funcao:
            rows[0],
        });

    } catch (err) {
      console.error(
        "Erro ao criar função:",
        err
      );

      if (
        err.code === "23505"
      ) {
        return res
          .status(409)
          .json({
            error:
              "Esta função já existe nesta empresa.",
          });
      }

      return res
        .status(500)
        .json({
          error:
            "Erro ao cadastrar função.",
        });
    }
  };

/* =========================================================
   ALTERAR FUNÇÃO
========================================================= */

exports.alterar =
  async (req, res) => {
    try {
      await garantirTabelaFuncoes();

      const funcaoId =
        Number(
          req.params.id
        );

      const nome =
        String(
          req.body?.nome || ""
        ).trim();

      if (
        !Number.isInteger(
          funcaoId
        ) ||
        funcaoId <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "ID da função inválido.",
          });
      }

      if (!nome) {
        return res
          .status(400)
          .json({
            error:
              "Nome da função é obrigatório.",
          });
      }

      if (
        nome.length > 150
      ) {
        return res
          .status(400)
          .json({
            error:
              "O nome da função deve possuir no máximo 150 caracteres.",
          });
      }

      const validacao =
        await validarEmpresaDaRequisicao(
          req,
          res
        );

      if (!validacao) {
        return;
      }

      const {
        empresaId,
      } = validacao;

      const nomeFinal =
        nome.toUpperCase();

      /* =====================================================
         VERIFICAR EXISTÊNCIA
      ===================================================== */

      const funcaoAtual =
        await pool.query(
          `
          SELECT
            id,
            empresa_id,
            nome

          FROM funcoes

          WHERE id = $1
            AND empresa_id = $2

          LIMIT 1
          `,
          [
            funcaoId,
            empresaId,
          ]
        );

      if (
        funcaoAtual.rows.length ===
        0
      ) {
        return res
          .status(404)
          .json({
            error:
              "Função não encontrada.",
          });
      }

      /* =====================================================
         VERIFICAR DUPLICIDADE
      ===================================================== */

      const duplicada =
        await pool.query(
          `
          SELECT id

          FROM funcoes

          WHERE empresa_id = $1

            AND LOWER(
                  TRIM(nome)
                ) =
                LOWER(
                  TRIM($2)
                )

            AND id <> $3

          LIMIT 1
          `,
          [
            empresaId,
            nomeFinal,
            funcaoId,
          ]
        );

      if (
        duplicada.rows.length >
        0
      ) {
        return res
          .status(409)
          .json({
            error:
              "Já existe outra função com este nome nesta empresa.",
          });
      }

      /* =====================================================
         ATUALIZAR FUNÇÃO
      ===================================================== */

      const { rows } =
        await pool.query(
          `
          UPDATE funcoes

          SET
            nome = $1,
            updated_at = NOW()

          WHERE id = $2
            AND empresa_id = $3

          RETURNING
            id,
            empresa_id,
            nome,
            created_at,
            updated_at
          `,
          [
            nomeFinal,
            funcaoId,
            empresaId,
          ]
        );

      /* =====================================================
         SINCRONIZAR FUNCIONÁRIOS

         Como funcionarios também possui a coluna
         "funcao", atualizamos o texto.

         Assim:
           funcao_id = 3
           funcao = RECEPCIONISTA
      ===================================================== */

      await pool.query(
        `
        UPDATE funcionarios

        SET
          funcao = $1,
          updated_at = NOW()

        WHERE funcao_id = $2
          AND empresa_id = $3
        `,
        [
          nomeFinal,
          funcaoId,
          empresaId,
        ]
      );

      return res.json({
        ok: true,

        message:
          "Função alterada com sucesso.",

        funcao:
          rows[0],
      });

    } catch (err) {
      console.error(
        "Erro ao alterar função:",
        err
      );

      if (
        err.code === "23505"
      ) {
        return res
          .status(409)
          .json({
            error:
              "Já existe uma função com este nome nesta empresa.",
          });
      }

      return res
        .status(500)
        .json({
          error:
            "Erro ao alterar função.",
        });
    }
  };

/* =========================================================
   EXCLUIR FUNÇÃO
========================================================= */

exports.excluir =
  async (req, res) => {
    try {
      await garantirTabelaFuncoes();

      const funcaoId =
        Number(
          req.params.id
        );

      if (
        !Number.isInteger(
          funcaoId
        ) ||
        funcaoId <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "ID da função inválido.",
          });
      }

      const validacao =
        await validarEmpresaDaRequisicao(
          req,
          res
        );

      if (!validacao) {
        return;
      }

      const {
        empresaId,
      } = validacao;

      /* =====================================================
         VERIFICAR EXISTÊNCIA
      ===================================================== */

      const funcao =
        await pool.query(
          `
          SELECT
            id,
            nome

          FROM funcoes

          WHERE id = $1
            AND empresa_id = $2

          LIMIT 1
          `,
          [
            funcaoId,
            empresaId,
          ]
        );

      if (
        funcao.rows.length ===
        0
      ) {
        return res
          .status(404)
          .json({
            error:
              "Função não encontrada.",
          });
      }

      /* =====================================================
         VERIFICAR FUNCIONÁRIOS
      ===================================================== */

      const funcionarios =
        await pool.query(
          `
          SELECT
            COUNT(*)::integer
              AS total

          FROM funcionarios

          WHERE funcao_id = $1
            AND empresa_id = $2
          `,
          [
            funcaoId,
            empresaId,
          ]
        );

      const totalFuncionarios =
        Number(
          funcionarios
            .rows[0]
            ?.total
        ) || 0;

      if (
        totalFuncionarios > 0
      ) {
        return res
          .status(409)
          .json({
            error:
              `Não é possível excluir esta função. Existem ${totalFuncionarios} funcionário(s) utilizando ela.`,
          });
      }

      /* =====================================================
         EXCLUIR
      ===================================================== */

      await pool.query(
        `
        DELETE FROM funcoes

        WHERE id = $1
          AND empresa_id = $2
        `,
        [
          funcaoId,
          empresaId,
        ]
      );

      return res.json({
        ok: true,

        message:
          "Função excluída com sucesso.",
      });

    } catch (err) {
      console.error(
        "Erro ao excluir função:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            "Erro ao excluir função.",
        });
    }
  };

/* =========================================================
   EXPORTS AUXILIARES
========================================================= */

exports.garantirTabelaFuncoes =
  garantirTabelaFuncoes;

exports.obterEmpresaIdDaRequisicao =
  obterEmpresaIdDaRequisicao;