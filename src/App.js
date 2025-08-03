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
  getDoc
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
  const [selectedRoleAttempt, setSelectedRoleAttempt] = useState(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // New states for cashier panel customer details
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [remark, setRemark] = useState(''); // New state for sale remark

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
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
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
      // This part ensures that if the component unmounts and remounts (e.g., hot reload),
      // the scripts/links are not duplicated.
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
    if (!auth || !selectedRoleAttempt || !email.trim() || !password.trim()) {
      setErrorMessage("Authentication service not ready, role not selected, or email/password missing.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setEmail('');
      setPassword('');
      setSelectedRoleAttempt(null);
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
        return prevCart.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
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
      return prevCart.map(item =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      );
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
    setRemark('');
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
          const discountedPrice = Math.max(0, originalPrice - discountApplied); // Ensure price doesn't go negative
          return {
            productId: item.id,
            name: item.name,
            originalPrice: originalPrice,
            discountedPrice: parseFloat(discountedPrice.toFixed(2)),
            discountApplied: parseFloat(discountApplied.toFixed(2)), // Store the applied discount
            quantity: item.quantity,
            batchNumber: item.batchNumber || '' // Include batch number in sale item
          };
        });

        const finalSaleTotal = saleItems.reduce((sum, item) => sum + item.discountedPrice * item.quantity, 0);
        const totalDiscount = saleItems.reduce((sum, item) => sum + item.discountApplied * item.quantity, 0);

        transaction.set(doc(salesCollectionRef), {
          items: saleItems,
          total: parseFloat(finalSaleTotal.toFixed(2)),
          totalDiscount: parseFloat(totalDiscount.toFixed(2)),
          timestamp: serverTimestamp(),
          customerName: customerName.trim(),
          paymentMethod: paymentMethod,
          purchaseDate: purchaseDate,
          remark: remark.trim(), // New remark field
          soldBy: auth.currentUser?.email || 'Unknown Cashier', // Record who made the sale
          soldById: userId, // Record the ID of who made the sale
        });
      });

      clearSale(); // Use the new clear function
      setErrorMessage('');
      setSuccessMessage('Checkout successful!');
    } catch (error) {
      console.error("Error during checkout transaction:", error);
      setErrorMessage(`Checkout failed: ${error.message}`);
    }
  };

  const handleAddNewProduct = async () => {
    if (!newProductName.trim() || isNaN(parseFloat(newProductPrice)) || parseFloat(newProductPrice) <= 0 || isNaN(parseInt(newProductStock)) || parseInt(newProductStock) < 0) {
      setErrorMessage("Please enter a valid product name, a positive price, and a non-negative stock quantity.");
      return;
    }
    if (!db) {
      setErrorMessage("Database not ready. Please wait or refresh.");
      return;
    }

    try {
      const productsCollectionRef = collection(db, `artifacts/${window.__app_id}/public/data/products`);
      await addDoc(productsCollectionRef, {
        name: newProductName.trim(),
        price: parseFloat(newProductPrice),
        stock: parseInt(newProductStock),
        batchNumber: newProductBatchNumber.trim(),
        status: newProductStatus, // Save new product status
      });
      setNewProductName('');
      setNewProductPrice('');
      setNewProductStock('');
      setNewProductBatchNumber('');
      setNewProductStatus('Active'); // Reset to default
      setShowAddProductModal(false);
      setErrorMessage('');
      setSuccessMessage('Product added successfully!');
    } catch (error) {
      console.error("Error adding product:", error);
      setErrorMessage("Failed to add product. Please try again.");
    }
  };

  const openEditProductModal = (product) => {
    setEditingProduct(product);
    setEditProductName(product.name);
    setEditProductPrice(product.price);
    setEditProductStock(product.stock);
    setEditProductBatchNumber(product.batchNumber || '');
    setEditProductStatus(product.status || 'Active'); // Set existing status or default to Active
    setShowEditProductModal(true);
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct || !editProductName.trim() || isNaN(parseFloat(editProductPrice)) || parseFloat(editProductPrice) <= 0 || isNaN(parseInt(editProductStock)) || parseInt(editProductStock) < 0) {
      setErrorMessage("Please enter valid product details for editing.");
      return;
    }
    if (!db) {
      setErrorMessage("Database not ready. Please wait or refresh.");
      return;
    }
    try {
      const productDocRef = doc(db, `artifacts/${window.__app_id}/public/data/products`, editingProduct.id);
      await updateDoc(productDocRef, {
        name: editProductName.trim(),
        price: parseFloat(editProductPrice),
        stock: parseInt(editProductStock),
        batchNumber: editProductBatchNumber.trim(),
        status: editProductStatus, // Update product status
      });
      setShowEditProductModal(false);
      setEditingProduct(null);
      setErrorMessage('');
      setSuccessMessage('Product updated successfully!');
    } catch (error) {
      console.error("Error updating product:", error);
      setErrorMessage("Failed to update product. Please try again.");
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!db) {
      setErrorMessage("Database not ready. Please wait or refresh.");
      return;
    }
    try {
      const productDocRef = doc(db, `artifacts/${window.__app_id}/public/data/products`, productId);
      await deleteDoc(productDocRef);
      setErrorMessage('');
      setSuccessMessage('Product deleted successfully!');
    } catch (error) {
      console.error("Error deleting product:", error);
      setErrorMessage("Failed to delete product. Please try again.");
    }
  };

  // --- User Management Handlers (Admin Only) ---
  const handleAddNewUser = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!auth || !db || !newAddUserEmail.trim() || !newAddUserPassword.trim() || !newAddUserRole.trim() || !adminPasswordForUserCreation.trim()) {
      setErrorMessage("Please fill in all fields for the new user, including your admin password.");
      return;
    }
    const currentAdminUser = auth.currentUser; // Get the current admin's user object
    if (!currentAdminUser || !currentAdminUser.email) {
      setErrorMessage("Admin user session invalid. Please log out and back in.");
      return;
    }
    const currentAdminEmail = currentAdminUser.email;
    try {
      // 1. Create user in Firebase Authentication.
      // This action will automatically log in the new user, logging out the current admin.
      const userCredential = await createUserWithEmailAndPassword(auth, newAddUserEmail, newAddUserPassword);
      const newUserUid = userCredential.user.uid;

      // 2. Immediately re-authenticate the original administrator.
      // This is crucial to restore the admin's session.
      // The `auth` object now refers to the new user, so we need to sign them out first
      // before signing in the admin.
      await signOut(auth); // Sign out the newly created user
      await signInWithEmailAndPassword(auth, currentAdminEmail, adminPasswordForUserCreation); // Sign in the admin

      // 3. Assign role to the new user in Firestore.
      // This operation now happens while the original admin is authenticated.
      const userRoleDocRef = doc(db, `artifacts/${window.__app_id}/user_roles`, newUserUid);
      await setDoc(userRoleDocRef, {
        role: newAddUserRole,
        email: newAddUserEmail.trim()
      });
      setNewAddUserEmail('');
      setNewAddUserPassword('');
      setNewAddUserRole('cashier'); // Reset to default
      setAdminPasswordForUserCreation(''); // Clear admin password
      setShowAddUserModal(false);
      setSuccessMessage(`New user ${newAddUserEmail} (${newAddUserRole}) added successfully!`);
    } catch (error) {
      console.error("Error adding new user:", error);
      // If the error is during signInWithEmailAndPassword for the admin,
      // it means the admin's session couldn't be restored.
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setErrorMessage(`Failed to re-authenticate admin: ${error.message}. You have been logged out.`);
        // Ensure admin is logged out if re-auth fails
        await signOut(auth);
      } else {
        setErrorMessage(`Failed to add new user: ${error.message}`);
      }
    }
  };

  const openEditUserRoleModal = (user) => {
    setEditingUserForRole(user);
    setNewRoleForUser(user.role);
    setShowEditUserRoleModal(true);
  };

  const handleUpdateUserRole = async () => {
    if (!editingUserForRole || !newRoleForUser.trim()) {
      setErrorMessage("Please select a user and a role.");
      return;
    }
    if (!db) {
      setErrorMessage("Database not ready. Please wait or refresh.");
      return;
    }
    try {
      const userRoleDocRef = doc(db, `artifacts/${window.__app_id}/user_roles`, editingUserForRole.id);
      await updateDoc(userRoleDocRef, {
        role: newRoleForUser
      });
      setShowEditUserRoleModal(false);
      setEditingUserForRole(null);
      setNewRoleForUser('');
      setErrorMessage('');
      setSuccessMessage(`Role for ${editingUserForRole.email || editingUserForRole.id.substring(0, 8) + '...'} updated successfully!`);
    } catch (error) {
      console.error("Error updating user role:", error);
      setErrorMessage("Failed to update user role. Please try again.");
    }
  };


  // --- SALES HISTORY EDITING HANDLERS (ADMIN ONLY) ---

  const openEditSaleModal = (sale) => {
    setErrorMessage('');
    setSuccessMessage('');
    setEditingSale(sale);
    setEditSaleDate(sale.purchaseDate);
    setEditSaleCustomerName(sale.customerName);
    setEditSalePaymentMethod(sale.paymentMethod);
    setEditSaleRemark(sale.remark || '');
    setEditSaleItems(sale.items.map(item => ({
      ...item,
      // Ensure prices are numbers for calculations
      originalPrice: parseFloat(item.originalPrice),
      discountedPrice: parseFloat(item.discountedPrice),
      discountApplied: parseFloat(item.discountApplied),
    })));
    setShowEditSaleModal(true);
  };

  const handleUpdateEditSaleItem = (index, field, value) => {
    setEditSaleItems(prevItems => {
      const newItems = [...prevItems];
      const itemToUpdate = { ...newItems[index]
      };

      if (field === 'quantity') {
        const newQuantity = parseInt(value);
        if (isNaN(newQuantity) || newQuantity < 1) {
          setErrorMessage("Quantity must be a positive number.");
          return prevItems;
        }
        itemToUpdate.quantity = newQuantity;
      } else if (field === 'discountApplied') {
        const newDiscount = parseFloat(value);
        if (isNaN(newDiscount) || newDiscount < 0) {
          setErrorMessage("Discount must be a non-negative number.");
          return prevItems;
        }
        if (newDiscount > itemToUpdate.originalPrice) {
          setErrorMessage("Discount cannot be more than the item's price.");
          return prevItems;
        }
        itemToUpdate.discountApplied = newDiscount;
        itemToUpdate.discountedPrice = Math.max(0, itemToUpdate.originalPrice - newDiscount);
      } else if (field === 'batchNumber') {
        itemToUpdate.batchNumber = value;
      }

      newItems[index] = itemToUpdate;
      return newItems;
    });
  };

  const handleConfirmEditSale = () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!editSaleCustomerName.trim() || !editSaleDate || !editSalePaymentMethod) {
      setErrorMessage("Please fill in all required sale details.");
      return;
    }
    if (editSaleItems.length === 0) {
      setErrorMessage("A sale must have at least one item.");
      return;
    }

    const newTotal = editSaleItems.reduce((sum, item) => sum + item.discountedPrice * item.quantity, 0);
    const newTotalDiscount = editSaleItems.reduce((sum, item) => sum + item.discountApplied * item.quantity, 0);

    const updatedSale = {
      ...editingSale,
      customerName: editSaleCustomerName.trim(),
      purchaseDate: editSaleDate,
      paymentMethod: editSalePaymentMethod,
      remark: editSaleRemark.trim(),
      items: editSaleItems,
      total: parseFloat(newTotal.toFixed(2)),
      totalDiscount: parseFloat(newTotalDiscount.toFixed(2)),
    };

    setPendingSaleUpdate(updatedSale);
    setShowEditSaleModal(false); // Hide the edit form
    setShowConfirmEditSaleModal(true); // Show the confirmation modal
  };

  const confirmUpdateSale = async () => {
    if (!db || !pendingSaleUpdate) {
      setErrorMessage("Database or pending sale data is not ready.");
      setShowConfirmEditSaleModal(false);
      setShowEditSaleModal(false);
      return;
    }
    const appId = window.__app_id;
    const saleDocRef = doc(db, `artifacts/${appId}/public/data/sales`, pendingSaleUpdate.id);

    try {
      await updateDoc(saleDocRef, {
        customerName: pendingSaleUpdate.customerName,
        purchaseDate: pendingSaleUpdate.purchaseDate,
        paymentMethod: pendingSaleUpdate.paymentMethod,
        remark: pendingSaleUpdate.remark,
        items: pendingSaleUpdate.items.map(item => {
          // Clean up the item objects for saving
          const {
            originalPrice,
            discountedPrice,
            discountApplied,
            quantity,
            batchNumber,
            name,
            productId
          } = item;
          return {
            originalPrice,
            discountedPrice,
            discountApplied,
            quantity,
            batchNumber,
            name,
            productId
          };
        }),
        total: pendingSaleUpdate.total,
        totalDiscount: pendingSaleUpdate.totalDiscount,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || 'Unknown Admin',
      });
      setSuccessMessage("Sale record updated successfully!");
    } catch (error) {
      console.error("Error updating sale record:", error);
      setErrorMessage(`Failed to update sale record: ${error.message}`);
    } finally {
      // Clean up state regardless of success or failure
      setShowConfirmEditSaleModal(false);
      setEditingSale(null);
      setPendingSaleUpdate(null);
    }
  };
  
  // --- NEW HANDLERS FOR DELETING SALES HISTORY ---
  const handleDeleteSale = (saleId) => {
      setErrorMessage('');
      setSuccessMessage('');
      setDeletingSaleId(saleId);
      setShowConfirmDeleteModal(true);
  };
  
  const confirmDeleteSale = async () => {
      if (!db || !deletingSaleId) {
          setErrorMessage("Database or sale ID not ready.");
          setShowConfirmDeleteModal(false);
          return;
      }
      const appId = window.__app_id;
      const saleDocRef = doc(db, `artifacts/${appId}/public/data/sales`, deletingSaleId);
      
      try {
          await deleteDoc(saleDocRef);
          setSuccessMessage("Sale record deleted successfully!");
      } catch (error) {
          console.error("Error deleting sale record:", error);
          setErrorMessage(`Failed to delete sale record: ${error.message}`);
      } finally {
          setShowConfirmDeleteModal(false);
          setDeletingSaleId(null);
      }
  };

  // --- HELPER FUNCTION FOR SALES HISTORY FILTERING ---
  const getFilteredSales = () => {
    return sales.filter(sale => {
      // Customer Name filter
      const customerNameMatch = filterCustomerName.trim() === '' ||
        (sale.customerName && sale.customerName.toLowerCase().includes(filterCustomerName.toLowerCase()));

      // Payment Method filter
      const paymentMethodMatch = filterPaymentMethod === '' ||
        (sale.paymentMethod && sale.paymentMethod === filterPaymentMethod);

      // Date Range filter
      const saleDate = new Date(sale.purchaseDate);
      const start = filterStartDate ? new Date(filterStartDate) : null;
      const end = filterEndDate ? new Date(filterEndDate) : null;

      const dateMatch = (!start || saleDate >= start) && (!end || saleDate <= end);
      
      return customerNameMatch && paymentMethodMatch && dateMatch;
    });
  };
  
  // --- RENDERING COMPONENTS ---

  const Message = ({ message, type }) => {
    const color = type === 'error' ? 'text-red-800 bg-red-100' : 'text-green-800 bg-green-100';
    if (!message) return null;
    return (
      <div className={`p-3 rounded-lg text-sm font-medium ${color}`}>
        {message}
      </div>
    );
  };

  const Loader = () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  const AuthForm = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 font-[Inter]">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-2xl">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">MHA POS System</h1>
        <Message message={errorMessage} type="error" />
        <Message message={successMessage} type="success" />

        {showForgotPassword ? (
          <div>
            <h2 className="text-2xl font-semibold text-gray-700 mb-4 text-center">Forgot Password</h2>
            <p className="text-sm text-gray-600 mb-4 text-center">
              Enter your email to receive a password reset link.
            </p>
            <div className="mb-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                className="input-field"
              />
            </div>
            <button onClick={handlePasswordReset} className="btn-primary w-full mb-3">Send Reset Email</button>
            <button
              onClick={() => {
                setShowForgotPassword(false);
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className="btn-secondary w-full"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-semibold text-gray-700 mb-4 text-center">Log In</h2>
            <div className="mb-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                className="input-field"
              />
            </div>
            <div className="mb-6">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="input-field"
              />
            </div>
            <div className="flex flex-col space-y-3">
              <button onClick={() => {
                setSelectedRoleAttempt('admin');
                handleAuthAction();
              }} className="btn-primary">
                Log In as Admin
              </button>
              <button onClick={() => {
                setSelectedRoleAttempt('cashier');
                handleAuthAction();
              }} className="btn-secondary">
                Log In as Cashier
              </button>
            </div>
            <div className="text-center mt-4">
              <button
                onClick={() => {
                  setShowForgotPassword(true);
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Forgot Password?
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const CashierPanel = () => (
    <div className="flex flex-col md:flex-row h-screen bg-gray-100 font-[Inter]">
      {/* Product List */}
      <div className="w-full md:w-3/5 p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Products</h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600">Signed in as: <span className="font-semibold">{auth.currentUser?.email}</span></span>
            <button onClick={handleSignOut} className="btn-secondary">Sign Out</button>
          </div>
        </div>
        <Message message={errorMessage} type="error" />
        <Message message={successMessage} type="success" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map(product => (
            <div key={product.id} className="bg-white p-4 rounded-xl shadow-lg flex flex-col justify-between transform transition duration-300 hover:scale-105">
              <div className="flex-grow">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{product.name}</h3>
                <p className="text-sm text-gray-600">Batch: {product.batchNumber || 'N/A'}</p>
                <p className="text-sm text-gray-600">Stock: {product.stock}</p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-2xl font-bold text-indigo-600">
                  RM{product.price ? product.price.toFixed(2) : '0.00'}
                </span>
                <button
                  onClick={() => addProductToCart(product)}
                  className="btn-primary"
                  disabled={product.stock <= 0}
                >
                  Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart & Checkout */}
      <div className="w-full md:w-2/5 p-6 bg-gray-50 flex flex-col h-full">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Checkout</h2>
        <div className="flex-grow overflow-y-auto">
          {cart.length === 0 ? (
            <div className="text-center text-gray-500 py-10">Cart is empty.</div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm mb-4">
                <div className="flex-grow">
                  <h3 className="font-semibold text-gray-800">{item.name}</h3>
                  <p className="text-sm text-gray-500">Price: RM{(item.price - (item.discountApplied || 0)).toFixed(2)}</p>
                  <p className="text-sm text-gray-500">Batch: {item.batchNumber || 'N/A'}</p>
                  <div className="mt-2 text-sm text-gray-600">
                    <label className="block">Discount (RM):</label>
                    <input
                      type="number"
                      value={item.discountApplied}
                      onChange={(e) => updateCartItemDiscount(item.id, e.target.value)}
                      min="0"
                      step="0.01"
                      className="input-field-small"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateCartQuantity(item.id, parseInt(e.target.value))}
                    min="1"
                    className="w-16 text-center border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-9V5a1 1 0 00-1-1H9a1 1 0 00-1 1v2m-6 0h14" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Customer Details & Actions */}
        <div className="mt-6 pt-6 border-t-2 border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="customerName" className="label-field">Customer Name</label>
              <input
                id="customerName"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
                className="input-field"
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
            <div className="col-span-1 md:col-span-2">
              <label htmlFor="remark" className="label-field">Remark</label>
              <input
                id="remark"
                type="text"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Add a remark (optional)"
                className="input-field"
              />
            </div>
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-2xl font-bold text-gray-800">Total:</span>
            <span className="text-3xl font-extrabold text-indigo-600">RM{total.toFixed(2)}</span>
          </div>
          <button onClick={checkout} className="btn-primary w-full mb-3" disabled={cart.length === 0}>
            Complete Sale
          </button>
          <button onClick={clearSale} className="btn-secondary w-full">
            Clear Sale
          </button>
        </div>
      </div>
    </div>
  );

  const AdminPanel = () => {
    // Get filtered sales data based on filter states
    const filteredSales = getFilteredSales();

    return (
      <div className="min-h-screen bg-gray-100 font-[Inter] flex flex-col">
        {/* Add the custom styles here */}
        <style>{customStyles}</style>
        <header className="bg-white shadow-md p-4 flex flex-col sm:flex-row justify-between items-center sticky top-0 z-10">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 sm:mb-0">Admin Dashboard</h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600 hidden md:block">Signed in as: <span className="font-semibold">{auth.currentUser?.email}</span></span>
            <button onClick={handleSignOut} className="btn-secondary">Sign Out</button>
          </div>
        </header>

        <div className="flex-grow p-6 overflow-y-auto">
          <div className="flex space-x-3 mb-6 border-b border-gray-200">
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

          <Message message={errorMessage} type="error" />
          <Message message={successMessage} type="success" />

          {currentAdminView === 'products' && (
            <div className="bg-white p-6 rounded-2xl shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-700">Products List</h2>
                <button onClick={() => {
                  setShowAddProductModal(true);
                  setErrorMessage('');
                  setSuccessMessage('');
                }} className="btn-primary">
                  Add New Product
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="table-header">Product Name</th>
                      <th scope="col" className="table-header">Batch Number</th>
                      <th scope="col" className="table-header">Price</th>
                      <th scope="col" className="table-header">Stock</th>
                      <th scope="col" className="table-header">Status</th>
                      <th scope="col" className="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-4 text-gray-500">No products found.</td>
                      </tr>
                    ) : (
                      products.map(product => (
                        <tr key={product.id}>
                          <td className="table-cell">{product.name}</td>
                          <td className="table-cell">{product.batchNumber || 'N/A'}</td>
                          <td className="table-cell">RM{product.price ? product.price.toFixed(2) : '0.00'}</td>
                          <td className="table-cell">{product.stock}</td>
                          <td className="table-cell">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${product.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {product.status || 'Active'}
                            </span>
                          </td>
                          <td className="table-cell">
                            <div className="flex items-center space-x-2">
                              <button onClick={() => openEditProductModal(product)} className="text-indigo-600 hover:text-indigo-900 transition">
                                Edit
                              </button>
                              <button onClick={() => handleDeleteProduct(product.id)} className="text-red-600 hover:text-red-900 transition">
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {currentAdminView === 'sales' && (
            <div className="bg-white p-6 rounded-2xl shadow-xl">
              <h2 className="text-2xl font-semibold text-gray-700 mb-6">Sales History</h2>
              {/* Sales History Filter Section */}
              <div className="mb-6 bg-gray-50 p-4 rounded-xl shadow-inner">
                <h3 className="font-semibold text-lg text-gray-700 mb-3">Filter Sales</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="filterCustomerName" className="label-field">Customer Name</label>
                    <input
                      id="filterCustomerName"
                      type="text"
                      value={filterCustomerName}
                      onChange={(e) => setFilterCustomerName(e.target.value)}
                      placeholder="e.g., John Doe"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label htmlFor="filterPaymentMethod" className="label-field">Payment Method</label>
                    <select
                      id="filterPaymentMethod"
                      value={filterPaymentMethod}
                      onChange={(e) => setFilterPaymentMethod(e.target.value)}
                      className="input-field"
                    >
                      <option value="">All</option>
                      <option value="Cash">Cash</option>
                      <option value="DuitNowQR">DuitNowQR</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="filterStartDate" className="label-field">Start Date</label>
                    <input
                      id="filterStartDate"
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label htmlFor="filterEndDate" className="label-field">End Date</label>
                    <input
                      id="filterEndDate"
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="table-header">Sale ID</th>
                      <th scope="col" className="table-header">Date</th>
                      <th scope="col" className="table-header">Customer Name</th>
                      <th scope="col" className="table-header">Total Amount</th>
                      <th scope="col" className="table-header">Payment Method</th>
                      <th scope="col" className="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredSales.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-4 text-gray-500">No sales history found.</td>
                      </tr>
                    ) : (
                      filteredSales.map(sale => (
                        <React.Fragment key={sale.id}>
                          <tr
                            className="cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => setExpandedSaleId(expandedSaleId === sale.id ? null : sale.id)}
                          >
                            <td className="table-cell">{sale.id.substring(0, 8)}...</td>
                            <td className="table-cell">
                              {sale.purchaseDate || (sale.timestamp ? new Date(sale.timestamp.seconds * 1000).toLocaleDateString() : 'N/A')}
                            </td>
                            <td className="table-cell">{sale.customerName}</td>
                            <td className="table-cell">RM{sale.total ? sale.total.toFixed(2) : '0.00'}</td>
                            <td className="table-cell">{sale.paymentMethod}</td>
                            <td className="table-cell">
                              <div className="flex space-x-2">
                                <button onClick={(e) => {
                                  e.stopPropagation(); // Prevent row from collapsing
                                  openEditSaleModal(sale);
                                }} className="text-indigo-600 hover:text-indigo-900 transition">
                                  Edit
                                </button>
                                <button onClick={(e) => {
                                  e.stopPropagation(); // Prevent row from collapsing
                                  handleDeleteSale(sale.id);
                                }} className="text-red-600 hover:text-red-900 transition">
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                          {/* Expanded details row */}
                          {expandedSaleId === sale.id && (
                            <tr className="bg-gray-50">
                              <td colSpan="6" className="p-4 border-t border-gray-200">
                                <h4 className="font-semibold text-gray-800 mb-2">Sale Details:</h4>
                                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                                  <li>Sold By: {sale.soldBy}</li>
                                  <li>Customer Name: {sale.customerName}</li>
                                  <li>Payment Method: {sale.paymentMethod}</li>
                                  <li>Remark: {sale.remark || 'N/A'}</li>
                                </ul>
                                <div className="mt-4 overflow-x-auto">
                                  <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                                        <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                                        <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price (RM)</th>
                                        <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                        <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount (RM)</th>
                                        <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total (RM)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {sale.items.map((item, itemIndex) => (
                                        <tr key={itemIndex}>
                                          <td className="py-2 px-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                                          <td className="py-2 px-4 whitespace-nowrap text-sm text-gray-500">{item.batchNumber || 'N/A'}</td>
                                          <td className="py-2 px-4 whitespace-nowrap text-sm text-gray-500">{item.originalPrice.toFixed(2)}</td>
                                          <td className="py-2 px-4 whitespace-nowrap text-sm text-gray-500">{item.quantity}</td>
                                          <td className="py-2 px-4 whitespace-nowrap text-sm text-gray-500">{item.discountApplied.toFixed(2)}</td>
                                          <td className="py-2 px-4 whitespace-nowrap text-sm text-gray-500">{(item.discountedPrice * item.quantity).toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {currentAdminView === 'users' && (
            <div className="bg-white p-6 rounded-2xl shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-700">Manage Users</h2>
                <button onClick={() => {
                  setShowAddUserModal(true);
                  setErrorMessage('');
                  setSuccessMessage('');
                }} className="btn-primary">
                  Add New User
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="table-header">User ID</th>
                      <th scope="col" className="table-header">Email</th>
                      <th scope="col" className="table-header">Role</th>
                      <th scope="col" className="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {usersInSystem.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-4 text-gray-500">No users found.</td>
                      </tr>
                    ) : (
                      usersInSystem.map(user => (
                        <tr key={user.id}>
                          <td className="table-cell">{user.id}</td>
                          <td className="table-cell">{user.email}</td>
                          <td className="table-cell">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="table-cell">
                            {user.id !== userId && (
                              <button
                                onClick={() => openEditUserRoleModal(user)}
                                className="text-indigo-600 hover:text-indigo-900 transition"
                              >
                                Edit Role
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Add Product Modal */}
        {showAddProductModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">Add New Product</h2>
              <div className="mb-4">
                <label htmlFor="newProductName" className="label-field">Product Name</label>
                <input type="text" id="newProductName" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} className="input-field" />
              </div>
              <div className="mb-4">
                <label htmlFor="newProductPrice" className="label-field">Price (RM)</label>
                <input type="number" id="newProductPrice" value={newProductPrice} onChange={(e) => setNewProductPrice(e.target.value)} step="0.01" className="input-field" />
              </div>
              <div className="mb-4">
                <label htmlFor="newProductStock" className="label-field">Stock</label>
                <input type="number" id="newProductStock" value={newProductStock} onChange={(e) => setNewProductStock(e.target.value)} min="0" className="input-field" />
              </div>
              <div className="mb-4">
                <label htmlFor="newProductBatchNumber" className="label-field">Batch Number</label>
                <input type="text" id="newProductBatchNumber" value={newProductBatchNumber} onChange={(e) => setNewProductBatchNumber(e.target.value)} className="input-field" />
              </div>
              <div className="mb-6">
                <label htmlFor="newProductStatus" className="label-field">Status</label>
                <select id="newProductStatus" value={newProductStatus} onChange={(e) => setNewProductStatus(e.target.value)} className="input-field">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button onClick={() => {
                  setShowAddProductModal(false);
                  setErrorMessage('');
                  setSuccessMessage('');
                }} className="btn-secondary">Cancel</button>
                <button onClick={handleAddNewProduct} className="btn-primary">Add Product</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Product Modal */}
        {showEditProductModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">Edit Product</h2>
              <div className="mb-4">
                <label htmlFor="editProductName" className="label-field">Product Name</label>
                <input type="text" id="editProductName" value={editProductName} onChange={(e) => setEditProductName(e.target.value)} className="input-field" />
              </div>
              <div className="mb-4">
                <label htmlFor="editProductPrice" className="label-field">Price (RM)</label>
                <input type="number" id="editProductPrice" value={editProductPrice} onChange={(e) => setEditProductPrice(e.target.value)} step="0.01" className="input-field" />
              </div>
              <div className="mb-4">
                <label htmlFor="editProductStock" className="label-field">Stock</label>
                <input type="number" id="editProductStock" value={editProductStock} onChange={(e) => setEditProductStock(e.target.value)} min="0" className="input-field" />
              </div>
              <div className="mb-4">
                <label htmlFor="editProductBatchNumber" className="label-field">Batch Number</label>
                <input type="text" id="editProductBatchNumber" value={editProductBatchNumber} onChange={(e) => setEditProductBatchNumber(e.target.value)} className="input-field" />
              </div>
              <div className="mb-6">
                <label htmlFor="editProductStatus" className="label-field">Status</label>
                <select id="editProductStatus" value={editProductStatus} onChange={(e) => setEditProductStatus(e.target.value)} className="input-field">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button onClick={() => {
                  setShowEditProductModal(false);
                  setErrorMessage('');
                  setSuccessMessage('');
                }} className="btn-secondary">Cancel</button>
                <button onClick={handleUpdateProduct} className="btn-primary">Update Product</button>
              </div>
            </div>
          </div>
        )}

        {/* Add User Modal */}
        {showAddUserModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">Add New User</h2>
              <div className="mb-4">
                <label htmlFor="newAddUserEmail" className="label-field">Email</label>
                <input type="email" id="newAddUserEmail" value={newAddUserEmail} onChange={(e) => setNewAddUserEmail(e.target.value)} placeholder="user@example.com" className="input-field" />
              </div>
              <div className="mb-4">
                <label htmlFor="newAddUserPassword" className="label-field">Password</label>
                <input type="password" id="newAddUserPassword" value={newAddUserPassword} onChange={(e) => setNewAddUserPassword(e.target.value)} placeholder="password" className="input-field" />
              </div>
              <div className="mb-4">
                <label htmlFor="newAddUserRole" className="label-field">Role</label>
                <select id="newAddUserRole" value={newAddUserRole} onChange={(e) => setNewAddUserRole(e.target.value)} className="input-field">
                  <option value="cashier">Cashier</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="mb-6">
                <label htmlFor="adminPasswordForUserCreation" className="label-field">Your Admin Password (for confirmation)</label>
                <input type="password" id="adminPasswordForUserCreation" value={adminPasswordForUserCreation} onChange={(e) => setAdminPasswordForUserCreation(e.target.value)} placeholder="Your admin password" className="input-field" />
              </div>
              <div className="flex justify-end space-x-3">
                <button onClick={() => {
                  setShowAddUserModal(false);
                  setErrorMessage('');
                  setSuccessMessage('');
                }} className="btn-secondary">Cancel</button>
                <button onClick={handleAddNewUser} className="btn-primary">Add User</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Role Modal */}
        {showEditUserRoleModal && editingUserForRole && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">Edit Role for {editingUserForRole.email || editingUserForRole.id.substring(0, 8) + '...'}</h2>
              <div className="mb-6">
                <label htmlFor="userRoleSelect" className="block text-sm font-medium text-gray-700">Select New Role</label>
                <select
                  id="userRoleSelect"
                  value={newRoleForUser}
                  onChange={(e) => setNewRoleForUser(e.target.value)}
                  className="input-field"
                >
                  <option value="admin">Admin</option>
                  <option value="cashier">Cashier</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowEditUserRoleModal(false);
                    setEditingUserForRole(null);
                    setNewRoleForUser('');
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateUserRole}
                  className="btn-primary"
                >
                  Update Role
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- MODALS FOR SALES EDITING AND DELETING --- */}
        {showEditSaleModal && editingSale && (
          <div className="modal-overlay">
            <div className="modal-content-lg">
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">Edit Sale Record (ID: {editingSale.id.substring(0, 8)}...)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label htmlFor="editSaleDate" className="label-field">Sale Date</label>
                  <input
                    type="date"
                    id="editSaleDate"
                    value={editSaleDate}
                    onChange={(e) => setEditSaleDate(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="editSaleCustomerName" className="label-field">Customer Name</label>
                  <input
                    type="text"
                    id="editSaleCustomerName"
                    value={editSaleCustomerName}
                    onChange={(e) => setEditSaleCustomerName(e.target.value)}
                    className="input-field"
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
                <div>
                  <label htmlFor="editSaleRemark" className="label-field">Remark</label>
                  <input
                    type="text"
                    id="editSaleRemark"
                    value={editSaleRemark}
                    onChange={(e) => setEditSaleRemark(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-700 mb-2">Sale Items</h3>
              <div className="overflow-x-auto mb-6 max-h-60 overflow-y-auto border rounded-lg">
                <table className="min-w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                      <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                      <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                      <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount (RM)</th>
                      <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Final Price</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {editSaleItems.map((item, index) => (
                      <tr key={index}>
                        <td className="py-2 px-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                        <td className="py-2 px-4 whitespace-nowrap">
                          <input
                            type="text"
                            value={item.batchNumber}
                            readOnly // Batch number is now read-only
                            className="input-field-table bg-gray-100 cursor-not-allowed"
                          />
                        </td>
                        <td className="py-2 px-4 whitespace-nowrap">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleUpdateEditSaleItem(index, 'quantity', e.target.value)}
                            min="1"
                            className="input-field-table w-16"
                          />
                        </td>
                        <td className="py-2 px-4 whitespace-nowrap">
                          <input
                            type="number"
                            value={item.discountApplied}
                            onChange={(e) => handleUpdateEditSaleItem(index, 'discountApplied', e.target.value)}
                            min="0"
                            step="0.01"
                            className="input-field-table w-20"
                          />
                        </td>
                        <td className="py-2 px-4 whitespace-nowrap text-sm text-gray-500">
                          RM{(item.discountedPrice * item.quantity).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end items-center text-lg font-bold text-gray-800">
                New Total: RM{editSaleItems.reduce((sum, item) => sum + (item.discountedPrice * item.quantity), 0).toFixed(2)}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditSaleModal(false);
                    setEditingSale(null);
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button onClick={handleConfirmEditSale} className="btn-primary">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {showConfirmEditSaleModal && pendingSaleUpdate && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">Confirm Changes</h2>
              <p className="text-gray-600 mb-6">Are you sure you want to update this sale record? This action cannot be undone.</p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowConfirmEditSaleModal(false);
                    setShowEditSaleModal(true); // Go back to the edit form
                    setPendingSaleUpdate(null);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button onClick={confirmUpdateSale} className="btn-primary">
                  Confirm Update
                </button>
              </div>
            </div>
          </div>
        )}
        
        {showConfirmDeleteModal && deletingSaleId && (
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
        {/* --- END NEW MODALS --- */}
      </div>
    );
  };

  // --- MAIN APP RENDER LOGIC ---
  if (loading || !isAuthReady) {
    return <Loader />;
  }

  if (!isAuthenticated) {
    return <AuthForm />;
  }

  if (userRole === 'admin') {
    return <AdminPanel />;
  }

  if (userRole === 'cashier') {
    return <CashierPanel />;
  }

  // Fallback for unhandled states
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 font-[Inter]">
      <p className="text-red-500">Authentication state is unexpected. Please try again.</p>
    </div>
  );
}
