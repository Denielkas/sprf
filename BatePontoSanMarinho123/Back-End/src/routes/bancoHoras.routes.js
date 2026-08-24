const { Router } = require("express");

const ctrl = require("../controllers/bancoHoras.controller");
const { auth } = require("../middlewares/auth");

const router = Router();

/* =========================================
   BANCO DE HORAS
   TODAS AS ROTAS EXIGEM LOGIN
========================================= */

/*
  ADMIN_EMPRESA:
  - empresa será obtida pelo token.

  SUPER_ADMIN:
  - deverá informar ?empresa_id=X
*/

/* Listar banco de horas */
router.get(
  "/",
  auth,
  ctrl.listarBancoHoras
);

/* Gerar PDF */
router.get(
  "/pdf",
  auth,
  ctrl.gerarPdfBancoHoras
);

/* Gerar Excel */
router.get(
  "/excel",
  auth,
  ctrl.gerarExcelBancoHoras
);

/* Salvar/alterar ajuste */
router.post(
  "/ajuste",
  auth,
  ctrl.salvarAjusteBancoHoras
);

module.exports = router;