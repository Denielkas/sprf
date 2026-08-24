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
   GARANTIR TABELA FUNCIONÁRIOS
========================================= */
async function garantirTabelaFuncionarios() {
  /* =========================================
     CRIAR TABELA DE FUNÇÕES
  ========================================= */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS funcoes (
      id BIGSERIAL PRIMARY KEY,
      nome VARCHAR(150) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  /* =========================================
     CRIAR TABELA DE EMPRESAS
     Apenas garante que ela exista antes da FK
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

  /* =========================================
     CRIAR TABELA DE FUNCIONÁRIOS
  ========================================= */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS funcionarios (
      id BIGSERIAL PRIMARY KEY,

      empresa_id BIGINT,

      nome VARCHAR(150) NOT NULL,

      cpf VARCHAR(20) NOT NULL UNIQUE,

      funcao VARCHAR(100),

      funcao_id BIGINT REFERENCES funcoes(id) ON DELETE SET NULL,

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

      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  /* =========================================
     GARANTIR COLUNA empresa_id

     Necessário caso a tabela funcionarios
     já tenha sido criada anteriormente.
  ========================================= */

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS empresa_id BIGINT;
  `);

  /* =========================================
     GARANTIR OUTRAS COLUNAS ANTIGAS
  ========================================= */

  await pool.query(`
    ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS funcao_id BIGINT;
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
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
`);

await pool.query(`
  ALTER TABLE funcionarios
  ADD COLUMN IF NOT EXISTS inativado_em TIMESTAMP;
`);

  /* =========================================
     FOREIGN KEY:
     FUNCIONÁRIO -> EMPRESA
  ========================================= */

  await pool.query(`
    DO $$
    BEGIN

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'funcionarios_empresa_id_fkey'
      ) THEN

        ALTER TABLE funcionarios
        ADD CONSTRAINT funcionarios_empresa_id_fkey
        FOREIGN KEY (empresa_id)
        REFERENCES empresas(id)
        ON DELETE RESTRICT;

      END IF;

    END $$;
  `);

  /* =========================================
     FOREIGN KEY:
     FUNCIONÁRIO -> FUNÇÃO
  ========================================= */

  await pool.query(`
    DO $$
    BEGIN

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'funcionarios_funcao_id_fkey'
      ) THEN

        ALTER TABLE funcionarios
        ADD CONSTRAINT funcionarios_funcao_id_fkey
        FOREIGN KEY (funcao_id)
        REFERENCES funcoes(id)
        ON DELETE SET NULL;

      END IF;

    END $$;
  `);

  /* =========================================
     ÍNDICE DA EMPRESA

     Vai melhorar consultas como:
     "todos funcionários do San Marinho"
  ========================================= */

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_funcionarios_empresa_id
    ON funcionarios(empresa_id);
  `);

  /* =========================================
     ÍNDICE DA FUNÇÃO
  ========================================= */

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_funcionarios_funcao_id
    ON funcionarios(funcao_id);
  `);
}

/* =========================================
   GARANTIR FACE EMBEDDINGS
========================================= */
async function garantirTabelaFaceEmbeddings() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS face_embeddings (
      funcionario_id BIGINT PRIMARY KEY REFERENCES funcionarios(id) ON DELETE CASCADE,
      embedding FLOAT8[],
      foto_path TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
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
  if (!nomeFuncao) return null;

  const nome = nomeFuncao.trim().toUpperCase();

  const existing = await pool.query(
    "SELECT id FROM funcoes WHERE nome = $1 LIMIT 1",
    [nome]
  );

  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const insert = await pool.query(
    `
    INSERT INTO funcoes (nome)
    VALUES ($1)
    RETURNING id
    `,
    [nome]
  );

  return insert.rows[0].id;
}

/* =========================================
   LISTAR FUNCIONÁRIOS DA EMPRESA LOGADA
========================================= */
exports.listar = async (req, res) => {
  try {
    await garantirTabelas();

    const empresaId = req.user?.empresa_id;
    const role = req.user?.role;

    /* =========================================
       SUPER ADMIN
       Pode visualizar todos os funcionários
    ========================================= */

    if (role === "super_admin") {
      const { rows } = await pool.query(`
        SELECT 
          f.*,

          fc.nome AS funcao_nome,

          e.nome AS empresa_nome,
          e.nome_fantasia AS empresa_nome_fantasia,

          CASE
            WHEN fe.embedding IS NOT NULL
            THEN true
            ELSE false
          END AS rosto_cadastrado,

          CASE
            WHEN fe.foto_path IS NOT NULL
              AND fe.foto_path <> ''
            THEN true
            ELSE false
          END AS possui_imagem_rosto,

          fe.foto_path

        FROM funcionarios f

        LEFT JOIN funcoes fc
          ON fc.id = f.funcao_id

        LEFT JOIN face_embeddings fe
          ON fe.funcionario_id = f.id

        LEFT JOIN empresas e
          ON e.id = f.empresa_id

        ORDER BY
          e.nome ASC,
          f.ativo DESC,
          f.nome ASC,
          f.id ASC
      `);

      return res.json(rows);
    }

    /* =========================================
       ADMIN DA EMPRESA
    ========================================= */

    if (!empresaId) {
      return res.status(403).json({
        error: "Usuário não está vinculado a uma empresa.",
      });
    }

    const { rows } = await pool.query(
      `
      SELECT 
        f.*,

        fc.nome AS funcao_nome,

        e.nome AS empresa_nome,
        e.nome_fantasia AS empresa_nome_fantasia,

        CASE
          WHEN fe.embedding IS NOT NULL
          THEN true
          ELSE false
        END AS rosto_cadastrado,

        CASE
          WHEN fe.foto_path IS NOT NULL
            AND fe.foto_path <> ''
          THEN true
          ELSE false
        END AS possui_imagem_rosto,

        fe.foto_path

      FROM funcionarios f

      LEFT JOIN funcoes fc
        ON fc.id = f.funcao_id

      LEFT JOIN face_embeddings fe
        ON fe.funcionario_id = f.id

      LEFT JOIN empresas e
        ON e.id = f.empresa_id

      WHERE f.empresa_id = $1

      ORDER BY
        f.ativo DESC,
        f.nome ASC,
        f.id ASC
      `,
      [empresaId]
    );

    return res.json(rows);

  } catch (err) {
    console.error(
      "Erro ao listar funcionários:",
      err
    );

    return res.status(500).json({
      error: "Erro ao listar funcionários",
    });
  }
};

/* =========================================
   BUSCAR FUNCIONÁRIO POR ID
========================================= */
exports.buscarPorId = async (req, res) => {
  try {
    await garantirTabelas();

    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "ID inválido.",
      });
    }

    const empresaId = req.user?.empresa_id;
    const role = req.user?.role;

    let query;
    let params;

    /* SUPER ADMIN PODE BUSCAR QUALQUER UM */
    if (role === "super_admin") {
      query = `
        SELECT 
          f.*,
          fc.nome AS funcao_nome,
          e.nome AS empresa_nome,
          e.nome_fantasia AS empresa_nome_fantasia,

          CASE
            WHEN fe.embedding IS NOT NULL THEN true
            ELSE false
          END AS rosto_cadastrado,

          CASE
            WHEN fe.foto_path IS NOT NULL
              AND fe.foto_path <> ''
            THEN true
            ELSE false
          END AS possui_imagem_rosto,

          fe.foto_path

        FROM funcionarios f

        LEFT JOIN funcoes fc
          ON fc.id = f.funcao_id

        LEFT JOIN face_embeddings fe
          ON fe.funcionario_id = f.id

        LEFT JOIN empresas e
          ON e.id = f.empresa_id

        WHERE f.id = $1

        LIMIT 1
      `;

      params = [id];
    } else {
      if (!empresaId) {
        return res.status(403).json({
          error: "Usuário não está vinculado a uma empresa.",
        });
      }

      query = `
        SELECT 
          f.*,
          fc.nome AS funcao_nome,
          e.nome AS empresa_nome,
          e.nome_fantasia AS empresa_nome_fantasia,

          CASE
            WHEN fe.embedding IS NOT NULL THEN true
            ELSE false
          END AS rosto_cadastrado,

          CASE
            WHEN fe.foto_path IS NOT NULL
              AND fe.foto_path <> ''
            THEN true
            ELSE false
          END AS possui_imagem_rosto,

          fe.foto_path

        FROM funcionarios f

        LEFT JOIN funcoes fc
          ON fc.id = f.funcao_id

        LEFT JOIN face_embeddings fe
          ON fe.funcionario_id = f.id

        LEFT JOIN empresas e
          ON e.id = f.empresa_id

        WHERE f.id = $1
          AND f.empresa_id = $2

        LIMIT 1
      `;

      params = [id, empresaId];
    }

    const { rows } = await pool.query(query, params);

    if (!rows[0]) {
      return res.status(404).json({
        error: "Funcionário não encontrado.",
      });
    }

    return res.json(rows[0]);

  } catch (err) {
    console.error("Erro ao buscar funcionário:", err);

    return res.status(500).json({
      error: "Erro interno.",
    });
  }
};

/* =========================================
   VISUALIZAR IMAGEM DO ROSTO
   COM PROTEÇÃO POR EMPRESA
========================================= */

exports.verImagemRosto = async (req, res) => {
  try {
    await garantirTabelas();

    const id = Number(req.params.id);

    const empresaId = req.user?.empresa_id;
    const role = req.user?.role;

    /* =========================================
       VALIDAR ID
    ========================================= */

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "ID inválido.",
      });
    }

    /* =========================================
       VALIDAR EMPRESA
    ========================================= */

    if (role !== "super_admin" && !empresaId) {
      return res.status(403).json({
        error: "Usuário não está vinculado a uma empresa.",
      });
    }

    /* =========================================
       BUSCAR FUNCIONÁRIO + FOTO
    ========================================= */

    let result;

    if (role === "super_admin") {
      result = await pool.query(
        `
        SELECT
          f.id,
          f.empresa_id,
          f.nome,
          fe.foto_path

        FROM funcionarios f

        LEFT JOIN face_embeddings fe
          ON fe.funcionario_id = f.id

        WHERE f.id = $1

        LIMIT 1
        `,
        [id]
      );
    } else {
      result = await pool.query(
        `
        SELECT
          f.id,
          f.empresa_id,
          f.nome,
          fe.foto_path

        FROM funcionarios f

        LEFT JOIN face_embeddings fe
          ON fe.funcionario_id = f.id

        WHERE f.id = $1
          AND f.empresa_id = $2

        LIMIT 1
        `,
        [
          id,
          empresaId,
        ]
      );
    }

    /* =========================================
       NÃO ENCONTROU
    ========================================= */

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Funcionário não encontrado.",
      });
    }

    const funcionario = result.rows[0];

    /* =========================================
       NÃO POSSUI FOTO
    ========================================= */

    if (!funcionario.foto_path) {
      return res.status(404).json({
        error: "Funcionário não possui imagem facial cadastrada.",
      });
    }

    /* =========================================
       CAMINHO DA FOTO
    ========================================= */

    const fotoPath = path.isAbsolute(
      funcionario.foto_path
    )
      ? funcionario.foto_path
      : path.join(
          __dirname,
          "../../",
          funcionario.foto_path
        );

    /* =========================================
       VERIFICAR ARQUIVO
    ========================================= */

    if (!fs.existsSync(fotoPath)) {
      return res.status(404).json({
        error: "Arquivo da imagem facial não encontrado.",
      });
    }

    /* =========================================
       ENVIAR FOTO
    ========================================= */

    return res.sendFile(
      path.resolve(fotoPath)
    );

  } catch (err) {
    console.error(
      "Erro ao visualizar imagem facial:",
      err
    );

    return res.status(500).json({
      error: "Erro ao visualizar imagem facial.",
    });
  }
};

/* =========================================
   EXCLUIR IMAGEM / CADASTRO FACIAL
   COM PROTEÇÃO POR EMPRESA
========================================= */

exports.excluirImagemRosto = async (req, res) => {
  const client = await pool.connect();

  try {
    await garantirTabelas();

    const id = Number(req.params.id);

    const empresaId = req.user?.empresa_id;
    const role = req.user?.role;

    /* =========================================
       VALIDAR ID
    ========================================= */

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "ID inválido.",
      });
    }

    if (role !== "super_admin" && !empresaId) {
      return res.status(403).json({
        error: "Usuário não está vinculado a uma empresa.",
      });
    }

    /* =========================================
       VERIFICAR FUNCIONÁRIO
    ========================================= */

    let funcionarioResult;

    if (role === "super_admin") {
      funcionarioResult = await client.query(
        `
        SELECT id, empresa_id, nome
        FROM funcionarios
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );
    } else {
      funcionarioResult = await client.query(
        `
        SELECT id, empresa_id, nome
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

    if (funcionarioResult.rows.length === 0) {
      return res.status(404).json({
        error: "Funcionário não encontrado.",
      });
    }

    /* =========================================
       BUSCAR CADASTRO FACIAL
    ========================================= */

    const faceResult = await client.query(
      `
      SELECT
        funcionario_id,
        foto_path

      FROM face_embeddings

      WHERE funcionario_id = $1

      LIMIT 1
      `,
      [id]
    );

    if (faceResult.rows.length === 0) {
      return res.status(404).json({
        error: "Funcionário não possui rosto cadastrado.",
      });
    }

    const face = faceResult.rows[0];

    /* =========================================
       INICIAR TRANSAÇÃO
    ========================================= */

    await client.query("BEGIN");

    /* =========================================
       EXCLUIR DO BANCO
    ========================================= */

    await client.query(
      `
      DELETE FROM face_embeddings
      WHERE funcionario_id = $1
      `,
      [id]
    );

    await client.query("COMMIT");

    /* =========================================
       EXCLUIR FOTO FÍSICA
    ========================================= */

    if (face.foto_path) {
      const fotoPath = path.isAbsolute(
        face.foto_path
      )
        ? face.foto_path
        : path.join(
            __dirname,
            "../../",
            face.foto_path
          );

      if (fs.existsSync(fotoPath)) {
        try {
          fs.unlinkSync(fotoPath);
        } catch (erroArquivo) {
          console.error(
            "Cadastro facial removido, mas houve erro ao excluir a foto:",
            erroArquivo
          );
        }
      }
    }

    return res.json({
      ok: true,
      message: "Cadastro facial excluído com sucesso.",
    });

  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}

    console.error(
      "Erro ao excluir cadastro facial:",
      err
    );

    return res.status(500).json({
      error: "Erro ao excluir cadastro facial.",
    });

  } finally {
    client.release();
  }
};

/* =========================================
   CRIAR FUNCIONÁRIO
========================================= */
exports.criar = async (req, res) => {
  try {
    await garantirTabelaFuncionarios();

    /* =========================================
       IDENTIFICAR A EMPRESA PELO LOGIN

       NÃO pegamos empresa_id do req.body.
       A empresa vem do token do usuário logado.
    ========================================= */

    const empresaId = req.user?.empresa_id;

    if (!empresaId) {
      return res.status(403).json({
        error: "Usuário não está vinculado a uma empresa.",
      });
    }

    /* =========================================
       VERIFICAR SE A EMPRESA EXISTE E ESTÁ ATIVA
    ========================================= */

    const empresaResult = await pool.query(
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

    if (empresaResult.rows.length === 0) {
      return res.status(404).json({
        error: "Empresa vinculada ao usuário não foi encontrada.",
      });
    }

    const empresa = empresaResult.rows[0];

    if (!empresa.ativo) {
      return res.status(403).json({
        error: "Esta empresa está desativada.",
      });
    }

    /* =========================================
       DADOS RECEBIDOS
    ========================================= */

    const {
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
      data_admissao,
      cnpj_empresa,
    } = req.body;

    /* =========================================
       VALIDAÇÕES
    ========================================= */

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({
        error: "Nome do funcionário é obrigatório.",
      });
    }

    if (!cpf || !String(cpf).trim()) {
      return res.status(400).json({
        error: "CPF do funcionário é obrigatório.",
      });
    }

    const cpfLimpo = onlyDigits(cpf);

    if (!cpfLimpo) {
      return res.status(400).json({
        error: "CPF inválido.",
      });
    }

    /* =========================================
       VERIFICAR CPF

       Por enquanto mantemos CPF único no sistema.
       Depois podemos decidir se o mesmo CPF poderá
       existir em empresas diferentes.
    ========================================= */

    const cpfExiste = await pool.query(
      `
      SELECT
        id,
        nome,
        empresa_id
      FROM funcionarios
      WHERE cpf = $1
      LIMIT 1
      `,
      [cpfLimpo]
    );

    if (cpfExiste.rows.length > 0) {
      return res.status(409).json({
        error: "Já existe um funcionário cadastrado com este CPF.",
      });
    }

    /* =========================================
       TRATAR FUNÇÃO
    ========================================= */

    let funcaoIdFinal = null;
    let funcaoNomeFinal = null;

    if (funcao_id) {
      const funcaoResult = await pool.query(
        `
        SELECT id, nome
        FROM funcoes
        WHERE id = $1
        LIMIT 1
        `,
        [funcao_id]
      );

      if (funcaoResult.rows.length === 0) {
        return res.status(400).json({
          error: "Função selecionada não existe.",
        });
      }

      funcaoIdFinal = funcaoResult.rows[0].id;
      funcaoNomeFinal = funcaoResult.rows[0].nome;
    } else if (funcao && String(funcao).trim()) {
      /*
        Mantemos compatibilidade com seu sistema antigo,
        que também possui a coluna funcao.
      */

      funcaoNomeFinal = String(funcao).trim();
    }

    /* =========================================
       CNPJ

       Se não vier cnpj_empresa no body,
       utilizamos automaticamente o CNPJ da empresa.
    ========================================= */

    const cnpjEmpresaFinal = cnpj_empresa
      ? onlyDigits(cnpj_empresa)
      : empresa.cnpj
        ? onlyDigits(empresa.cnpj)
        : null;

    /* =========================================
       CADASTRAR FUNCIONÁRIO
    ========================================= */

    const result = await pool.query(
      `
      INSERT INTO funcionarios (
        empresa_id,
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
        true,
        $12,
        $13
      )

      RETURNING
        id,
        empresa_id,
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
        cnpj_empresa,
        created_at
      `,
      [
        empresaId,             // $1
        String(nome).trim(),   // $2
        cpfLimpo,              // $3
        funcaoNomeFinal,       // $4
        funcaoIdFinal,         // $5
        email || null,         // $6
        telefone || null,      // $7
        chegada || null,       // $8
        intervalo_inicio || null, // $9
        intervalo_fim || null, // $10
        saida || null,         // $11
        data_admissao || null, // $12
        cnpjEmpresaFinal,      // $13
      ]
    );

    const funcionario = result.rows[0];

    /* =========================================
       RESPOSTA
    ========================================= */

    return res.status(201).json({
      ok: true,

      message: "Funcionário cadastrado com sucesso.",

      funcionario: {
        ...funcionario,

        empresa_nome:
          empresa.nome_fantasia ||
          empresa.nome,
      },
    });
  } catch (err) {
    console.error("Erro ao cadastrar funcionário:", err);

    /*
      Segurança adicional para CPF duplicado.
    */

    if (err.code === "23505") {
      return res.status(409).json({
        error: "Já existe um funcionário com estes dados.",
      });
    }

    return res.status(500).json({
      error: "Erro ao cadastrar funcionário.",
    });
  }
};

/* =========================================
   ATUALIZAR FUNCIONÁRIO
========================================= */
/* =========================================
   ATUALIZAR FUNCIONÁRIO
========================================= */

exports.atualizar = async (req, res) => {
  try {
    await garantirTabelas();

    const id = Number(req.params.id);

    const empresaId = req.user?.empresa_id;
    const role = req.user?.role;

    /* =========================================
       VALIDAR ID
    ========================================= */

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "ID inválido.",
      });
    }

    /* =========================================
       VALIDAR EMPRESA DO USUÁRIO
    ========================================= */

    if (role !== "super_admin" && !empresaId) {
      return res.status(403).json({
        error: "Usuário não está vinculado a uma empresa.",
      });
    }

    /* =========================================
       VERIFICAR SE O FUNCIONÁRIO EXISTE
       E SE PERTENCE À EMPRESA
    ========================================= */

    let funcionarioExiste;

    if (role === "super_admin") {
      funcionarioExiste = await pool.query(
        `
        SELECT
          id,
          empresa_id,
          cnpj_empresa
        FROM funcionarios
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );
    } else {
      funcionarioExiste = await pool.query(
        `
        SELECT
          id,
          empresa_id,
          cnpj_empresa
        FROM funcionarios
        WHERE id = $1
          AND empresa_id = $2
        LIMIT 1
        `,
        [id, empresaId]
      );
    }

    if (funcionarioExiste.rows.length === 0) {
      return res.status(404).json({
        error: "Funcionário não encontrado.",
      });
    }

    const funcionarioAtual = funcionarioExiste.rows[0];

    /*
      Se for Super Admin, usamos a empresa do próprio
      funcionário para fazer as validações.

      Se for admin_empresa, usamos a empresa do token.
    */
    const empresaDoFuncionario =
      role === "super_admin"
        ? Number(funcionarioAtual.empresa_id)
        : Number(empresaId);

    /* =========================================
       DADOS RECEBIDOS
    ========================================= */

    let {
      nome,
      cpf,
      chegada,
      intervalo_inicio,
      intervalo_fim,
      saida,
      funcao_id,
      funcao_nome,
      cnpj_empresa,
    } = req.body;

    /* =========================================
       VALIDAR NOME
    ========================================= */

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({
        error: "Nome é obrigatório.",
      });
    }

    /* =========================================
       VALIDAR CPF
    ========================================= */

    if (!cpf) {
      return res.status(400).json({
        error: "CPF é obrigatório.",
      });
    }

    cpf = onlyDigits(cpf);

    if (!cpf) {
      return res.status(400).json({
        error: "CPF inválido.",
      });
    }

    /* =========================================
       VERIFICAR CPF DUPLICADO
    ========================================= */

    const cpfExiste = await pool.query(
      `
      SELECT id
      FROM funcionarios
      WHERE cpf = $1
        AND id <> $2
      LIMIT 1
      `,
      [cpf, id]
    );

    if (cpfExiste.rows.length > 0) {
      return res.status(409).json({
        error: "Já existe outro funcionário com este CPF.",
      });
    }

    /* =========================================
       TRATAR FUNÇÃO
    ========================================= */

    if (funcao_nome && String(funcao_nome).trim()) {
      funcao_id = await findOrCreateFuncao(
        String(funcao_nome)
      );
    }

    /* =========================================
       CNPJ DA EMPRESA
    ========================================= */

    let cnpjEmpresaFinal = cnpj_empresa
      ? onlyDigits(cnpj_empresa)
      : funcionarioAtual.cnpj_empresa
        ? onlyDigits(funcionarioAtual.cnpj_empresa)
        : null;

    /* =========================================
       CNPJs DO HOTEL SAN MARINHO

       empresa_id = 1
    ========================================= */

    const cnpjsPermitidosSanMarinho = [
      "52830136000122",
      "60871302000167",
    ];

    /*
      Para o San Marinho, obrigatoriamente deve
      estar selecionado um dos dois CNPJs.
    */

    if (empresaDoFuncionario === 1) {
      if (
        !cnpjEmpresaFinal ||
        !cnpjsPermitidosSanMarinho.includes(
          cnpjEmpresaFinal
        )
      ) {
        return res.status(400).json({
          error:
            "Selecione um CNPJ válido do Hotel San Marinho.",
        });
      }
    }

    /* =========================================
       ATUALIZAR FUNCIONÁRIO
    ========================================= */

    let result;

    /* =========================================
       SUPER ADMIN
    ========================================= */

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
          funcao_id = $7,
          cnpj_empresa = $8,
          updated_at = NOW()

        WHERE id = $9

        RETURNING *
        `,
        [
          String(nome).trim(),      // $1
          cpf,                      // $2
          chegada || null,          // $3
          intervalo_inicio || null, // $4
          intervalo_fim || null,    // $5
          saida || null,            // $6
          funcao_id || null,        // $7
          cnpjEmpresaFinal,         // $8
          id,                       // $9
        ]
      );
    }

    /* =========================================
       ADMIN DA EMPRESA
    ========================================= */

    else {
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
          funcao_id = $7,
          cnpj_empresa = $8,
          updated_at = NOW()

        WHERE id = $9
          AND empresa_id = $10

        RETURNING *
        `,
        [
          String(nome).trim(),      // $1
          cpf,                      // $2
          chegada || null,          // $3
          intervalo_inicio || null, // $4
          intervalo_fim || null,    // $5
          saida || null,            // $6
          funcao_id || null,        // $7
          cnpjEmpresaFinal,         // $8
          id,                       // $9
          empresaId,                // $10
        ]
      );
    }

    /* =========================================
       SEGURANÇA
    ========================================= */

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Funcionário não encontrado.",
      });
    }

    /* =========================================
       RESPOSTA
    ========================================= */

    return res.json({
      ok: true,

      message:
        "Funcionário atualizado com sucesso.",

      funcionario: result.rows[0],
    });

  } catch (err) {
    console.error(
      "Erro ao atualizar funcionário:",
      err
    );

    if (err.code === "23505") {
      return res.status(409).json({
        error: "CPF já cadastrado.",
      });
    }

    return res.status(500).json({
      error: "Erro ao atualizar funcionário.",
    });
  }
};

