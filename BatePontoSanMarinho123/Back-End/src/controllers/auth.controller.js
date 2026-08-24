const pool = require("../database/pool");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/* =====================================================
   GARANTIR TABELA ADMINS
===================================================== */

async function garantirTabelaAdmins() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,

      role VARCHAR(30) NOT NULL DEFAULT 'admin_empresa',

      empresa_id BIGINT REFERENCES empresas(id) ON DELETE RESTRICT,

      ativo BOOLEAN NOT NULL DEFAULT true,

      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  /*
    Isso serve para banco que já tinha a tabela admins.
  */

  await pool.query(`
    ALTER TABLE admins
    ADD COLUMN IF NOT EXISTS role VARCHAR(30)
    NOT NULL DEFAULT 'admin_empresa';
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
}

/* =====================================================
   LOGIN
===================================================== */

async function login(req, res) {
  try {
    await garantirTabelaAdmins();

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: "Usuário e senha são obrigatórios.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        a.id,
        a.username,
        a.password_hash,
        a.role,
        a.empresa_id,
        a.ativo,

        e.nome AS empresa_nome,
        e.nome_fantasia AS empresa_nome_fantasia,
        e.ativo AS empresa_ativa

      FROM admins a

      LEFT JOIN empresas e
        ON e.id = a.empresa_id

      WHERE a.username = $1

      LIMIT 1
      `,
      [String(username).trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Usuário ou senha inválidos.",
      });
    }

    const admin = result.rows[0];

    if (!admin.ativo) {
      return res.status(403).json({
        error: "Este usuário está desativado.",
      });
    }

    if (
      admin.role === "admin_empresa" &&
      admin.empresa_ativa === false
    ) {
      return res.status(403).json({
        error: "Esta empresa está desativada.",
      });
    }

    const senhaCorreta = await bcrypt.compare(
      String(password),
      admin.password_hash
    );

    if (!senhaCorreta) {
      return res.status(401).json({
        error: "Usuário ou senha inválidos.",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        error: "JWT_SECRET não configurado.",
      });
    }

    const token = jwt.sign(
      {
        sub: admin.id,

        username: admin.username,

        role: admin.role,

        empresa_id:
          admin.role === "super_admin"
            ? null
            : admin.empresa_id,
      },

      process.env.JWT_SECRET,

      {
        expiresIn: "8h",
      }
    );

    return res.json({
      ok: true,

      token,

      usuario: {
        id: admin.id,

        username: admin.username,

        role: admin.role,

        empresa_id: admin.empresa_id,

        empresa_nome:
          admin.empresa_nome_fantasia ||
          admin.empresa_nome ||
          null,
      },
    });
  } catch (err) {
    console.error("Erro no login:", err);

    return res.status(500).json({
      error: "Erro interno no login.",
    });
  }
}

/* =====================================================
   CRIAR PRIMEIRO SUPER ADMIN

   Esta rota será usada somente para criar o primeiro.
===================================================== */

async function criarPrimeiroSuperAdmin(req, res) {
  try {
    await garantirTabelaAdmins();

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: "Usuário e senha são obrigatórios.",
      });
    }

    if (String(password).trim().length < 6) {
      return res.status(400).json({
        error: "A senha deve possuir pelo menos 6 caracteres.",
      });
    }

    /*
      Verifica se já existe algum SUPER ADMIN.
    */

    const superAdminExiste = await pool.query(`
      SELECT id
      FROM admins
      WHERE role = 'super_admin'
      LIMIT 1
    `);

    if (superAdminExiste.rows.length > 0) {
      return res.status(403).json({
        error: "O Super Admin já foi criado.",
      });
    }

    const usernameExiste = await pool.query(
      `
      SELECT id
      FROM admins
      WHERE username = $1
      LIMIT 1
      `,
      [String(username).trim()]
    );

    if (usernameExiste.rows.length > 0) {
      return res.status(409).json({
        error: "Este usuário já existe.",
      });
    }

    const hash = await bcrypt.hash(
      String(password),
      10
    );

    const { rows } = await pool.query(
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
        String(username).trim(),
        hash,
      ]
    );

    return res.status(201).json({
      ok: true,

      message:
        "Super Admin criado com sucesso.",

      usuario: rows[0],
    });
  } catch (err) {
    console.error(
      "Erro ao criar Super Admin:",
      err
    );

    return res.status(500).json({
      error: "Erro ao criar Super Admin.",
    });
  }
}

/* =====================================================
   SUPER ADMIN CRIA LOGIN DE UMA EMPRESA
===================================================== */

async function criarAdminEmpresa(req, res) {
  try {
    await garantirTabelaAdmins();

    const {
      username,
      password,
      empresa_id,
    } = req.body;

    /* =====================================
       VALIDAÇÕES
    ===================================== */

    if (!username || !password || !empresa_id) {
      return res.status(400).json({
        error:
          "Usuário, senha e empresa são obrigatórios.",
      });
    }

    if (String(password).trim().length < 6) {
      return res.status(400).json({
        error:
          "A senha deve possuir pelo menos 6 caracteres.",
      });
    }

    /* =====================================
       VERIFICAR EMPRESA
    ===================================== */

    const empresaResult = await pool.query(
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
      [empresa_id]
    );

    if (empresaResult.rows.length === 0) {
      return res.status(404).json({
        error: "Empresa não encontrada.",
      });
    }

    const empresa = empresaResult.rows[0];

    if (!empresa.ativo) {
      return res.status(400).json({
        error:
          "Não é possível criar login para uma empresa desativada.",
      });
    }

    /* =====================================
       VERIFICAR USERNAME
    ===================================== */

    const usuarioExiste = await pool.query(
      `
      SELECT id
      FROM admins
      WHERE username = $1
      LIMIT 1
      `,
      [String(username).trim()]
    );

    if (usuarioExiste.rows.length > 0) {
      return res.status(409).json({
        error: "Este usuário já existe.",
      });
    }

    /* =====================================
       CRIPTOGRAFAR SENHA
    ===================================== */

    const hash = await bcrypt.hash(
      String(password),
      10
    );

    /* =====================================
       CRIAR ADMIN DA EMPRESA
    ===================================== */

    const { rows } = await pool.query(
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
        'admin_empresa',
        $3,
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
        String(username).trim(),
        hash,
        empresa_id,
      ]
    );

    return res.status(201).json({
      ok: true,

      message:
        "Login da empresa criado com sucesso.",

      admin: {
        ...rows[0],

        empresa_nome:
          empresa.nome_fantasia ||
          empresa.nome,
      },
    });
  } catch (err) {
    console.error(
      "Erro ao criar login da empresa:",
      err
    );

    return res.status(500).json({
      error:
        "Erro ao criar login da empresa.",
    });
  }
}

module.exports = {
  login,
  criarPrimeiroSuperAdmin,
  criarAdminEmpresa,
};