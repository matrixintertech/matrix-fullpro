const express = require("express");
const {
  createBranch,
  getAllBranches,
  getBranchById,
  updateBranch,
  deleteBranch,
} = require("./branch-controller");
const router = express.Router();

router.post("/create-branch", createBranch);
router.get("/get-all-branch", getAllBranches);
router.get("/get-branch-by-id/:id", getBranchById);
router.post("/update-branch/:id", updateBranch);
router.delete("/delete-branch/:id", deleteBranch);

module.exports = router;
