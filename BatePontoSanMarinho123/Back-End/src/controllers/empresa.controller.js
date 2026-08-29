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

      nome_exibicao VARCHAR(200),

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
     COMPATIBILIDADE EMPRESA_CNPJS
  ======================================================= */

  await pool.query(`
    ALTER TABLE empresa_cnpjs
    ADD COLUMN IF NOT EXISTS nome_exibicao VARCHAR(200);
  `);


  await pool.query(`
    DO $$
    BEGIN

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'empresa_cnpjs'
          AND column_name = 'nome'
      ) THEN

        UPDATE empresa_cnpjs
        SET nome_exibicao = nome

        WHERE
          (
            nome_exibicao IS NULL
            OR TRIM(nome_exibicao) = ''
          )

          AND nome IS NOT NULL

          AND TRIM(nome) <> '';

      END IF;

    END $$;
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
      nome_exibicao,
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

            AND principal.principal = true

            AND principal.ativo = true
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
        nome_exibicao,

        nome_exibicao AS nome,

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
      [
        empresaId,
      ]
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
          async (
            empresa
          ) => {

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
      Number(
        req.params.id
      );


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
        [
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
    } =
      req.body;


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
      Array.isArray(
        cnpjs
      )
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

          nome_exibicao:
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

                nome_exibicao:
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

              nome_exibicao:
                item?.nome_exibicao
                  ? String(
                      item.nome_exibicao
                    ).trim()
                  : item?.nome
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
          (
            item
          ) =>
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
          (
            item
          ) =>
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
        (
          item
        ) =>
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
        (
          item
        ) => {

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
        (
          item
        ) =>
          item.principal
      )?.cnpj ||
      listaCnpjs[0]?.cnpj ||
      null;


    /* =====================================================
       EMPRESA
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
        `,
        [
          empresa.id,

          item.cnpj,

          item.nome_exibicao,

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
      Number(
        req.params.id
      );


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
    } =
      req.body;


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
        [
          empresaId,
        ]
      );


    if (
      existe.rows.length === 0
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
        ? String(
            nome
          ).trim()
        : atual.nome;


    nome_fantasia =
      nome_fantasia !== undefined
        ? (
            nome_fantasia
              ? String(
                  nome_fantasia
                ).trim()
              : null
          )
        : atual.nome_fantasia;


    cor_primaria =
      cor_primaria !== undefined
        ? String(
            cor_primaria
          ).trim()
        : atual.cor_primaria;


    cor_secundaria =
      cor_secundaria !== undefined
        ? String(
            cor_secundaria
          ).trim()
        : atual.cor_secundaria;


    ativo =
      ativo !== undefined
        ? Boolean(
            ativo
          )
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
      Number(
        req.params.id
      );


    const {
      ativo,
    } =
      req.body;


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

          updated_at = NOW()

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
   AUXILIARES PARA EXCLUSÃO COMPLETA DA EMPRESA
========================================================= */

function protegerIdentificadorSql(nome) {
  return `"${String(nome).replace(/"/g, '""')}"`;
}


/*
  Exclui recursivamente registros vinculados através
  das FOREIGN KEYS existentes no PostgreSQL.

  Exemplo:

  empresas
    -> funcionarios
       -> face_embeddings
    -> pontos
    -> atestados
    -> faltas_ajustes
    -> empresa_cnpjs
*/
async function excluirDependenciasRecursivamente(
  client,
  tabelaPai,
  condicaoPaiSql,
  parametros,
  caminho = []
) {

  /* =======================================================
     EVITAR LOOP DE RELACIONAMENTOS
  ======================================================= */

  if (caminho.includes(tabelaPai)) {
    return;
  }


  const novoCaminho = [
    ...caminho,
    tabelaPai,
  ];


  /* =======================================================
     DESCOBRIR FOREIGN KEYS QUE APONTAM PARA A TABELA
  ======================================================= */

  const fksResult =
    await client.query(
      `
      SELECT
        tc.constraint_name,

        kcu.table_schema AS child_schema,
        kcu.table_name AS child_table,
        kcu.column_name AS child_column,

        ccu.table_schema AS parent_schema,
        ccu.table_name AS parent_table,
        ccu.column_name AS parent_column

      FROM information_schema.table_constraints tc

      INNER JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.constraint_schema = kcu.constraint_schema

      INNER JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.constraint_schema = tc.constraint_schema

      WHERE
        tc.constraint_type = 'FOREIGN KEY'

        AND ccu.table_schema = 'public'

        AND ccu.table_name = $1

      ORDER BY
        kcu.table_name ASC,
        tc.constraint_name ASC
      `,
      [
        tabelaPai,
      ]
    );


  /* =======================================================
     PERCORRER AS TABELAS FILHAS
  ======================================================= */

  for (
    const fk
    of fksResult.rows
  ) {

    const tabelaFilha =
      fk.child_table;


    const colunaFilha =
      fk.child_column;


    const colunaPai =
      fk.parent_column;


    /* =====================================================
       EVITAR AUTO-RELACIONAMENTO
    ===================================================== */

    if (
      tabelaFilha ===
      tabelaPai
    ) {

      continue;
    }


    const tabelaPaiSql =
      protegerIdentificadorSql(
        tabelaPai
      );


    const tabelaFilhaSql =
      protegerIdentificadorSql(
        tabelaFilha
      );


    const colunaPaiSql =
      protegerIdentificadorSql(
        colunaPai
      );


    const colunaFilhaSql =
      protegerIdentificadorSql(
        colunaFilha
      );


    /* =====================================================
       LOCALIZAR REGISTROS FILHOS

       Exemplo:

       funcionario_id IN (
         SELECT id
         FROM funcionarios
         WHERE empresa_id = $1
       )
    ===================================================== */

    const condicaoFilhaSql = `
      ${colunaFilhaSql} IN (

        SELECT
          ${colunaPaiSql}

        FROM
          ${tabelaPaiSql}

        WHERE
          ${condicaoPaiSql}
      )
    `;


    /* =====================================================
       PRIMEIRO EXCLUI DEPENDÊNCIAS DA TABELA FILHA

       Exemplo:

       empresas
          ↓
       funcionarios
          ↓
       face_embeddings

       Primeiro:
       face_embeddings

       Depois:
       funcionarios
    ===================================================== */

    await excluirDependenciasRecursivamente(
      client,
      tabelaFilha,
      condicaoFilhaSql,
      parametros,
      novoCaminho
    );


    /* =====================================================
       EXCLUIR REGISTROS DA TABELA FILHA
    ===================================================== */

    const deleteResult =
      await client.query(
        `
        DELETE FROM ${tabelaFilhaSql}

        WHERE
          ${condicaoFilhaSql}
        `,
        parametros
      );


    /* =====================================================
       LOG
    ===================================================== */

    if (
      deleteResult.rowCount > 0
    ) {

      console.log(
        `[EXCLUIR EMPRESA] ${tabelaFilha}: ${deleteResult.rowCount} registro(s) removido(s).`
      );
    }
  }
}


/* =========================================================
   EXCLUIR EMPRESA
========================================================= */

async function excluirEmpresa(
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
      Number(
        req.params.id
      );


    /* =====================================================
       VALIDAR ID
    ===================================================== */

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


    /* =====================================================
       INICIAR TRANSAÇÃO
    ===================================================== */

    await client.query(
      "BEGIN"
    );


    transacaoIniciada =
      true;


    /* =====================================================
       BUSCAR EMPRESA

       FOR UPDATE impede alteração da empresa enquanto
       estamos realizando a exclusão.
    ===================================================== */

    const empresaResult =
      await client.query(
        `
        SELECT
          id,
          nome,
          nome_fantasia,
          logo_arquivo,
          fundo_arquivo,
          ativo

        FROM empresas

        WHERE id = $1

        LIMIT 1

        FOR UPDATE
        `,
        [
          empresaId,
        ]
      );


    /* =====================================================
       EMPRESA NÃO ENCONTRADA
    ===================================================== */

    if (
      empresaResult.rows.length === 0
    ) {

      await client.query(
        "ROLLBACK"
      );


      transacaoIniciada =
        false;


      return res
        .status(404)
        .json({
          error:
            "Empresa não encontrada.",
        });
    }


    const empresa =
      empresaResult.rows[0];


    /* =====================================================
       NÃO EXCLUIR EMPRESA ATIVA

       REGRA:

       ATIVA
       ❌ NÃO EXCLUI

       INATIVA
       ✅ EXCLUI EMPRESA + DADOS
    ===================================================== */

    if (
      empresa.ativo === true
    ) {

      await client.query(
        "ROLLBACK"
      );


      transacaoIniciada =
        false;


      return res
        .status(409)
        .json({

          error:
            "A empresa está ativa. Desative a empresa antes de excluí-la.",
        });
    }


    /* =====================================================
       EMPRESA INATIVA

       AGORA PODE EXCLUIR OS DADOS
    ===================================================== */

    console.log(
      "=================================================="
    );

    console.log(
      `[EXCLUIR EMPRESA] ID: ${empresaId}`
    );

    console.log(
      `[EXCLUIR EMPRESA] Nome: ${empresa.nome_fantasia || empresa.nome}`
    );

    console.log(
      "[EXCLUIR EMPRESA] Empresa está INATIVA."
    );

    console.log(
      "[EXCLUIR EMPRESA] Excluindo dados vinculados..."
    );


    /* =====================================================
       EXCLUIR DEPENDÊNCIAS

       A função consulta automaticamente as FOREIGN KEYS.

       Portanto pode localizar relações como:

       empresas
          ↓
       empresa_cnpjs

       empresas
          ↓
       funcionarios
          ↓
       face_embeddings

       empresas
          ↓
       pontos

       empresas
          ↓
       faltas_ajustes

       empresas
          ↓
       atestados

       empresas
          ↓
       banco_horas

       etc.
    ===================================================== */

    await excluirDependenciasRecursivamente(
      client,

      "empresas",

      `"id" = $1`,

      [
        empresaId,
      ]
    );


    /* =====================================================
       AGORA EXCLUIR A EMPRESA

       Mesmo depois da verificação anterior,
       usamos "ativo = false" novamente por segurança.
    ===================================================== */

    const deleteEmpresa =
      await client.query(
        `
        DELETE FROM empresas

        WHERE
          id = $1

          AND ativo = false
        `,
        [
          empresaId,
        ]
      );


    /* =====================================================
       VERIFICAR SE REALMENTE EXCLUIU
    ===================================================== */

    if (
      deleteEmpresa.rowCount !== 1
    ) {

      throw new Error(
        "A empresa não pôde ser excluída."
      );
    }


    /* =====================================================
       CONFIRMAR TODAS AS EXCLUSÕES
    ===================================================== */

    await client.query(
      "COMMIT"
    );


    transacaoIniciada =
      false;


    console.log(
      `[EXCLUIR EMPRESA] Empresa ${empresaId} excluída com sucesso.`
    );

    console.log(
      "=================================================="
    );


    /* =====================================================
       RESPOSTA
    ===================================================== */

    return res.json({

      ok: true,

      message:
        `Empresa "${empresa.nome_fantasia || empresa.nome}" e todos os dados vinculados foram excluídos com sucesso.`,

      empresa_id:
        empresaId,
    });

  } catch (err) {

    /* =====================================================
       SE DER ERRO, DESFAZER TUDO

       Assim não acontece de:
       - excluir alguns pontos;
       - excluir alguns funcionários;
       - dar erro;
       - deixar o banco pela metade.
    ===================================================== */

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
          "Erro no rollback da exclusão da empresa:",
          rollbackError
        );
      }
    }


    console.error(
      "Erro ao excluir empresa:",
      err
    );


    /* =====================================================
       ALGUMA FOREIGN KEY AINDA BLOQUEOU
    ===================================================== */

    if (
      err.code ===
      "23503"
    ) {

      return res
        .status(409)
        .json({

          error:
            "A empresa está inativa, mas ainda existe um relacionamento no banco que impediu a exclusão completa. Nenhum dado foi apagado.",
        });
    }


    /* =====================================================
       OUTRO ERRO
    ===================================================== */

    return res
      .status(500)
      .json({

        error:
          "Erro ao excluir a empresa e seus dados vinculados. Nenhum dado foi apagado.",
      });

  } finally {

    client.release();
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
      Number(
        req.params.id
      );


    let {
      cnpj,
      nome,
      nome_exibicao,
      principal,
    } =
      req.body;


    nome_exibicao =
      String(
        nome_exibicao ||
        nome ||
        ""
      ).trim() ||
      null;


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
        [
          empresaId,
        ]
      );


    if (
      empresaResult.rows.length === 0
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


    if (
      principal
    ) {

      await client.query(
        `
        UPDATE empresa_cnpjs

        SET
          principal = false,

          updated_at = NOW()

        WHERE empresa_id = $1
        `,
        [
          empresaId,
        ]
      );
    }


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

          Boolean(
            principal
          ),
        ]
      );


    const quantidade =
      await client.query(
        `
        SELECT
          COUNT(*)::int AS total

        FROM empresa_cnpjs

        WHERE empresa_id = $1
        `,
        [
          empresaId,
        ]
      );


    if (
      quantidade.rows[0].total === 1
    ) {

      await client.query(
        `
        UPDATE empresa_cnpjs

        SET
          principal = true,

          updated_at = NOW()

        WHERE id = $1
        `,
        [
          rows[0].id,
        ]
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

        updated_at = NOW()

      WHERE id = $1
      `,
      [
        empresaId,
      ]
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
      Number(
        req.params.id
      );


    const cnpjId =
      Number(
        req.params.cnpjId
      );


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
      nome_exibicao,
      principal,
      ativo,
    } =
      req.body;


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
      atualResult.rows.length === 0
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


    nome_exibicao =
      nome_exibicao !== undefined
        ? (
            nome_exibicao
              ? String(
                  nome_exibicao
                ).trim()
              : null
          )
        : nome !== undefined
          ? (
              nome
                ? String(
                    nome
                  ).trim()
                : null
            )
          : atual.nome_exibicao ||
            atual.nome ||
            null;


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

          updated_at = NOW()

        WHERE empresa_id = $1
        `,
        [
          empresaId,
        ]
      );
    }


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
      `,
      [
        cnpj,

        nome_exibicao,

        principal && ativo,

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
        [
          empresaId,
        ]
      );


    if (
      principalResult.rows.length === 0
    ) {

      await client.query(
        `
        UPDATE empresa_cnpjs

        SET
          principal = true,

          updated_at = NOW()

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
        [
          empresaId,
        ]
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

        updated_at = NOW()

      WHERE id = $1
      `,
      [
        empresaId,
      ]
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
      Number(
        req.params.id
      );


    const cnpjId =
      Number(
        req.params.cnpjId
      );


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
      cnpjResult.rows.length === 0
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
        [
          empresaId,
        ]
      );


    if (
      principalResult.rows.length === 0
    ) {

      await client.query(
        `
        UPDATE empresa_cnpjs

        SET
          principal = true,

          updated_at = NOW()

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
        [
          empresaId,
        ]
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

        updated_at = NOW()

      WHERE id = $1
      `,
      [
        empresaId,
      ]
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

  excluirEmpresa,

  adicionarCnpj,

  atualizarCnpj,

  removerCnpj,
};