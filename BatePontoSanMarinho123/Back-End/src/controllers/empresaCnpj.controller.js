const pool = require("../database/pool");

/* =========================================================
   UTILITÁRIOS
========================================================= */

function somenteNumeros(valor = "") {
  return String(valor || "").replace(/\D/g, "");
}

function numeroInteiroPositivo(valor) {
  const numero = Number(valor);

  if (!Number.isInteger(numero) || numero <= 0) {
    return null;
  }

  return numero;
}

function converterBoolean(valor, padrao = false) {
  if (valor === undefined || valor === null) {
    return padrao;
  }

  return (
    valor === true ||
    valor === "true" ||
    valor === 1 ||
    valor === "1"
  );
}

/* =========================================================
   GARANTIR TABELA EMPRESA_CNPJS
========================================================= */

async function garantirTabelaEmpresaCnpjs(client = pool) {
  /* =======================================================
     CRIAR TABELA CASO NÃO EXISTA
  ======================================================= */

  await client.query(`
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

  /* =======================================================
     CORRIGIR TABELA ANTIGA

     IMPORTANTE:
     CREATE TABLE IF NOT EXISTS não adiciona colunas
     novas quando a tabela já existe.

     Por isso usamos ALTER TABLE.
  ======================================================= */

  await client.query(`
    ALTER TABLE empresa_cnpjs
    ADD COLUMN IF NOT EXISTS nome_exibicao VARCHAR(200);
  `);

  await client.query(`
    ALTER TABLE empresa_cnpjs
    ADD COLUMN IF NOT EXISTS principal BOOLEAN DEFAULT false;
  `);

  await client.query(`
    ALTER TABLE empresa_cnpjs
    ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;
  `);

  await client.query(`
    ALTER TABLE empresa_cnpjs
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
  `);

  await client.query(`
    ALTER TABLE empresa_cnpjs
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `);

  /* =======================================================
     CORRIGIR REGISTROS ANTIGOS
  ======================================================= */

  await client.query(`
    UPDATE empresa_cnpjs
    SET principal = false
    WHERE principal IS NULL;
  `);

  await client.query(`
    UPDATE empresa_cnpjs
    SET ativo = true
    WHERE ativo IS NULL;
  `);

  await client.query(`
    UPDATE empresa_cnpjs
    SET created_at = NOW()
    WHERE created_at IS NULL;
  `);

  await client.query(`
    UPDATE empresa_cnpjs
    SET updated_at = NOW()
    WHERE updated_at IS NULL;
  `);

  /* =======================================================
     CONFIGURAR DEFAULTS
  ======================================================= */

  await client.query(`
    ALTER TABLE empresa_cnpjs
    ALTER COLUMN principal SET DEFAULT false;
  `);

  await client.query(`
    ALTER TABLE empresa_cnpjs
    ALTER COLUMN ativo SET DEFAULT true;
  `);

  /* =======================================================
     CONFIGURAR NOT NULL
  ======================================================= */

  await client.query(`
    ALTER TABLE empresa_cnpjs
    ALTER COLUMN principal SET NOT NULL;
  `);

  await client.query(`
    ALTER TABLE empresa_cnpjs
    ALTER COLUMN ativo SET NOT NULL;
  `);

  /* =======================================================
     ÍNDICE ÚNICO

     Impede o mesmo CNPJ duas vezes na mesma empresa.
  ======================================================= */

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
      uq_empresa_cnpjs_empresa_cnpj
    ON empresa_cnpjs (
      empresa_id,
      cnpj
    );
  `);

  /* =======================================================
     ÍNDICE EMPRESA
  ======================================================= */

  await client.query(`
    CREATE INDEX IF NOT EXISTS
      idx_empresa_cnpjs_empresa_id
    ON empresa_cnpjs (
      empresa_id
    );
  `);
}

/* =========================================================
   IDENTIFICAR EMPRESA

   RH/PONTO:
   pega empresa_id automaticamente do JWT.

   SUPER ADMIN:
   pode enviar empresa_id por query/body/params.
========================================================= */

