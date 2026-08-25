const pool = require("../database/pool");

/* =========================================================
   GARANTIR ESTRUTURA DAS EMPRESAS
========================================================= */

async function garantirTabelaEmpresas() {
  /* =======================================================
     TABELA EMPRESAS
  ======================================================= */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS empresas (
      id BIGSERIAL PRIMARY KEY,

      nome VARCHAR(200) NOT NULL,

      nome_fantasia VARCHAR(200),

      cnpj VARCHAR(14),

      cor_primaria VARCHAR(20)
        NOT NULL DEFAULT '#0d6efd',

      cor_secundaria VARCHAR(20)
        NOT NULL DEFAULT '#084298',

      logo_arquivo TEXT,

      fundo_arquivo TEXT,

      ativo BOOLEAN
        NOT NULL DEFAULT true,

      created_at TIMESTAMP
        DEFAULT NOW(),

      updated_at TIMESTAMP
        DEFAULT NOW()
    );
  `);

  /* =======================================================
     COMPATIBILIDADE COM BANCO ANTIGO
  ======================================================= */

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS nome_fantasia VARCHAR(200);
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS cnpj VARCHAR(14);
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS cor_primaria VARCHAR(20)
    NOT NULL DEFAULT '#0d6efd';
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS cor_secundaria VARCHAR(20)
    NOT NULL DEFAULT '#084298';
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS logo_arquivo TEXT;
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS fundo_arquivo TEXT;
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS ativo BOOLEAN
    NOT NULL DEFAULT true;
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
    DEFAULT NOW();
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
    DEFAULT NOW();
  `);

  /* =======================================================
     MIGRAR IMAGENS ANTIGAS

     Caso sua tabela antiga possua logo_url/fundo_url,
     tentamos aproveitar esses registros.

     Como PostgreSQL não permite referenciar coluna que
     talvez não exista diretamente, verificamos antes.
  ======================================================= */

  await pool.query(`
    DO $$
    BEGIN

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'empresas'
          AND column_name = 'logo_url'
      ) THEN

        UPDATE empresas
        SET logo_arquivo =
          regexp_replace(
            logo_url,
            '^.*/',
            ''
          )
        WHERE
          logo_arquivo IS NULL
          AND logo_url IS NOT NULL
          AND TRIM(logo_url) <> '';

      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'empresas'
          AND column_name = 'fundo_url'
      ) THEN

        UPDATE empresas
        SET fundo_arquivo =
          regexp_replace(
            fundo_url,
            '^.*/',
            ''
          )
        WHERE
          fundo_arquivo IS NULL
          AND fundo_url IS NOT NULL
          AND TRIM(fundo_url) <> '';

      END IF;

    END $$;
  `);

  /* =======================================================
     TABELA DE CNPJS
  ======================================================= */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS empresa_cnpjs (
      id BIGSERIAL PRIMARY KEY,

      empresa_id BIGINT NOT NULL
        REFERENCES empresas(id)
        ON DELETE CASCADE,

      cnpj VARCHAR(14) NOT NULL,

      nome VARCHAR(200),

      principal BOOLEAN
        NOT NULL DEFAULT false,

      ativo BOOLEAN
        NOT NULL DEFAULT true,

      created_at TIMESTAMP
        DEFAULT NOW(),

      updated_at TIMESTAMP
        DEFAULT NOW(),

      UNIQUE (empresa_id, cnpj)
    );
  `);

  /* =======================================================
     COMPATIBILIDADE empresa_cnpjs
  ======================================================= */

  await pool.query(`
    ALTER TABLE empresa_cnpjs
    ADD COLUMN IF NOT EXISTS nome VARCHAR(200);
  `);

  await pool.query(`
    ALTER TABLE empresa_cnpjs
    ADD COLUMN IF NOT EXISTS principal BOOLEAN
    NOT NULL DEFAULT false;
  `);

  await pool.query(`
    ALTER TABLE empresa_cnpjs
    ADD COLUMN IF NOT EXISTS ativo BOOLEAN
    NOT NULL DEFAULT true;
  `);

  await pool.query(`
    ALTER TABLE empresa_cnpjs
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
    DEFAULT NOW();
  `);

  await pool.query(`
    ALTER TABLE empresa_cnpjs
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
    DEFAULT NOW();
  `);

  /* =======================================================
     MIGRAR CNPJ ANTIGO
  ======================================================= */

  await pool.query(`
    INSERT INTO empresa_cnpjs (
      empresa_id,
      cnpj,
      nome,
      principal,
      ativo
    )

    SELECT
      e.id,
      e.cnpj,

      COALESCE(
        NULLIF(
          TRIM(e.nome_fantasia),
          ''
        ),
        e.nome
      ),

      true,
      true

    FROM empresas e

    WHERE
      e.cnpj IS NOT NULL

      AND TRIM(e.cnpj) <> ''

      AND NOT EXISTS (
        SELECT 1

        FROM empresa_cnpjs ec

        WHERE
          ec.empresa_id = e.id

          AND ec.cnpj = e.cnpj
      );
  `);

  /* =======================================================
     GARANTIR UM CNPJ PRINCIPAL
  ======================================================= */

  await pool.query(`
    UPDATE empresa_cnpjs ec

    SET
      principal = true,
      updated_at = NOW()

    WHERE ec.id IN (
      SELECT
        MIN(ec2.id)

      FROM empresa_cnpjs ec2

      WHERE
        ec2.ativo = true

        AND NOT EXISTS (
          SELECT 1

          FROM empresa_cnpjs principal

          WHERE
            principal.empresa_id =
              ec2.empresa_id

            AND principal.principal =
              true

            AND principal.ativo =
              true
        )

      GROUP BY
        ec2.empresa_id
    );
  `);

  /* =======================================================
     SINCRONIZAR CNPJ PRINCIPAL
  ======================================================= */

  await pool.query(`
    UPDATE empresas e

    SET
      cnpj = (
        SELECT ec.cnpj

        FROM empresa_cnpjs ec

        WHERE
          ec.empresa_id = e.id

          AND ec.principal = true

          AND ec.ativo = true

        ORDER BY ec.id ASC

        LIMIT 1
      ),

      updated_at = NOW()

    WHERE EXISTS (
      SELECT 1

      FROM empresa_cnpjs ec

      WHERE
        ec.empresa_id = e.id

        AND ec.principal = true

        AND ec.ativo = true
    );
  `);
}

/* =========================================================
   FUNÇÕES AUXILIARES
========================================================= */

function limparCnpj(cnpj) {
  if (!cnpj) {
    return null;
  }

  return String(cnpj)
    .replace(/\D/g, "");
}

function validarCnpjBasico(cnpj) {
  if (!cnpj) {
    return false;
  }

  return /^\d{14}$/.test(cnpj);
}

function validarCorHex(cor) {
  if (!cor) {
    return false;
  }

  return /^#[0-9A-Fa-f]{6}$/.test(
    String(cor).trim()
  );
}

/* =========================================================
   MONTAR RESPOSTA DA EMPRESA

   Aqui transformamos os arquivos em URLs públicas.
========================================================= */

function montarEmpresa(empresa) {
  if (!empresa) {
    return null;
  }

  return {
    ...empresa,

    logo_url:
      empresa.logo_arquivo
        ? `/api/empresas/${empresa.id}/logo`
        : null,

    fundo_url:
      empresa.fundo_arquivo
        ? `/api/empresas/${empresa.id}/fundo`
        : null,
  };
}

/* =========================================================
   BUSCAR CNPJS DA EMPRESA
========================================================= */

async function buscarCnpjsEmpresa(
  empresaId
) {
  const { rows } =
    await pool.query(
      `
      SELECT
        id,
        empresa_id,
        cnpj,
        nome,
        principal,
        ativo,
        created_at,
        updated_at

      FROM empresa_cnpjs

      WHERE empresa_id = $1

      ORDER BY
        principal DESC,
        nome ASC NULLS LAST,
        id ASC
      `,
      [empresaId]
    );

  return rows;
}

/* =========================================================
   LISTAR EMPRESAS
========================================================= */

async function listarEmpresas(
  req,
  res
) {
  try {
    await garantirTabelaEmpresas();

    const { rows } =
      await pool.query(`
        SELECT
          id,
          nome,
          nome_fantasia,
          cnpj,

          cor_primaria,
          cor_secundaria,

          logo_arquivo,
          fundo_arquivo,

          ativo,

          created_at,
          updated_at

        FROM empresas

        ORDER BY
          nome ASC
      `);

    const empresas =
      await Promise.all(
        rows.map(
          async (empresa) => {
            const cnpjs =
              await buscarCnpjsEmpresa(
                empresa.id
              );

            return {
              ...montarEmpresa(
                empresa
              ),

              cnpjs,
            };
          }
        )
      );

    return res.json(
      empresas
    );
  } catch (err) {
    console.error(
      "Erro ao listar empresas:",
      err
    );

    return res
      .status(500)
      .json({
        error:
          "Erro ao listar empresas.",
      });
  }
}

/* =========================================================
   BUSCAR EMPRESA POR ID
========================================================= */

async function buscarEmpresaPorId(
  req,
  res
) {
  try {
    await garantirTabelaEmpresas();

    const empresaId =
      Number(req.params.id);

    if (
      !Number.isInteger(
        empresaId
      ) ||
      empresaId <= 0
    ) {
      return res
        .status(400)
        .json({
          error:
            "ID da empresa inválido.",
        });
    }

    const { rows } =
      await pool.query(
        `
        SELECT
          id,
          nome,
          nome_fantasia,
          cnpj,

          cor_primaria,
          cor_secundaria,

          logo_arquivo,
          fundo_arquivo,

          ativo,

          created_at,
          updated_at

        FROM empresas

        WHERE id = $1

        LIMIT 1
        `,
        [empresaId]
      );

    if (
      rows.length === 0
    ) {
      return res
        .status(404)
        .json({
          error:
            "Empresa não encontrada.",
        });
    }

    const empresa =
      rows[0];

    const cnpjs =
      await buscarCnpjsEmpresa(
        empresa.id
      );

    return res.json({
      ...montarEmpresa(
        empresa
      ),

      cnpjs,
    });
  } catch (err) {
    console.error(
      "Erro ao buscar empresa:",
      err
    );

    return res
      .status(500)
      .json({
        error:
          "Erro ao buscar empresa.",
      });
  }
}

/* =========================================================
   CRIAR EMPRESA
========================================================= */

async function criarEmpresa(
  req,
  res
) {
  const client =
    await pool.connect();

  let transacaoIniciada =
    false;

  try {
    await garantirTabelaEmpresas();

    let {
      nome,
      nome_fantasia,

      cnpj,
      cnpjs,

      cor_primaria,
      cor_secundaria,
    } = req.body;

    /* =====================================================
       NOME
    ===================================================== */

    if (
      !nome ||
      !String(nome).trim()
    ) {
      return res
        .status(400)
        .json({
          error:
            "Nome da empresa é obrigatório.",
        });
    }

    /* =====================================================
       CORES
    ===================================================== */

    cor_primaria =
      cor_primaria ||
      "#0d6efd";

    cor_secundaria =
      cor_secundaria ||
      "#084298";

    if (
      !validarCorHex(
        cor_primaria
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Cor primária inválida.",
        });
    }

    if (
      !validarCorHex(
        cor_secundaria
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Cor secundária inválida.",
        });
    }

    /* =====================================================
       CNPJS
    ===================================================== */

    let listaCnpjs = [];

    if (
      Array.isArray(cnpjs)
    ) {
      listaCnpjs =
        cnpjs;
    }

    if (
      cnpj &&
      listaCnpjs.length === 0
    ) {
      listaCnpjs = [
        {
          cnpj,

          nome:
            nome_fantasia ||
            nome,

          principal:
            true,
        },
      ];
    }

    listaCnpjs =
      listaCnpjs
        .map(
          (
            item,
            index
          ) => {
            if (
              typeof item ===
              "string"
            ) {
              return {
                cnpj:
                  limparCnpj(
                    item
                  ),

                nome:
                  null,

                principal:
                  index === 0,
              };
            }

            return {
              cnpj:
                limparCnpj(
                  item?.cnpj
                ),

              nome:
                item?.nome
                  ? String(
                      item.nome
                    ).trim()
                  : null,

              principal:
                Boolean(
                  item?.principal
                ),
            };
          }
        )
        .filter(
          (item) =>
            item.cnpj
        );

    /* =====================================================
       VALIDAR CNPJS
    ===================================================== */

    for (
      const item
      of listaCnpjs
    ) {
      if (
        !validarCnpjBasico(
          item.cnpj
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              `CNPJ inválido: ${item.cnpj}`,
          });
      }
    }

    /* =====================================================
       DUPLICADOS
    ===================================================== */

    const cnpjsUnicos =
      new Set(
        listaCnpjs.map(
          (item) =>
            item.cnpj
        )
      );

    if (
      cnpjsUnicos.size !==
      listaCnpjs.length
    ) {
      return res
        .status(400)
        .json({
          error:
            "Existem CNPJs repetidos.",
        });
    }

    /* =====================================================
       PRINCIPAL
    ===================================================== */

    if (
      listaCnpjs.length > 0 &&
      !listaCnpjs.some(
        (item) =>
          item.principal
      )
    ) {
      listaCnpjs[0].principal =
        true;
    }

    let encontrouPrincipal =
      false;

    listaCnpjs =
      listaCnpjs.map(
        (item) => {
          if (
            item.principal &&
            !encontrouPrincipal
          ) {
            encontrouPrincipal =
              true;

            return item;
          }

          return {
            ...item,

            principal:
              false,
          };
        }
      );

    /* =====================================================
       TRANSAÇÃO
    ===================================================== */

    await client.query(
      "BEGIN"
    );

    transacaoIniciada =
      true;

    const cnpjPrincipal =
      listaCnpjs.find(
        (item) =>
          item.principal
      )?.cnpj ||
      listaCnpjs[0]?.cnpj ||
      null;

    /* =====================================================
       EMPRESA

       A logo e o fundo serão enviados posteriormente
       pelas rotas específicas de upload.
    ===================================================== */

    const empresaResult =
      await client.query(
        `
        INSERT INTO empresas (
          nome,
          nome_fantasia,
          cnpj,

          cor_primaria,
          cor_secundaria,

          logo_arquivo,
          fundo_arquivo,

          ativo
        )

        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          NULL,
          NULL,
          true
        )

        RETURNING
          id,
          nome,
          nome_fantasia,
          cnpj,
          cor_primaria,
          cor_secundaria,
          logo_arquivo,
          fundo_arquivo,
          ativo,
          created_at,
          updated_at
        `,
        [
          String(
            nome
          ).trim(),

          nome_fantasia
            ? String(
                nome_fantasia
              ).trim()
            : null,

          cnpjPrincipal,

          String(
            cor_primaria
          ).trim(),

          String(
            cor_secundaria
          ).trim(),
        ]
      );

    const empresa =
      empresaResult.rows[0];

    /* =====================================================
       CADASTRAR CNPJS
    ===================================================== */

    for (
      const item
      of listaCnpjs
    ) {
      await client.query(
        `
        INSERT INTO empresa_cnpjs (
          empresa_id,
          cnpj,
          nome,
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
        `,
        [
          empresa.id,

          item.cnpj,

          item.nome,

          item.principal,
        ]
      );
    }

    await client.query(
      "COMMIT"
    );

    transacaoIniciada =
      false;

    const empresaCnpjs =
      await buscarCnpjsEmpresa(
        empresa.id
      );

    return res
      .status(201)
      .json({
        ok: true,

        message:
          "Empresa cadastrada com sucesso.",

        empresa: {
          ...montarEmpresa(
            empresa
          ),

          cnpjs:
            empresaCnpjs,
        },
      });
  } catch (err) {
    if (
      transacaoIniciada
    ) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "Erro no rollback:",
          rollbackError
        );
      }
    }

    console.error(
      "Erro ao cadastrar empresa:",
      err
    );

    if (
      err.code ===
      "23505"
    ) {
      return res
        .status(409)
        .json({
          error:
            "Já existe um cadastro utilizando um desses dados.",
        });
    }

    return res
      .status(500)
      .json({
        error:
          "Erro ao cadastrar empresa.",
      });
  } finally {
    client.release();
  }
}

/* =========================================================
   ATUALIZAR EMPRESA
========================================================= */

async function atualizarEmpresa(
  req,
  res
) {
  const client =
    await pool.connect();

  try {
    await garantirTabelaEmpresas();

    const empresaId =
      Number(req.params.id);

    if (
      !Number.isInteger(
        empresaId
      ) ||
      empresaId <= 0
    ) {
      return res
        .status(400)
        .json({
          error:
            "ID da empresa inválido.",
        });
    }

    let {
      nome,
      nome_fantasia,

      cor_primaria,
      cor_secundaria,

      ativo,
    } = req.body;

    /* =====================================================
       EMPRESA ATUAL
    ===================================================== */

    const existe =
      await client.query(
        `
        SELECT
          id,
          nome,
          nome_fantasia,
          cnpj,
          cor_primaria,
          cor_secundaria,
          logo_arquivo,
          fundo_arquivo,
          ativo,
          created_at,
          updated_at

        FROM empresas

        WHERE id = $1

        LIMIT 1
        `,
        [empresaId]
      );

    if (
      existe.rows.length ===
      0
    ) {
      return res
        .status(404)
        .json({
          error:
            "Empresa não encontrada.",
        });
    }

    const atual =
      existe.rows[0];

    /* =====================================================
       VALORES
    ===================================================== */

    nome =
      nome !== undefined
        ? String(nome).trim()
        : atual.nome;

    nome_fantasia =
      nome_fantasia !==
      undefined
        ? (
            nome_fantasia
              ? String(
                  nome_fantasia
                ).trim()
              : null
          )
        : atual.nome_fantasia;

    cor_primaria =
      cor_primaria !==
      undefined
        ? String(
            cor_primaria
          ).trim()
        : atual.cor_primaria;

    cor_secundaria =
      cor_secundaria !==
      undefined
        ? String(
            cor_secundaria
          ).trim()
        : atual.cor_secundaria;

    ativo =
      ativo !== undefined
        ? Boolean(ativo)
        : atual.ativo;

    /* =====================================================
       VALIDAÇÕES
    ===================================================== */

    if (!nome) {
      return res
        .status(400)
        .json({
          error:
            "Nome da empresa é obrigatório.",
        });
    }

    if (
      !validarCorHex(
        cor_primaria
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Cor primária inválida.",
        });
    }

    if (
      !validarCorHex(
        cor_secundaria
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Cor secundária inválida.",
        });
    }

    /* =====================================================
       ATUALIZAR

       IMPORTANTE:
       esta função NÃO altera logo_arquivo nem fundo_arquivo.

       As imagens são controladas exclusivamente pelo
       empresaUpload.controller.js.
    ===================================================== */

    const { rows } =
      await client.query(
        `
        UPDATE empresas

        SET
          nome = $1,

          nome_fantasia = $2,

          cor_primaria = $3,

          cor_secundaria = $4,

          ativo = $5,

          updated_at = NOW()

        WHERE id = $6

        RETURNING
          id,
          nome,
          nome_fantasia,
          cnpj,
          cor_primaria,
          cor_secundaria,
          logo_arquivo,
          fundo_arquivo,
          ativo,
          created_at,
          updated_at
        `,
        [
          nome,

          nome_fantasia,

          cor_primaria,

          cor_secundaria,

          ativo,

          empresaId,
        ]
      );

    const empresa =
      rows[0];

    const cnpjs =
      await buscarCnpjsEmpresa(
        empresa.id
      );

    return res.json({
      ok: true,

      message:
        "Empresa atualizada com sucesso.",

      empresa: {
        ...montarEmpresa(
          empresa
        ),

        cnpjs,
      },
    });
  } catch (err) {
    console.error(
      "Erro ao atualizar empresa:",
      err
    );

    return res
      .status(500)
      .json({
        error:
          "Erro ao atualizar empresa.",
      });
  } finally {
    client.release();
  }
}

/* =========================================================
   ALTERAR STATUS
========================================================= */

async function alterarStatusEmpresa(
  req,
  res
) {
  try {
    await garantirTabelaEmpresas();

    const empresaId =
      Number(req.params.id);

    const {
      ativo,
    } = req.body;

    if (
      !Number.isInteger(
        empresaId
      ) ||
      empresaId <= 0
    ) {
      return res
        .status(400)
        .json({
          error:
            "ID da empresa inválido.",
        });
    }

    if (
      typeof ativo !==
      "boolean"
    ) {
      return res
        .status(400)
        .json({
          error:
            "Informe o status da empresa.",
        });
    }

    const { rows } =
      await pool.query(
        `
        UPDATE empresas

        SET
          ativo = $1,

          updated_at =
            NOW()

        WHERE id = $2

        RETURNING
          id,
          nome,
          nome_fantasia,
          cnpj,
          cor_primaria,
          cor_secundaria,
          logo_arquivo,
          fundo_arquivo,
          ativo,
          created_at,
          updated_at
        `,
        [
          ativo,
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
            "Empresa não encontrada.",
        });
    }

    return res.json({
      ok: true,

      message:
        ativo
          ? "Empresa ativada com sucesso."
          : "Empresa desativada com sucesso.",

      empresa:
        montarEmpresa(
          rows[0]
        ),
    });
  } catch (err) {
    console.error(
      "Erro ao alterar status da empresa:",
      err
    );

    return res
      .status(500)
      .json({
        error:
          "Erro ao alterar status da empresa.",
      });
  }
}

/* =========================================================
   ADICIONAR CNPJ
========================================================= */

async function adicionarCnpj(
  req,
  res
) {
  const client =
    await pool.connect();

  let transacaoIniciada =
    false;

  try {
    await garantirTabelaEmpresas();

    const empresaId =
      Number(req.params.id);

    let {
      cnpj,
      nome,
      principal,
    } = req.body;

    if (
      !Number.isInteger(
        empresaId
      ) ||
      empresaId <= 0
    ) {
      return res
        .status(400)
        .json({
          error:
            "ID da empresa inválido.",
        });
    }

    cnpj =
      limparCnpj(
        cnpj
      );

    if (
      !validarCnpjBasico(
        cnpj
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "CNPJ inválido.",
        });
    }

    const empresaResult =
      await client.query(
        `
        SELECT id

        FROM empresas

        WHERE id = $1

        LIMIT 1
        `,
        [empresaId]
      );

    if (
      empresaResult.rows.length ===
      0
    ) {
      return res
        .status(404)
        .json({
          error:
            "Empresa não encontrada.",
        });
    }

    await client.query(
      "BEGIN"
    );

    transacaoIniciada =
      true;

    if (principal) {
      await client.query(
        `
        UPDATE empresa_cnpjs

        SET
          principal = false,

          updated_at =
            NOW()

        WHERE empresa_id = $1
        `,
        [empresaId]
      );
    }

    const { rows } =
      await client.query(
        `
        INSERT INTO empresa_cnpjs (
          empresa_id,
          cnpj,
          nome,
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

          nome
            ? String(
                nome
              ).trim()
            : null,

          Boolean(
            principal
          ),
        ]
      );

    const quantidade =
      await client.query(
        `
        SELECT
          COUNT(*)::int
            AS total

        FROM empresa_cnpjs

        WHERE empresa_id = $1
        `,
        [empresaId]
      );

    if (
      quantidade.rows[0]
        .total === 1
    ) {
      await client.query(
        `
        UPDATE empresa_cnpjs

        SET
          principal = true,
          updated_at = NOW()

        WHERE id = $1
        `,
        [rows[0].id]
      );
    }

    await client.query(
      `
      UPDATE empresas

      SET
        cnpj = (
          SELECT cnpj

          FROM empresa_cnpjs

          WHERE
            empresa_id = $1

            AND principal = true

            AND ativo = true

          ORDER BY id ASC

          LIMIT 1
        ),

        updated_at =
          NOW()

      WHERE id = $1
      `,
      [empresaId]
    );

    await client.query(
      "COMMIT"
    );

    transacaoIniciada =
      false;

    const cnpjs =
      await buscarCnpjsEmpresa(
        empresaId
      );

    return res
      .status(201)
      .json({
        ok: true,

        message:
          "CNPJ adicionado com sucesso.",

        cnpjs,
      });
  } catch (err) {
    if (
      transacaoIniciada
    ) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "Erro no rollback:",
          rollbackError
        );
      }
    }

    console.error(
      "Erro ao adicionar CNPJ:",
      err
    );

    if (
      err.code ===
      "23505"
    ) {
      return res
        .status(409)
        .json({
          error:
            "Este CNPJ já está cadastrado para a empresa.",
        });
    }

    return res
      .status(500)
      .json({
        error:
          "Erro ao adicionar CNPJ.",
      });
  } finally {
    client.release();
  }
}

