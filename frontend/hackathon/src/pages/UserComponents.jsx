import { useState } from "react"
import { ShoppingCart, Package, X, Upload } from "lucide-react"
import { api } from "../api"

export function ProductCard({ product, onOrder }) {
  return (
    <div className="bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-2 overflow-hidden border border-gray-100">
      <div className="h-48 bg-gradient-to-br from-green-100 to-emerald-200 flex items-center justify-center">
        <Package size={64} className="text-green-600" />
      </div>
      <div className="p-6">
        <h3 className="text-xl font-black text-gray-800 mb-2">{product.name}</h3>
        <p className="text-sm text-gray-600 mb-4">{product.category}</p>
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-2xl font-black text-green-700">₹{product.price}</p>
            <p className="text-xs text-gray-500">per {product.unit}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-700">Stock: {product.quantity}</p>
            <p className="text-xs text-gray-500">{product.unit}s available</p>
          </div>
        </div>
        <button
          onClick={() => onOrder(product)}
          disabled={product.quantity === 0}
          className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
            product.quantity > 0
              ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          <ShoppingCart size={18} />
          {product.quantity > 0 ? 'Order Now' : 'Out of Stock'}
        </button>
      </div>
    </div>
  )
}

export function OrderItem({ order }) {
  const statusColors = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    SHIPPED: 'bg-purple-100 text-purple-800',
    DELIVERED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800'
  }

  return (
    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
      <div className="flex-1">
        <p className="font-bold text-gray-800">{order.productName}</p>
        <p className="text-sm text-gray-600">
          Qty: {order.quantity} × ₹{order.price} = ₹{order.totalAmount}
        </p>
        <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString()}</p>
      </div>
      <span className={`px-4 py-2 rounded-full text-xs font-bold ${statusColors[order.status]}`}>
        {order.status}
      </span>
    </div>
  )
}

export function OrderModal({ product, onClose, onSuccess }) {
  const [quantity, setQuantity] = useState(1)
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)

  const total = product.price * quantity

  const handleSubmit = async () => {
    if (!address || !phone) {
      alert("Please fill in all fields")
      return
    }

    setLoading(true)
    try {
      await api("/inventory/order", "POST", {
        productId: product._id,
        quantity,
        deliveryAddress: address,
        phoneNumber: phone
      })
      alert("Order placed successfully!")
      onSuccess()
      onClose()
    } catch (err) {
      alert("Failed to place order")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>

        <h2 className="text-3xl font-black mb-6 text-gray-800">Place Order</h2>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-2xl mb-6 border-2 border-green-200">
          <h3 className="text-xl font-bold text-gray-800 mb-2">{product.name}</h3>
          <p className="text-gray-600 mb-4">{product.category}</p>
          <div className="flex justify-between items-center">
            <span className="text-2xl font-black text-green-700">₹{product.price}/{product.unit}</span>
            <span className="text-sm text-gray-600">Stock: {product.quantity}</span>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Quantity</label>
            <input
              type="number"
              min="1"
              max={product.quantity}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(product.quantity, parseInt(e.target.value) || 1)))}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter your phone number"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Delivery Address</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter complete delivery address"
              rows="3"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all"
            />
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-xl mb-6">
          <div className="flex justify-between items-center text-lg">
            <span className="font-semibold text-gray-700">Total Amount:</span>
            <span className="font-black text-2xl text-green-700">₹{total.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-bold transition-all shadow-lg disabled:opacity-50"
          >
            {loading ? "Processing..." : "Confirm Order"}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Input({ label, value, onChange, type = "text", required = false, placeholder = "" }) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
      />
    </div>
  )
}

export function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  )
}

export function Textarea({ label, value, onChange, rows = 4 }) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
      />
    </div>
  )
}

export function FileUpload({ label, onChange, accept, multiple = false }) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
      <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-indigo-500 cursor-pointer transition-all">
        <Upload size={20} className="text-gray-400" />
        <span className="text-sm text-gray-600">Click to upload {multiple ? 'photos' : 'photo'}</span>
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={e => onChange(Array.from(e.target.files))}
          className="hidden"
        />
      </label>
    </div>
  )
}