function obterEmpresaId(req) {
  /* =======================================================
     PRIMEIRO: EMPRESA DO USUÁRIO LOGADO
  ======================================================= */

  const empresaToken = numeroInteiroPositivo(
    req.user?.empresa_id
  );

  if (empresaToken) {
    return empresaToken;
  }

  /* =======================================================
     SUPER ADMIN
  ======================================================= */

  const empresaRecebida =
    req.query?.empresa_id ||
    req.body?.empresa_id ||
    req.params?.empresa_id;

  return numeroInteiroPositivo(
    empresaRecebida
  );
}

/* =========================================================
   VERIFICAR SE EMPRESA EXISTE
========================================================= */

async function empresaExiste(
  empresaId,
  client = pool
) {
  const resultado = await client.query(
    `
    SELECT id
    FROM empresas
    WHERE id = $1
    LIMIT 1
    `,
    [empresaId]
  );

  return resultado.rows.length > 0;
}

/* =========================================================
   GARANTIR CNPJ PRINCIPAL

   Se existem CNPJs ativos e nenhum está marcado como
   principal, o primeiro passa a ser principal.
========================================================= */

async function garantirCnpjPrincipal(
  empresaId,
  client = pool
) {
  const principal = await client.query(
    `
    SELECT id
    FROM empresa_cnpjs
    WHERE empresa_id = $1
      AND principal = true
      AND ativo = true
    LIMIT 1
    `,
    [empresaId]
  );

  if (principal.rows.length > 0) {
    return;
  }

  const primeiro = await client.query(
    `
    SELECT id
    FROM empresa_cnpjs
    WHERE empresa_id = $1
      AND ativo = true
    ORDER BY id ASC
    LIMIT 1
    `,
    [empresaId]
  );

  if (primeiro.rows.length === 0) {
    return;
  }

  await client.query(
    `
    UPDATE empresa_cnpjs
    SET
      principal = true,
      updated_at = NOW()
    WHERE id = $1
      AND empresa_id = $2
    `,
    [
      primeiro.rows[0].id,
      empresaId,
    ]
  );
}

/* =========================================================
   LISTAR CNPJS
========================================================= */

async function listar(req, res) {
  try {
    /* =====================================================
       GARANTIR E CORRIGIR TABELA
    ===================================================== */

    await garantirTabelaEmpresaCnpjs();

    /* =====================================================
       IDENTIFICAR EMPRESA
    ===================================================== */

    const empresaId = obterEmpresaId(req);

    console.log(
      "=========================================="
    );

    console.log(
      "📋 LISTAR CNPJS"
    );

    console.log(
      "Usuário:",
      req.user
    );

    console.log(
      "Empresa identificada:",
      empresaId
    );

    console.log(
      "=========================================="
    );

    if (!empresaId) {
      return res.status(400).json({
        error:
          "Empresa não identificada no usuário logado.",
      });
    }

    /* =====================================================
       VERIFICAR EMPRESA
    ===================================================== */

    const existe = await empresaExiste(
      empresaId
    );

    if (!existe) {
      return res.status(404).json({
        error:
          "Empresa não encontrada.",
      });
    }

    /* =====================================================
       GARANTIR PRINCIPAL
    ===================================================== */

    await garantirCnpjPrincipal(
      empresaId
    );

    /* =====================================================
       BUSCAR CNPJS
    ===================================================== */

    const resultado = await pool.query(
      `
      SELECT
        id,
        empresa_id,
        cnpj,
        nome_exibicao,
        principal,
        ativo,
        created_at,
        updated_at

      FROM empresa_cnpjs

      WHERE empresa_id = $1

      ORDER BY
        principal DESC,
        ativo DESC,
        nome_exibicao ASC NULLS LAST,
        id ASC
      `,
      [empresaId]
    );

    console.log(
      `CNPJs encontrados para empresa ${empresaId}:`,
      resultado.rows
    );

    /* =====================================================
       RETORNO
    ===================================================== */

    return res.json({
      ok: true,

      empresa_id:
        empresaId,

      cnpjs:
        resultado.rows,
    });
  } catch (err) {
    console.error(
      "=========================================="
    );

    console.error(
      "❌ ERRO AO LISTAR CNPJS"
    );

    console.error(
      "Mensagem:",
      err.message
    );

    console.error(
      "Código PostgreSQL:",
      err.code
    );

    console.error(
      "Detalhe:",
      err.detail
    );

    console.error(
      "Stack:",
      err.stack
    );

    console.error(
      "=========================================="
    );

    return res.status(500).json({
      error:
        "Erro ao listar CNPJs da empresa.",

      detalhe:
        err.message,
    });
  }
}

