// frontend/src/pages/Inventory.jsx
import { useEffect, useState } from "react"
import { api } from "../api"

export default function Inventory() {
  const [products, setProducts] = useState([])

  useEffect(() => {
    api("/inventory").then(setProducts)
  }, [])

  async function buy(id) {
    await api("/inventory/order", "POST", {
      productId: id,
      quantity: 1,
      type: "B2C"
    })
    alert("Order placed")
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
      <h3 className="text-lg font-bold mb-4">Product Catalog</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        {products.map(p => (
          <div key={p._id} className="p-4 border rounded-xl hover:border-green-500 transition">
            <p className="font-bold text-gray-800">{p.name}</p>
            <p className="text-green-600 font-semibold">₹{p.price}</p>
            <button 
              onClick={() => buy(p._id)}
              className="mt-3 w-full bg-green-100 text-green-700 py-1 rounded-md text-sm font-bold hover:bg-green-600 hover:text-white transition"
            >
              Buy Now
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}