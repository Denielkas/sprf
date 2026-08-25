const { Router } = require("express");

const {
  auth,
  somenteRH,
} = require("../middlewares/auth");

const ctrl = require(
  "../controllers/funcionario.controller"
);

const router = Router();

/* =========================================================
   ROTAS DE FUNCIONÁRIOS

   Somente o usuário:

   role = "rh_empresa"

   pode acessar estas rotas.

   O login "ponto_empresa" NÃO pode:
   - listar funcionários
   - visualizar cadastro
   - cadastrar
   - editar
   - inativar
   - excluir imagem facial
========================================================= */


/* =========================================================
   LISTAR FUNCIONÁRIOS

   GET /api/funcionarios
========================================================= */

router.get(
  "/",
  auth,
  somenteRH,
  ctrl.listar
);


/* =========================================================
   VISUALIZAR IMAGEM DO ROSTO

   GET /api/funcionarios/:id/imagem
========================================================= */

router.get(
  "/:id/imagem",
  auth,
  somenteRH,
  ctrl.verImagemRosto
);


/* =========================================================
   EXCLUIR IMAGEM DO ROSTO

   DELETE /api/funcionarios/:id/imagem
========================================================= */

router.delete(
  "/:id/imagem",
  auth,
  somenteRH,
  ctrl.excluirImagemRosto
);


/* =========================================================
   BUSCAR FUNCIONÁRIO POR ID

   GET /api/funcionarios/:id
========================================================= */

router.get(
  "/:id",
  auth,
  somenteRH,
  ctrl.buscarPorId
);


/* =========================================================
   CADASTRAR FUNCIONÁRIO

   POST /api/funcionarios
========================================================= */

router.post(
  "/",
  auth,
  somenteRH,
  ctrl.criar
);


/* =========================================================
   ATUALIZAR FUNCIONÁRIO

   PUT /api/funcionarios/:id
========================================================= */

router.put(
  "/:id",
  auth,
  somenteRH,
  ctrl.atualizar
);


/* =========================================================
   INATIVAR / REATIVAR FUNCIONÁRIO

   PATCH /api/funcionarios/:id/status
========================================================= */

router.patch(
  "/:id/status",
  auth,
  somenteRH,
  ctrl.alterarStatus
);


module.exports = router;