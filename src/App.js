import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
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
  getDocs,
  query,
  where
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

export default function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
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
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      transition: all 0.2s ease-in-out;
      border: none;
    }

    .btn-secondary:hover {
      background-color: #d1d5db;
      box-shadow: 0 6px 10px -1px rgba(0, 0, 0, 0.15), 0 4px 6px -1px rgba(0, 0, 0, 0.1);
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
              setUserRole(null);
              setIsAuthenticated(false);
            }
          } else {
            setUserId(null);
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
        return prevCart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item );
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
      return prevCart.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item );
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

    try {
      await runTransaction(db, async (transaction) => {
        // Save sales to a public collection accessible by all admins
        const salesCollectionRef = collection(db, `artifacts/${window.__app_id}/public/data/sales`);
        console.log("Saving sale to path:", `artifacts/${window.__app_id}/public/data/sales`); // Log save path

        const productUpdates = [];
        for (const item of cart) {
          const productRef = doc(db, `artifacts/${window.__app_id}/public/data/products`, item.id);
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

        const saleItems = cart.map(item => {
          const originalPrice = item.price;
          const discountApplied = item.discountApplied || 0;
          const discountedPrice = Math.max(0, originalPrice - discountApplied);
          return {
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            originalPrice,
            discountApplied,
            finalPrice: discountedPrice,
            totalPrice: discountedPrice * item.quantity,
            batchNumber: item.batchNumber // Include batch number in sale record
          };
        });

        const newSale = {
          customerName,
          paymentMethod,
          date: purchaseDate,
          remark: '', // Remark field is for admin only, so we save it as an empty string from cashier
          items: saleItems,
          total: total,
          timestamp: serverTimestamp(),
          cashierId: userId, // Record the cashier who made the sale
        };

        await addDoc(salesCollectionRef, newSale);

        setSuccessMessage("Sale completed successfully!");
        clearSale();
      });
    } catch (error) {
      console.error("Checkout transaction failed:", error);
      setErrorMessage(`Checkout failed: ${error.message}`);
    }
  };


  // --- ADMIN PANEL HANDLERS ---

  const handleAddProduct = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!newProductName.trim() || !newProductPrice.trim() || !newProductStock.trim()) {
      setErrorMessage('Product name, price, and stock are required.');
      return;
    }
    const price = parseFloat(newProductPrice);
    const stock = parseInt(newProductStock, 10);
    if (isNaN(price) || price < 0 || isNaN(stock) || stock < 0) {
      setErrorMessage('Price and stock must be non-negative numbers.');
      return;
    }
    if (!db || !userId) {
      setErrorMessage("Database not ready. Please wait or refresh.");
      return;
    }
    try {
      const productsCollectionRef = collection(db, `artifacts/${window.__app_id}/public/data/products`);
      const newProduct = {
        name: newProductName,
        price,
        stock,
        batchNumber: newProductBatchNumber,
        status: newProductStatus, // Save the new product status
        createdAt: serverTimestamp(),
        lastUpdatedBy: userId,
      };
      await addDoc(productsCollectionRef, newProduct);
      setSuccessMessage('Product added successfully!');
      setNewProductName('');
      setNewProductPrice('');
      setNewProductStock('');
      setNewProductBatchNumber('');
      setNewProductStatus('Active');
      setShowAddProductModal(false);
    } catch (error) {
      console.error("Error adding product:", error);
      setErrorMessage("Failed to add product: " + error.message);
    }
  };

  const openEditProductModal = (product) => {
    setEditingProduct(product);
    setEditProductName(product.name);
    setEditProductPrice(product.price);
    setEditProductStock(product.stock);
    setEditProductBatchNumber(product.batchNumber || '');
    setEditProductStatus(product.status || 'Active');
    setShowEditProductModal(true);
  };

  const handleEditProduct = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!editingProduct) {
      setErrorMessage("No product selected for editing.");
      return;
    }
    if (!editProductName.trim() || !editProductPrice.trim() || !editProductStock.trim()) {
      setErrorMessage('Product name, price, and stock are required.');
      return;
    }
    const price = parseFloat(editProductPrice);
    const stock = parseInt(editProductStock, 10);
    if (isNaN(price) || price < 0 || isNaN(stock) || stock < 0) {
      setErrorMessage('Price and stock must be non-negative numbers.');
      return;
    }
    if (!db || !userId) {
      setErrorMessage("Database not ready. Please wait or refresh.");
      return;
    }
    try {
      const productRef = doc(db, `artifacts/${window.__app_id}/public/data/products`, editingProduct.id);
      await updateDoc(productRef, {
        name: editProductName,
        price,
        stock,
        batchNumber: editProductBatchNumber,
        status: editProductStatus, // Update product status
        lastUpdatedBy: userId,
      });
      setSuccessMessage('Product updated successfully!');
      setShowEditProductModal(false);
      setEditingProduct(null);
    } catch (error) {
      console.error("Error updating product:", error);
      setErrorMessage("Failed to update product: " + error.message);
    }
  };

  const handleDeleteProduct = async (productId) => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!db || !userId) {
      setErrorMessage("Database not ready. Please wait or refresh.");
      return;
    }
    try {
      const productRef = doc(db, `artifacts/${window.__app_id}/public/data/products`, productId);
      await deleteDoc(productRef);
      setSuccessMessage('Product deleted successfully!');
    } catch (error) {
      console.error("Error deleting product:", error);
      setErrorMessage("Failed to delete product: " + error.message);
    }
  };

  const handleCreateUser = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!newAddUserEmail.trim() || !newAddUserPassword.trim() || !newAddUserRole.trim() || !adminPasswordForUserCreation.trim()) {
      setErrorMessage("All fields are required to create a new user.");
      return;
    }

    if (!auth || !db) {
      setErrorMessage("Authentication or Database service is not ready.");
      return;
    }

    try {
      // First, re-authenticate the admin to confirm they have permission to create a user.
      const adminCredential = signInWithEmailAndPassword(auth, auth.currentUser.email, adminPasswordForUserCreation);
      await adminCredential;

      // Create the new user with email and password
      const userCredential = await createUserWithEmailAndPassword(auth, newAddUserEmail, newAddUserPassword);
      const newUserId = userCredential.user.uid;

      // Assign the role in Firestore
      const userRoleDocRef = doc(db, `artifacts/${window.__app_id}/user_roles`, newUserId);
      await setDoc(userRoleDocRef, {
        role: newAddUserRole,
        email: newAddUserEmail,
        createdAt: serverTimestamp(),
      });

      setSuccessMessage(`New ${newAddUserRole} user created successfully!`);
      // Clear form states
      setNewAddUserEmail('');
      setNewAddUserPassword('');
      setNewAddUserRole('cashier');
      setAdminPasswordForUserCreation('');
      setShowAddUserModal(false);
    } catch (error) {
      console.error("User creation error:", error);
      setErrorMessage("Failed to create user: " + error.message);
    }
  };

  const openEditUserRoleModal = (user) => {
    setEditingUserForRole(user);
    setNewRoleForUser(user.role);
    setShowEditUserRoleModal(true);
  };

  const handleEditUserRole = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!editingUserForRole || !newRoleForUser.trim()) {
      setErrorMessage("User or new role not selected.");
      return;
    }

    if (!db) {
      setErrorMessage("Database not ready.");
      return;
    }

    try {
      const userRoleDocRef = doc(db, `artifacts/${window.__app_id}/user_roles`, editingUserForRole.id);
      await updateDoc(userRoleDocRef, {
        role: newRoleForUser,
        lastUpdated: serverTimestamp(),
      });
      setSuccessMessage(`Role for ${editingUserForRole.email} updated to ${newRoleForUser} successfully.`);
      setShowEditUserRoleModal(false);
      setEditingUserForRole(null);
      setNewRoleForUser('');
    } catch (error) {
      console.error("Error updating user role:", error);
      setErrorMessage("Failed to update user role: " + error.message);
    }
  };

  const openConfirmDeleteUserModal = (userIdToDelete) => {
    if (userIdToDelete === userId) {
      setErrorMessage("You cannot delete your own account.");
      return;
    }
    setDeletingUserId(userIdToDelete);
    setShowConfirmDeleteUserModal(true);
  };
  
  const handleDeleteUser = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!deletingUserId) {
      setErrorMessage("No user selected for deletion.");
      return;
    }
    if (!db || !userId) {
      setErrorMessage("Database not ready. Please wait or refresh.");
      return;
    }
    // Note: We are only deleting the user's role document from Firestore.
    // Deleting the user from Firebase Authentication requires re-authentication
    // with a recent login, which is not implemented here. This is a common
    // security consideration.
    try {
      const userRef = doc(db, `artifacts/${window.__app_id}/user_roles`, deletingUserId);
      await deleteDoc(userRef);
      setSuccessMessage('User role deleted successfully!');
      setShowConfirmDeleteUserModal(false);
      setDeletingUserId(null);
    } catch (error) {
      console.error("Error deleting user role:", error);
      setErrorMessage("Failed to delete user role: " + error.message);
    }
  };

  const confirmDeleteSale = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!deletingSaleId) {
      setErrorMessage("No sale selected for deletion.");
      return;
    }
    if (!db || !userId) {
      setErrorMessage("Database not ready. Please wait or refresh.");
      return;
    }

    try {
      const saleRef = doc(db, `artifacts/${window.__app_id}/public/data/sales`, deletingSaleId);
      await deleteDoc(saleRef);
      setSuccessMessage('Sale record deleted successfully!');
      setShowConfirmDeleteModal(false);
      setDeletingSaleId(null);
    } catch (error) {
      console.error("Error deleting sale record:", error);
      setErrorMessage("Failed to delete sale record: " + error.message);
    }
  };


  // --- UI Components ---
  const Loader = () => (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 font-[Inter]">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-indigo-600"></div>
    </div>
  );

  const AuthForm = () => {
    const handleSubmit = (e) => {
      e.preventDefault();
      handleAuthAction();
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 font-[Inter] p-4">
        <style>{customStyles}</style>
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm">
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Hazwan Alani's Kitchen</h1>
            <h2 className="text-2xl font-semibold text-center text-gray-800 mb-2">Welcome Back</h2>
            <p className="text-center text-gray-500">Sign in to your account</p>
          </div>

          {errorMessage && (
            <div className="p-3 mb-4 text-sm text-white bg-red-500 rounded-lg text-center">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="p-3 mb-4 text-sm text-white bg-green-500 rounded-lg text-center">
              {successMessage}
            </div>
          )}

          {showForgotPassword ? (
            <form onSubmit={(e) => { e.preventDefault(); handlePasswordReset(); }} className="space-y-4">
              <div>
                <label className="label-field" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="input-field"
                  required
                />
              </div>
              <button type="submit" className="w-full btn-primary">
                Send Reset Email
              </button>
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="w-full text-center text-sm text-indigo-600 hover:underline mt-4"
              >
                Back to Sign In
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label-field" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label-field" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="input-field"
                  required
                />
              </div>
              <button type="submit" className="w-full btn-primary">
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="w-full text-center text-sm text-gray-500 hover:text-indigo-600 transition-colors"
              >
                Forgot Password?
              </button>
            </form>
          )}
        </div>
        <footer className="footer mt-6">
          &copy; 2024 MHA POS System created by Muhammad Hazwan Arif
        </footer>
      </div>
    );
  };

  const AdminPanel = () => {
    const renderAdminDashboard = () => {
      const filteredSales = sales.filter(sale => {
        const saleDate = sale.date;
        const customerMatch = filterCustomerName.toLowerCase() === '' || sale.customerName.toLowerCase().includes(filterCustomerName.toLowerCase());
        const paymentMatch = filterPaymentMethod === '' || sale.paymentMethod === filterPaymentMethod;
        return customerMatch && paymentMatch 
      });

      const handleOpenEditSaleModal = (sale) => {
        setEditingSale(sale);
        setEditSaleDate(sale.date);
        setEditSaleCustomerName(sale.customerName);
        setEditSalePaymentMethod(sale.paymentMethod);
        setEditSaleRemark(sale.remark || '');
        setEditSaleItems(sale.items.map(item => ({
            ...item,
            originalPrice: item.originalPrice || 0,
            discountApplied: item.discountApplied || 0,
            totalPrice: (item.originalPrice - (item.discountApplied || 0)) * item.quantity
        })));
        setShowEditSaleModal(true);
      };

      const handleUpdateSale = async () => {
        setErrorMessage('');
        setSuccessMessage('');

        if (!editingSale || !editSaleDate || !editSaleCustomerName || !editSalePaymentMethod) {
          setErrorMessage("All fields are required to update sale.");
          return;
        }

        if (!db) {
          setErrorMessage("Database not ready.");
          return;
        }

        const updatedTotal = editSaleItems.reduce((sum, item) => sum + item.totalPrice, 0);

        const pendingUpdate = {
          saleId: editingSale.id,
          updatedData: {
            date: editSaleDate,
            customerName: editSaleCustomerName,
            paymentMethod: editSalePaymentMethod,
            remark: editSaleRemark,
            items: editSaleItems,
            total: updatedTotal,
            lastUpdatedBy: userId,
            lastUpdated: serverTimestamp()
          }
        };

        setPendingSaleUpdate(pendingUpdate);
        setShowConfirmEditSaleModal(true);
        setShowEditSaleModal(false);
      };


      const confirmUpdateSale = async () => {
        setErrorMessage('');
        setSuccessMessage('');
        if (!pendingSaleUpdate || !db) {
          setErrorMessage("No pending update to confirm.");
          setShowConfirmEditSaleModal(false);
          return;
        }

        try {
          const saleRef = doc(db, `artifacts/${window.__app_id}/public/data/sales`, pendingSaleUpdate.saleId);
          await updateDoc(saleRef, pendingSaleUpdate.updatedData);
          setSuccessMessage("Sale record updated successfully!");
          setPendingSaleUpdate(null);
          setShowConfirmEditSaleModal(false);
        } catch (error) {
          console.error("Error updating sale record:", error);
          setErrorMessage("Failed to update sale record: " + error.message);
        }
      };
      const openConfirmDeleteModal = (saleId) => {
        setDeletingSaleId(saleId);
        setShowConfirmDeleteModal(true);
      };

      const handleAddUser = (e) => {
        e.preventDefault();
        handleCreateUser();
      };
      
      return (
        <div className="flex-1 flex flex-col overflow-auto bg-gray-100 font-[Inter]">
          <style>{customStyles}</style>
          {/* Admin Header */}
          <header className="bg-white shadow-md p-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600 text-sm">Signed in as: <span className="font-medium">{auth?.currentUser?.email}</span></span>
              <button onClick={handleSignOut} className="btn-secondary">
                Sign Out
              </button>
            </div>
          </header>

          {/* Admin Navigation Tabs */}
          <div className="bg-white px-4 pt-2 border-b border-gray-200">
            <div className="flex space-x-4">
              <button
                onClick={() => setCurrentAdminView('products')}
                className={`tab-button ${currentAdminView === 'products' ? 'tab-button-active' : ''}`}
              >
                Manage Products
              </button>
              <button
                onClick={() => setCurrentAdminView('sales')}
                className={`tab-button ${currentAdminView === 'sales' ? 'tab-button-active' : ''}`}
              >
                Sales History
              </button>
              <button
                onClick={() => setCurrentAdminView('users')}
                className={`tab-button ${currentAdminView === 'users' ? 'tab-button-active' : ''}`}
              >
                Manage Users
              </button>
            </div>
          </div>
          
          <div className="flex-1 p-6 overflow-auto">
            {errorMessage && (
              <div className="p-3 mb-4 text-sm text-white bg-red-500 rounded-lg text-center">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="p-3 mb-4 text-sm text-white bg-green-500 rounded-lg text-center">
                {successMessage}
              </div>
            )}
            <div className="bg-white p-6 rounded-xl shadow-lg">

              {currentAdminView === 'products' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-semibold text-gray-700">Products List</h2>
                    <button
                      onClick={() => setShowAddProductModal(true)}
                      className="btn-primary"
                    >
                      Add New Product
                    </button>
                  </div>
                  <div className="overflow-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="table-header">Product Name</th>
                          <th className="table-header">Batch Number</th>
                          <th className="table-header">Price</th>
                          <th className="table-header">Stock</th>
                          <th className="table-header">Status</th>
                          <th className="table-header text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {products.map((product) => (
                          <tr key={product.id}>
                            <td className="table-cell font-medium text-gray-900">{product.name}</td>
                            <td className="table-cell">{product.batchNumber}</td>
                            <td className="table-cell">MYR {product.price.toFixed(2)}</td>
                            <td className="table-cell">{product.stock}</td>
                            <td className="table-cell">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  product.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {product.status || 'Active'}
                              </span>
                            </td>
                            <td className="table-cell text-right">
                              <div className="flex justify-end space-x-2">
                                <button
                                  onClick={() => openEditProductModal(product)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(product.id)}
                                  className="text-red-600 hover:text-red-900"
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

              {currentAdminView === 'sales' && (
                <div>
                  <h2 className="text-2xl font-semibold text-gray-700 mb-4">Sales History</h2>
                  {/* Sales Filtering UI */}
                  <div className="bg-white p-4 rounded-xl shadow-inner mb-6 flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <label htmlFor="filterCustomerName" className="label-field">Customer Name</label>
                      <input
                        type="text"
                        id="filterCustomerName"
                        value={filterCustomerName}
                        onChange={(e) => setFilterCustomerName(e.target.value)}
                        placeholder="Filter by customer name"
                        className="input-field-small"
                      />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <label htmlFor="filterPaymentMethod" className="label-field">Payment Method</label>
                      <select
                        id="filterPaymentMethod"
                        value={filterPaymentMethod}
                        onChange={(e) => setFilterPaymentMethod(e.target.value)}
                        className="input-field-small"
                      >
                        <option value="">All</option>
                        <option value="Cash">Cash</option>
                        <option value="DuitNowQR">DuitNowQR</option>
                      </select>
                    </div>
                    </div>

                  {/* Sales Table */}
                  <div className="overflow-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="table-header">Sale ID</th>
                          <th className="table-header">Date</th>
                          <th className="table-header">Customer Name</th>
                          <th className="table-header">Total</th>
                          <th className="table-header">Payment Method</th>
                          <th className="table-header text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredSales.map((sale) => (
                          <React.Fragment key={sale.id}>
                            <tr className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setExpandedSaleId(expandedSaleId === sale.id ? null : sale.id)}>
                              <td className="table-cell text-xs text-gray-500">{sale.id}</td>
                              <td className="table-cell">
                                {sale.purchaseDate}
                              </td>
                              <td className="table-cell">{sale.customerName}</td>
                              <td className="table-cell font-medium">MYR {sale.total?.toFixed(2) || '0.00'}</td>
                              <td className="table-cell">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                  {sale.paymentMethod}
                                </span>
                              </td>
                              
                              <td className="table-cell text-right">
                                <div className="flex justify-end space-x-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenEditSaleModal(sale); }}
                                    className="text-indigo-600 hover:text-indigo-900"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openConfirmDeleteModal(sale.id); }}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {expandedSaleId === sale.id && (
                              <tr className="bg-gray-100">
                                <td colSpan="6" className="p-4">
                                  <div className="p-4 rounded-lg bg-white shadow-inner">
                                    <h4 className="text-lg font-bold text-gray-800 mb-2">Sale Details</h4>
                                    <p className="text-sm text-gray-600 mb-2"><strong>Remark:</strong> {sale.remark || 'N/A'}</p>
                                    <table className="min-w-full divide-y divide-gray-200 mt-2">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price (MYR)</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount (MYR)</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total (MYR)</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch No</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {sale.items.map((item, index) => (
                                          <tr key={index}>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.quantity}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.originalPrice?.toFixed(2) || '0.00'}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.discountApplied?.toFixed(2) || '0.00'}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.totalPrice?.toFixed(2) || '0.00'}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.batchNumber || 'N/A'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
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

              {currentAdminView === 'users' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-semibold text-gray-700">User Management</h2>
                    <button
                      onClick={() => setShowAddUserModal(true)}
                      className="btn-primary"
                    >
                      Add New User
                    </button>
                  </div>
                  <div className="overflow-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="table-header">User Email</th>
                          <th className="table-header">Role</th>
                          <th className="table-header">User ID</th>
                          <th className="table-header text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {usersInSystem.map((user) => (
                          <tr key={user.id}>
                            <td className="table-cell font-medium text-gray-900">{user.email}</td>
                            <td className="table-cell">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  user.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {user.role}
                              </span>
                            </td>
                            <td className="table-cell text-xs text-gray-500">{user.id}</td>
                            <td className="table-cell text-right">
                              <div className="flex justify-end space-x-2">
                                <button
                                  onClick={() => openEditUserRoleModal(user)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                >
                                  Edit Role
                                </button>
                                <button
                                  onClick={() => openConfirmDeleteUserModal(user.id)}
                                  className="text-red-600 hover:text-red-900"
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
            </div>
          </div>

          {/* --- NEW MODALS --- */}
          {showEditSaleModal && (
            <div className="modal-overlay">
              <div className="modal-content-lg">
                <h2 className="text-2xl font-semibold text-gray-700 mb-4">Edit Sale Record</h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="editSaleDate" className="label-field">Sale Date</label>
                    <input
                      id="editSaleDate"
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="editSaleCustomerName" className="label-field">Customer Name</label>
                    <input
                      id="editSaleCustomerName"
                      type="text"
                      value={editSaleCustomerName}
                      onChange={(e) => setEditSaleCustomerName(e.target.value)}
                      placeholder="Enter customer name"
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="editSalePaymentMethod" className="label-field">Payment Method</label>
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
                </div>
                <div className="mb-4">
                  <label htmlFor="editSaleRemark" className="label-field">Remark</label>
                  <textarea
                    id="editSaleRemark"
                    value={editSaleRemark}
                    onChange={(e) => setEditSaleRemark(e.target.value)}
                    placeholder="Add a remark (optional)"
                    className="input-field"
                  />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Items</h3>
                <div className="bg-white rounded-xl shadow-lg overflow-auto max-h-60 mb-4">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Original Price</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {editSaleItems.map((item, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.quantity}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">MYR {item.originalPrice?.toFixed(2) || '0.00'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.discountApplied?.toFixed(2) || '0.00'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.totalPrice?.toFixed(2) || '0.00'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between items-center text-lg font-bold text-gray-800 mb-6">
                  <span>New Total:</span>
                  <span>MYR {editSaleItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-end space-x-3">
                  <button onClick={() => setShowEditSaleModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button onClick={handleUpdateSale} className="btn-primary">
                    Update Sale
                  </button>
                </div>
              </div>
            </div>
          )}

          {showConfirmEditSaleModal && (
            <div className="modal-overlay">
              <div className="modal-content">
                <h2 className="text-2xl font-semibold text-gray-700 mb-4">Confirm Sale Update</h2>
                <p className="text-gray-600 mb-6">Are you sure you want to update this sale record? This action cannot be undone.</p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowConfirmEditSaleModal(false);
                      setShowEditSaleModal(true); // Go back to the edit modal
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button onClick={confirmUpdateSale} className="btn-primary bg-green-600 hover:bg-green-700">
                    Confirm Update
                  </button>
                </div>
              </div>
            </div>
          )}
          {showConfirmDeleteModal && (
            <div className="modal-overlay">
              <div className="modal-content">
                <h2 className="text-2xl font-semibold text-gray-700 mb-4">Confirm Deletion</h2>
                <p className="text-gray-600 mb-6">Are you sure you want to permanently delete this sale record? This action cannot be undone.</p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowConfirmDeleteModal(false);
                      setDeletingSaleId(null);
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button onClick={confirmDeleteSale} className="btn-primary bg-red-600 hover:bg-red-700">
                    Confirm Delete
                  </button>
                </div>
              </div>
            </div>
          )}
          {showAddProductModal && (
            <div className="modal-overlay">
              <div className="modal-content">
                <h2 className="text-2xl font-semibold text-gray-700 mb-4">Add New Product</h2>
                <form onSubmit={(e) => { e.preventDefault(); handleAddProduct(); }} className="space-y-4">
                  <div>
                    <label className="label-field" htmlFor="newProductName">Product Name</label>
                    <input
                      id="newProductName"
                      type="text"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      placeholder="e.g., Iced Latte"
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-field" htmlFor="newProductPrice">Price (MYR)</label>
                    <input
                      id="newProductPrice"
                      type="number"
                      step="0.01"
                      value={newProductPrice}
                      onChange={(e) => setNewProductPrice(e.target.value)}
                      placeholder="e.g., 12.50"
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-field" htmlFor="newProductStock">Stock</label>
                    <input
                      id="newProductStock"
                      type="number"
                      value={newProductStock}
                      onChange={(e) => setNewProductStock(e.target.value)}
                      placeholder="e.g., 100"
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-field" htmlFor="newProductBatchNumber">Batch Number</label>
                    <input
                      id="newProductBatchNumber"
                      type="text"
                      value={newProductBatchNumber}
                      onChange={(e) => setNewProductBatchNumber(e.target.value)}
                      placeholder="e.g., BLK123"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label-field" htmlFor="newProductStatus">Status</label>
                    <select
                      id="newProductStatus"
                      value={newProductStatus}
                      onChange={(e) => setNewProductStatus(e.target.value)}
                      className="input-field"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button type="button" onClick={() => setShowAddProductModal(false)} className="btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary">
                      Add Product
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showEditProductModal && (
            <div className="modal-overlay">
              <div className="modal-content">
                <h2 className="text-2xl font-semibold text-gray-700 mb-4">Edit Product</h2>
                <form onSubmit={(e) => { e.preventDefault(); handleEditProduct(); }} className="space-y-4">
                  <div>
                    <label className="label-field" htmlFor="editProductName">Product Name</label>
                    <input
                      id="editProductName"
                      type="text"
                      value={editProductName}
                      onChange={(e) => setEditProductName(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-field" htmlFor="editProductPrice">Price (MYR)</label>
                    <input
                      id="editProductPrice"
                      type="number"
                      step="0.01"
                      value={editProductPrice}
                      onChange={(e) => setEditProductPrice(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-field" htmlFor="editProductStock">Stock</label>
                    <input
                      id="editProductStock"
                      type="number"
                      value={editProductStock}
                      onChange={(e) => setEditProductStock(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-field" htmlFor="editProductBatchNumber">Batch Number</label>
                    <input
                      id="editProductBatchNumber"
                      type="text"
                      value={editProductBatchNumber}
                      onChange={(e) => setEditProductBatchNumber(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label-field" htmlFor="editProductStatus">Status</label>
                    <select
                      id="editProductStatus"
                      value={editProductStatus}
                      onChange={(e) => setEditProductStatus(e.target.value)}
                      className="input-field"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button type="button" onClick={() => setShowEditProductModal(false)} className="btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary">
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showAddUserModal && (
            <div className="modal-overlay">
              <div className="modal-content">
                <h2 className="text-2xl font-semibold text-gray-700 mb-4">Add New User</h2>
                <form onSubmit={handleAddUser} className="space-y-4">
                  <div>
                    <label className="label-field" htmlFor="newUserEmail">Email</label>
                    <input
                      id="newUserEmail"
                      type="email"
                      value={newAddUserEmail}
                      onChange={(e) => setNewAddUserEmail(e.target.value)}
                      placeholder="e.g., user@example.com"
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-field" htmlFor="newUserPassword">Password</label>
                    <input
                      id="newUserPassword"
                      type="password"
                      value={newAddUserPassword}
                      onChange={(e) => setNewAddUserPassword(e.target.value)}
                      placeholder="Must be at least 6 characters"
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-field" htmlFor="newUserRole">Role</label>
                    <select
                      id="newUserRole"
                      value={newAddUserRole}
                      onChange={(e) => setNewAddUserRole(e.target.value)}
                      className="input-field"
                    >
                      <option value="cashier">Cashier</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-field" htmlFor="adminPassword">Your Admin Password</label>
                    <input
                      id="adminPassword"
                      type="password"
                      value={adminPasswordForUserCreation}
                      onChange={(e) => setAdminPasswordForUserCreation(e.target.value)}
                      placeholder="Confirm your password to proceed"
                      className="input-field"
                      required
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button type="button" onClick={() => setShowAddUserModal(false)} className="btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary">
                      Create User
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showEditUserRoleModal && (
            <div className="modal-overlay">
              <div className="modal-content">
                <h2 className="text-2xl font-semibold text-gray-700 mb-4">Edit User Role</h2>
                <p className="text-gray-600 mb-4">Editing role for: <span className="font-semibold">{editingUserForRole?.email}</span></p>
                <div className="mb-4">
                  <label className="label-field" htmlFor="newRoleForUser">New Role</label>
                  <select
                    id="newRoleForUser"
                    value={newRoleForUser}
                    onChange={(e) => setNewRoleForUser(e.target.value)}
                    className="input-field"
                  >
                    <option value="cashier">Cashier</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex justify-end space-x-3">
                  <button type="button" onClick={() => setShowEditUserRoleModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button onClick={handleEditUserRole} className="btn-primary">
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
          {showConfirmDeleteUserModal && (
            <div className="modal-overlay">
              <div className="modal-content">
                <h2 className="text-2xl font-semibold text-gray-700 mb-4">Confirm User Deletion</h2>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete the user role for <span className="font-semibold">{usersInSystem.find(user => user.id === deletingUserId)?.email}</span>?
                  This will prevent them from logging in. This action cannot be undone.
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowConfirmDeleteUserModal(false);
                      setDeletingUserId(null);
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button onClick={handleDeleteUser} className="btn-primary bg-red-600 hover:bg-red-700">
                    Confirm Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    };

    return renderAdminDashboard();
  };

  const CashierPanel = () => {
    return (
      <div className="flex-1 flex flex-col p-6 overflow-auto bg-gray-100 font-[Inter]">
        <style>{customStyles}</style>
        <div className="bg-white shadow-md rounded-xl p-6 flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Cashier Panel</h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600 text-sm">Signed in as: <span className="font-medium">{auth?.currentUser?.email}</span></span>
            <button onClick={handleSignOut} className="btn-secondary">
              Sign Out
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-grow">
          {/* Product Grid */}
          <div className="col-span-1 lg:col-span-2 bg-white rounded-xl shadow-lg p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-gray-700">Products</h2>
            </div>
            {errorMessage && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-lg" role="alert">
                <p>{errorMessage}</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto flex-grow">
              {products.length > 0 ? (
                products.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => addProductToCart(product)}
                    className="bg-gray-50 rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <h3 className="font-semibold text-gray-800 text-lg">{product.name}</h3>
                      <p className="text-gray-600 text-sm">Stock: {product.stock}</p>
                    </div>
                    <div className="mt-2">
                      <span className="text-lg font-bold text-indigo-600">MYR {product.price.toFixed(2)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 col-span-full p-8">No active products available.</div>
              )}
            </div>
          </div>

          {/* Cart & Checkout */}
          <div className="col-span-1 bg-white rounded-xl shadow-lg p-6 flex flex-col">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">Cart</h2>
            {successMessage && (
              <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4 rounded-lg" role="alert">
                <p>{successMessage}</p>
              </div>
            )}
            <div className="flex-1 overflow-y-auto mb-4">
              {cart.length > 0 ? (
                cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b border-gray-200 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        MYR {(item.price - (item.discountApplied || 0)).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex flex-col space-y-1 ml-4">
                      <div className="flex items-center space-x-2">
                        <label className="text-xs text-gray-500">Qty:</label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateCartQuantity(item.id, parseInt(e.target.value))}
                          min="1"
                          className="input-field-table w-16 text-center"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <label className="text-xs text-gray-500">Disc:</label>
                        <input
                          type="number"
                          value={item.discountApplied}
                          onChange={(e) => updateCartItemDiscount(item.id, e.target.value)}
                          min="0"
                          className="input-field-table w-16 text-center"
                        />
                      </div>
                    </div>
                    <div className="ml-4">
                      <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 p-8">Cart is empty.</div>
              )}
            </div>

            <div className="mt-auto">
              <div className="flex justify-between items-center text-xl font-bold text-gray-800 mb-4">
                <span>Total:</span>
                <span>MYR {total.toFixed(2)}</span>
              </div>
              <div className="space-y-4">
                <div>
                  <label htmlFor="customerName" className="label-field">Customer Name</label>
                  <input
                    id="customerName"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="paymentMethod" className="label-field">Payment Method</label>
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
                  <label htmlFor="purchaseDate" className="label-field">Purchase Date</label>
                  <input
                    id="purchaseDate"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <button
                  onClick={checkout}
                  className="w-full btn-primary"
                >
                  Complete Sale
                </button>
                <button
                  onClick={clearSale}
                  className="w-full btn-secondary"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- MAIN APP RENDER LOGIC ---
  return (
    <div className="main-container">
      <style>{customStyles}</style>
      {loading || !isAuthReady ? (
        <Loader />
      ) : !isAuthenticated ? (
        <AuthForm />
      ) : userRole === 'admin' ? (
        <AdminPanel />
      ) : userRole === 'cashier' ? (
        <CashierPanel />
      ) : (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 font-[Inter]">
          <p className="text-red-500">Authentication state is unexpected. Please try again...</p>
        </div>
      )}
      {isAuthenticated && (
        <footer className="footer">
          &copy; 2024 MHA POS System created by Muhammad Hazwan Arif
        </footer>
      )}
    </div>
  );
};
