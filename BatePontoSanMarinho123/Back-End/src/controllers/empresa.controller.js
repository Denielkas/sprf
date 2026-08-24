const pool = require("../database/pool");

/* =========================================================
   GARANTIR ESTRUTURA DAS EMPRESAS
========================================================= */

async function garantirTabelaEmpresas() {
  /* -------------------------------------------------------
     TABELA PRINCIPAL
  ------------------------------------------------------- */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS empresas (
      id BIGSERIAL PRIMARY KEY,

      nome VARCHAR(200) NOT NULL,

      nome_fantasia VARCHAR(200),

      cnpj VARCHAR(14),

      cor_primaria VARCHAR(20)
        NOT NULL DEFAULT '#0d6efd',

      cor_secundaria VARCHAR(20)
        NOT NULL DEFAULT '#1a1a1a',

      logo_url TEXT,

      fundo_url TEXT,

      ativo BOOLEAN
        NOT NULL DEFAULT true,

      created_at TIMESTAMP
        DEFAULT NOW(),

      updated_at TIMESTAMP
        DEFAULT NOW()
    );
  `);

  /*
    Compatibilidade com banco já existente.
  */

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS cor_primaria VARCHAR(20)
    NOT NULL DEFAULT '#0d6efd';
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS cor_secundaria VARCHAR(20)
    NOT NULL DEFAULT '#1a1a1a';
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS logo_url TEXT;
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS fundo_url TEXT;
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS ativo BOOLEAN
    NOT NULL DEFAULT true;
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
    DEFAULT NOW();
  `);

  /* -------------------------------------------------------
     TABELA DE CNPJS

     Uma empresa poderá possuir vários CNPJs.
  ------------------------------------------------------- */

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

  /*
    MIGRAÇÃO DO CNPJ ANTIGO.

    Se a empresa já tinha CNPJ diretamente
    na tabela empresas, colocamos também
    em empresa_cnpjs.

    Assim não perdemos os dados existentes.
  */

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
        e.nome_fantasia,
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
   BUSCAR CNPJS DE UMA EMPRESA
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
   SOMENTE SUPER ADMIN PELA ROTA
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
          e.id,
          e.nome,
          e.nome_fantasia,
          e.cnpj,

          e.cor_primaria,
          e.cor_secundaria,

          e.logo_url,
          e.fundo_url,

          e.ativo,

          e.created_at,
          e.updated_at

        FROM empresas e

        ORDER BY
          e.nome ASC
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
              ...empresa,

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

    return res.status(500).json({
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

    const {
      id,
    } = req.params;

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

          logo_url,
          fundo_url,

          ativo,

          created_at,
          updated_at

        FROM empresas

        WHERE id = $1

        LIMIT 1
        `,
        [id]
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
      ...empresa,

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

  try {
    await garantirTabelaEmpresas();

    let {
      nome,
      nome_fantasia,

      cnpj,

      cnpjs,

      cor_primaria,
      cor_secundaria,

      logo_url,
      fundo_url,
    } = req.body;

    /* -----------------------------------------------------
       NOME
    ----------------------------------------------------- */

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

    /* -----------------------------------------------------
       CORES
    ----------------------------------------------------- */

    cor_primaria =
      cor_primaria ||
      "#0d6efd";

    cor_secundaria =
      cor_secundaria ||
      "#1a1a1a";

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

    /* -----------------------------------------------------
       COMPATIBILIDADE

       Aceita:
       cnpj: "..."

       ou:

       cnpjs: [...]
    ----------------------------------------------------- */

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

    /* -----------------------------------------------------
       NORMALIZAR CNPJS
    ----------------------------------------------------- */

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

    /* -----------------------------------------------------
       VALIDAR CNPJS
    ----------------------------------------------------- */

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

    /* -----------------------------------------------------
       EVITAR DUPLICADOS NA MESMA REQUISIÇÃO
    ----------------------------------------------------- */

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

    /*
      Se nenhum foi marcado como principal,
      o primeiro será principal.
    */

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

    /*
      Apenas um principal.
    */

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

    await client.query(
      "BEGIN"
    );

    /* -----------------------------------------------------
       CRIAR EMPRESA
    ----------------------------------------------------- */

    const cnpjPrincipal =
      listaCnpjs.find(
        (item) =>
          item.principal
      )?.cnpj ||
      listaCnpjs[0]?.cnpj ||
      null;

    const empresaResult =
      await client.query(
        `
        INSERT INTO empresas (
          nome,
          nome_fantasia,
          cnpj,

          cor_primaria,
          cor_secundaria,

          logo_url,
          fundo_url,

          ativo
        )

        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          true
        )

        RETURNING *
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

          logo_url ||
            null,

          fundo_url ||
            null,
        ]
      );

    const empresa =
      empresaResult.rows[0];

    /* -----------------------------------------------------
       CRIAR CNPJS
    ----------------------------------------------------- */

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
          ...empresa,

          cnpjs:
            empresaCnpjs,
        },
      });
  } catch (err) {
    await client.query(
      "ROLLBACK"
    );

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

    const {
      id,
    } = req.params;

    let {
      nome,
      nome_fantasia,

      cor_primaria,
      cor_secundaria,

      logo_url,
      fundo_url,

      ativo,
    } = req.body;

    /* -----------------------------------------------------
       VERIFICAR EMPRESA
    ----------------------------------------------------- */

    const existe =
      await client.query(
        `
        SELECT *

        FROM empresas

        WHERE id = $1

        LIMIT 1
        `,
        [id]
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
        ? cor_primaria
        : atual.cor_primaria;

    cor_secundaria =
      cor_secundaria !==
      undefined
        ? cor_secundaria
        : atual.cor_secundaria;

    logo_url =
      logo_url !== undefined
        ? logo_url
        : atual.logo_url;

    fundo_url =
      fundo_url !== undefined
        ? fundo_url
        : atual.fundo_url;

    ativo =
      ativo !== undefined
        ? Boolean(ativo)
        : atual.ativo;

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

    const { rows } =
      await client.query(
        `
        UPDATE empresas

        SET
          nome = $1,

          nome_fantasia = $2,

          cor_primaria = $3,

          cor_secundaria = $4,

          logo_url = $5,

          fundo_url = $6,

          ativo = $7,

          updated_at = NOW()

        WHERE id = $8

        RETURNING *
        `,
        [
          nome,

          nome_fantasia,

          cor_primaria,

          cor_secundaria,

          logo_url,

          fundo_url,

          ativo,

          id,
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
        ...empresa,

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

    const {
      id,
    } = req.params;

    const {
      ativo,
    } = req.body;

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

        RETURNING *
        `,
        [
          ativo,
          id,
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
        rows[0],
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
   ADICIONAR CNPJ À EMPRESA
========================================================= */

async function adicionarCnpj(
  req,
  res
) {
  const client =
    await pool.connect();

  try {
    await garantirTabelaEmpresas();

    const {
      id,
    } = req.params;

    let {
      cnpj,
      nome,
      principal,
    } = req.body;

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
        [id]
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

    /*
      Se o novo CNPJ será principal,
      removemos o principal anterior.
    */

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
        [id]
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
          id,

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

    /*
      Caso seja o primeiro CNPJ,
      tornamos principal.
    */

    const quantidade =
      await client.query(
        `
        SELECT
          COUNT(*)::int
            AS total

        FROM empresa_cnpjs

        WHERE empresa_id = $1
        `,
        [id]
      );

    if (
      quantidade.rows[0]
        .total === 1
    ) {
      await client.query(
        `
        UPDATE empresa_cnpjs

        SET principal = true

        WHERE id = $1
        `,
        [rows[0].id]
      );
    }

    /*
      Atualiza o campo antigo empresas.cnpj
      para manter compatibilidade.
    */

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

          LIMIT 1
        ),

        updated_at =
          NOW()

      WHERE id = $1
      `,
      [id]
    );

    await client.query(
      "COMMIT"
    );

    const cnpjs =
      await buscarCnpjsEmpresa(
        id
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
    await client.query(
      "ROLLBACK"
    );

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
   ALTERAR CNPJ
========================================================= */

async function atualizarCnpj(
  req,
  res
) {
  const client =
    await pool.connect();

  try {
    await garantirTabelaEmpresas();

    const {
      id,
      cnpjId,
    } = req.params;

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
          id,
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
        ? limparCnpj(cnpj)
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
        [id]
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
        principal,
        ativo,
        cnpjId,
        id,
      ]
    );

    /*
      Garante pelo menos um principal.
    */

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
        [id]
      );

    if (
      principalResult.rows.length ===
      0
    ) {
      await client.query(
        `
        UPDATE empresa_cnpjs

        SET principal = true

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
        [id]
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

          LIMIT 1
        ),

        updated_at =
          NOW()

      WHERE id = $1
      `,
      [id]
    );

    await client.query(
      "COMMIT"
    );

    const cnpjs =
      await buscarCnpjsEmpresa(
        id
      );

    return res.json({
      ok: true,

      message:
        "CNPJ atualizado com sucesso.",

      cnpjs,
    });
  } catch (err) {
    await client.query(
      "ROLLBACK"
    );

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

  try {
    await garantirTabelaEmpresas();

    const {
      id,
      cnpjId,
    } = req.params;

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
          id,
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

    await client.query(
      `
      DELETE FROM empresa_cnpjs

      WHERE
        id = $1

        AND empresa_id = $2
      `,
      [
        cnpjId,
        id,
      ]
    );

    /*
      Verifica se ainda existe principal.
    */

    const principalResult =
      await client.query(
        `
        SELECT id

        FROM empresa_cnpjs

        WHERE
          empresa_id = $1

          AND principal = true

        LIMIT 1
        `,
        [id]
      );

    if (
      principalResult.rows.length ===
      0
    ) {
      await client.query(
        `
        UPDATE empresa_cnpjs

        SET principal = true

        WHERE id = (
          SELECT id

          FROM empresa_cnpjs

          WHERE empresa_id = $1

          ORDER BY id ASC

          LIMIT 1
        )
        `,
        [id]
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

          LIMIT 1
        ),

        updated_at =
          NOW()

      WHERE id = $1
      `,
      [id]
    );

    await client.query(
      "COMMIT"
    );

    const cnpjs =
      await buscarCnpjsEmpresa(
        id
      );

    return res.json({
      ok: true,

      message:
        "CNPJ removido com sucesso.",

      cnpjs,
    });
  } catch (err) {
    await client.query(
      "ROLLBACK"
    );

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