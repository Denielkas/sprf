const pool = require("../database/pool");

/* =========================================================
   GARANTIR TABELA EMPRESA_CNPJS
========================================================= */

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

      updated_at TIMESTAMP DEFAULT NOW(),

      UNIQUE (empresa_id, cnpj)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
      idx_empresa_cnpjs_empresa_id
    ON empresa_cnpjs (empresa_id);
  `);
}

/* =========================================================
   DESCOBRIR EMPRESA

   admin_empresa:
   pega automaticamente do token.

   super_admin:
   recebe empresa_id pela URL.
========================================================= */

function obterEmpresaId(req) {
  if (!req.user) {
    return null;
  }

  if (req.user.role === "admin_empresa") {
    return req.user.empresa_id || null;
  }

  if (req.user.role === "super_admin") {
    return (
      req.params.empresa_id ||
      req.query.empresa_id ||
      req.body?.empresa_id ||
      null
    );
  }

  return null;
}

/* =========================================================
   VERIFICAR EMPRESA
========================================================= */

async function buscarEmpresa(empresaId) {
  const { rows } = await pool.query(
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
   LISTAR CNPJS DA EMPRESA
========================================================= */

async function listar(req, res) {
  try {
    await garantirTabelaEmpresaCnpjs();

    const empresaId = obterEmpresaId(req);

    if (!empresaId) {
      return res.status(400).json({
        error: "Empresa não informada.",
      });
    }

    const empresa = await buscarEmpresa(empresaId);

    if (!empresa) {
      return res.status(404).json({
        error: "Empresa não encontrada.",
      });
    }

    const { rows } = await pool.query(
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
        nome_exibicao ASC NULLS LAST,
        id ASC
      `,
      [empresaId]
    );

    return res.json({
      empresa: {
        id: empresa.id,
        nome:
          empresa.nome_fantasia ||
          empresa.nome,
      },

      cnpjs: rows,
    });
  } catch (err) {
    console.error(
      "Erro ao listar CNPJs:",
      err
    );

    return res.status(500).json({
      error:
        "Erro ao listar CNPJs da empresa.",
    });
  }
}

/* =========================================================
   CADASTRAR CNPJ
========================================================= */

async function criar(req, res) {
  const client =
    await pool.connect();

  try {
    await garantirTabelaEmpresaCnpjs();

    const empresaId = obterEmpresaId(req);

    let {
      cnpj,
      nome_exibicao,
      principal,
    } = req.body;

    if (!empresaId) {
      return res.status(400).json({
        error: "Empresa não informada.",
      });
    }

    const empresa =
      await buscarEmpresa(empresaId);

    if (!empresa) {
      return res.status(404).json({
        error: "Empresa não encontrada.",
      });
    }

    cnpj = cnpj
      ? String(cnpj).replace(/\D/g, "")
      : "";

    if (cnpj.length !== 14) {
      return res.status(400).json({
        error:
          "O CNPJ deve possuir 14 números.",
      });
    }

    nome_exibicao =
      nome_exibicao
        ? String(nome_exibicao).trim()
        : null;

    principal =
      principal === true ||
      principal === "true";

    /* =============================================
       VERIFICAR DUPLICIDADE
    ============================================= */

    const existe =
      await pool.query(
        `
        SELECT id
        FROM empresa_cnpjs
        WHERE
          empresa_id = $1
          AND cnpj = $2
        LIMIT 1
        `,
        [
          empresaId,
          cnpj,
        ]
      );

    if (existe.rows.length > 0) {
      return res.status(409).json({
        error:
          "Este CNPJ já está cadastrado nesta empresa.",
      });
    }

    await client.query("BEGIN");

    /* =============================================
       PRIMEIRO CNPJ VIRA PRINCIPAL AUTOMATICAMENTE
    ============================================= */

    const quantidade =
      await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM empresa_cnpjs
        WHERE empresa_id = $1
        `,
        [empresaId]
      );

    if (
      quantidade.rows[0].total === 0
    ) {
      principal = true;
    }

    /* =============================================
       SE NOVO FOR PRINCIPAL, REMOVE PRINCIPAL DOS OUTROS
    ============================================= */

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

    /* =============================================
       INSERIR
    ============================================= */

    const { rows } =
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

        RETURNING *
        `,
        [
          empresaId,
          cnpj,
          nome_exibicao,
          principal,
        ]
      );

    await client.query("COMMIT");

    return res.status(201).json({
      ok: true,

      message:
        "CNPJ cadastrado com sucesso.",

      cnpj: rows[0],
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}

    console.error(
      "Erro ao cadastrar CNPJ:",
      err
    );

    return res.status(500).json({
      error:
        "Erro ao cadastrar CNPJ.",
    });
  } finally {
    client.release();
  }
}

/* =========================================================
   ALTERAR CNPJ
========================================================= */

