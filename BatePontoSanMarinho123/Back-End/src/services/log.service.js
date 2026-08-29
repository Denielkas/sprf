const pool = require("../database/pool");

/* =========================================================
   GARANTIR TABELA DE LOGS
========================================================= */
async function garantirTabelaLogs() {
  /* =========================================
     TABELA
  ========================================= */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS logs_sistema (
      id BIGSERIAL PRIMARY KEY,

      empresa_id BIGINT
        REFERENCES empresas(id)
        ON DELETE CASCADE,

      usuario_id BIGINT,

      funcionario_id BIGINT
        REFERENCES funcionarios(id)
        ON DELETE SET NULL,

      username VARCHAR(100),

      role VARCHAR(30),

      tipo VARCHAR(50)
        NOT NULL,

      acao VARCHAR(100)
        NOT NULL,

      descricao TEXT,

      ip VARCHAR(100),

      user_agent TEXT,

      dados JSONB,

      created_at TIMESTAMP
        NOT NULL
        DEFAULT NOW()
    );
  `);

  /* =========================================
     MIGRAÇÕES PARA BANCO JÁ EXISTENTE
  ========================================= */

  await pool.query(`
    ALTER TABLE logs_sistema
    ADD COLUMN IF NOT EXISTS empresa_id
    BIGINT REFERENCES empresas(id)
    ON DELETE CASCADE
  `);

  await pool.query(`
    ALTER TABLE logs_sistema
    ADD COLUMN IF NOT EXISTS usuario_id
    BIGINT
  `);

  await pool.query(`
    ALTER TABLE logs_sistema
    ADD COLUMN IF NOT EXISTS funcionario_id
    BIGINT REFERENCES funcionarios(id)
    ON DELETE SET NULL
  `);

  await pool.query(`
    ALTER TABLE logs_sistema
    ADD COLUMN IF NOT EXISTS username
    VARCHAR(100)
  `);

  await pool.query(`
    ALTER TABLE logs_sistema
    ADD COLUMN IF NOT EXISTS role
    VARCHAR(30)
  `);

  await pool.query(`
    ALTER TABLE logs_sistema
    ADD COLUMN IF NOT EXISTS tipo
    VARCHAR(50)
  `);

  await pool.query(`
    ALTER TABLE logs_sistema
    ADD COLUMN IF NOT EXISTS acao
    VARCHAR(100)
  `);

  await pool.query(`
    ALTER TABLE logs_sistema
    ADD COLUMN IF NOT EXISTS descricao
    TEXT
  `);

  await pool.query(`
    ALTER TABLE logs_sistema
    ADD COLUMN IF NOT EXISTS ip
    VARCHAR(100)
  `);

  await pool.query(`
    ALTER TABLE logs_sistema
    ADD COLUMN IF NOT EXISTS user_agent
    TEXT
  `);

  await pool.query(`
    ALTER TABLE logs_sistema
    ADD COLUMN IF NOT EXISTS dados
    JSONB
  `);

  await pool.query(`
    ALTER TABLE logs_sistema
    ADD COLUMN IF NOT EXISTS created_at
    TIMESTAMP DEFAULT NOW()
  `);

  /* =========================================
     ÍNDICES
  ========================================= */

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_logs_sistema_empresa

    ON logs_sistema(
      empresa_id
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_logs_sistema_funcionario

    ON logs_sistema(
      funcionario_id
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_logs_sistema_usuario

    ON logs_sistema(
      usuario_id
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_logs_sistema_tipo

    ON logs_sistema(
      tipo
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_logs_sistema_acao

    ON logs_sistema(
      acao
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_logs_sistema_created_at

    ON logs_sistema(
      created_at DESC
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_logs_sistema_empresa_data

    ON logs_sistema(
      empresa_id,
      created_at DESC
    )
  `);
}


/* =========================================================
   OBTER IP
========================================================= */
function obterIp(req) {
  if (!req) {
    return null;
  }

  const forwarded =
    req.headers?.[
      "x-forwarded-for"
    ];

  if (forwarded) {
    return String(
      forwarded
    )
      .split(",")[0]
      .trim();
  }

  return (
    req.ip ||
    req.socket?.remoteAddress ||
    req.connection
      ?.remoteAddress ||
    null
  );
}


/* =========================================================
   OBTER USER AGENT
========================================================= */
function obterUserAgent(req) {
  if (!req) {
    return null;
  }

  return (
    req.headers?.[
      "user-agent"
    ] ||
    null
  );
}


/* =========================================================
   LIMPAR DADOS SENSÍVEIS

   Nunca devemos salvar nos logs:

   - senha
   - password
   - token JWT
   - authorization
   - image_base64
   - embeddings faciais
========================================================= */
function limparDadosSensiveis(
  valor
) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return valor;
  }

  if (
    Array.isArray(valor)
  ) {
    return valor.map(
      limparDadosSensiveis
    );
  }

  if (
    typeof valor !== "object"
  ) {
    return valor;
  }

  const resultado = {};

  const camposBloqueados =
    new Set([
      "password",
      "senha",
      "password_hash",
      "token",
      "jwt",
      "authorization",
      "image_base64",
      "embedding",
      "embeddings",
      "foto_base64",
    ]);

  for (
    const [
      chave,
      conteudo,
    ] of Object.entries(
      valor
    )
  ) {
    const chaveNormalizada =
      String(chave)
        .trim()
        .toLowerCase();

    if (
      camposBloqueados.has(
        chaveNormalizada
      )
    ) {
      resultado[chave] =
        "[REMOVIDO]";
    } else {
      resultado[chave] =
        limparDadosSensiveis(
          conteudo
        );
    }
  }

  return resultado;
}


