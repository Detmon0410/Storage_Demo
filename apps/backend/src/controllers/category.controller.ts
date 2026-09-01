import { CategoryModel } from "../models/category.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listCategories = asyncHandler(async (_req, res) => {
  res.json(await CategoryModel.findAll());
});

export const getCategory = asyncHandler(async (req, res) => {
  const category = await CategoryModel.findById(Number(req.params.id));
  if (!category) throw new HttpError(404, "Category not found");
  res.json(category);
});

export const createCategory = asyncHandler(async (req, res) => {
  const { categoryCode, categoryName, description, isActive } = req.body;
  if (!categoryCode || !categoryName) {
    throw new HttpError(400, "categoryCode and categoryName are required");
  }
  res.status(201).json(await CategoryModel.create({ categoryCode, categoryName, description, isActive }));
});

export const updateCategory = asyncHandler(async (req, res) => {
  const { categoryCode, categoryName, description, isActive } = req.body;
  res.json(
    await CategoryModel.update(Number(req.params.id), { categoryCode, categoryName, description, isActive }),
  );
});

export const deleteCategory = asyncHandler(async (req, res) => {
  await CategoryModel.delete(Number(req.params.id));
  res.status(204).end();
});