/* =========================================================
   ATUALIZAR CNPJ
========================================================= */

async function atualizarCnpj(
  req,
  res
) {
  const client =
    await pool.connect();

  let transacaoIniciada =
    false;

  try {
    await garantirTabelaEmpresas();

    const empresaId =
      Number(req.params.id);

    const cnpjId =
      Number(req.params.cnpjId);

    if (
      !Number.isInteger(
        empresaId
      ) ||
      empresaId <= 0 ||
      !Number.isInteger(
        cnpjId
      ) ||
      cnpjId <= 0
    ) {
      return res
        .status(400)
        .json({
          error:
            "Empresa ou CNPJ inválido.",
        });
    }

    let {
      cnpj,
      nome,
      principal,
      ativo,
    } = req.body;

    const atualResult =
      await client.query(
        `
        SELECT *

        FROM empresa_cnpjs

        WHERE
          id = $1

          AND empresa_id = $2

        LIMIT 1
        `,
        [
          cnpjId,
          empresaId,
        ]
      );

    if (
      atualResult.rows.length ===
      0
    ) {
      return res
        .status(404)
        .json({
          error:
            "CNPJ não encontrado.",
        });
    }

    const atual =
      atualResult.rows[0];

    cnpj =
      cnpj !== undefined
        ? limparCnpj(
            cnpj
          )
        : atual.cnpj;

    nome =
      nome !== undefined
        ? (
            nome
              ? String(
                  nome
                ).trim()
              : null
          )
        : atual.nome;

    principal =
      principal !== undefined
        ? Boolean(
            principal
          )
        : atual.principal;

    ativo =
      ativo !== undefined
        ? Boolean(
            ativo
          )
        : atual.ativo;

    if (
      !validarCnpjBasico(
        cnpj
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "CNPJ inválido.",
        });
    }

    await client.query(
      "BEGIN"
    );

    transacaoIniciada =
      true;

    if (
      principal &&
      ativo
    ) {
      await client.query(
        `
        UPDATE empresa_cnpjs

        SET
          principal = false,

          updated_at =
            NOW()

        WHERE empresa_id = $1
        `,
        [empresaId]
      );
    }

    await client.query(
      `
      UPDATE empresa_cnpjs

      SET
        cnpj = $1,

        nome = $2,

        principal = $3,

        ativo = $4,

        updated_at =
          NOW()

      WHERE
        id = $5

        AND empresa_id = $6
      `,
      [
        cnpj,

        nome,

        principal &&
          ativo,

        ativo,

        cnpjId,

        empresaId,
      ]
    );

    /* =====================================================
       GARANTIR PRINCIPAL
    ===================================================== */

    const principalResult =
      await client.query(
        `
        SELECT id

        FROM empresa_cnpjs

        WHERE
          empresa_id = $1

          AND principal = true

          AND ativo = true

        LIMIT 1
        `,
        [empresaId]
      );

    if (
      principalResult.rows.length ===
      0
    ) {
      await client.query(
        `
        UPDATE empresa_cnpjs

        SET
          principal = true,

          updated_at =
            NOW()

        WHERE id = (
          SELECT id

          FROM empresa_cnpjs

          WHERE
            empresa_id = $1

            AND ativo = true

          ORDER BY id ASC

          LIMIT 1
        )
        `,
        [empresaId]
      );
    }

    /* =====================================================
       SINCRONIZAR EMPRESA
    ===================================================== */

    await client.query(
      `
      UPDATE empresas

      SET
        cnpj = (
          SELECT cnpj

          FROM empresa_cnpjs

          WHERE
            empresa_id = $1

            AND principal = true

            AND ativo = true

          ORDER BY id ASC

          LIMIT 1
        ),

        updated_at =
          NOW()

      WHERE id = $1
      `,
      [empresaId]
    );

    await client.query(
      "COMMIT"
    );

    transacaoIniciada =
      false;

    const cnpjs =
      await buscarCnpjsEmpresa(
        empresaId
      );

    return res.json({
      ok: true,

      message:
        "CNPJ atualizado com sucesso.",

      cnpjs,
    });
  } catch (err) {
    if (
      transacaoIniciada
    ) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "Erro no rollback:",
          rollbackError
        );
      }
    }

    console.error(
      "Erro ao atualizar CNPJ:",
      err
    );

    if (
      err.code ===
      "23505"
    ) {
      return res
        .status(409)
        .json({
          error:
            "Este CNPJ já está cadastrado.",
        });
    }

    return res
      .status(500)
      .json({
        error:
          "Erro ao atualizar CNPJ.",
      });
  } finally {
    client.release();
  }
}

