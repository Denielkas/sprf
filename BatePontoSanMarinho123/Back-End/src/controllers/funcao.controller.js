const pool = require("../database/pool");


/* =========================================================
   OBTER EMPRESA DA REQUISIÇÃO
========================================================= */

function obterEmpresaIdDaRequisicao(req) {
  /*
    ADMIN_EMPRESA:
    a empresa sempre vem do token.
  */
  if (req.user?.role === "admin_empresa") {
    const empresaId = Number(
      req.user.empresa_id
    );

    if (
      Number.isInteger(empresaId) &&
      empresaId > 0
    ) {
      return empresaId;
    }

    return null;
  }


  /*
    SUPER_ADMIN:
    pode escolher a empresa.

    GET:
    ?empresa_id=1

    POST/PUT:
    {
      "empresa_id": 1
    }
  */
  if (req.user?.role === "super_admin") {
    const empresaId = Number(
      req.query?.empresa_id ||
      req.body?.empresa_id
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
   GARANTE TABELA FUNÇÕES
   MULTIEMPRESA
========================================================= */

async function garantirTabelaFuncoes() {
  /*
    Cria a tabela caso ainda não exista.

    IMPORTANTE:
    não colocamos mais UNIQUE diretamente em nome.
  */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS funcoes (
      id BIGSERIAL PRIMARY KEY,

      empresa_id BIGINT
        REFERENCES empresas(id)
        ON DELETE RESTRICT,

      nome VARCHAR(150) NOT NULL,

      created_at TIMESTAMP
        DEFAULT NOW(),

      updated_at TIMESTAMP
        DEFAULT NOW()
    );
  `);


  /* =====================================================
     ADICIONAR empresa_id EM TABELA ANTIGA
  ===================================================== */

  await pool.query(`
    ALTER TABLE funcoes
    ADD COLUMN IF NOT EXISTS empresa_id
    BIGINT REFERENCES empresas(id)
    ON DELETE RESTRICT
  `);


  /* =====================================================
     ADICIONAR updated_at
  ===================================================== */

  await pool.query(`
    ALTER TABLE funcoes
    ADD COLUMN IF NOT EXISTS updated_at
    TIMESTAMP DEFAULT NOW()
  `);


  /* =====================================================
     REMOVER UNIQUE ANTIGO DO CAMPO nome

     Antes tínhamos:

     nome VARCHAR(150) UNIQUE

     Isso impediria:

     Empresa 1 -> Gerente
     Empresa 2 -> Gerente

     Agora cada empresa poderá ter seus próprios cargos.
  ===================================================== */

  await pool.query(`
    DO $$
    DECLARE
      constraint_record RECORD;
    BEGIN

      FOR constraint_record IN
        SELECT
          tc.constraint_name

        FROM information_schema.table_constraints tc

        INNER JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
         AND tc.constraint_schema = ccu.constraint_schema

        WHERE tc.table_name = 'funcoes'
          AND tc.constraint_type = 'UNIQUE'
          AND ccu.column_name = 'nome'

      LOOP

        EXECUTE format(
          'ALTER TABLE funcoes DROP CONSTRAINT IF EXISTS %I',
          constraint_record.constraint_name
        );

      END LOOP;

    END $$;
  `);


  /* =====================================================
     MIGRAR FUNÇÕES ANTIGAS

     Descobre a empresa através dos funcionários
     que já utilizam aquela função.

     Isso preserva os cargos existentes.
  ===================================================== */

  const migracao = await pool.query(`
    UPDATE funcoes fn

    SET empresa_id = origem.empresa_id

    FROM (
      SELECT
        funcao_id,
        MIN(empresa_id) AS empresa_id

      FROM funcionarios

      WHERE funcao_id IS NOT NULL
        AND empresa_id IS NOT NULL

      GROUP BY funcao_id
    ) origem

    WHERE fn.id = origem.funcao_id
      AND fn.empresa_id IS NULL
  `);


  if (migracao.rowCount > 0) {
    console.log(
      `✅ ${migracao.rowCount} função(ões) antiga(s) vinculada(s) às empresas.`
    );
  }


  /* =====================================================
     ÍNDICE
  ===================================================== */

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_funcoes_empresa_id

    ON funcoes(empresa_id)
  `);


  /* =====================================================
     UNIQUE MULTIEMPRESA

     Uma mesma empresa não poderá cadastrar
     o mesmo nome duas vezes.

     Mas empresas diferentes poderão ter:

     Empresa 1 -> Gerente
     Empresa 2 -> Gerente
  ===================================================== */

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    idx_funcoes_empresa_nome_unique

    ON funcoes(
      empresa_id,
      LOWER(nome)
    )

    WHERE empresa_id IS NOT NULL
  `);
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
   VALIDAR EMPRESA
========================================================= */

async function validarEmpresaDaRequisicao(
  req,
  res
) {
  const empresaId =
    obterEmpresaIdDaRequisicao(req);


  if (!empresaId) {
    res.status(400).json({
      error: "Empresa não informada.",
    });

    return null;
  }


  const empresa =
    await buscarEmpresa(empresaId);


  if (!empresa) {
    res.status(404).json({
      error: "Empresa não encontrada.",
    });

    return null;
  }


  if (!empresa.ativo) {
    res.status(403).json({
      error: "Empresa desativada.",
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

exports.listar = async (req, res) => {
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


    const { empresaId } =
      validacao;


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

        WHERE empresa_id = $1

        ORDER BY nome ASC
        `,
        [empresaId]
      );


    return res.json(rows);

  } catch (err) {
    console.error(
      "Erro ao listar funções:",
      err
    );


    return res.status(500).json({
      error:
        "Erro ao listar funções.",
    });
  }
};