/* =========================================
   INATIVAR OU REATIVAR FUNCIONÁRIO
========================================= */

exports.alterarStatus = async (req, res) => {
  try {
    await garantirTabelas();

    const id = Number(req.params.id);

    const empresaId = req.user?.empresa_id;
    const role = req.user?.role;

    const { ativo } = req.body;

    /* =========================================
       VALIDAR ID
    ========================================= */

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "ID inválido.",
      });
    }

    /* =========================================
       VALIDAR CAMPO ATIVO
    ========================================= */

    if (typeof ativo !== "boolean") {
      return res.status(400).json({
        error: "O campo ativo deve ser true ou false.",
      });
    }

    /* =========================================
       VALIDAR EMPRESA
    ========================================= */

    if (role !== "super_admin" && !empresaId) {
      return res.status(403).json({
        error: "Usuário não está vinculado a uma empresa.",
      });
    }

    let result;

    /* =========================================
       SUPER ADMIN

       Pode alterar funcionário de qualquer
       empresa.
    ========================================= */

    if (role === "super_admin") {
      result = await pool.query(
        `
        UPDATE funcionarios

        SET
          ativo = $1,

          inativado_em = CASE
            WHEN $1 = false
            THEN NOW()
            ELSE NULL
          END,

          data_inativacao = CASE
            WHEN $1 = false
            THEN CURRENT_DATE
            ELSE NULL
          END,

          updated_at = NOW()

        WHERE id = $2

        RETURNING
          id,
          empresa_id,
          nome,
          cpf,
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
    }

    /* =========================================
       ADMIN DA EMPRESA

       Só pode alterar funcionário que pertence
       à própria empresa.
    ========================================= */

    else {
      result = await pool.query(
        `
        UPDATE funcionarios

        SET
          ativo = $1,

          inativado_em = CASE
            WHEN $1 = false
            THEN NOW()
            ELSE NULL
          END,

          data_inativacao = CASE
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
          nome,
          cpf,
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

    /* =========================================
       NÃO ENCONTROU / NÃO PERTENCE À EMPRESA
    ========================================= */

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Funcionário não encontrado.",
      });
    }

    /* =========================================
       RESPOSTA
    ========================================= */

    return res.json({
      ok: true,

      message: ativo
        ? "Funcionário reativado com sucesso."
        : "Funcionário inativado com sucesso.",

      funcionario: result.rows[0],
    });

  } catch (err) {
    console.error(
      "Erro ao alterar status do funcionário:",
      err
    );

    return res.status(500).json({
      error: "Erro ao alterar status do funcionário.",
    });
  }
};