/* =========================================================
   REMOVER CNPJ
========================================================= */

async function removerCnpj(
  req,
  res
) {
  const client =
    await pool.connect();

  let transacaoIniciada =
    false;

  try {
    await garantirTabelaEmpresas();

    const empresaId =
      Number(req.params.id);

    const cnpjId =
      Number(req.params.cnpjId);

    if (
      !Number.isInteger(
        empresaId
      ) ||
      empresaId <= 0 ||
      !Number.isInteger(
        cnpjId
      ) ||
      cnpjId <= 0
    ) {
      return res
        .status(400)
        .json({
          error:
            "Empresa ou CNPJ inválido.",
        });
    }

    const cnpjResult =
      await client.query(
        `
        SELECT *

        FROM empresa_cnpjs

        WHERE
          id = $1

          AND empresa_id = $2

        LIMIT 1
        `,
        [
          cnpjId,
          empresaId,
        ]
      );

    if (
      cnpjResult.rows.length ===
      0
    ) {
      return res
        .status(404)
        .json({
          error:
            "CNPJ não encontrado.",
        });
    }

    await client.query(
      "BEGIN"
    );

    transacaoIniciada =
      true;

    await client.query(
      `
      DELETE FROM empresa_cnpjs

      WHERE
        id = $1

        AND empresa_id = $2
      `,
      [
        cnpjId,
        empresaId,
      ]
    );

    /* =====================================================
       GARANTIR PRINCIPAL
    ===================================================== */

    const principalResult =
      await client.query(
        `
        SELECT id

        FROM empresa_cnpjs

        WHERE
          empresa_id = $1

          AND principal = true

          AND ativo = true

        LIMIT 1
        `,
        [empresaId]
      );

    if (
      principalResult.rows.length ===
      0
    ) {
      await client.query(
        `
        UPDATE empresa_cnpjs

        SET
          principal = true,

          updated_at =
            NOW()

        WHERE id = (
          SELECT id

          FROM empresa_cnpjs

          WHERE
            empresa_id = $1

            AND ativo = true

          ORDER BY id ASC

          LIMIT 1
        )
        `,
        [empresaId]
      );
    }

    /* =====================================================
       SINCRONIZAR EMPRESA
    ===================================================== */

    await client.query(
      `
      UPDATE empresas

      SET
        cnpj = (
          SELECT cnpj

          FROM empresa_cnpjs

          WHERE
            empresa_id = $1

            AND principal = true

            AND ativo = true

          ORDER BY id ASC

          LIMIT 1
        ),

        updated_at =
          NOW()

      WHERE id = $1
      `,
      [empresaId]
    );

    await client.query(
      "COMMIT"
    );

    transacaoIniciada =
      false;

    const cnpjs =
      await buscarCnpjsEmpresa(
        empresaId
      );

    return res.json({
      ok: true,

      message:
        "CNPJ removido com sucesso.",

      cnpjs,
    });
  } catch (err) {
    if (
      transacaoIniciada
    ) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "Erro no rollback:",
          rollbackError
        );
      }
    }

    console.error(
      "Erro ao remover CNPJ:",
      err
    );

    return res
      .status(500)
      .json({
        error:
          "Erro ao remover CNPJ.",
      });
  } finally {
    client.release();
  }
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  garantirTabelaEmpresas,

  listarEmpresas,

  buscarEmpresaPorId,

  criarEmpresa,

  atualizarEmpresa,

  alterarStatusEmpresa,

  adicionarCnpj,

  atualizarCnpj,

  removerCnpj,
};