/* =========================================================
   CRIAR CNPJ
========================================================= */

async function criar(req, res) {
  const client = await pool.connect();

  let iniciouTransacao = false;

  try {
    /* =====================================================
       GARANTIR TABELA
    ===================================================== */

    await garantirTabelaEmpresaCnpjs(
      client
    );

    /* =====================================================
       EMPRESA
    ===================================================== */

    const empresaId = obterEmpresaId(req);

    if (!empresaId) {
      return res.status(400).json({
        error:
          "Empresa não identificada no usuário logado.",
      });
    }

    const existeEmpresa =
      await empresaExiste(
        empresaId,
        client
      );

    if (!existeEmpresa) {
      return res.status(404).json({
        error:
          "Empresa não encontrada.",
      });
    }

    /* =====================================================
       DADOS
    ===================================================== */

    let {
      cnpj,
      nome_exibicao,
      identificacao,
      principal,
    } = req.body;

    /* =====================================================
       CNPJ
    ===================================================== */

    cnpj = somenteNumeros(
      cnpj
    );

    if (cnpj.length !== 14) {
      return res.status(400).json({
        error:
          "O CNPJ deve possuir 14 números.",
      });
    }

    /* =====================================================
       IDENTIFICAÇÃO

       Aceita:
       nome_exibicao
       ou
       identificacao
    ===================================================== */

    nome_exibicao = String(
      nome_exibicao ||
      identificacao ||
      ""
    ).trim();

    if (!nome_exibicao) {
      nome_exibicao = null;
    }

    /* =====================================================
       PRINCIPAL
    ===================================================== */

    principal = converterBoolean(
      principal,
      false
    );

    /* =====================================================
       VERIFICAR DUPLICADO
    ===================================================== */

    const duplicado =
      await client.query(
        `
        SELECT id

        FROM empresa_cnpjs

        WHERE empresa_id = $1
          AND cnpj = $2

        LIMIT 1
        `,
        [
          empresaId,
          cnpj,
        ]
      );

    if (
      duplicado.rows.length > 0
    ) {
      return res.status(409).json({
        error:
          "Este CNPJ já está cadastrado nesta empresa.",
      });
    }

    /* =====================================================
       TRANSAÇÃO
    ===================================================== */

    await client.query(
      "BEGIN"
    );

    iniciouTransacao = true;

    /* =====================================================
       VERIFICAR SE É PRIMEIRO CNPJ
    ===================================================== */

    const quantidade =
      await client.query(
        `
        SELECT
          COUNT(*)::int AS total

        FROM empresa_cnpjs

        WHERE empresa_id = $1
        `,
        [empresaId]
      );

    const total = Number(
      quantidade.rows[0]?.total || 0
    );

    /*
     * Primeiro CNPJ da empresa sempre será principal.
     */

    if (total === 0) {
      principal = true;
    }

    /* =====================================================
       SE FOR PRINCIPAL, REMOVER DOS OUTROS
    ===================================================== */

    if (principal) {
      await client.query(
        `
        UPDATE empresa_cnpjs

        SET
          principal = false,
          updated_at = NOW()

        WHERE empresa_id = $1
        `,
        [empresaId]
      );
    }

    /* =====================================================
       INSERIR
    ===================================================== */

    const resultado =
      await client.query(
        `
        INSERT INTO empresa_cnpjs (
          empresa_id,
          cnpj,
          nome_exibicao,
          principal,
          ativo
        )

        VALUES (
          $1,
          $2,
          $3,
          $4,
          true
        )

        RETURNING
          id,
          empresa_id,
          cnpj,
          nome_exibicao,
          principal,
          ativo,
          created_at,
          updated_at
        `,
        [
          empresaId,
          cnpj,
          nome_exibicao,
          principal,
        ]
      );

    /* =====================================================
       COMMIT
    ===================================================== */

    await client.query(
      "COMMIT"
    );

    iniciouTransacao = false;

    /* =====================================================
       RETORNO
    ===================================================== */

    return res.status(201).json({
      ok: true,

      message:
        "CNPJ cadastrado com sucesso.",

      cnpj:
        resultado.rows[0],
    });
  } catch (err) {
    /* =====================================================
       ROLLBACK
    ===================================================== */

    if (iniciouTransacao) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (rollbackError) {
        console.error(
          "Erro no rollback:",
          rollbackError
        );
      }
    }

    console.error(
      "=========================================="
    );

    console.error(
      "❌ ERRO AO CADASTRAR CNPJ"
    );

    console.error(
      "Mensagem:",
      err.message
    );

    console.error(
      "Código:",
      err.code
    );

    console.error(
      "Detalhe:",
      err.detail
    );

    console.error(
      "=========================================="
    );

    if (err.code === "23505") {
      return res.status(409).json({
        error:
          "Este CNPJ já está cadastrado nesta empresa.",
      });
    }

    return res.status(500).json({
      error:
        "Erro ao cadastrar CNPJ.",

      detalhe:
        err.message,
    });
  } finally {
    client.release();
  }
}

