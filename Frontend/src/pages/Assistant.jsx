import React from 'react';

export default function Assistant({ catalog = [], cart = [], addToCart = () => {}, clearCart = () => {}, checkoutCart = () => {}, placeDirectPurchase = () => {}, refreshAllData = () => {} }) {
  return (
    <div style={{ padding: 20 }}>
      <h3>AI Retail Assistant</h3>
      <p>This is a lightweight placeholder for the Assistant page.</p>

      <section>
        <h4>Catalog</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {catalog.length === 0 ? (
            <div>No catalog items available.</div>
          ) : (
            catalog.map(item => (
              <div key={item.id} style={{ border: '1px solid #ddd', padding: 8, borderRadius: 6 }}>
                <div style={{ fontWeight: 600 }}>{item.name || item.title}</div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>{item.description || ''}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button onClick={() => addToCart(item, 1)} className="btn">Add</button>
                  <button onClick={() => placeDirectPurchase(item, 1)} className="btn btn-secondary">Buy 1</button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section style={{ marginTop: 18 }}>
        <h4>Cart</h4>
        {cart.length === 0 ? (
          <div>No items in cart.</div>
        ) : (
          <div>
            <ul>
              {cart.map((c, idx) => (
                <li key={idx}>{c.product?.name || c.product?.title} x {c.quantity}</li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={checkoutCart} className="btn">Checkout</button>
              <button onClick={clearCart} className="btn btn-secondary">Clear</button>
            </div>
          </div>
        )}
      </section>

      <div style={{ marginTop: 18 }}>
        <button onClick={refreshAllData} className="btn">Refresh Data</button>
      </div>
    </div>
  );
}
