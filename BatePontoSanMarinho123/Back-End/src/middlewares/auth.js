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
  const header = req.headers.authorization || "";

  const token = header.startsWith("Bearer ")
    ? header.slice(7).trim()
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
    console.error("JWT_SECRET não configurado.");

    return res.status(500).json({
      error: "Configuração de autenticação inválida.",
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

    console.log("========================================");
    console.log("🔐 JWT DECODIFICADO:");
    console.log(payload);
    console.log("========================================");

    /* =====================================================
       VALIDAR PAYLOAD
    ===================================================== */

    if (!payload.sub || !payload.role) {
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

    if (!rolesPermitidas.includes(payload.role)) {
      return res.status(403).json({
        error: "Tipo de usuário não autorizado.",
      });
    }

    /* =====================================================
       EMPRESA ID
    ===================================================== */

    let empresaId = null;

    if (
      payload.empresa_id !== undefined &&
      payload.empresa_id !== null &&
      payload.empresa_id !== ""
    ) {
      const convertido = Number(payload.empresa_id);

      if (
        Number.isInteger(convertido) &&
        convertido > 0
      ) {
        empresaId = convertido;
      }
    }

    /* =====================================================
       RH E PONTO PRECISAM OBRIGATORIAMENTE DE EMPRESA
    ===================================================== */

    if (
      payload.role !== ROLES.SUPER_ADMIN &&
      !empresaId
    ) {
      console.error(
        "❌ Usuário sem empresa_id:",
        payload
      );

      return res.status(403).json({
        error:
          "Usuário não vinculado a uma empresa.",
      });
    }

    /* =====================================================
       DADOS DO USUÁRIO
    ===================================================== */

    req.user = {
      id: Number(payload.sub),

      username:
        payload.username || null,

      role:
        payload.role,

      empresa_id:
        empresaId,
    };

    console.log("👤 REQ.USER:");
    console.log(req.user);

    return next();

  } catch (err) {
    console.error(
      "❌ ERRO AO VALIDAR TOKEN:",
      err.message
    );

    /* =====================================================
       TOKEN EXPIRADO
    ===================================================== */

    if (err.name === "TokenExpiredError") {
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
========================================================= */

function somenteSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: "Usuário não autenticado.",
    });
  }

  if (
    req.user.role !== ROLES.SUPER_ADMIN
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
========================================================= */

function somenteRH(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: "Usuário não autenticado.",
    });
  }

  if (
    req.user.role !== ROLES.RH_EMPRESA
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
========================================================= */

function somentePonto(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: "Usuário não autenticado.",
    });
  }

  if (
    req.user.role !== ROLES.PONTO_EMPRESA
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
========================================================= */

function superAdminOuRH(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: "Usuário não autenticado.",
    });
  }

  const permitido =
    req.user.role === ROLES.SUPER_ADMIN ||
    req.user.role === ROLES.RH_EMPRESA;

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
========================================================= */

function rhOuPonto(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: "Usuário não autenticado.",
    });
  }

  const permitido =
    req.user.role === ROLES.RH_EMPRESA ||
    req.user.role === ROLES.PONTO_EMPRESA;

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
========================================================= */

function somenteUsuarioEmpresa(
  req,
  res,
  next
) {
  if (!req.user) {
    return res.status(401).json({
      error: "Usuário não autenticado.",
    });
  }

  if (
    req.user.role === ROLES.SUPER_ADMIN
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