async function atualizar(req, res) {
  const client =
    await pool.connect();

  try {
    await garantirTabelaEmpresaCnpjs();

    const empresaId =
      obterEmpresaId(req);

    const { id } = req.params;

    let {
      cnpj,
      nome_exibicao,
      principal,
      ativo,
    } = req.body;

    if (!empresaId) {
      return res.status(400).json({
        error: "Empresa não informada.",
      });
    }

    const atual =
      await pool.query(
        `
        SELECT *
        FROM empresa_cnpjs
        WHERE
          id = $1
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

    const registroAtual =
      atual.rows[0];

    cnpj =
      cnpj !== undefined
        ? String(cnpj).replace(
            /\D/g,
            ""
          )
        : registroAtual.cnpj;

    if (cnpj.length !== 14) {
      return res.status(400).json({
        error:
          "O CNPJ deve possuir 14 números.",
      });
    }

    nome_exibicao =
      nome_exibicao !== undefined
        ? String(
            nome_exibicao || ""
          ).trim() || null
        : registroAtual.nome_exibicao;

    principal =
      principal !== undefined
        ? principal === true ||
          principal === "true"
        : registroAtual.principal;

    ativo =
      ativo !== undefined
        ? ativo === true ||
          ativo === "true"
        : registroAtual.ativo;

    /* =============================================
       DUPLICIDADE
    ============================================= */

    const duplicado =
      await pool.query(
        `
        SELECT id
        FROM empresa_cnpjs

        WHERE
          empresa_id = $1
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

    await client.query("BEGIN");

    /* =============================================
       DEFINIR PRINCIPAL
    ============================================= */

    if (principal) {
      await client.query(
        `
        UPDATE empresa_cnpjs
        SET
          principal = false,
          updated_at = NOW()

        WHERE
          empresa_id = $1
          AND id <> $2
        `,
        [
          empresaId,
          id,
        ]
      );
    }

    const { rows } =
      await client.query(
        `
        UPDATE empresa_cnpjs

        SET
          cnpj = $1,
          nome_exibicao = $2,
          principal = $3,
          ativo = $4,
          updated_at = NOW()

        WHERE
          id = $5
          AND empresa_id = $6

        RETURNING *
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

    await client.query("COMMIT");

    return res.json({
      ok: true,

      message:
        "CNPJ atualizado com sucesso.",

      cnpj: rows[0],
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}

    console.error(
      "Erro ao atualizar CNPJ:",
      err
    );

    return res.status(500).json({
      error:
        "Erro ao atualizar CNPJ.",
    });
  } finally {
    client.release();
  }
}

/* =========================================================
   DEFINIR COMO PRINCIPAL
========================================================= */

async function definirPrincipal(
  req,
  res
) {
  const client =
    await pool.connect();

  try {
    await garantirTabelaEmpresaCnpjs();

    const empresaId =
      obterEmpresaId(req);

    const { id } = req.params;

    if (!empresaId) {
      return res.status(400).json({
        error: "Empresa não informada.",
      });
    }

    const existe =
      await pool.query(
        `
        SELECT id, ativo
        FROM empresa_cnpjs

        WHERE
          id = $1
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

    if (
      !existe.rows[0].ativo
    ) {
      return res.status(400).json({
        error:
          "Não é possível definir um CNPJ inativo como principal.",
      });
    }

    await client.query("BEGIN");

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

    const { rows } =
      await client.query(
        `
        UPDATE empresa_cnpjs

        SET
          principal = true,
          updated_at = NOW()

        WHERE
          id = $1
          AND empresa_id = $2

        RETURNING *
        `,
        [
          id,
          empresaId,
        ]
      );

    await client.query("COMMIT");

    return res.json({
      ok: true,

      message:
        "CNPJ principal alterado com sucesso.",

      cnpj: rows[0],
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}

    console.error(
      "Erro ao definir CNPJ principal:",
      err
    );

    return res.status(500).json({
      error:
        "Erro ao definir CNPJ principal.",
    });
  } finally {
    client.release();
  }
}

/* =========================================================
   EXCLUIR CNPJ
========================================================= */

async function excluir(req, res) {
  try {
    await garantirTabelaEmpresaCnpjs();

    const empresaId =
      obterEmpresaId(req);

    const { id } = req.params;

    if (!empresaId) {
      return res.status(400).json({
        error: "Empresa não informada.",
      });
    }

    const registro =
      await pool.query(
        `
        SELECT
          id,
          principal

        FROM empresa_cnpjs

        WHERE
          id = $1
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

    if (
      registro.rows[0].principal
    ) {
      return res.status(400).json({
        error:
          "O CNPJ principal não pode ser excluído. Defina outro como principal primeiro.",
      });
    }

    await pool.query(
      `
      DELETE FROM empresa_cnpjs

      WHERE
        id = $1
        AND empresa_id = $2
      `,
      [
        id,
        empresaId,
      ]
    );

    return res.json({
      ok: true,

      message:
        "CNPJ excluído com sucesso.",
    });
  } catch (err) {
    console.error(
      "Erro ao excluir CNPJ:",
      err
    );

    return res.status(500).json({
      error:
        "Erro ao excluir CNPJ.",
    });
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