const {
  sendSuccessResponse,
  sendFailedResponse,
} = require("../../utils/response");
const { CategoryModal } = require("./category-modal");

const createCategory = async (req, res) => {
  try {
    const newCategory = await CategoryModal.create(req?.body);
    sendSuccessResponse(res, {
      message: "Category created successfully",
      category: newCategory,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error Creating Category", error: error.message });
  }
};

const getAllCategories = async (req, res) => {
  try {
    const query = req?.query;
    const categories = await CategoryModal.find(query).sort({ createdAt: -1 });;
    sendSuccessResponse(res, {
      data: categories,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error fetching categories"  , error: error.message});
  }
};

const getCategoryById = async (req, res) => {
  try {
    const category = await CategoryModal.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    return res.status(200).json(category);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching category" , error: error.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const updatedCategory = await CategoryModal.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true }
    );
    if (!updatedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }
    return res.status(200).json({
      message: "Category updated successfully",
      category: updatedCategory,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error updating category", error: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const deletedCategory = await CategoryModal.findByIdAndDelete(
      req.params.id
    );
    if (!deletedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }
    return res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Error deleting Category", error: error.message });
  }
};

module.exports = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
