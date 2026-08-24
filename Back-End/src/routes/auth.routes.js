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


/* =========================================
   LOGIN
========================================= */

router.post(
  "/login",
  login
);


/* =========================================
   CRIAR PRIMEIRO SUPER ADMIN

   Só funciona uma vez.
========================================= */

router.post(
  "/primeiro-super-admin",
  criarPrimeiroSuperAdmin
);


/* =========================================
   SUPER ADMIN CRIA LOGIN DE EMPRESA
========================================= */

router.post(
  "/admin-empresa",
  auth,
  somenteSuperAdmin,
  criarAdminEmpresa
);


module.exports = router;