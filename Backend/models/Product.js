import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  inventory: { type: Number, required: true },
  rating: { type: Number, required: true }
}, { timestamps: true });

export default mongoose.model('Product', productSchema);
