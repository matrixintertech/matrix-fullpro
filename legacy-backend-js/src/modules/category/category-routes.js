const express = require("express");
const {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} = require("./category-controller");
const router = express.Router();

router.post("/create-category", createCategory);
router.get("/get-all-category", getAllCategories);
router.get("/get-category-by-id/:id", getCategoryById);
router.post("/update-category/:id", updateCategory);
router.delete("/delete-category/:id", deleteCategory);

module.exports = router;