/* =========================================================
   ATUALIZAR CNPJ
========================================================= */

async function atualizar(req, res) {
  const client = await pool.connect();

  let iniciouTransacao = false;

  try {
    /* =====================================================
       GARANTIR TABELA
    ===================================================== */

    await garantirTabelaEmpresaCnpjs(
      client
    );

    /* =====================================================
       EMPRESA
    ===================================================== */

    const empresaId = obterEmpresaId(req);

    if (!empresaId) {
      return res.status(400).json({
        error:
          "Empresa não identificada no usuário logado.",
      });
    }

    /* =====================================================
       ID DO CNPJ
    ===================================================== */

    const id = numeroInteiroPositivo(
      req.params.id
    );

    if (!id) {
      return res.status(400).json({
        error:
          "ID do CNPJ inválido.",
      });
    }

    /* =====================================================
       BUSCAR REGISTRO
    ===================================================== */

    const atual =
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

        WHERE id = $1
          AND empresa_id = $2

        LIMIT 1
        `,
        [
          id,
          empresaId,
        ]
      );

    if (
      atual.rows.length === 0
    ) {
      return res.status(404).json({
        error:
          "CNPJ não encontrado.",
      });
    }

    const registro =
      atual.rows[0];

    /* =====================================================
       DADOS RECEBIDOS
    ===================================================== */

    let {
      cnpj,
      nome_exibicao,
      identificacao,
      principal,
      ativo,
    } = req.body;

    /* =====================================================
       CNPJ
    ===================================================== */

    if (cnpj !== undefined) {
      cnpj = somenteNumeros(
        cnpj
      );
    } else {
      cnpj =
        registro.cnpj;
    }

    if (cnpj.length !== 14) {
      return res.status(400).json({
        error:
          "O CNPJ deve possuir 14 números.",
      });
    }

    /* =====================================================
       IDENTIFICAÇÃO
    ===================================================== */

    if (
      nome_exibicao !== undefined ||
      identificacao !== undefined
    ) {
      nome_exibicao = String(
        nome_exibicao ||
        identificacao ||
        ""
      ).trim();

      if (!nome_exibicao) {
        nome_exibicao = null;
      }
    } else {
      nome_exibicao =
        registro.nome_exibicao;
    }

    /* =====================================================
       PRINCIPAL
    ===================================================== */

    principal =
      principal !== undefined
        ? converterBoolean(
            principal,
            registro.principal
          )
        : registro.principal;

    /* =====================================================
       ATIVO
    ===================================================== */

    ativo =
      ativo !== undefined
        ? converterBoolean(
            ativo,
            registro.ativo
          )
        : registro.ativo;

    /* =====================================================
       PRINCIPAL NÃO PODE FICAR INATIVO
    ===================================================== */

    if (
      principal &&
      !ativo
    ) {
      return res.status(400).json({
        error:
          "O CNPJ principal não pode ficar inativo.",
      });
    }

    /* =====================================================
       VERIFICAR DUPLICIDADE
    ===================================================== */

    const duplicado =
      await client.query(
        `
        SELECT id

        FROM empresa_cnpjs

        WHERE empresa_id = $1
          AND cnpj = $2
          AND id <> $3

        LIMIT 1
        `,
        [
          empresaId,
          cnpj,
          id,
        ]
      );

    if (
      duplicado.rows.length > 0
    ) {
      return res.status(409).json({
        error:
          "Este CNPJ já está cadastrado nesta empresa.",
      });
    }

    /* =====================================================
       TRANSAÇÃO
    ===================================================== */

    await client.query(
      "BEGIN"
    );

    iniciouTransacao = true;

    /* =====================================================
       SE FOR PRINCIPAL
    ===================================================== */

    if (principal) {
      await client.query(
        `
        UPDATE empresa_cnpjs

        SET
          principal = false,
          updated_at = NOW()

        WHERE empresa_id = $1
          AND id <> $2
        `,
        [
          empresaId,
          id,
        ]
      );
    }

    /* =====================================================
       ATUALIZAR
    ===================================================== */

    const resultado =
      await client.query(
        `
        UPDATE empresa_cnpjs

        SET
          cnpj = $1,
          nome_exibicao = $2,
          principal = $3,
          ativo = $4,
          updated_at = NOW()

        WHERE id = $5
          AND empresa_id = $6

        RETURNING
          id,
          empresa_id,
          cnpj,
          nome_exibicao,
          principal,
          ativo,
          created_at,
          updated_at
        `,
        [
          cnpj,
          nome_exibicao,
          principal,
          ativo,
          id,
          empresaId,
        ]
      );

    /* =====================================================
       COMMIT
    ===================================================== */

    await client.query(
      "COMMIT"
    );

    iniciouTransacao = false;

    /* =====================================================
       GARANTIR PRINCIPAL
    ===================================================== */

    await garantirCnpjPrincipal(
      empresaId
    );

    /* =====================================================
       RETORNO
    ===================================================== */

    return res.json({
      ok: true,

      message:
        "CNPJ atualizado com sucesso.",

      cnpj:
        resultado.rows[0],
    });
  } catch (err) {
    /* =====================================================
       ROLLBACK
    ===================================================== */

    if (iniciouTransacao) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (rollbackError) {
        console.error(
          "Erro no rollback:",
          rollbackError
        );
      }
    }

    console.error(
      "=========================================="
    );

    console.error(
      "❌ ERRO AO ATUALIZAR CNPJ"
    );

    console.error(
      "Mensagem:",
      err.message
    );

    console.error(
      "Código:",
      err.code
    );

    console.error(
      "=========================================="
    );

    if (err.code === "23505") {
      return res.status(409).json({
        error:
          "Este CNPJ já está cadastrado nesta empresa.",
      });
    }

    return res.status(500).json({
      error:
        "Erro ao atualizar CNPJ.",

      detalhe:
        err.message,
    });
  } finally {
    client.release();
  }
}

/* =========================================================
   DEFINIR CNPJ COMO PRINCIPAL
========================================================= */

async function definirPrincipal(
  req,
  res
) {
  const client = await pool.connect();

  let iniciouTransacao = false;

  try {
    /* =====================================================
       GARANTIR TABELA
    ===================================================== */

    await garantirTabelaEmpresaCnpjs(
      client
    );

    /* =====================================================
       EMPRESA
    ===================================================== */

    const empresaId = obterEmpresaId(req);

    if (!empresaId) {
      return res.status(400).json({
        error:
          "Empresa não identificada no usuário logado.",
      });
    }

    /* =====================================================
       ID
    ===================================================== */

    const id = numeroInteiroPositivo(
      req.params.id
    );

    if (!id) {
      return res.status(400).json({
        error:
          "ID do CNPJ inválido.",
      });
    }

    /* =====================================================
       VERIFICAR REGISTRO
    ===================================================== */

    const existe =
      await client.query(
        `
        SELECT
          id,
          cnpj,
          ativo

        FROM empresa_cnpjs

        WHERE id = $1
          AND empresa_id = $2

        LIMIT 1
        `,
        [
          id,
          empresaId,
        ]
      );

    if (
      existe.rows.length === 0
    ) {
      return res.status(404).json({
        error:
          "CNPJ não encontrado.",
      });
    }

    /* =====================================================
       NÃO PERMITIR INATIVO
    ===================================================== */

    if (
      existe.rows[0].ativo === false
    ) {
      return res.status(400).json({
        error:
          "Não é possível definir um CNPJ inativo como principal.",
      });
    }

    /* =====================================================
       TRANSAÇÃO
    ===================================================== */

    await client.query(
      "BEGIN"
    );

    iniciouTransacao = true;

    /* =====================================================
       REMOVER PRINCIPAL ATUAL
    ===================================================== */

    await client.query(
      `
      UPDATE empresa_cnpjs

      SET
        principal = false,
        updated_at = NOW()

      WHERE empresa_id = $1
      `,
      [empresaId]
    );

    /* =====================================================
       DEFINIR NOVO PRINCIPAL
    ===================================================== */

    const resultado =
      await client.query(
        `
        UPDATE empresa_cnpjs

        SET
          principal = true,
          ativo = true,
          updated_at = NOW()

        WHERE id = $1
          AND empresa_id = $2

        RETURNING
          id,
          empresa_id,
          cnpj,
          nome_exibicao,
          principal,
          ativo,
          created_at,
          updated_at
        `,
        [
          id,
          empresaId,
        ]
      );

    /* =====================================================
       COMMIT
    ===================================================== */

    await client.query(
      "COMMIT"
    );

    iniciouTransacao = false;

    /* =====================================================
       RETORNO
    ===================================================== */

    return res.json({
      ok: true,

      message:
        "CNPJ principal alterado com sucesso.",

      cnpj:
        resultado.rows[0],
    });
  } catch (err) {
    /* =====================================================
       ROLLBACK
    ===================================================== */

    if (iniciouTransacao) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (rollbackError) {
        console.error(
          "Erro no rollback:",
          rollbackError
        );
      }
    }

    console.error(
      "=========================================="
    );

    console.error(
      "❌ ERRO AO DEFINIR CNPJ PRINCIPAL"
    );

    console.error(
      "Mensagem:",
      err.message
    );

    console.error(
      "Código:",
      err.code
    );

    console.error(
      "=========================================="
    );

    return res.status(500).json({
      error:
        "Erro ao definir CNPJ principal.",

      detalhe:
        err.message,
    });
  } finally {
    client.release();
  }
}

/* =========================================================
   EXCLUIR CNPJ
========================================================= */

async function excluir(req, res) {
  const client = await pool.connect();

  let iniciouTransacao = false;

  try {
    /* =====================================================
       GARANTIR TABELA
    ===================================================== */

    await garantirTabelaEmpresaCnpjs(
      client
    );

    /* =====================================================
       EMPRESA
    ===================================================== */

    const empresaId = obterEmpresaId(req);

    if (!empresaId) {
      return res.status(400).json({
        error:
          "Empresa não identificada no usuário logado.",
      });
    }

    /* =====================================================
       ID
    ===================================================== */

    const id = numeroInteiroPositivo(
      req.params.id
    );

    if (!id) {
      return res.status(400).json({
        error:
          "ID do CNPJ inválido.",
      });
    }

    /* =====================================================
       BUSCAR CNPJ
    ===================================================== */

    const registro =
      await client.query(
        `
        SELECT
          id,
          empresa_id,
          cnpj,
          principal

        FROM empresa_cnpjs

        WHERE id = $1
          AND empresa_id = $2

        LIMIT 1
        `,
        [
          id,
          empresaId,
        ]
      );

    if (
      registro.rows.length === 0
    ) {
      return res.status(404).json({
        error:
          "CNPJ não encontrado.",
      });
    }

    /* =====================================================
       NÃO EXCLUIR PRINCIPAL
    ===================================================== */

    if (
      registro.rows[0].principal
    ) {
      return res.status(400).json({
        error:
          "O CNPJ principal não pode ser excluído. Defina outro como principal primeiro.",
      });
    }

    /* =====================================================
       VERIFICAR FUNCIONÁRIOS VINCULADOS

       Se você possui cnpj_empresa na tabela funcionarios,
       não deixa excluir enquanto estiver sendo usado.
    ===================================================== */

    try {
      const funcionariosUsando =
        await client.query(
          `
          SELECT
            COUNT(*)::int AS total

          FROM funcionarios

          WHERE empresa_id = $1

            AND REGEXP_REPLACE(
              COALESCE(
                cnpj_empresa,
                ''
              ),
              '[^0-9]',
              '',
              'g'
            ) = $2
          `,
          [
            empresaId,
            registro.rows[0].cnpj,
          ]
        );

      const totalFuncionarios =
        Number(
          funcionariosUsando
            .rows[0]
            ?.total || 0
        );

      if (
        totalFuncionarios > 0
      ) {
        return res.status(400).json({
          error:
            "Este CNPJ está vinculado a funcionário(s) e não pode ser excluído.",
        });
      }
    } catch (erroFuncionarios) {
      /*
       * 42703 = coluna não existe.
       *
       * Se a sua tabela funcionarios ainda não tiver
       * cnpj_empresa, não vamos impedir a exclusão por isso.
       */

      if (
        erroFuncionarios.code !==
        "42703"
      ) {
        throw erroFuncionarios;
      }

      console.log(
        "Coluna cnpj_empresa não encontrada em funcionarios. Verificação ignorada."
      );
    }

    /* =====================================================
       TRANSAÇÃO
    ===================================================== */

    await client.query(
      "BEGIN"
    );

    iniciouTransacao = true;

    /* =====================================================
       EXCLUIR
    ===================================================== */

    await client.query(
      `
      DELETE FROM empresa_cnpjs

      WHERE id = $1
        AND empresa_id = $2
      `,
      [
        id,
        empresaId,
      ]
    );

    /* =====================================================
       COMMIT
    ===================================================== */

    await client.query(
      "COMMIT"
    );

    iniciouTransacao = false;

    /* =====================================================
       GARANTIR QUE CONTINUE EXISTINDO PRINCIPAL
    ===================================================== */

    await garantirCnpjPrincipal(
      empresaId
    );

    /* =====================================================
       RETORNO
    ===================================================== */

    return res.json({
      ok: true,

      message:
        "CNPJ excluído com sucesso.",
    });
  } catch (err) {
    /* =====================================================
       ROLLBACK
    ===================================================== */

    if (iniciouTransacao) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (rollbackError) {
        console.error(
          "Erro no rollback:",
          rollbackError
        );
      }
    }

    console.error(
      "=========================================="
    );

    console.error(
      "❌ ERRO AO EXCLUIR CNPJ"
    );

    console.error(
      "Mensagem:",
      err.message
    );

    console.error(
      "Código:",
      err.code
    );

    console.error(
      "Detalhe:",
      err.detail
    );

    console.error(
      "=========================================="
    );

    return res.status(500).json({
      error:
        "Erro ao excluir CNPJ.",

      detalhe:
        err.message,
    });
  } finally {
    client.release();
  }
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  garantirTabelaEmpresaCnpjs,

  listar,

  criar,

  atualizar,

  definirPrincipal,

  excluir,
};