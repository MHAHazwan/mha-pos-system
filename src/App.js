import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  // eslint-disable-next-line
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  serverTimestamp,
  runTransaction,
  getDoc,
  // eslint-disable-next-line
  getDocs,  query,  where
} from 'firebase/firestore';

// --- START LOCAL DEVELOPMENT FIXES ---
// These variables are provided by the Canvas environment.
// For local development, we need to define them if they don't exist.
// If you connect your own Firebase project, you would replace these with your actual config.
if (typeof __app_id === 'undefined') {
  window.__app_id = 'local-dev-app-id'; // A dummy ID for local testing
}
if (typeof __firebase_config === 'undefined') {
  window.__firebase_config = JSON.stringify({
    apiKey: "AIzaSyCGMkBzCi7gSYVYL9ZAUmhFjutghkMfd3w", // Replaced with your actual Firebase API Key
    authDomain: "mha-pos-system.firebaseapp.com", // Replaced with your actual Auth Domain
    projectId: "mha-pos-system", // Replaced with your actual Project ID
    storageBucket: "mha-pos-system.firebasestorage.app", // Replaced with your actual Storage Bucket
    messagingSenderId: "839836614917", // Replaced with your actual App ID
    appId: "1:839836614917:web:a4c370daf0346afcc0f76c", // Replaced with your actual App ID
    measurementId: "G-40NN9GPDRK" // Added your Measurement ID
  });
}
// --- END LOCAL DEVELOPMENT FIXES ---

// === FIX: Moved components outside the App function to prevent re-renders and loss of focus ===

const Loader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-100 font-[Inter]">
    <div className="flex flex-col items-center p-8 bg-white rounded-xl shadow-lg">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      <p className="mt-4 text-gray-600">Loading...</p>
    </div>
  </div>
);

const AuthForm = ({
  email,
  setEmail,
  password,
  setPassword,
  handleAuthAction,
  handlePasswordReset,
  showForgotPassword,
  setShowForgotPassword,
  errorMessage,
  successMessage,
}) => (
  <div className="flex items-center justify-center min-h-screen bg-gray-100 font-[Inter]">
    <div className="p-8 bg-white rounded-xl shadow-lg w-full max-w-md">
      <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
        {showForgotPassword ? "Reset Password" : "Login"}
      </h2>
      {errorMessage && (
        <div className="text-red-500 text-center mb-4 p-2 bg-red-100 rounded-lg">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="text-green-500 text-center mb-4 p-2 bg-green-100 rounded-lg">
          {successMessage}
        </div>
      )}
      <div className="space-y-4">
        <div>
          <label className="label-field" htmlFor="email">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
            required
          />
        </div>
        {!showForgotPassword && (
          <div>
            <label className="label-field" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              required
            />
          </div>
        )}
        <button
          onClick={
            showForgotPassword ? handlePasswordReset : handleAuthAction
          }
          className="w-full btn-primary"
        >
          {showForgotPassword ? "Send Reset Email" : "Login"}
        </button>
      </div>
      <div className="mt-6 text-center">
        <button
          onClick={() => setShowForgotPassword(!showForgotPassword)}
          className="text-blue-600 hover:text-blue-800 transition-colors duration-200"
        >
          {showForgotPassword ? "Back to Login" : "Forgot Password?"}
        </button>
      </div>
    </div>
  </div>
);

// --- MODAL COMPONENTS (MOVED OUTSIDE ADMINPANEL) ---
const AddProductModal = ({
  newProductName,
  setNewProductName,
  newProductPrice,
  setNewProductPrice,
  newProductStock,
  setNewProductStock,
  newProductBatchNumber,
  setNewProductBatchNumber,
  newProductStatus,
  setNewProductStatus,
  setShowAddProductModal,
  handleAddNewProduct,
}) => (
  <div className="modal-overlay">
    <div className="modal-content">
      <h3 className="text-xl font-bold mb-4">Add New Product</h3>
      <div className="space-y-4">
        <input
          type="text"
          value={newProductName}
          onChange={(e) => setNewProductName(e.target.value)}
          placeholder="Product Name"
          className="input-field"
          required
        />
        <input
          type="number"
          value={newProductPrice}
          onChange={(e) => setNewProductPrice(e.target.value)}
          placeholder="Price"
          className="input-field"
          required
        />
        <input
          type="number"
          value={newProductStock}
          onChange={(e) => setNewProductStock(e.target.value)}
          placeholder="Stock"
          className="input-field"
          required
        />
        <input
          type="text"
          value={newProductBatchNumber}
          onChange={(e) => setNewProductBatchNumber(e.target.value)}
          placeholder="Batch Number"
          className="input-field"
        />
        <select
          value={newProductStatus}
          onChange={(e) => setNewProductStatus(e.target.value)}
          className="input-field"
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>
      <div className="flex justify-end space-x-4 mt-6">
        <button
          onClick={() => setShowAddProductModal(false)}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button onClick={handleAddNewProduct} className="btn-primary">
          Add Product
        </button>
      </div>
    </div>
  </div>
);

const EditProductModal = ({
  editProductName,
  setEditProductName,
  editProductPrice,
  setEditProductPrice,
  editProductStock,
  setEditProductStock,
  editProductBatchNumber,
  setEditProductBatchNumber,
  editProductStatus,
  setEditProductStatus,
  setShowEditProductModal,
  setEditingProduct,
  handleEditProduct,
}) => (
  <div className="modal-overlay">
    <div className="modal-content">
      <h3 className="text-xl font-bold mb-4">Edit Product</h3>
      <div className="space-y-4">
        <input
          type="text"
          value={editProductName}
          onChange={(e) => setEditProductName(e.target.value)}
          className="input-field"
          required
        />
        <input
          type="number"
          value={editProductPrice}
          onChange={(e) => setEditProductPrice(e.target.value)}
          className="input-field"
          required
        />
        <input
          type="number"
          value={editProductStock}
          onChange={(e) => setEditProductStock(e.target.value)}
          className="input-field"
          required
        />
        <input
          type="text"
          value={editProductBatchNumber}
          onChange={(e) => setEditProductBatchNumber(e.target.value)}
          className="input-field"
        />
        <select
          value={editProductStatus}
          onChange={(e) => setEditProductStatus(e.target.value)}
          className="input-field"
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>
      <div className="flex justify-end space-x-4 mt-6">
        <button
          onClick={() => {
            setShowEditProductModal(false);
            setEditingProduct(null);
          }}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button onClick={handleEditProduct} className="btn-primary">
          Save Changes
        </button>
      </div>
    </div>
  </div>
);

