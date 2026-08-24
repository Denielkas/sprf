const { Router } = require("express");

const ctrl =
  require("../controllers/funcao.controller");

const {
  auth,
} = require("../middlewares/auth");

const router = Router();


/* =========================================
   LISTAR FUNÇÕES
========================================= */

router.get(
  "/",
  auth,
  ctrl.listar
);


/* =========================================
   BUSCAR UMA FUNÇÃO
========================================= */

router.get(
  "/:id",
  auth,
  ctrl.buscarPorId
);


/* =========================================
   CADASTRAR FUNÇÃO
========================================= */

router.post(
  "/",
  auth,
  ctrl.criar
);


/* =========================================
   ALTERAR FUNÇÃO
========================================= */

router.put(
  "/:id",
  auth,
  ctrl.alterar
);


/* =========================================
   EXCLUIR FUNÇÃO
========================================= */

router.delete(
  "/:id",
  auth,
  ctrl.excluir
);


module.exports = router;