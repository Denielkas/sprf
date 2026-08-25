const pool = require("../database/pool");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/* =========================================================
   ROLES
========================================================= */

const ROLES = {
  SUPER_ADMIN: "super_admin",
  RH_EMPRESA: "rh_empresa",
  PONTO_EMPRESA: "ponto_empresa",
};

/* =========================================================
   GARANTIR TABELA EMPRESAS
========================================================= */

async function garantirTabelaEmpresas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS empresas (
      id BIGSERIAL PRIMARY KEY,

      nome VARCHAR(150) NOT NULL,

      nome_fantasia VARCHAR(150),

      cor_primaria VARCHAR(30)
      DEFAULT '#0d6efd',

      cor_secundaria VARCHAR(30)
      DEFAULT '#084298',

      logo_arquivo TEXT,

      fundo_arquivo TEXT,

      ativo BOOLEAN
      NOT NULL
      DEFAULT true,

      created_at TIMESTAMP
      NOT NULL
      DEFAULT NOW(),

      updated_at TIMESTAMP
      NOT NULL
      DEFAULT NOW()
    );
  `);

  /* =======================================================
     GARANTIR COLUNAS
  ======================================================= */

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS nome VARCHAR(150);
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS nome_fantasia VARCHAR(150);
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS cor_primaria VARCHAR(30)
    DEFAULT '#0d6efd';
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS cor_secundaria VARCHAR(30)
    DEFAULT '#084298';
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
    NOT NULL
    DEFAULT true;
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
    NOT NULL
    DEFAULT NOW();
  `);

  await pool.query(`
    ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
    NOT NULL
    DEFAULT NOW();
  `);
}

/* =========================================================
   GARANTIR TABELA ADMINS
========================================================= */

