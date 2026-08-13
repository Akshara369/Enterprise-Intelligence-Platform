import mongoose from 'mongoose';

const stockHistorySchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  TECH: { type: Number, required: true },
  RETL: { type: Number, required: true },
  techVolume: { type: Number, required: true },
  retailVolume: { type: Number, required: true }
}, { timestamps: true });

export default mongoose.model('StockHistory', stockHistorySchema);
