const express = require("express");
const usersRouter = require("./routes/users");

const app = express();

app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/api/users", usersRouter);

app.listen(3000);