async function garantirTabelaAdmins() {
  await garantirTabelaEmpresas();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id BIGSERIAL PRIMARY KEY,

      username VARCHAR(100)
      NOT NULL
      UNIQUE,

      password_hash TEXT
      NOT NULL,

      role VARCHAR(30)
      NOT NULL
      DEFAULT 'rh_empresa',

      empresa_id BIGINT
      REFERENCES empresas(id)
      ON DELETE RESTRICT,

      ativo BOOLEAN
      NOT NULL
      DEFAULT true,

      created_at TIMESTAMP
      NOT NULL
      DEFAULT NOW()
    );
  `);

  /* =======================================================
     GARANTIR COLUNAS
  ======================================================= */

  await pool.query(`
    ALTER TABLE admins
    ADD COLUMN IF NOT EXISTS role VARCHAR(30)
    NOT NULL DEFAULT 'rh_empresa';
  `);

  await pool.query(`
    ALTER TABLE admins
    ADD COLUMN IF NOT EXISTS empresa_id BIGINT;
  `);

  await pool.query(`
    ALTER TABLE admins
    ADD COLUMN IF NOT EXISTS ativo BOOLEAN
    NOT NULL DEFAULT true;
  `);

  await pool.query(`
    ALTER TABLE admins
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
    NOT NULL DEFAULT NOW();
  `);

  /* =======================================================
     MIGRAR ROLE ANTIGA
  ======================================================= */

  await pool.query(`
    UPDATE admins
    SET role = 'rh_empresa'
    WHERE role = 'admin_empresa';
  `);

  /* =======================================================
     GARANTIR FOREIGN KEY
  ======================================================= */

  await pool.query(`
    DO $$
    BEGIN

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'admins_empresa_id_fkey'
      ) THEN

        ALTER TABLE admins

        ADD CONSTRAINT admins_empresa_id_fkey

        FOREIGN KEY (empresa_id)

        REFERENCES empresas(id)

        ON DELETE RESTRICT;

      END IF;

    END $$;
  `);
}

/* =========================================================
   LOGIN
========================================================= */

async function login(req, res) {
  try {
    await garantirTabelaAdmins();

    const {
      username,
      password,
    } = req.body;

    /* =====================================================
       VALIDAR CAMPOS
    ===================================================== */

    if (
      !username ||
      !password
    ) {
      return res.status(400).json({
        error:
          "Usuário e senha são obrigatórios.",
      });
    }

    const usuarioDigitado =
      String(username).trim();

    /* =====================================================
       BUSCAR USUÁRIO + EMPRESA
    ===================================================== */

    const result =
      await pool.query(
        `
        SELECT

          a.id,

          a.username,

          a.password_hash,

          a.role,

          a.empresa_id,

          a.ativo,

          e.id
            AS empresa_id_real,

          e.nome
            AS empresa_nome,

          e.nome_fantasia
            AS empresa_nome_fantasia,

          e.ativo
            AS empresa_ativa,

          e.cor_primaria,

          e.cor_secundaria,

          e.logo_arquivo,

          e.fundo_arquivo

        FROM admins a

        LEFT JOIN empresas e
          ON e.id = a.empresa_id

        WHERE LOWER(a.username) =
              LOWER($1)

        LIMIT 1
        `,
        [
          usuarioDigitado,
        ]
      );

    /* =====================================================
       NÃO ENCONTRADO
    ===================================================== */

    if (
      result.rows.length === 0
    ) {
      return res.status(401).json({
        error:
          "Usuário ou senha inválidos.",
      });
    }

    const admin =
      result.rows[0];

    /* =====================================================
       DEBUG

       IMPORTANTE PARA CONFERIR LOGO/FUNDO
    ===================================================== */

    console.log(
      "=========================================="
    );

    console.log(
      "🔐 LOGIN:",
      admin.username
    );

    console.log(
      "👤 ROLE:",
      admin.role
    );

    console.log(
      "🏢 EMPRESA ID:",
      admin.empresa_id
    );

    console.log(
      "🏢 EMPRESA:",
      admin.empresa_nome_fantasia ||
        admin.empresa_nome
    );

    console.log(
      "🖼 LOGO ARQUIVO:",
      admin.logo_arquivo
    );

    console.log(
      "🌄 FUNDO ARQUIVO:",
      admin.fundo_arquivo
    );

    console.log(
      "=========================================="
    );

    /* =====================================================
       USUÁRIO DESATIVADO
    ===================================================== */

    if (!admin.ativo) {
      return res.status(403).json({
        error:
          "Este usuário está desativado.",
      });
    }

    /* =====================================================
       VALIDAR ROLE
    ===================================================== */

    const rolesPermitidas = [
      ROLES.SUPER_ADMIN,
      ROLES.RH_EMPRESA,
      ROLES.PONTO_EMPRESA,
    ];

    if (
      !rolesPermitidas.includes(
        admin.role
      )
    ) {
      return res.status(403).json({
        error:
          "Tipo de usuário inválido.",
      });
    }

    /* =====================================================
       EMPRESA OBRIGATÓRIA
    ===================================================== */

    if (
      admin.role !==
        ROLES.SUPER_ADMIN &&
      !admin.empresa_id
    ) {
      return res.status(403).json({
        error:
          "Este usuário não está vinculado a uma empresa.",
      });
    }

    /* =====================================================
       EMPRESA PRECISA EXISTIR
    ===================================================== */

    if (
      admin.role !==
        ROLES.SUPER_ADMIN &&
      !admin.empresa_id_real
    ) {
      return res.status(403).json({
        error:
          "A empresa vinculada a este usuário não foi encontrada.",
      });
    }

    /* =====================================================
       EMPRESA ATIVA
    ===================================================== */

    if (
      admin.role !==
        ROLES.SUPER_ADMIN &&
      admin.empresa_ativa === false
    ) {
      return res.status(403).json({
        error:
          "Esta empresa está desativada.",
      });
    }

    /* =====================================================
       SENHA
    ===================================================== */

    const senhaCorreta =
      await bcrypt.compare(
        String(password),
        admin.password_hash
      );

    if (!senhaCorreta) {
      return res.status(401).json({
        error:
          "Usuário ou senha inválidos.",
      });
    }

    /* =====================================================
       JWT SECRET
    ===================================================== */

    if (
      !process.env.JWT_SECRET
    ) {
      console.error(
        "❌ JWT_SECRET não configurado."
      );

      return res.status(500).json({
        error:
          "JWT_SECRET não configurado.",
      });
    }

    /* =====================================================
       EMPRESA ID
    ===================================================== */

    const empresaId =
      admin.role ===
      ROLES.SUPER_ADMIN
        ? null
        : Number(
            admin.empresa_id
          );

    /* =====================================================
       TOKEN
    ===================================================== */

    const token =
      jwt.sign(
        {
          sub:
            admin.id,

          username:
            admin.username,

          role:
            admin.role,

          empresa_id:
            empresaId,
        },

        process.env.JWT_SECRET,

        {
          expiresIn:
            "8h",
        }
      );

    /* =====================================================
       REDIRECT
    ===================================================== */

    let redirect = "/";

    if (
      admin.role ===
      ROLES.SUPER_ADMIN
    ) {
      redirect =
        "/app/empresas";
    }

    if (
      admin.role ===
      ROLES.RH_EMPRESA
    ) {
      redirect =
        "/app/registrar-funcionario";
    }

    if (
      admin.role ===
      ROLES.PONTO_EMPRESA
    ) {
      redirect =
        "/ponto";
    }

    /* =====================================================
       NOME EMPRESA
    ===================================================== */

    const empresaNome =
      admin.empresa_nome_fantasia ||
      admin.empresa_nome ||
      null;

    /* =====================================================
       OBJETO DA EMPRESA

       ESSA É A PARTE PRINCIPAL PARA A HOME.
    ===================================================== */

    let empresa = null;

    if (
      admin.role !==
      ROLES.SUPER_ADMIN
    ) {
      empresa = {
        id:
          empresaId,

        nome:
          empresaNome,

        nome_fantasia:
          admin.empresa_nome_fantasia ||
          empresaNome,

        razao_social:
          admin.empresa_nome ||
          empresaNome,

        cor_primaria:
          admin.cor_primaria ||
          "#0d6efd",

        cor_secundaria:
          admin.cor_secundaria ||
          "#084298",

        /* ===============================================
           NOMES DOS ARQUIVOS
        =============================================== */

        logo_arquivo:
          admin.logo_arquivo ||
          null,

        fundo_arquivo:
          admin.fundo_arquivo ||
          null,

        /* ===============================================
           ROTAS PÚBLICAS DAS IMAGENS

           Mesmo que o arquivo tenha outro nome,
           o frontend sempre acessa estas URLs.
        =============================================== */

        logo_url:
          admin.logo_arquivo
            ? `/api/empresas/${empresaId}/logo`
            : null,

        fundo_url:
          admin.fundo_arquivo
            ? `/api/empresas/${empresaId}/fundo`
            : null,

        dashboard_background_url:
          admin.fundo_arquivo
            ? `/api/empresas/${empresaId}/fundo`
            : null,
      };
    }

    /* =====================================================
       DEBUG DO OBJETO FINAL
    ===================================================== */

    console.log(
      "🏢 EMPRESA ENVIADA PARA O FRONT:",
      empresa
    );

    /* =====================================================
       RESPOSTA
    ===================================================== */

    return res.json({
      ok: true,

      token,

      redirect,

      usuario: {
        id:
          admin.id,

        username:
          admin.username,

        role:
          admin.role,

        empresa_id:
          empresaId,

        empresa_nome:
          empresaNome,
      },

      empresa,
    });

  } catch (err) {
    console.error(
      "❌ Erro no login:",
      err
    );

    return res.status(500).json({
      error:
        "Erro interno no login.",
    });
  }
}

/* =========================================================
   CRIAR PRIMEIRO SUPER ADMIN
========================================================= */

async function criarPrimeiroSuperAdmin(
  req,
  res
) {
  try {
    await garantirTabelaAdmins();

    const {
      username,
      password,
    } = req.body;

    /* =====================================================
       CAMPOS
    ===================================================== */

    if (
      !username ||
      !password
    ) {
      return res.status(400).json({
        error:
          "Usuário e senha são obrigatórios.",
      });
    }

    const usuario =
      String(username).trim();

    const senha =
      String(password);

    /* =====================================================
       VALIDAÇÕES
    ===================================================== */

    if (
      usuario.length < 3
    ) {
      return res.status(400).json({
        error:
          "O usuário deve possuir pelo menos 3 caracteres.",
      });
    }

    if (
      senha.trim().length < 6
    ) {
      return res.status(400).json({
        error:
          "A senha deve possuir pelo menos 6 caracteres.",
      });
    }

    /* =====================================================
       VERIFICAR SUPER ADMIN
    ===================================================== */

    const superAdminExiste =
      await pool.query(`
        SELECT
          id,
          username

        FROM admins

        WHERE role = 'super_admin'

        LIMIT 1
      `);

    if (
      superAdminExiste.rows.length >
      0
    ) {
      return res.status(403).json({
        error:
          "O Super Admin já foi criado.",
      });
    }

    /* =====================================================
       USERNAME
    ===================================================== */

    const usernameExiste =
      await pool.query(
        `
        SELECT id

        FROM admins

        WHERE LOWER(username) =
              LOWER($1)

        LIMIT 1
        `,
        [
          usuario,
        ]
      );

    if (
      usernameExiste.rows.length >
      0
    ) {
      return res.status(409).json({
        error:
          "Este usuário já existe.",
      });
    }

    /* =====================================================
       HASH
    ===================================================== */

    const hash =
      await bcrypt.hash(
        senha,
        10
      );

    /* =====================================================
       INSERT
    ===================================================== */

    const { rows } =
      await pool.query(
        `
        INSERT INTO admins (
          username,
          password_hash,
          role,
          empresa_id,
          ativo
        )

        VALUES (
          $1,
          $2,
          'super_admin',
          NULL,
          true
        )

        RETURNING
          id,
          username,
          role,
          empresa_id,
          ativo,
          created_at
        `,
        [
          usuario,
          hash,
        ]
      );

    return res
      .status(201)
      .json({
        ok: true,

        message:
          "Super Admin criado com sucesso.",

        usuario:
          rows[0],
      });

  } catch (err) {
    console.error(
      "❌ Erro ao criar Super Admin:",
      err
    );

    return res.status(500).json({
      error:
        "Erro ao criar Super Admin.",
    });
  }
}

/* =========================================================
   SUPER ADMIN CRIA LOGIN DA EMPRESA
========================================================= */

async function criarAdminEmpresa(
  req,
  res
) {
  try {
    await garantirTabelaAdmins();

    const {
      username,
      password,
      empresa_id,
      role,
    } = req.body;

    /* =====================================================
       CAMPOS
    ===================================================== */

    if (
      !username ||
      !password ||
      !empresa_id ||
      !role
    ) {
      return res.status(400).json({
        error:
          "Usuário, senha, empresa e tipo de acesso são obrigatórios.",
      });
    }

    /* =====================================================
       ROLE
    ===================================================== */

    const rolesEmpresa = [
      ROLES.RH_EMPRESA,
      ROLES.PONTO_EMPRESA,
    ];

    if (
      !rolesEmpresa.includes(
        role
      )
    ) {
      return res.status(400).json({
        error:
          "Tipo de acesso inválido. Use rh_empresa ou ponto_empresa.",
      });
    }

    const usuario =
      String(username).trim();

    const senha =
      String(password);

    /* =====================================================
       USERNAME
    ===================================================== */

    if (
      usuario.length < 3
    ) {
      return res.status(400).json({
        error:
          "O usuário deve possuir pelo menos 3 caracteres.",
      });
    }

    /* =====================================================
       SENHA
    ===================================================== */

    if (
      senha.trim().length < 6
    ) {
      return res.status(400).json({
        error:
          "A senha deve possuir pelo menos 6 caracteres.",
      });
    }

    /* =====================================================
       EMPRESA
    ===================================================== */

    const empresaResult =
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
        [
          empresa_id,
        ]
      );

    if (
      empresaResult.rows.length ===
      0
    ) {
      return res.status(404).json({
        error:
          "Empresa não encontrada.",
      });
    }

    const empresa =
      empresaResult.rows[0];

    if (!empresa.ativo) {
      return res.status(400).json({
        error:
          "Não é possível criar login para uma empresa desativada.",
      });
    }

    /* =====================================================
       USERNAME JÁ EXISTE
    ===================================================== */

    const usuarioExiste =
      await pool.query(
        `
        SELECT id

        FROM admins

        WHERE LOWER(username) =
              LOWER($1)

        LIMIT 1
        `,
        [
          usuario,
        ]
      );

    if (
      usuarioExiste.rows.length >
      0
    ) {
      return res.status(409).json({
        error:
          "Este usuário já existe.",
      });
    }

    /* =====================================================
       EMPRESA JÁ POSSUI ESSE LOGIN
    ===================================================== */

    const tipoExiste =
      await pool.query(
        `
        SELECT
          id,
          username

        FROM admins

        WHERE empresa_id = $1
          AND role = $2

        LIMIT 1
        `,
        [
          empresa_id,
          role,
        ]
      );

    if (
      tipoExiste.rows.length >
      0
    ) {
      const nomeTipo =
        role ===
        ROLES.RH_EMPRESA
          ? "RH"
          : "Ponto";

      return res.status(409).json({
        error:
          `Esta empresa já possui um login de ${nomeTipo}.`,
      });
    }

    /* =====================================================
       HASH
    ===================================================== */

    const hash =
      await bcrypt.hash(
        senha,
        10
      );

    /* =====================================================
       CRIAR
    ===================================================== */

    const { rows } =
      await pool.query(
        `
        INSERT INTO admins (
          username,
          password_hash,
          role,
          empresa_id,
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
          username,
          role,
          empresa_id,
          ativo,
          created_at
        `,
        [
          usuario,
          hash,
          role,
          empresa_id,
        ]
      );

    /* =====================================================
       TIPO
    ===================================================== */

    const nomeTipo =
      role ===
      ROLES.RH_EMPRESA
        ? "RH"
        : "Ponto";

    /* =====================================================
       RESPOSTA
    ===================================================== */

    return res
      .status(201)
      .json({
        ok: true,

        message:
          `Login de ${nomeTipo} criado com sucesso.`,

        admin: {
          ...rows[0],

          empresa_nome:
            empresa.nome_fantasia ||
            empresa.nome,
        },
      });

  } catch (err) {
    console.error(
      "❌ Erro ao criar login da empresa:",
      err
    );

    return res.status(500).json({
      error:
        "Erro ao criar login da empresa.",
    });
  }
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  login,
  criarPrimeiroSuperAdmin,
  criarAdminEmpresa,
};