const AddUserModal = ({
  newAddUserEmail,
  setNewAddUserEmail,
  newAddUserPassword,
  setNewAddUserPassword,
  newAddUserRole,
  setNewAddUserRole,
  adminPasswordForUserCreation,
  setAdminPasswordForUserCreation,
  setShowAddUserModal,
  handleAddUser,
}) => (
  <div className="modal-overlay">
    <div className="modal-content">
      <h3 className="text-xl font-bold mb-4">Add New User</h3>
      <div className="space-y-4">
        <input
          type="email"
          value={newAddUserEmail}
          onChange={(e) => setNewAddUserEmail(e.target.value)}
          placeholder="User Email"
          className="input-field"
          required
        />
        <input
          type="password"
          value={newAddUserPassword}
          onChange={(e) => setNewAddUserPassword(e.target.value)}
          placeholder="User Password"
          className="input-field"
          required
        />
        <select
          value={newAddUserRole}
          onChange={(e) => setNewAddUserRole(e.target.value)}
          className="input-field"
        >
          <option value="cashier">Cashier</option>
          <option value="admin">Admin</option>
        </select>
        <input
          type="password"
          value={adminPasswordForUserCreation}
          onChange={(e) => setAdminPasswordForUserCreation(e.target.value)}
          placeholder="Your Admin Password (for verification)"
          className="input-field"
          required
        />
      </div>
      <div className="flex justify-end space-x-4 mt-6">
        <button
          onClick={() => setShowAddUserModal(false)}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button onClick={handleAddUser} className="btn-primary">
          Add User
        </button>
      </div>
    </div>
  </div>
);

const EditUserRoleModal = ({
  editingUserForRole,
  newRoleForUser,
  setNewRoleForUser,
  setShowEditUserRoleModal,
  handleEditUserRole,
}) => (
  <div className="modal-overlay">
    <div className="modal-content">
      <h3 className="text-xl font-bold mb-4">Edit User Role</h3>
      {editingUserForRole && (
        <p className="text-center mb-4">
          User ID:{" "}
          <span className="font-mono text-xs">{editingUserForRole.id}</span>
        </p>
      )}
      <div className="space-y-4">
        <select
          value={newRoleForUser}
          onChange={(e) => setNewRoleForUser(e.target.value)}
          className="input-field"
        >
          <option value="cashier">Cashier</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="flex justify-end space-x-4 mt-6">
        <button
          onClick={() => setShowEditUserRoleModal(false)}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button onClick={handleEditUserRole} className="btn-primary">
          Save Role
        </button>
      </div>
    </div>
  </div>
);

const ConfirmDeleteUserModal = ({
  setShowConfirmDeleteUserModal,
  handleDeleteUser,
  deletingUserId,
}) => (
  <div className="modal-overlay">
    <div className="modal-content">
      <h3 className="text-xl font-bold mb-4 text-red-600">
        Confirm Deletion
      </h3>
      <p className="mb-4">
        Are you sure you want to delete this user? This action cannot be
        undone.
      </p>
      {deletingUserId && (
        <p className="text-center mb-4">
          User ID:{" "}
          <span className="font-mono text-xs">{deletingUserId}</span>
        </p>
      )}
      <div className="flex justify-end space-x-4 mt-6">
        <button
          onClick={() => setShowConfirmDeleteUserModal(false)}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button
          onClick={() => handleDeleteUser(deletingUserId)}
          className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors duration-200"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
);

const ConfirmEditSaleModal = ({
  setShowConfirmEditSaleModal,
  handleEditSale,
}) => (
  <div className="modal-overlay">
    <div className="modal-content">
      <h3 className="text-xl font-bold mb-4">Confirm Sale Edit</h3>
      <p className="mb-4">
        Are you sure you want to edit this sale? This will permanently
        override the previous sale record.
      </p>
      <div className="flex justify-end space-x-4 mt-6">
        <button
          onClick={() => setShowConfirmEditSaleModal(false)}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button onClick={handleEditSale} className="btn-primary">
          Confirm Edit
        </button>
      </div>
    </div>
  </div>
);

const ConfirmDeleteModal = ({
  setShowConfirmDeleteModal,
  handleDeleteSale,
  deletingSaleId,
}) => (
  <div className="modal-overlay">
    <div className="modal-content">
      <h3 className="text-xl font-bold mb-4 text-red-600">
        Confirm Deletion
      </h3>
      <p className="mb-4">
        Are you sure you want to delete this sale? This action cannot be
        undone.
      </p>
      <div className="flex justify-end space-x-4 mt-6">
        <button
          onClick={() => setShowConfirmDeleteModal(false)}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button
          onClick={() => handleDeleteSale(deletingSaleId)}
          className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors duration-200"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
);

