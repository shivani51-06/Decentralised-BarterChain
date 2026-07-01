const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const auth = require("../middleware/auth");

// POST /api/products — create a listing
router.post("/", auth, async (req, res) => {
  try {
    const { title, description, images, estimatedValue } = req.body;
    if (!title || !description || estimatedValue === undefined) {
      return res.status(400).json({ error: "title, description and estimatedValue are required" });
    }

    const product = await Product.create({
      title,
      description,
      images: images || [],
      estimatedValue,
      owner: req.walletAddress,
    });

    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/products — list all available products
router.get("/", async (req, res) => {
  try {
    const filter = { isAvailable: true };
    // Optional: filter by owner
    if (req.query.owner) {
      filter.owner = req.query.owner.toLowerCase();
    }
    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/products/:id — single product
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