/* =========================================================
   REGISTRAR LOG

   IMPORTANTE:

   Esta função nunca deve derrubar a operação principal.

   Se houver problema ao registrar o log,
   apenas mostramos o erro no console.
========================================================= */
async function registrarLog({
  req = null,

  empresa_id = null,

  usuario_id = null,

  funcionario_id = null,

  username = null,

  role = null,

  tipo,

  acao,

  descricao = null,

  dados = null,
} = {}) {
  try {
    /* =====================================
       VALIDAR CAMPOS OBRIGATÓRIOS
    ===================================== */

    if (
      !tipo ||
      !String(tipo).trim()
    ) {
      console.error(
        "❌ LOG NÃO REGISTRADO: tipo não informado."
      );

      return null;
    }

    if (
      !acao ||
      !String(acao).trim()
    ) {
      console.error(
        "❌ LOG NÃO REGISTRADO: ação não informada."
      );

      return null;
    }

    /* =====================================
       GARANTIR TABELA
    ===================================== */

    await garantirTabelaLogs();

    /* =====================================
       DADOS DO USUÁRIO AUTENTICADO
    ===================================== */

    const usuarioReq =
      req?.user || null;

    const roleFinal =
      role ||
      usuarioReq?.role ||
      null;

    const usuarioIdFinal =
      usuario_id ||
      usuarioReq?.id ||
      null;

    const usernameFinal =
      username ||
      usuarioReq?.username ||
      null;

    /* =====================================
       EMPRESA

       REGRA DE SEGURANÇA:

       Para usuário de empresa:
       sempre usamos empresa_id do JWT.

       Para super_admin:
       permitimos empresa_id explícito porque
       ele pode realizar ações sobre qualquer
       empresa.
    ===================================== */

    let empresaIdFinal =
      empresa_id
        ? Number(
            empresa_id
          )
        : null;

    if (
      usuarioReq &&
      usuarioReq.role !==
        "super_admin"
    ) {
      const empresaToken =
        Number(
          usuarioReq.empresa_id
        );

      if (
        Number.isInteger(
          empresaToken
        ) &&
        empresaToken > 0
      ) {
        empresaIdFinal =
          empresaToken;
      }
    }

    if (
      !Number.isInteger(
        empresaIdFinal
      ) ||
      empresaIdFinal <= 0
    ) {
      empresaIdFinal =
        null;
    }

    /* =====================================
       FUNCIONÁRIO
    ===================================== */

    let funcionarioIdFinal =
      funcionario_id
        ? Number(
            funcionario_id
          )
        : null;

    if (
      !Number.isInteger(
        funcionarioIdFinal
      ) ||
      funcionarioIdFinal <= 0
    ) {
      funcionarioIdFinal =
        null;
    }

    /* =====================================
       USUÁRIO
    ===================================== */

    let usuarioIdBanco =
      usuarioIdFinal
        ? Number(
            usuarioIdFinal
          )
        : null;

    if (
      !Number.isInteger(
        usuarioIdBanco
      ) ||
      usuarioIdBanco <= 0
    ) {
      usuarioIdBanco =
        null;
    }

    /* =====================================
       IP / NAVEGADOR
    ===================================== */

    const ip =
      obterIp(req);

    const userAgent =
      obterUserAgent(req);

    /* =====================================
       LIMPAR DADOS SENSÍVEIS
    ===================================== */

    const dadosLimpos =
      limparDadosSensiveis(
        dados
      );

    /* =====================================
       INSERIR
    ===================================== */

    const { rows } =
      await pool.query(
        `
        INSERT INTO logs_sistema (
          empresa_id,
          usuario_id,
          funcionario_id,

          username,
          role,

          tipo,
          acao,
          descricao,

          ip,
          user_agent,

          dados,

          created_at
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

          $11::jsonb,

          NOW()
        )

        RETURNING
          id,
          empresa_id,
          usuario_id,
          funcionario_id,

          username,
          role,

          tipo,
          acao,
          descricao,

          ip,
          user_agent,

          dados,

          created_at
        `,
        [
          empresaIdFinal,
          usuarioIdBanco,
          funcionarioIdFinal,

          usernameFinal
            ? String(
                usernameFinal
              )
            : null,

          roleFinal
            ? String(
                roleFinal
              )
            : null,

          String(tipo)
            .trim()
            .toUpperCase(),

          String(acao)
            .trim()
            .toUpperCase(),

          descricao
            ? String(
                descricao
              )
            : null,

          ip
            ? String(ip)
            : null,

          userAgent
            ? String(
                userAgent
              )
            : null,

          JSON.stringify(
            dadosLimpos ??
            {}
          ),
        ]
      );

    console.log(
      "📝 LOG REGISTRADO:",
      {
        id:
          rows[0]?.id,

        empresa_id:
          empresaIdFinal,

        funcionario_id:
          funcionarioIdFinal,

        tipo:
          String(tipo)
            .toUpperCase(),

        acao:
          String(acao)
            .toUpperCase(),
      }
    );

    return (
      rows[0] ||
      null
    );

  } catch (err) {
    /*
      MUITO IMPORTANTE:

      Falha no sistema de logs NÃO deve impedir:

      - bater ponto
      - ajustar horário
      - cadastrar funcionário
      - login
      - etc.
    */

    console.error(
      "❌ Erro ao registrar log:",
      err
    );

    return null;
  }
}


/* =========================================================
   EXPORTAÇÕES
========================================================= */
module.exports = {
  garantirTabelaLogs,
  registrarLog,
  obterIp,
  obterUserAgent,
  limparDadosSensiveis,
};