const EditSaleModal = ({
  editingSale,
  editSaleDate,
  setEditSaleDate,
  editSaleCustomerName,
  setEditSaleCustomerName,
  editSalePaymentMethod,
  setEditSalePaymentMethod,
  editSaleRemark,
  setEditSaleRemark,
  editSaleItems,
  setEditSaleItems, 
  setShowEditSaleModal,
  setEditingSale,
  setShowConfirmEditSaleModal,
}) => {
  // Function to handle quantity change for a specific item
  // eslint-disable-next-line
  const handleQuantityChange = (index, newQuantity) => {
    // Ensure newQuantity is a number and is not negative
    const quantity = Math.max(0, parseInt(newQuantity) || 0);

    const updatedItems = editSaleItems.map((item, i) =>
      i === index ? { ...item, quantity } : item
    );
    setEditSaleItems(updatedItems);
  };

  // Calculate the total amount based on the current state of editSaleItems
  const calculateTotal = () => {
    return editSaleItems.reduce((sum, item) => {
      // Ensure price and discountApplied are numbers, default to 0 if undefined/null
      const itemoriginalprice = item.originalprice || 0;
      const itemDiscountApplied = item.discountApplied || 0;
      const itemQuantity = item.quantity || 0;

      const discountedPrice = itemoriginalprice - itemDiscountApplied;
      const finalPrice = Math.max(0, discountedPrice); // Ensure price doesn't go below zero
      return sum + finalPrice * itemQuantity;
    }, 0);
  };
  
  const newTotal = calculateTotal();

  return (
    <div className="modal-overlay">
      <div className="modal-content-lg">
        <h3 className="text-xl font-bold mb-4">Edit Sale Record</h3>
        {editingSale && (
          <>
            <p className="text-center text-sm mb-4 text-gray-500">
              Sale ID:{" "}
              <span className="font-mono text-xs">{editingSale.id}</span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label-field" htmlFor="editSaleDate">
                  Sale Date
                </label>
                <input
                  id="editSaleDate"
                  type="date"
                  value={editSaleDate}
                  onChange={(e) => setEditSaleDate(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field" htmlFor="editSaleCustomerName">
                  Customer Name
                </label>
                <input
                  id="editSaleCustomerName"
                  type="text"
                  value={editSaleCustomerName}
                  onChange={(e) => setEditSaleCustomerName(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label
                  className="label-field"
                  htmlFor="editSalePaymentMethod"
                >
                  Payment Method
                </label>
                <select
                  id="editSalePaymentMethod"
                  value={editSalePaymentMethod}
                  onChange={(e) => setEditSalePaymentMethod(e.target.value)}
                  className="input-field"
                >
                  <option value="Cash">Cash</option>
                  <option value="DuitNowQR">DuitNowQR</option>
                </select>
              </div>
              <div>
                <label className="label-field" htmlFor="editSaleRemark">
                  Remark
                </label>
                <textarea
                  id="editSaleRemark"
                  value={editSaleRemark}
                  onChange={(e) => setEditSaleRemark(e.target.value)}
                  className="input-field h-24"
                />
              </div>
            </div>
  
            <h4 className="text-lg font-bold mb-2">Items</h4>
            <div className="overflow-x-auto rounded-lg shadow">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">ITEM</th>
                    <th className="table-header">QUANTITY</th>
                    <th className="table-header">ORIGINAL PRICE</th>
                    <th className="table-header">DISCOUNT (MYR)</th>
                    <th className="table-header">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {editSaleItems.map((item, index) => (
                    <tr key={index}>
                      <td className="table-cell">{item.name}</td>
                      <td className="table-cell">{(item.quantity || 0)}
                      </td>
                      <td className="table-cell">RM{(item.originalPrice || 0)?.toFixed(2)}</td>
                      <td className="table-cell">RM{(item.discountApplied || 0)?.toFixed(2)}</td>
                      <td className="table-cell">
                        RM{(((item.originalPrice || 0) - (item.discountApplied || 0)) * (item.quantity || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end items-center mt-6">
              <div className="flex-1">
                <h4 className="text-xl font-bold">New Total:</h4>
              </div>
              <div className="text-xl font-bold mr-6">
                {/* FIX: Display the calculated newTotal */}
                RM{newTotal.toFixed(2)}
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setShowEditSaleModal(false);
                    setEditingSale(null);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowConfirmEditSaleModal(true)}
                  className="btn-primary"
                >
                  Update Sale
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const AdminPanel = ({
  userEmail,
  userRole,
  handleSignOut,
  currentAdminView,
  setCurrentAdminView,
  products,
  setShowAddProductModal,
  handleDeleteProduct,
  setEditingProduct,
  sales,
  expandedSaleId,
  setExpandedSaleId,
  handleOpenEditSaleModal,
  setDeletingSaleId,
  setShowConfirmDeleteModal,
  filterCustomerName,
  setFilterCustomerName,
  filterPaymentMethod,
  setFilterPaymentMethod,
  usersInSystem,
  setShowAddUserModal,
  handleOpenEditUserRoleModal,
  setDeletingUserId,
  setShowConfirmDeleteUserModal,
}) => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-100 font-[Inter] text-gray-800">
      <header className="bg-white shadow-md p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">MHA POS System - Admin</h1>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">
            Email: <span className="font-semibold text-blue-600">{userEmail}</span>
          </span>
          <span className="text-sm text-gray-600">
            Role: <span className="font-semibold text-blue-600">{userRole}</span>
          </span>
          <button onClick={handleSignOut} className="btn-secondary">
            Sign Out
          </button>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => setCurrentAdminView("products")}
            className={`tab-button ${
              currentAdminView === "products" ? "tab-button-active" : ""
            }`}
          >
            Product Management
          </button>
          <button
            onClick={() => setCurrentAdminView("sales")}
            className={`tab-button ${
              currentAdminView === "sales" ? "tab-button-active" : ""
            }`}
          >
            Sales History
          </button>
          <button
            onClick={() => setCurrentAdminView("users")}
            className={`tab-button ${
              currentAdminView === "users" ? "tab-button-active" : ""
            }`}
          >
            User Management
          </button>
        </div>
      </nav>

      <main className="flex-1 p-8 overflow-y-auto">
        {currentAdminView === "products" && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Products</h2>
              <button
                onClick={() => setShowAddProductModal(true)}
                className="btn-primary"
              >
                Add Product
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg shadow">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Product ID</th>
                    <th className="table-header">Name</th>
                    <th className="table-header">Price</th>
                    <th className="table-header">Stock</th>
                    <th className="table-header">Batch Number</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className="table-cell font-mono text-xs">
                        {product.id}
                      </td>
                      <td className="table-cell">{product.name}</td>
                      <td className="table-cell">
                        RM{product.price?.toFixed(2)}
                      </td>
                      <td className="table-cell">{product.stock}</td>
                      <td className="table-cell">{product.batchNumber}</td>
                      <td className="table-cell">{product.status}</td>
                      <td className="table-cell">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setEditingProduct(product)}
                            className="text-blue-600 hover:text-blue-800 transition-colors duration-200"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="text-red-600 hover:text-red-800 transition-colors duration-200"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentAdminView === "sales" && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Sales History</h2>
            <div className="flex space-x-4 mb-4">
              <input
                type="text"
                placeholder="Filter by Customer Name"
                value={filterCustomerName}
                onChange={(e) => setFilterCustomerName(e.target.value)}
                className="input-field"
              />
              <select
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                className="input-field"
              >
                <option value="">All Payment Methods</option>
                <option value="Cash">Cash</option>
                <option value="DuitNowQR">DuitNowQR</option>
              </select>
            </div>
            <div className="overflow-x-auto rounded-lg shadow">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Sale ID</th>
                    <th className="table-header">Date</th>
                    <th className="table-header">Customer Name</th>
                    <th className="table-header">Items Count</th>
                    <th className="table-header">Total</th>
                    <th className="table-header">Payment Method</th>
                    <th className="table-header">Sold By</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sales
                    .filter((sale) => {
                      const customerMatch = sale.customerName
                        ?.toLowerCase()
                        .includes(filterCustomerName.toLowerCase());
                      const paymentMatch =
                        filterPaymentMethod === "" ||
                        sale.paymentMethod === filterPaymentMethod;
                      return customerMatch && paymentMatch;
                    })
                    .map((sale) => (
                      <React.Fragment key={sale.id}>
                        <tr className="hover:bg-gray-50 transition-colors duration-150">
                          {/* FIX: Make Sale ID clickable to expand/collapse details */}
                          <td className="table-cell font-mono text-xs cursor-pointer text-blue-600 hover:underline" onClick={() => setExpandedSaleId(expandedSaleId === sale.id ? null : sale.id)}>
                            {sale.id}
                          </td>
                          {/* FIX: Display purchaseDate instead of timestamp */}
                          <td className="table-cell">
                            {sale.purchaseDate}
                          </td>
                          <td className="table-cell">{sale.customerName}</td>
                          {/* FIX: Display total quantity, not item count */}
                          <td className="table-cell">
                            {sale.items.reduce((sum, item) => sum + (item.quantity || 0), 0)}
                          </td>
                          {/* FIX: Display total amount */}
                          <td className="table-cell">
                            RM{sale.total?.toFixed(2)}
                          </td>
                          <td className="table-cell">
                            {sale.paymentMethod}
                          </td>
                          {/* FIX: Display soldBy instead of cashierId */}
                          <td className="table-cell">{sale.soldBy}</td>
                          <td className="table-cell">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleOpenEditSaleModal(sale)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setDeletingSaleId(sale.id);
                                  setShowConfirmDeleteModal(true);
                                }}
                                className="text-red-600 hover:text-red-800"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedSaleId === sale.id && (
                          <tr className="bg-gray-100">
                            <td colSpan="8" className="p-4">
                              <div className="pl-8">
                                <h4 className="font-bold mb-2">Sale Details:</h4>
                                <ul className="list-disc list-inside text-sm">
                                  {sale.items.map((item, index) => (
                                    <li key={index}>
                                      {item.name} (x{sale.quantity}) | RM
                                      {(item.originalPrice || 0).toFixed(2)}
                                      {/* FIX: Safely access discountApplied */}
                                      {(item.discountApplied || 0) > 0 && (
                                        <span className="text-red-500 ml-2">
                                          - RM{(item.discountApplied || 0).toFixed(2)} 
                                        </span>
                                      )}
									    <span className="text-black-500 ml-2">
                                          = RM{(sale.total || 0).toFixed(2)}
										</span>
                                    </li>
                                  ))}
                                </ul>
                                {sale.remark && (
                                  <p className="mt-2 text-sm text-gray-500">
                                    Remark: {sale.remark}
                                  </p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentAdminView === "users" && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">User Management</h2>
              <button
                onClick={() => setShowAddUserModal(true)}
                className="btn-primary"
              >
                Add User
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg shadow">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">User ID</th>
                    <th className="table-header">Email</th>
                    <th className="table-header">Role</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {usersInSystem.map((user) => (
                    <tr key={user.id}>
                      <td className="table-cell font-mono text-xs">
                        {user.id}
                      </td>
                      <td className="table-cell">{user.email}</td>
                      <td className="table-cell">{user.role}</td>
                      <td className="table-cell">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleOpenEditUserRoleModal(user)}
                            className="text-blue-600 hover:text-blue-800 transition-colors duration-200"
                          >
                            Edit Role
                          </button>
                          {user.id !==
                            "c4c153b6-1753-4613-8889-cf775586616a" && ( // Example check to prevent deleting a specific user
                            <button
                              onClick={() => {
                                setDeletingUserId(user.id);
                                setShowConfirmDeleteUserModal(true);
                              }}
                              className="text-red-600 hover:text-red-800 transition-colors duration-200"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const CashierPanel = ({
  userEmail,
  userRole,
  handleSignOut,
  products,
  cart,
  removeFromCart,
  updateCartQuantity,
  updateCartItemDiscount,
  total,
  customerName,
  setCustomerName,
  paymentMethod,
  setPaymentMethod,
  purchaseDate,
  setPurchaseDate,
  checkout,
  clearSale,
  addProductToCart,
  errorMessage,
  successMessage,
}) => (
  <div className="flex flex-col md:flex-row min-h-screen bg-gray-100 font-[Inter] text-gray-800">
    {/* Product List Panel */}
    <div className="flex-1 p-8 overflow-y-auto">
      <header className="bg-white shadow-md rounded-xl p-4 flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">MHA POS System - Cashier</h1>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">
            Email: <span className="font-semibold text-blue-600">{userEmail}</span>
          </span>
          <span className="text-sm text-gray-600">
            Role: <span className="font-semibold text-blue-600">{userRole}</span>
          </span>
          <button onClick={handleSignOut} className="btn-secondary">
            Sign Out
          </button>
        </div>
      </header>
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Products</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto max-h-[70vh]">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-gray-50 rounded-xl shadow-sm p-4 flex flex-col justify-between transform transition-transform duration-200 hover:scale-105"
            >
              <div>
                <h3 className="text-lg font-bold">{product.name}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Stock: {product.stock}
                </p>
                <p className="text-xl font-semibold text-blue-600 mt-2">
                  RM{product.price?.toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => addProductToCart(product)}
                className="mt-4 w-full btn-primary"
              >
                Add to Cart
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Cart & Checkout Panel */}
    <div className="w-full md:w-1/3 bg-white p-8 shadow-lg md:min-h-screen flex flex-col">
      <div className="flex-1">
        <h2 className="text-2xl font-bold mb-4">Shopping Cart</h2>
        {errorMessage && (
          <div className="text-red-500 mb-4 p-2 bg-red-100 rounded-lg">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="text-green-500 mb-4 p-2 bg-green-100 rounded-lg">
            {successMessage}
          </div>
        )}
        <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
          {cart.length === 0 ? (
            <p className="text-center text-gray-500">Cart is empty</p>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-gray-50 rounded-lg p-3 shadow-sm"
              >
                <div className="flex-1">
                  <h3 className="font-semibold">{item.name}</h3>
                  <div className="flex items-center mt-1">
                    <p className="text-sm text-gray-600 mr-2">Qty:</p>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        updateCartQuantity(
                          item.id,
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="input-field-small w-16"
                      min="1"
                    />
                  </div>
                  <div className="flex items-center mt-1">
                    <p className="text-sm text-gray-600 mr-2">Discount:</p>
                    <input
                      type="number"
                      value={item.discountApplied}
                      onChange={(e) =>
                        updateCartItemDiscount(
                          item.id,
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="input-field-small w-20"
                      min="0"
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">
                    RM{(item.price * item.quantity).toFixed(2)}
                  </p>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-red-500 hover:text-red-700 text-sm mt-1"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="mt-auto pt-6 border-t border-gray-200">
        <div className="flex justify-between items-center text-2xl font-bold mb-4">
          <span>Total:</span>
          <span>RM{total.toFixed(2)}</span>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label-field" htmlFor="customerName">
              Customer Name
            </label>
            <input
              id="customerName"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="label-field" htmlFor="paymentMethod">
              Payment Method
            </label>
            <select
              id="paymentMethod"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="input-field"
            >
              <option value="Cash">Cash</option>
              <option value="DuitNowQR">DuitNowQR</option>
            </select>
          </div>
          <div>
            <label className="label-field" htmlFor="purchaseDate">
              Purchase Date
            </label>
            <input
              id="purchaseDate"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <button onClick={checkout} className="w-full btn-primary">
            Complete Sale
          </button>
          <button onClick={clearSale} className="w-full btn-secondary">
            Clear
          </button>
        </div>
      </div>
    </div>
  </div>
);

// === End of component fixes ===

export default function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState(null); // New state for user email
  const [userRole, setUserRole] = useState(null); // 'admin' or 'cashier'
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false); // Indicates Firebase auth listener is ready

  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [sales, setSales] = useState([]);
  const [total, setTotal] = useState(0);

  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductStock, setNewProductStock] = useState('');
  const [newProductBatchNumber, setNewProductBatchNumber] = useState('');
  const [newProductStatus, setNewProductStatus] = useState('Active'); // New state for product status

  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editProductName, setEditProductName] = useState('');
  const [editProductPrice, setEditProductPrice] = useState('');
  const [editProductStock, setEditProductStock] = useState('');
  const [editProductBatchNumber, setEditProductBatchNumber] = useState('');
  const [editProductStatus, setEditProductStatus] = useState('Active'); // New state for product status

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Auth states for login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // New states for cashier panel customer details
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);

  // New states for User Management (Admin Only)
  const [usersInSystem, setUsersInSystem] = useState([]);
  const [showEditUserRoleModal, setShowEditUserRoleModal] = useState(false);
  const [editingUserForRole, setEditingUserForRole] = useState(null);
  const [newRoleForUser, setNewRoleForUser] = useState('');

  // New states for Add User Modal (Admin Only)
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newAddUserEmail, setNewAddUserEmail] = useState('');
  const [newAddUserPassword, setNewAddUserPassword] = useState('');
  const [newAddUserRole, setNewAddUserRole] = useState('cashier'); // Default to cashier
  const [adminPasswordForUserCreation, setAdminPasswordForUserCreation] = useState(''); // New state for admin's password

  // State for Admin Dashboard View
  const [currentAdminView, setCurrentAdminView] = useState('products'); // 'products', 'sales', 'users'

  // --- NEW STATES FOR EDITING SALES HISTORY ---
  const [showEditSaleModal, setShowEditSaleModal] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [editSaleDate, setEditSaleDate] = useState('');
  const [editSaleCustomerName, setEditSaleCustomerName] = useState('');
  const [editSalePaymentMethod, setEditSalePaymentMethod] = useState('');
  const [editSaleRemark, setEditSaleRemark] = useState('');
  const [editSaleItems, setEditSaleItems] = useState([]);
  const [showConfirmEditSaleModal, setShowConfirmEditSaleModal] = useState(false);
  // eslint-disable-next-line
  const [pendingSaleUpdate, setPendingSaleUpdate] = useState(null);
  // --- END NEW STATES ---

  // --- NEW STATES FOR DELETING SALES HISTORY ---
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [deletingSaleId, setDeletingSaleId] = useState(null);

  // --- NEW STATES FOR SALES HISTORY FILTERING AND EXPANDED VIEW ---
  const [expandedSaleId, setExpandedSaleId] = useState(null); // Track which sales row is expanded
  const [filterCustomerName, setFilterCustomerName] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('');
  
  // --- NEW STATES FOR DELETING USERS ---
  const [showConfirmDeleteUserModal, setShowConfirmDeleteUserModal] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);

  // Custom CSS for better styling and modal functionality
  const customStyles = `
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 50;
      animation: fadeIn 0.3s ease-out;
    }

    .modal-content {
      background-color: white;
      padding: 2rem;
      border-radius: 1rem;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      max-width: 90%;
      width: 400px;
      animation: slideIn 0.3s ease-out;
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-content-lg {
      background-color: white;
      padding: 2rem;
      border-radius: 1rem;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      max-width: 90%;
      width: 700px;
      animation: slideIn 0.3s ease-out;
      max-height: 90vh;
      overflow-y: auto;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideIn {
      from { transform: translateY(-50px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .input-field {
      width: 100%;
      padding: 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid #d1d5db;
      font-size: 1rem;
      transition: all 0.2s ease-in-out;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .input-field:focus {
      outline: none;
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
    }

    .input-field-small {
      width: 100%;
      padding: 0.35rem 0.5rem;
      border-radius: 0.375rem;
      border: 1px solid #d1d5db;
      font-size: 0.875rem;
    }

    .btn-primary {
      padding: 0.75rem 1.5rem;
      border-radius: 0.75rem;
      font-weight: 600;
      color: #ffffff;
      background-color: #6366f1;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      transition: all 0.2s ease-in-out;
      border: none;
    }

    .btn-primary:hover {
      background-color: #4f46e5;
      box-shadow: 0 6px 10px -1px rgba(0, 0, 0, 0.15), 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .btn-secondary {
      padding: 0.75rem 1.5rem;
      border-radius: 0.75rem;
      font-weight: 600;
      color: #4b5563;
      background-color: #e5e7eb;
      box-shadow: 0 4px 6px -1-px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      transition: all 0.2s ease-in-out;
      border: none;
    }

    .btn-secondary:hover {
      background-color: #d1d5db;
      box-shadow: 0 6px 10px -1-px rgba(0, 0, 0, 0.15), 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .tab-button {
      padding: 0.75rem 1.5rem;
      font-weight: 500;
      color: #6b7280;
      border-bottom: 2px solid transparent;
      transition: all 0.2s ease-in-out;
    }

    .tab-button:hover {
      color: #4b5563;
    }

    .tab-button-active {
      color: #4f46e5;
      border-bottom-color: #4f46e5;
      font-weight: 600;
    }

    .table-header {
      padding: 1rem 1.5rem;
      text-align: left;
      font-size: 0.75rem;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .table-cell {
      padding: 1rem 1.5rem;
      white-space: nowrap;
      font-size: 0.875rem;
      color: #4b5563;
    }

    .label-field {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: #4b5563;
      margin-bottom: 0.25rem;
    }

    .input-field-table {
      padding: 0.25rem 0.5rem;
      border-radius: 0.375rem;
      border: 1px solid #d1d5db;
      width: 100%;
      font-size: 0.875rem;
    }

    .main-container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background-color: #f3f4f6;
    }

    .footer {
      text-align: center;
      padding: 1rem;
      font-size: 0.75rem;
      color: #6b7280;
      background-color: #f9fafb;
    }
  `;

  // Initialize Firebase and handle authentication state changes
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        const appId = window.__app_id;
        const firebaseConfig = JSON.parse(window.__firebase_config);

        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const authInstance = getAuth(app);

        setDb(firestore);
        setAuth(authInstance);

        onAuthStateChanged(authInstance, async (user) => {
          if (user) {
            let userRoleData = null;
            try {
              const userRoleDocRef = doc(firestore, `artifacts/${appId}/user_roles`, user.uid);
              const userRoleDoc = await getDoc(userRoleDocRef);
              if (userRoleDoc.exists()) {
                userRoleData = userRoleDoc.data();
              }
            } catch (error) {
              console.error("Error fetching user role in onAuthStateChanged:", error);
            }

            if (userRoleData && userRoleData.role) {
              setUserId(user.uid);
              setUserEmail(user.email); // Set the user email
              setUserRole(userRoleData.role);
              setIsAuthenticated(true);
            } else {
              console.warn("Authenticated user has no role assigned or role fetch failed. Attempting to sign out.");
              try {
                await signOut(authInstance);
                console.log("Successfully signed out user with no role.");
              } catch (signOutError) {
                console.error("Firebase Auth Error: Failed to sign out user with no role:", signOutError);
              }
              setUserId(null);
              setUserEmail(null);
              setUserRole(null);
              setIsAuthenticated(false);
            }
          } else {
            setUserId(null);
            setUserEmail(null);
            setUserRole(null);
            setIsAuthenticated(false);
          }
          setIsAuthReady(true);
          setLoading(false);
        });
      } catch (error) {
        console.error("Firebase Initialization Error:", error);
        setErrorMessage("Failed to initialize Firebase. Check your configuration.");
        setLoading(false);
      }
    };

    initializeFirebase();
  }, []);

  // Dynamically load Tailwind CSS and Google Fonts
  useEffect(() => {
    // Load Tailwind CSS
    const tailwindScript = document.createElement('script');
    tailwindScript.src = 'https://cdn.tailwindcss.com';
    document.head.appendChild(tailwindScript);

    // Load Google Fonts (Inter)
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    return () => {
      // Clean up on component unmount (optional, but good practice)
      if (document.head.contains(tailwindScript)) {
        document.head.removeChild(tailwindScript);
      }
      if (document.head.contains(fontLink)) {
        document.head.removeChild(fontLink);
      }
    };
  }, []); // Empty dependency array means this runs once on mount


  // Listen for real-time updates to products, sales, and user roles
  useEffect(() => {
    if (db && isAuthReady && isAuthenticated) {
      const appId = window.__app_id;
      console.log("Current App ID:", appId);

      // Products listener (public data)
      const productsCollectionRef = collection(db, `artifacts/${appId}/public/data/products`);
      const unsubscribeProducts = onSnapshot(productsCollectionRef, (snapshot) => {
        let productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filter products based on user role
        if (userRole === 'cashier') {
          // Treat products without a 'status' field as 'Active' by default
          productsData = productsData.filter(product => (product.status === 'Active' || product.status === undefined));
        }
        setProducts(productsData);
      }, (error) => {
        console.error("Error fetching products:", error);
        setErrorMessage("Failed to load products.");
      });

      // Sales listener: Admin sees all sales from the public sales collection
      let unsubscribeSales;
      if (userRole === 'admin') {
        const salesCollectionPath = `artifacts/${appId}/public/data/sales`;
        console.log("Admin sales listener path:", salesCollectionPath);
        const salesCollectionRef = collection(db, salesCollectionPath);
        unsubscribeSales = onSnapshot(salesCollectionRef, (snapshot) => {
          const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          salesData.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
          setSales(salesData);
          console.log("Sales data received for admin:", salesData.length, "items");
        }, (error) => {
          console.error("Error fetching sales:", error);
          setErrorMessage("Failed to load sales history.");
        });
      } else if (userRole === 'cashier' && userId) {
        // Cashier only sees their own sales (if a UI for it existed)
        // For now, cashiers don't have a sales history view in the UI,
        // but if they did, it would typically be from their private collection.
        // This part is kept for logical completeness, but not actively used in the current UI.
        const salesCollectionPath = `artifacts/${appId}/users/${userId}/sales`;
        console.log("Cashier sales listener path (if applicable):", salesCollectionPath);
        const salesCollectionRef = collection(db, salesCollectionPath);
        unsubscribeSales = onSnapshot(salesCollectionRef, (snapshot) => {
          const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          salesData.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
          setSales(salesData);
          console.log("Sales data received for cashier (if applicable):", salesData.length, "items");
        }, (error) => {
          console.error("Error fetching sales:", error);
          setErrorMessage("Failed to load sales history.");
        });
      }


      // User Roles listener (admin sees all user roles)
      let unsubscribeUsers;
      if (userRole === 'admin') {
        const userRolesCollectionRef = collection(db, `artifacts/${appId}/user_roles`);
        unsubscribeUsers = onSnapshot(userRolesCollectionRef, (snapshot) => {
          const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setUsersInSystem(usersData);
        }, (error) => {
          console.error("Error fetching user roles:", error);
          setErrorMessage("Failed to load user list.");
        });
      }

      return () => {
        unsubscribeProducts();
        if (unsubscribeSales) {
          unsubscribeSales();
        }
        if (unsubscribeUsers) {
          unsubscribeUsers();
        }
      };
    }
  }, [db, userId, isAuthReady, isAuthenticated, userRole]);

  // Calculate total whenever cart changes (applying discounts)
  useEffect(() => {
    const newTotal = cart.reduce((sum, item) => {
      const discountedPrice = item.price - (item.discountApplied || 0);
      // Ensure discounted price doesn't go below zero
      const finalPrice = Math.max(0, discountedPrice);
      return sum + finalPrice * item.quantity;
    }, 0);
    setTotal(newTotal);
  }, [cart]);

  // --- Authentication Handlers ---
  const handleAuthAction = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!auth || !email.trim() || !password.trim()) {
      setErrorMessage("Authentication service not ready, or email/password missing.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setEmail('');
      setPassword('');
    } catch (error) {
      console.error("Auth error:", error);
      setErrorMessage(error.message);
    }
  };

  const handlePasswordReset = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!auth) {
      setErrorMessage("Authentication service not ready.");
      return;
    }
    if (!email.trim()) {
      setErrorMessage("Please enter your email address to reset password.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage("Password reset email sent! Check your inbox.");
      setEmail('');
    } catch (error) {
      console.error("Password reset error:", error);
      setErrorMessage(error.message);
    }
  };

  const handleSignOut = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!auth) return;
    try {
      await signOut(auth);
      setCart([]);
      setProducts([]);
      setSales([]);
      setUsersInSystem([]); // Clear users list on sign out
      setCurrentAdminView('products'); // Reset admin view on logout
    } catch (error) {
      console.error("Sign out error:", error);
      setErrorMessage("Failed to sign out.");
    }
  };

  // --- Product & Cart Management Handlers ---
  const addProductToCart = (product) => {
    setErrorMessage('');
    setSuccessMessage('');
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        if (existingItem.quantity + 1 > product.stock) {
          setErrorMessage(`Not enough stock for ${product.name}. Only ${product.stock} available.`);
          return prevCart;
        }
        return prevCart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        if (product.stock < 1) {
          setErrorMessage(`No stock available for ${product.name}.`);
          return prevCart;
        }
        // Initialize discountApplied to 0 and include batchNumber when adding to cart
        return [...prevCart, { ...product, quantity: 1, discountApplied: 0, batchNumber: product.batchNumber || '' }];
      }
    });
  };

  const updateCartQuantity = (productId, newQuantity) => {
    setErrorMessage('');
    setSuccessMessage('');
    setCart(prevCart => {
      const productInList = products.find(p => p.id === productId);
      if (!productInList) return prevCart;

      if (newQuantity <= 0) {
        return prevCart.filter(item => item.id !== productId);
      }
      if (newQuantity > productInList.stock) {
        setErrorMessage(`Cannot add more than available stock for ${productInList.name}. Max: ${productInList.stock}`);
        return prevCart;
      }
      return prevCart.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item);
    });
  };

  const updateCartItemDiscount = (productId, newDiscount) => {
    setErrorMessage('');
    setSuccessMessage('');
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id === productId) {
          const parsedDiscount = parseFloat(newDiscount);
          if (isNaN(parsedDiscount) || parsedDiscount < 0) {
            setErrorMessage("Discount must be a non-negative number.");
            return item; // Return original item if invalid input
          }
          if (parsedDiscount > item.price) {
            setErrorMessage("Discount cannot be more than the item's price.");
            return item; // Return original item if discount exceeds price
          }
          return { ...item, discountApplied: parsedDiscount };
        }
        return item;
      });
    });
  };

  const removeFromCart = (productId) => {
    setErrorMessage('');
    setSuccessMessage('');
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const clearSale = () => {
    setErrorMessage('');
    setSuccessMessage('');
    setCart([]);
    setCustomerName('');
    setPaymentMethod('Cash');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
  };

  const checkout = async () => {
    if (cart.length === 0) {
      setErrorMessage("Cart is empty. Add products before checking out.");
      return;
    }
    if (!customerName.trim()) {
      setErrorMessage("Please enter customer name.");
      return;
    }
    if (!paymentMethod) {
      setErrorMessage("Please select a payment method.");
      return;
    }
    if (!purchaseDate) {
      setErrorMessage("Please select a purchase date.");
      return;
    }
    if (!db || !userId) {
      setErrorMessage("Database not ready. Please wait or refresh.");
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await runTransaction(db, async (transaction) => {
        const appId = window.__app_id;
        const salesCollectionRef = collection(db, `artifacts/${appId}/public/data/sales`);
        
        const productUpdates = [];
        for (const item of cart) {
          const productRef = doc(db, `artifacts/${appId}/public/data/products`, item.id);
          const productDoc = await transaction.get(productRef);
          
          if (!productDoc.exists()) {
            throw new Error(`Product "${item.name}" not found in inventory.`);
          }
          
          const currentStock = productDoc.data().stock || 0;
          if (currentStock < item.quantity) {
            throw new Error(`Insufficient stock for "${item.name}". Available: ${currentStock}, Needed: ${item.quantity}`);
          }
          
          productUpdates.push({ ref: productRef, newStock: currentStock - item.quantity });
        }

        for (const update of productUpdates) {
          transaction.update(update.ref, { stock: update.newStock });
        }

        const saleItems = cart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          batchNumber: item.batchNumber,
          discountApplied: item.discountApplied,
        }));

        await addDoc(salesCollectionRef, {
          timestamp: serverTimestamp(),
          customerName,
          paymentMethod,
          purchaseDate,
          items: saleItems,
          totalAmount: total,
          // FIX: Changed cashierId to soldBy to match user request
          soldBy: userEmail, // Changed from userId to userEmail for readability
        });
      });

      setSuccessMessage("Sale completed successfully!");
      clearSale();
    } catch (error) {
      console.error("Checkout transaction failed:", error);
      setErrorMessage(`Checkout failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };


  // --- Admin Panel Handlers ---

  const handleAddNewProduct = async () => {
    if (!db) {
      setErrorMessage("Database not ready. Please wait or refresh.");
      return;
    }
    setErrorMessage('');
    setSuccessMessage('');

    if (!newProductName || !newProductPrice || !newProductStock || !newProductStatus) {
      setErrorMessage("Please fill out all product details.");
      return;
    }

    try {
      setLoading(true);
      const appId = window.__app_id;
      const productsCollectionRef = collection(db, `artifacts/${appId}/public/data/products`);
      await addDoc(productsCollectionRef, {
        name: newProductName,
        price: parseFloat(newProductPrice),
        stock: parseInt(newProductStock, 10),
        batchNumber: newProductBatchNumber,
        status: newProductStatus,
        createdAt: serverTimestamp(),
      });
      setSuccessMessage("Product added successfully!");
      setNewProductName('');
      setNewProductPrice('');
      setNewProductStock('');
      setNewProductBatchNumber('');
      setNewProductStatus('Active');
      setShowAddProductModal(false);
    } catch (error) {
      console.error("Error adding product:", error);
      setErrorMessage("Failed to add product. " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!db) {
      setErrorMessage("Database not ready.");
      return;
    }
    setErrorMessage('');
    setSuccessMessage('');
    try {
      setLoading(true);
      const appId = window.__app_id;
      const productDocRef = doc(db, `artifacts/${appId}/public/data/products`, productId);
      await deleteDoc(productDocRef);
      setSuccessMessage("Product deleted successfully!");
    } catch (error) {
      console.error("Error deleting product:", error);
      setErrorMessage("Failed to delete product. " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Open the edit modal with the selected product's data
  useEffect(() => {
    if (editingProduct) {
      setEditProductName(editingProduct.name);
      setEditProductPrice(editingProduct.price.toString());
      setEditProductStock(editingProduct.stock.toString());
      setEditProductBatchNumber(editingProduct.batchNumber || '');
      setEditProductStatus(editingProduct.status || 'Active');
      setShowEditProductModal(true);
    }
  }, [editingProduct]);

  const handleEditProduct = async () => {
    if (!db || !editingProduct) {
      setErrorMessage("Database not ready or no product selected.");
      return;
    }
    setErrorMessage('');
    setSuccessMessage('');

    if (!editProductName || !editProductPrice || !editProductStock || !editProductStatus) {
      setErrorMessage("Please fill out all product details.");
      return;
    }

    try {
      setLoading(true);
      const appId = window.__app_id;
      const productDocRef = doc(db, `artifacts/${appId}/public/data/products`, editingProduct.id);
      await updateDoc(productDocRef, {
        name: editProductName,
        price: parseFloat(editProductPrice),
        stock: parseInt(editProductStock, 10),
        batchNumber: editProductBatchNumber,
        status: editProductStatus,
      });
      setSuccessMessage("Product updated successfully!");
      setShowEditProductModal(false);
      setEditingProduct(null); // Clear editing state
    } catch (error) {
      console.error("Error updating product:", error);
      setErrorMessage("Failed to update product. " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditSaleModal = (sale) => {
    setEditingSale(sale);
    setEditSaleDate(sale.purchaseDate);
    setEditSaleCustomerName(sale.customerName);
    setEditSalePaymentMethod(sale.paymentMethod);
    setEditSaleRemark(sale.remark || '');
    // FIX: Clone the items array to allow for local state changes in the modal
    setEditSaleItems([...sale.items]);
    setShowEditSaleModal(true);
  };

  const handleEditSale = async () => {
    if (!db || !editingSale) return;
    setErrorMessage('');
    setSuccessMessage('');
    setShowConfirmEditSaleModal(false);

    try {
      setLoading(true);
      const appId = window.__app_id;
      const saleDocRef = doc(db, `artifacts/${appId}/public/data/sales`, editingSale.id);
      
      // Calculate the new total based on the updated items array
      const newTotal = editSaleItems.reduce((sum, item) => {
        const discountedPrice = (item.price || 0) - (item.discountApplied || 0);
        const finalPrice = Math.max(0, discountedPrice);
        return sum + finalPrice * (item.quantity || 0);
      }, 0);

      await updateDoc(saleDocRef, {
        purchaseDate: editSaleDate,
        customerName: editSaleCustomerName,
        paymentMethod: editSalePaymentMethod,
        remark: editSaleRemark,
        // FIX: Update items and totalAmount from the modal's state
        items: editSaleItems,
        totalAmount: newTotal,
      });
      setSuccessMessage("Sale history updated successfully!");
      setShowEditSaleModal(false);
      setEditingSale(null);
      // Re-fetch sales to ensure the display is updated
      // This is handled by the onSnapshot listener, so no need to manually call it.
    } catch (error) {
      console.error("Error updating sale:", error);
      setErrorMessage("Failed to update sale history. " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSale = async (saleId) => {
    if (!db || !saleId) return;
    setErrorMessage('');
    setSuccessMessage('');
    setShowConfirmDeleteModal(false);

    try {
      setLoading(true);
      const appId = window.__app_id;
      const saleDocRef = doc(db, `artifacts/${appId}/public/data/sales`, saleId);
      await deleteDoc(saleDocRef);
      setSuccessMessage("Sale history deleted successfully!");
    } catch (error) {
      console.error("Error deleting sale:", error);
      setErrorMessage("Failed to delete sale history. " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditUserRoleModal = (user) => {
    setEditingUserForRole(user);
    setNewRoleForUser(user.role);
    setShowEditUserRoleModal(true);
  };

  const handleEditUserRole = async () => {
    if (!db || !editingUserForRole || !newRoleForUser) return;
    setErrorMessage('');
    setSuccessMessage('');
    setShowEditUserRoleModal(false);

    try {
      setLoading(true);
      const appId = window.__app_id;
      const userRoleDocRef = doc(db, `artifacts/${appId}/user_roles`, editingUserForRole.id);
      await setDoc(userRoleDocRef, {
        email: editingUserForRole.email,
        role: newRoleForUser,
      });
      setSuccessMessage("User role updated successfully!");
      setEditingUserForRole(null);
    } catch (error) {
      console.error("Error updating user role:", error);
      setErrorMessage("Failed to update user role. " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!auth || !db || !newAddUserEmail || !newAddUserPassword || !newAddUserRole) {
      setErrorMessage("Please fill all fields.");
      return;
    }
    // This is a placeholder as Firebase Admin SDK is not available in client-side code.
    // In a real application, user creation should be done via a secure backend/cloud function.
    setErrorMessage("User creation is a backend operation. This is a placeholder.");
    return;
  };

  const handleDeleteUser = async (userIdToDelete) => {
    setErrorMessage("User deletion is a backend operation. This is a placeholder.");
    setShowConfirmDeleteUserModal(false);
    return;
  };

  // --- MAIN APP RENDER LOGIC ---
  return (
    <div className="main-container">
      <style>{customStyles}</style>
      {loading || !isAuthReady ? (
        <Loader />
      ) : !isAuthenticated ? (
        <AuthForm
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          handleAuthAction={handleAuthAction}
          handlePasswordReset={handlePasswordReset}
          showForgotPassword={showForgotPassword}
          setShowForgotPassword={setShowForgotPassword}
          errorMessage={errorMessage}
          successMessage={successMessage}
        />
      ) : userRole === 'admin' ? (
        <AdminPanel
          userEmail={userEmail}
          userRole={userRole}
          handleSignOut={handleSignOut}
          currentAdminView={currentAdminView}
          setCurrentAdminView={setCurrentAdminView}
          products={products}
          setShowAddProductModal={setShowAddProductModal}
          handleDeleteProduct={handleDeleteProduct}
          setEditingProduct={setEditingProduct}
          sales={sales}
          expandedSaleId={expandedSaleId}
          setExpandedSaleId={setExpandedSaleId}
          handleOpenEditSaleModal={handleOpenEditSaleModal}
          setDeletingSaleId={setDeletingSaleId}
          setShowConfirmDeleteModal={setShowConfirmDeleteModal}
          filterCustomerName={filterCustomerName}
          setFilterCustomerName={setFilterCustomerName}
          filterPaymentMethod={filterPaymentMethod}
          setFilterPaymentMethod={setFilterPaymentMethod}
          usersInSystem={usersInSystem}
          setShowAddUserModal={setShowAddUserModal}
          handleOpenEditUserRoleModal={handleOpenEditUserRoleModal}
          setDeletingUserId={setDeletingUserId}
          setShowConfirmDeleteUserModal={setShowConfirmDeleteUserModal}
        />
      ) : userRole === 'cashier' ? (
        <CashierPanel
          userEmail={userEmail}
          userRole={userRole}
          handleSignOut={handleSignOut}
          products={products}
          cart={cart}
          removeFromCart={removeFromCart}
          updateCartQuantity={updateCartQuantity}
          updateCartItemDiscount={updateCartItemDiscount}
          total={total}
          customerName={customerName}
          setCustomerName={setCustomerName}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          purchaseDate={purchaseDate}
          setPurchaseDate={setPurchaseDate}
          checkout={checkout}
          clearSale={clearSale}
          addProductToCart={addProductToCart}
          errorMessage={errorMessage}
          successMessage={successMessage}
        />
      ) : (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 font-[Inter]">
          <p className="text-red-500">Authentication state is unexpected. Please try again...</p>
        </div>
      )}

      {/* --- RENDER MODALS OUTSIDE MAIN COMPONENTS TO PREVENT RE-RENDERS --- */}
      {showAddProductModal && (
        <AddProductModal
          newProductName={newProductName}
          setNewProductName={setNewProductName}
          newProductPrice={newProductPrice}
          setNewProductPrice={setNewProductPrice}
          newProductStock={newProductStock}
          setNewProductStock={setNewProductStock}
          newProductBatchNumber={newProductBatchNumber}
          setNewProductBatchNumber={setNewProductBatchNumber}
          newProductStatus={newProductStatus}
          setNewProductStatus={setNewProductStatus}
          setShowAddProductModal={setShowAddProductModal}
          handleAddNewProduct={handleAddNewProduct}
        />
      )}
      {showEditProductModal && (
        <EditProductModal
          editProductName={editProductName}
          setEditProductName={setEditProductName}
          editProductPrice={editProductPrice}
          setEditProductPrice={setEditProductPrice}
          editProductStock={editProductStock}
          setEditProductStock={setEditProductStock}
          editProductBatchNumber={editProductBatchNumber}
          setEditProductBatchNumber={setEditProductBatchNumber}
          editProductStatus={editProductStatus}
          setEditProductStatus={setEditProductStatus}
          setShowEditProductModal={setShowEditProductModal}
          setEditingProduct={setEditingProduct}
          handleEditProduct={handleEditProduct}
        />
      )}
      {showEditSaleModal && (
        <EditSaleModal
          editingSale={editingSale}
          editSaleDate={editSaleDate}
          setEditSaleDate={setEditSaleDate}
          editSaleCustomerName={editSaleCustomerName}
          setEditSaleCustomerName={setEditSaleCustomerName}
          editSalePaymentMethod={editSalePaymentMethod}
          setEditSalePaymentMethod={setEditSalePaymentMethod}
          editSaleRemark={editSaleRemark}
          setEditSaleRemark={setEditSaleRemark}
          editSaleItems={editSaleItems}
          setEditSaleItems={setEditSaleItems}
          total={total}
          setShowEditSaleModal={setShowEditSaleModal}
          setEditingSale={setEditingSale}
          setShowConfirmEditSaleModal={setShowConfirmEditSaleModal}
        />
      )}
      {showConfirmEditSaleModal && (
        <ConfirmEditSaleModal
          setShowConfirmEditSaleModal={setShowConfirmEditSaleModal}
          handleEditSale={handleEditSale}
        />
      )}
      {showConfirmDeleteModal && (
        <ConfirmDeleteModal
          setShowConfirmDeleteModal={setShowConfirmDeleteModal}
          handleDeleteSale={handleDeleteSale}
          deletingSaleId={deletingSaleId}
        />
      )}
      {showEditUserRoleModal && (
        <EditUserRoleModal
          editingUserForRole={editingUserForRole}
          newRoleForUser={newRoleForUser}
          setNewRoleForUser={setNewRoleForUser}
          setShowEditUserRoleModal={setShowEditUserRoleModal}
          handleEditUserRole={handleEditUserRole}
        />
      )}
      {showAddUserModal && (
        <AddUserModal
          newAddUserEmail={newAddUserEmail}
          setNewAddUserEmail={setNewAddUserEmail}
          newAddUserPassword={newAddUserPassword}
          setNewAddUserPassword={setNewAddUserPassword}
          newAddUserRole={newAddUserRole}
          setNewAddUserRole={setNewAddUserRole}
          adminPasswordForUserCreation={adminPasswordForUserCreation}
          setAdminPasswordForUserCreation={setAdminPasswordForUserCreation}
          setShowAddUserModal={setShowAddUserModal}
          handleAddUser={handleAddUser}
        />
      )}
      {showConfirmDeleteUserModal && (
        <ConfirmDeleteUserModal
          setShowConfirmDeleteUserModal={setShowConfirmDeleteUserModal}
          handleDeleteUser={handleDeleteUser}
          deletingUserId={deletingUserId}
        />
      )}

      {/* FIX: Footer is now always visible */}
      <footer className="footer">
        &copy; 2024 MHA POS System created by Muhammad Hazwan Arif
      </footer>
    </div>
  );
};
