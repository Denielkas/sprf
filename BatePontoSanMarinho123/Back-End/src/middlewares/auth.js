const jwt = require("jsonwebtoken");

/* =========================================================
   ROLES DO SISTEMA
========================================================= */

const ROLES = {
  SUPER_ADMIN: "super_admin",
  RH_EMPRESA: "rh_empresa",
  PONTO_EMPRESA: "ponto_empresa",
};

/* =========================================================
   AUTENTICAÇÃO

   Verifica o JWT e coloca os dados do usuário em:

   req.user
========================================================= */

function auth(req, res, next) {
  const header =
    req.headers.authorization || "";

  const token =
    header.startsWith("Bearer ")
      ? header.slice(7)
      : null;

  /* =======================================================
     TOKEN NÃO INFORMADO
  ======================================================= */

  if (!token) {
    return res.status(401).json({
      error: "Token não informado.",
    });
  }

  /* =======================================================
     JWT_SECRET
  ======================================================= */

  if (!process.env.JWT_SECRET) {
    console.error(
      "JWT_SECRET não configurado."
    );

    return res.status(500).json({
      error:
        "Configuração de autenticação inválida.",
    });
  }

  try {
    /* =====================================================
       VERIFICAR TOKEN
    ===================================================== */

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    /* =====================================================
       VALIDAR PAYLOAD
    ===================================================== */

    if (
      !payload.sub ||
      !payload.role
    ) {
      return res.status(401).json({
        error: "Token inválido.",
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
        payload.role
      )
    ) {
      return res.status(403).json({
        error:
          "Tipo de usuário não autorizado.",
      });
    }

    /* =====================================================
       USUÁRIOS DE EMPRESA PRECISAM TER EMPRESA_ID
    ===================================================== */

    if (
      payload.role !==
        ROLES.SUPER_ADMIN &&
      !payload.empresa_id
    ) {
      return res.status(403).json({
        error:
          "Usuário não vinculado a uma empresa.",
      });
    }

    /* =====================================================
       DADOS DO USUÁRIO
    ===================================================== */

    req.user = {
      id:
        payload.sub,

      username:
        payload.username,

      role:
        payload.role,

      empresa_id:
        payload.role ===
        ROLES.SUPER_ADMIN
          ? null
          : payload.empresa_id,
    };

    return next();
  } catch (err) {
    /* =====================================================
       TOKEN EXPIRADO
    ===================================================== */

    if (
      err.name ===
      "TokenExpiredError"
    ) {
      return res.status(401).json({
        error:
          "Sessão expirada. Faça login novamente.",
      });
    }

    /* =====================================================
       TOKEN INVÁLIDO
    ===================================================== */

    return res.status(401).json({
      error:
        "Token inválido ou expirado.",
    });
  }
}

/* =========================================================
   SOMENTE SUPER ADMIN

   Exemplo:

   /empresas
   /criar login RH
   /criar login ponto
   /configuração das empresas
========================================================= */

function somenteSuperAdmin(
  req,
  res,
  next
) {
  if (!req.user) {
    return res.status(401).json({
      error:
        "Usuário não autenticado.",
    });
  }

  if (
    req.user.role !==
    ROLES.SUPER_ADMIN
  ) {
    return res.status(403).json({
      error:
        "Acesso permitido somente ao Super Admin.",
    });
  }

  return next();
}

/* =========================================================
   SOMENTE RH

   Utilizar nas rotas administrativas da empresa:

   - funcionários
   - relatório
   - atestado
   - banco de horas
   - ponto manual
   - funções
========================================================= */

function somenteRH(
  req,
  res,
  next
) {
  if (!req.user) {
    return res.status(401).json({
      error:
        "Usuário não autenticado.",
    });
  }

  if (
    req.user.role !==
    ROLES.RH_EMPRESA
  ) {
    return res.status(403).json({
      error:
        "Acesso permitido somente ao RH da empresa.",
    });
  }

  if (!req.user.empresa_id) {
    return res.status(403).json({
      error:
        "Usuário do RH não está vinculado a uma empresa.",
    });
  }

  return next();
}

/* =========================================================
   SOMENTE PONTO

   Para rotas exclusivas da tela operacional de ponto.
========================================================= */

function somentePonto(
  req,
  res,
  next
) {
  if (!req.user) {
    return res.status(401).json({
      error:
        "Usuário não autenticado.",
    });
  }

  if (
    req.user.role !==
    ROLES.PONTO_EMPRESA
  ) {
    return res.status(403).json({
      error:
        "Acesso permitido somente ao terminal de ponto.",
    });
  }

  if (!req.user.empresa_id) {
    return res.status(403).json({
      error:
        "Terminal de ponto não está vinculado a uma empresa.",
    });
  }

  return next();
}

/* =========================================================
   SUPER ADMIN OU RH

   Existem situações em que queremos permitir:

   SUPER ADMIN
        OU
   RH DA EMPRESA

   mas nunca o login de ponto.
========================================================= */

function superAdminOuRH(
  req,
  res,
  next
) {
  if (!req.user) {
    return res.status(401).json({
      error:
        "Usuário não autenticado.",
    });
  }

  const permitido =
    req.user.role ===
      ROLES.SUPER_ADMIN ||
    req.user.role ===
      ROLES.RH_EMPRESA;

  if (!permitido) {
    return res.status(403).json({
      error:
        "Você não possui permissão para acessar esta área.",
    });
  }

  return next();
}

/* =========================================================
   RH OU PONTO

   Útil somente nas rotas que realmente precisam funcionar
   tanto no painel RH quanto no terminal de ponto.

   IMPORTANTE:
   isso NÃO libera o Super Admin.
========================================================= */

function rhOuPonto(
  req,
  res,
  next
) {
  if (!req.user) {
    return res.status(401).json({
      error:
        "Usuário não autenticado.",
    });
  }

  const permitido =
    req.user.role ===
      ROLES.RH_EMPRESA ||
    req.user.role ===
      ROLES.PONTO_EMPRESA;

  if (!permitido) {
    return res.status(403).json({
      error:
        "Acesso não permitido para este usuário.",
    });
  }

  if (!req.user.empresa_id) {
    return res.status(403).json({
      error:
        "Usuário não vinculado a uma empresa.",
    });
  }

  return next();
}

/* =========================================================
   QUALQUER USUÁRIO DE EMPRESA

   Bloqueia Super Admin e permite:

   RH
   PONTO
========================================================= */

function somenteUsuarioEmpresa(
  req,
  res,
  next
) {
  if (!req.user) {
    return res.status(401).json({
      error:
        "Usuário não autenticado.",
    });
  }

  if (
    req.user.role ===
    ROLES.SUPER_ADMIN
  ) {
    return res.status(403).json({
      error:
        "Esta operação deve ser realizada por um usuário da empresa.",
    });
  }

  if (!req.user.empresa_id) {
    return res.status(403).json({
      error:
        "Usuário não vinculado a uma empresa.",
    });
  }

  return next();
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  auth,

  somenteSuperAdmin,

  somenteRH,

  somentePonto,

  superAdminOuRH,

  rhOuPonto,

  somenteUsuarioEmpresa,

  ROLES,
};