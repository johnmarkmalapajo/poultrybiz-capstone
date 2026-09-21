const express = require("express");
const router = express.Router();

const {
  getPersonalTodos,
  getAllPersonalTodos,
  createPersonalTodo,
  updatePersonalTodo,
  deletePersonalTodo,
  archivePersonalTodo,
  restorePersonalTodo,
} = require("../controllers/personalTodoController");

const { protect, ownerOnly } = require("../middleware/authMiddleware");

router.get("/", protect, getPersonalTodos);

router.get("/all", protect, ownerOnly, getAllPersonalTodos);

router.post("/", protect, createPersonalTodo);

router.put("/:id", protect, updatePersonalTodo);

router.delete("/:id", protect, deletePersonalTodo);

router.put("/:id/archive", protect, archivePersonalTodo);

router.put("/:id/restore", protect, restorePersonalTodo);

module.exports = router;