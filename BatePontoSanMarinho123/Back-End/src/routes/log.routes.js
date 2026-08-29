const express =
  require("express");

const router =
  express.Router();


const {
  listarLogs,
  listarTiposLog,
} = require(
  "../controllers/log.controller"
);


const {
  auth,
  somenteSuperAdmin,
} = require(
  "../middlewares/auth"
);


/* =========================================================
   TODAS AS ROTAS DE LOG

   SOMENTE SUPER ADMIN
========================================================= */

router.use(
  auth,
  somenteSuperAdmin
);


/* =========================================================
   LISTAR
========================================================= */

router.get(
  "/",
  listarLogs
);


/* =========================================================
   TIPOS
========================================================= */

router.get(
  "/tipos",
  listarTiposLog
);


module.exports =
  router;