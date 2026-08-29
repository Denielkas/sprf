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
   - visualizar imagens faciais
   - excluir imagens faciais
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
   LISTAR TODAS AS IMAGENS FACIAIS DO FUNCIONÁRIO

   GET /api/funcionarios/:id/imagens

   Exemplo:

   GET /api/funcionarios/2/imagens

   Retorna:

   {
     "ok": true,
     "quantidade": 3,
     "imagens": [
       {
         "id": 10,
         "funcionario_id": 2,
         "foto_mime": "image/jpeg",
         "tamanho_bytes": 150000,
         "created_at": "..."
       },
       {
         "id": 11,
         "funcionario_id": 2,
         "foto_mime": "image/jpeg",
         "tamanho_bytes": 160000,
         "created_at": "..."
       }
     ]
   }
========================================================= */

router.get(
  "/:id/imagens",
  auth,
  somenteRH,
  ctrl.listarImagensRosto
);


/* =========================================================
   VISUALIZAR UMA IMAGEM FACIAL ESPECÍFICA

   GET /api/funcionarios/:id/rostos/:fotoId

   Exemplo:

   GET /api/funcionarios/2/rostos/10

   Retorna diretamente:

   image/jpeg
========================================================= */

router.get(
  "/:id/rostos/:fotoId",
  auth,
  somenteRH,
  ctrl.verImagemRosto
);


/* =========================================================
   EXCLUIR UMA IMAGEM FACIAL ESPECÍFICA

   DELETE /api/funcionarios/:id/rostos/:fotoId

   Exemplo:

   DELETE /api/funcionarios/2/rostos/10

   IMPORTANTE:

   Apaga somente a foto escolhida.

   As outras fotos do funcionário continuam cadastradas.
========================================================= */

router.delete(
  "/:id/rostos/:fotoId",
  auth,
  somenteRH,
  ctrl.excluirUmaImagemRosto
);


/* =========================================================
   EXCLUIR TODO O CADASTRO FACIAL

   DELETE /api/funcionarios/:id/imagem

   IMPORTANTE:

   Essa rota continua existindo.

   Ela apaga TODAS as imagens e TODOS os embeddings
   cadastrados para o funcionário.

   Exemplo:

   funcionário 2 possui:

   foto 10
   foto 11
   foto 12

   DELETE /api/funcionarios/2/imagem

   apaga as três.
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

   IMPORTANTE:

   Esta rota fica DEPOIS das rotas específicas como:

   /:id/imagens
   /:id/rostos/:fotoId

   para evitar conflitos.
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