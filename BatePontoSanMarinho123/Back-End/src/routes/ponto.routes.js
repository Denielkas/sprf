const express = require("express");

const router = express.Router();

const pontoController = require(
  "../controllers/ponto.controller"
);

const {
  auth,
  somenteRH,
  somentePonto,
} = require("../middlewares/auth");

/* =========================================================
   ROTAS DO TERMINAL DE PONTO

   Somente:

   role = "ponto_empresa"

   O empresa_id NÃO deve ser escolhido pelo usuário.
   Ele vem do token:

   req.user.empresa_id
========================================================= */


/* =========================================================
   STATUS DAS BATIDAS

   GET /api/ponto/status-batidas/:funcionario_id
========================================================= */

router.get(
  "/status-batidas/:funcionario_id",
  auth,
  somentePonto,
  pontoController.statusBatidas
);


/* =========================================================
   STATUS DAS BATIDAS

   Rota antiga mantida por compatibilidade.

   GET /api/ponto/status/:funcionario_id
========================================================= */

router.get(
  "/status/:funcionario_id",
  auth,
  somentePonto,
  pontoController.statusBatidas
);


/* =========================================================
   BATER PONTO AUTOMATICAMENTE

   POST /api/ponto/auto
========================================================= */

router.post(
  "/auto",
  auth,
  somentePonto,
  pontoController.auto
);


/* =========================================================
   BATER PONTO PELOS BOTÕES

   POST /api/ponto/bater
========================================================= */

router.post(
  "/bater",
  auth,
  somentePonto,
  pontoController.bater
);


/* =========================================================
   BUSCAR FUNCIONÁRIO PELO CPF

   GET /api/ponto/cpf/:cpf

   Utilizada no terminal de ponto.
========================================================= */

router.get(
  "/cpf/:cpf",
  auth,
  somentePonto,
  pontoController.buscarPorCPF
);


/* =========================================================
   ROTAS ADMINISTRATIVAS DO RH

   Somente:

   role = "rh_empresa"
========================================================= */


/* =========================================================
   INSERIR PONTO MANUAL

   POST /api/ponto/manual
========================================================= */

router.post(
  "/manual",
  auth,
  somenteRH,
  pontoController.inserirManual
);


/* =========================================================
   AJUSTAR PONTO PELO RELATÓRIO

   PUT /api/ponto/ajustar
========================================================= */

router.put(
  "/ajustar",
  auth,
  somenteRH,
  pontoController.ajustar
);


/* =========================================================
   LIMPAR BATIDAS DO DIA

   DELETE /api/ponto/limpar-dia
========================================================= */

router.delete(
  "/limpar-dia",
  auth,
  somenteRH,
  pontoController.limparBatidasDoDia
);


/* =========================================================
   LANÇAR HORÁRIO PADRÃO DO MÊS

   POST /api/ponto/lancar-padrao-mes
========================================================= */

router.post(
  "/lancar-padrao-mes",
  auth,
  somenteRH,
  pontoController.lancarHorarioPadraoMes
);


module.exports = router;