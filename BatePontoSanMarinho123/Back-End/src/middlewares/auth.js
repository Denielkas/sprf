const jwt = require("jsonwebtoken");

function auth(req, res, next) {
  const header = req.headers.authorization || "";

  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      error: "Token não informado.",
    });
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
      empresa_id: payload.empresa_id || null,
    };

    return next();
  } catch (err) {
    return res.status(401).json({
      error: "Token inválido ou expirado.",
    });
  }
}


/* =========================================
   SOMENTE SUPER ADMIN
========================================= */

function somenteSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: "Usuário não autenticado.",
    });
  }

  if (req.user.role !== "super_admin") {
    return res.status(403).json({
      error: "Acesso permitido somente ao Super Admin.",
    });
  }

  return next();
}


module.exports = {
  auth,
  somenteSuperAdmin,
};