/* =========================================================
   BUSCAR UMA FUNÇÃO
========================================================= */

exports.buscarPorId = async (
  req,
  res
) => {
  try {
    await garantirTabelaFuncoes();


    const { id } =
      req.params;


    const funcaoId =
      Number(id);


    if (
      !Number.isInteger(funcaoId) ||
      funcaoId <= 0
    ) {
      return res.status(400).json({
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


    const { empresaId } =
      validacao;


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


    if (rows.length === 0) {
      return res.status(404).json({
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


    return res.status(500).json({
      error:
        "Erro ao buscar função.",
    });
  }
};


/* =========================================================
   CRIAR FUNÇÃO
========================================================= */

exports.criar = async (
  req,
  res
) => {
  try {
    await garantirTabelaFuncoes();


    const nome =
      String(
        req.body?.nome || ""
      ).trim();


    if (!nome) {
      return res.status(400).json({
        error:
          "Nome da função é obrigatório.",
      });
    }


    if (nome.length > 150) {
      return res.status(400).json({
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


    const { empresaId } =
      validacao;


    /* ===================================================
       VERIFICAR DUPLICIDADE NA MESMA EMPRESA
    =================================================== */

    const existe =
      await pool.query(
        `
        SELECT id

        FROM funcoes

        WHERE empresa_id = $1
          AND LOWER(TRIM(nome)) =
              LOWER(TRIM($2))

        LIMIT 1
        `,
        [
          empresaId,
          nome,
        ]
      );


    if (
      existe.rows.length > 0
    ) {
      return res.status(409).json({
        error:
          "Esta função já existe nesta empresa.",
      });
    }


    /* ===================================================
       CRIAR
    =================================================== */

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
          nome,
        ]
      );


    return res.status(201).json({
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


    /*
      Proteção adicional caso duas requisições
      tentem cadastrar simultaneamente.
    */
    if (
      err.code === "23505"
    ) {
      return res.status(409).json({
        error:
          "Esta função já existe nesta empresa.",
      });
    }


    return res.status(500).json({
      error:
        "Erro ao cadastrar função.",
    });
  }
};


/* =========================================================
   ALTERAR FUNÇÃO
========================================================= */

exports.alterar = async (
  req,
  res
) => {
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
      !Number.isInteger(funcaoId) ||
      funcaoId <= 0
    ) {
      return res.status(400).json({
        error:
          "ID da função inválido.",
      });
    }


    if (!nome) {
      return res.status(400).json({
        error:
          "Nome da função é obrigatório.",
      });
    }


    if (nome.length > 150) {
      return res.status(400).json({
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


    const { empresaId } =
      validacao;


    /* ===================================================
       VERIFICAR SE A FUNÇÃO PERTENCE À EMPRESA
    =================================================== */

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
      funcaoAtual.rows.length === 0
    ) {
      return res.status(404).json({
        error:
          "Função não encontrada.",
      });
    }


    /* ===================================================
       VERIFICAR OUTRA FUNÇÃO COM MESMO NOME
    =================================================== */

    const duplicada =
      await pool.query(
        `
        SELECT id

        FROM funcoes

        WHERE empresa_id = $1

          AND LOWER(TRIM(nome)) =
              LOWER(TRIM($2))

          AND id <> $3

        LIMIT 1
        `,
        [
          empresaId,
          nome,
          funcaoId,
        ]
      );


    if (
      duplicada.rows.length > 0
    ) {
      return res.status(409).json({
        error:
          "Já existe outra função com este nome nesta empresa.",
      });
    }


    /* ===================================================
       ALTERAR
    =================================================== */

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
          nome,
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
      return res.status(409).json({
        error:
          "Já existe uma função com este nome nesta empresa.",
      });
    }


    return res.status(500).json({
      error:
        "Erro ao alterar função.",
    });
  }
};


/* =========================================================
   EXCLUIR FUNÇÃO
========================================================= */

exports.excluir = async (
  req,
  res
) => {
  try {
    await garantirTabelaFuncoes();


    const funcaoId =
      Number(
        req.params.id
      );


    if (
      !Number.isInteger(funcaoId) ||
      funcaoId <= 0
    ) {
      return res.status(400).json({
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


    const { empresaId } =
      validacao;


    /* ===================================================
       VERIFICAR SE EXISTE NA EMPRESA
    =================================================== */

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
      funcao.rows.length === 0
    ) {
      return res.status(404).json({
        error:
          "Função não encontrada.",
      });
    }


    /* ===================================================
       VERIFICAR FUNCIONÁRIOS UTILIZANDO A FUNÇÃO
    =================================================== */

    const funcionarios =
      await pool.query(
        `
        SELECT COUNT(*)::integer
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
        funcionarios.rows[0]
          ?.total
      ) || 0;


    if (
      totalFuncionarios > 0
    ) {
      return res.status(409).json({
        error:
          `Não é possível excluir esta função. Existem ${totalFuncionarios} funcionário(s) utilizando ela.`,
      });
    }


    /* ===================================================
       EXCLUIR
    =================================================== */

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


    return res.status(500).json({
      error:
        "Erro ao excluir função.",
    });
  }
};


/* =========================================================
   EXPORTAR FUNÇÃO AUXILIAR
   CASO OUTRO CONTROLLER PRECISE
========================================================= */

exports.garantirTabelaFuncoes =
  garantirTabelaFuncoes;