const express = require("express");

const router = express.Router();

const {
  login,
  criarPrimeiroSuperAdmin,
  criarAdminEmpresa,
} = require("../controllers/auth.controller");

const {
  auth,
  somenteSuperAdmin,
} = require("../middlewares/auth");

/* =========================================================
   LOGIN

   POST /api/auth/login

   Pode logar:
   - super_admin
   - rh_empresa
   - ponto_empresa
========================================================= */

router.post(
  "/login",
  login
);

/* =========================================================
   CRIAR PRIMEIRO SUPER ADMIN

   POST /api/auth/primeiro-super-admin

   Esta rota somente consegue criar o primeiro Super Admin.
========================================================= */

router.post(
  "/primeiro-super-admin",
  criarPrimeiroSuperAdmin
);

/* =========================================================
   SUPER ADMIN CRIA ACESSO DE EMPRESA

   POST /api/auth/admin-empresa

   SOMENTE SUPER ADMIN.

   ACESSO RH:

   {
     "username": "sanmarinho.rh",
     "password": "123456",
     "empresa_id": 1,
     "role": "rh_empresa"
   }

   ACESSO PONTO:

   {
     "username": "sanmarinho",
     "password": "123456",
     "empresa_id": 1,
     "role": "ponto_empresa"
   }

========================================================= */

router.post(
  "/admin-empresa",
  auth,
  somenteSuperAdmin,
  criarAdminEmpresa
);

module.exports = router;