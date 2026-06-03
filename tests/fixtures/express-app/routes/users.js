const express = require("express");

const router = express.Router();

router.get("/", (req, res) => res.json([]));
router.post("/", (req, res) => res.json({}));
router.get("/:id", (req, res) => res.json({ id: req.params.id }));

module.exports = router;
