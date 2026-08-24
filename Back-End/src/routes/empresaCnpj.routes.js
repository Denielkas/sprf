const express = require("express");

const router = express.Router();

const ctrl = require(
  "../controllers/empresaCnpj.controller"
);

const {
  auth,
} = require(
  "../middlewares/auth"
);

/* =========================================================
   ROTAS DOS CNPJS DAS EMPRESAS
========================================================= */

/*
  ADMIN_EMPRESA

  A empresa vem automaticamente do JWT.

  GET:
  /api/empresa-cnpjs

  POST:
  /api/empresa-cnpjs


  SUPER_ADMIN

  Informa qual empresa deseja administrar.

  GET:
  /api/empresa-cnpjs?empresa_id=1

  POST:
  /api/empresa-cnpjs

  Body:
  {
    "empresa_id": 1,
    ...
  }
*/


/* =========================================================
   LISTAR
========================================================= */

router.get(
  "/",
  auth,
  ctrl.listar
);


/* =========================================================
   CADASTRAR
========================================================= */

router.post(
  "/",
  auth,
  ctrl.criar
);


/* =========================================================
   ALTERAR
========================================================= */

router.put(
  "/:id",
  auth,
  ctrl.atualizar
);


/* =========================================================
   DEFINIR COMO PRINCIPAL
========================================================= */

router.patch(
  "/:id/principal",
  auth,
  ctrl.definirPrincipal
);


/* =========================================================
   EXCLUIR
========================================================= */

router.delete(
  "/:id",
  auth,
  ctrl.excluir
);


module.exports = router;