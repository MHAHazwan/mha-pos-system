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
          productsData = productsData.filter(product => product.status === 'Active');
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

        transaction.set(doc(salesCollectionRef), {
          items: saleItems,
          total: parseFloat(finalSaleTotal.toFixed(2)),
          timestamp: serverTimestamp(),
          customerName: customerName.trim(),
          paymentMethod: paymentMethod,
          purchaseDate: purchaseDate,
          soldBy: auth.currentUser?.email || 'Unknown Cashier', // Record who made the sale
          soldById: userId, // Record the ID of who made the sale
        });
      });

      setCart([]);
      setCustomerName('');
      setPaymentMethod('Cash');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
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
      await setDoc(userRoleDocRef, { role: newAddUserRole, email: newAddUserEmail.trim() });

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
      await updateDoc(userRoleDocRef, { role: newRoleForUser });
      setShowEditUserRoleModal(false);
      setEditingUserForRole(null);
      setNewRoleForUser('');
      setErrorMessage('');
      setSuccessMessage(`Role for ${editingUserForRole.email || editingUserForRole.id} updated to ${newRoleForUser}!`);
    } catch (error) {
      console.error("Error updating user role:", error);
      setErrorMessage("Failed to update user role. Please try again.");
    }
  };

  const handleDeleteUser = async (userToDelete) => {
    if (!db) {
      setErrorMessage("Database not ready. Please wait or refresh.");
      return;
    }
    // Prevent admin from deleting themselves
    if (userToDelete.id === userId) {
      setErrorMessage("You cannot delete your own account from here.");
      return;
    }

    if (window.confirm(`Are you sure you want to delete user ${userToDelete.email || userToDelete.id}? This action cannot be undone.`)) {
      try {
        // IMPORTANT: This only deletes the user's role document from Firestore.
        // It does NOT delete the actual Firebase Authentication user account.
        // Deleting a Firebase Auth user (for another user) requires server-side operations (e.g., Cloud Functions)
        // for security reasons. For this demo, removing the role document effectively prevents
        // them from logging into the POS system.
        const userRoleDocRef = doc(db, `artifacts/${window.__app_id}/user_roles`, userToDelete.id);
        await deleteDoc(userRoleDocRef);
        setErrorMessage('');
        setSuccessMessage(`User ${userToDelete.email || userToDelete.id} "deleted" successfully (role removed).`);
      } catch (error) {
        console.error("Error deleting user:", error);
        setErrorMessage("Failed to delete user. Please try again.");
      }
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-lg font-semibold text-gray-700">Loading POS System...</div>
      </div>
    );
  }

  // Render role selection or login/signup form if not authenticated
  if (!isAuthenticated) {
    // Show role selection buttons if no role has been attempted yet
    if (!selectedRoleAttempt) {
      return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 font-sans relative">
          <style>
            {`
              html, body { margin: 0; padding: 0; }
              body { font-family: 'Inter', sans-serif; }
              .login-btn {
                @apply bg-gray-200 text-gray-800 font-bold py-4 px-8 rounded-xl shadow-lg transition duration-300 ease-in-out text-xl transform hover:scale-105 border border-gray-400;
              }
              .login-btn:hover {
                @apply bg-black text-white;
              }
              .card {
                @apply bg-white p-8 rounded-2xl shadow-2xl;
              }
            `}
          </style>
          <div className="card w-full max-w-md p-8 text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-2">Hazwan & Alani's Kitchen</h1>
            <h2 className="text-3xl font-bold text-gray-800 mb-8">Choose Your Role</h2>
            <div className="flex flex-col space-y-4">
              <button
                onClick={() => setSelectedRoleAttempt('admin')}
                className="login-btn"
              >
                Login as Admin
              </button>
              <button
                onClick={() => setSelectedRoleAttempt('cashier')}
                className="login-btn"
              >
                Login as Cashier
              </button>
            </div>
          </div>

          <div className="absolute bottom-4 w-full text-center">
            <p className="text-sm text-gray-600">MHA POS System &copy; created by Muhammad Hazwan Arif</p>
          </div>
        </div>
      );
    }

    // Show login form after a role has been selected (no signup option here)
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans">
        <style>
          {`
            html, body { margin: 0; padding: 0; }
            body { font-family: 'Inter', sans-serif; }
            .btn-primary {
              @apply bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out;
            }
            .btn-secondary {
              @apply bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out;
            }
            .input-field {
              @apply mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm;
            }
            .card {
              @apply bg-white p-6 rounded-xl shadow-lg;
            }
            .message-box {
              @apply px-4 py-3 rounded-lg relative mb-4 w-full max-w-md;
            }
            .message-box.error {
              @apply bg-red-100 border border-red-400 text-red-700;
            }
            .message-box.success {
              @apply bg-green-100 border border-green-400 text-green-700;
            }
          `}
        </style>
        <div className="card w-full max-w-md">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
            {showForgotPassword ? 'Reset Password' : `Login as ${selectedRoleAttempt}`}
          </h2>
          {errorMessage && (
            <div className="message-box error" role="alert">
              <span className="block sm:inline">{errorMessage}</span>
              <span className="absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer" onClick={() => setErrorMessage('')}>
                <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.697l-2.651 3.152a1.2 1.2 0 1 1-1.697-1.697L8.303 10 5.152 7.348a1.2 1.2 0 0 1 1.697-1.697L10 8.303l2.651-3.152a1.2 1.2 0 1 1 1.697 1.697L11.697 10l3.152 2.651a1.2 1.2 0 0 1 0 1.698z"/></svg>
              </span>
            </div>
          )}
          {successMessage && (
            <div className="message-box success" role="alert">
              <span className="block sm:inline">{successMessage}</span>
              <span className="absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer" onClick={() => setSuccessMessage('')}>
                <svg className="fill-current h-6 w-6 text-green-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.697l-2.651 3.152a1.2 1.2 0 1 1-1.697-1.697L8.303 10 5.152 7.348a1.2 1.2 0 0 1 1.697-1.697L10 8.303l2.651-3.152a1.2 1.2 0 1 1 1.697 1.697L11.697 10l3.152 2.651a1.2 1.2 0 0 1 0 1.698z"/></svg>
          </span>
        </div>
      )}

      {!showForgotPassword ? (
        <>
          {/* Email input */}
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="your@example.com"
            />
          </div>
          {/* Password input */}
          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="********"
            />
          </div>
          <button onClick={handleAuthAction} className="btn-primary w-full mb-4">
            Login
          </button>
          <p className="text-center text-sm text-gray-600 mt-2">
            <span
              className="text-blue-600 hover:text-blue-800 cursor-pointer font-medium"
              onClick={() => {
                setShowForgotPassword(true);
                setErrorMessage('');
                setSuccessMessage('');
                setEmail('');
              }}
            >
              Forgot Password?
            </span>
          </p>
        </>
      ) : ( // Forgot Password UI
        <>
          <div className="mb-4">
            <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-700">Email Address</label>
            <input
              type="email"
              id="resetEmail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="your@example.com"
            />
          </div>
          <button onClick={handlePasswordReset} className="btn-primary w-full mb-4">
            Send Reset Email
          </button>
          <button
            onClick={() => {
              setShowForgotPassword(false);
              setErrorMessage('');
              setSuccessMessage('');
              setEmail('');
              setPassword('');
            }}
            className="btn-secondary w-full"
          >
            Back to Login
          </button>
        </>
      )}
      <button
        onClick={() => {
          setSelectedRoleAttempt(null);
          setShowForgotPassword(false);
          setErrorMessage('');
          setSuccessMessage('');
          setEmail('');
          setPassword('');
        }}
        className="btn-secondary w-full mt-4"
      >
        Back to Role Selection
      </button>
    </div>
  </div>
);
}

// Render main POS app if authenticated
return (
  <div className="min-h-screen bg-gray-100 p-4 font-sans flex flex-col items-center">
    <style>
      {`
        html, body { margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; }
        .btn {
          @apply font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105;
        }
        .btn-primary {
          @apply bg-blue-600 text-white;
        }
        .btn-primary:hover {
          @apply bg-blue-700;
        }
        .btn-secondary {
          @apply bg-gray-300 text-gray-800;
        }
        .btn-secondary:hover {
          @apply bg-gray-400;
        }
        .btn-danger {
          @apply bg-red-500 text-white;
        }
        .btn-danger:hover {
          @apply bg-red-600;
        }
        .card {
          @apply bg-white p-6 rounded-xl shadow-lg;
        }
        .input-field {
          @apply mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm;
        }
        /* Enhanced product card for better aesthetics */
        .product-card {
          @apply border border-gray-200 rounded-xl p-4 flex flex-col justify-between shadow-md hover:shadow-xl transition-all duration-300 ease-in-out bg-white;
        }
        .product-card button {
          @apply text-sm py-1 px-3 rounded-md transition-colors duration-200;
        }
        .product-card .btn-add-to-cart {
          @apply bg-green-500 text-white hover:bg-green-600;
        }
        .product-card .btn-edit {
          @apply bg-yellow-500 text-white hover:bg-yellow-600;
        }
        .product-card .btn-delete {
          @apply bg-red-500 text-white hover:bg-red-600;
        }
        .message-box {
          @apply px-4 py-3 rounded-lg relative mb-4 w-full max-w-md;
        }
        .message-box.error {
          @apply bg-red-100 border border-red-400 text-red-700;
        }
        .message-box.success {
          @apply bg-green-100 border border-green-400 text-green-700;
        }
        /* Styles for active navigation button */
        .nav-button.active {
          @apply bg-blue-600 text-white;
        }
        .nav-button {
          @apply py-2 px-4 rounded-lg font-semibold transition duration-200 ease-in-out;
        }
        /* Table specific enhancements */
        .table-header {
          @apply py-3 px-6 text-left text-gray-600 uppercase text-sm leading-normal font-bold;
        }
        .table-row-cell {
          @apply py-3 px-6 text-gray-700 text-sm;
        }
        .table-row:nth-child(even) {
          @apply bg-gray-50;
        }
        .table-row:hover {
          @apply bg-gray-100;
        }
      `}
    </style>

    <div className="w-full max-w-6xl flex justify-between items-start mb-8 mt-4">
      <h1 className="text-4xl font-bold text-gray-800">MHA POS System</h1>
      <div className="flex flex-col items-end space-y-1">
        {auth.currentUser?.email && <span className="text-gray-700 font-medium">Logged in as: {auth.currentUser.email}</span>}
        {userRole && <span className="text-gray-700 font-medium capitalize">Role: {userRole}</span>}
        <button onClick={handleSignOut} className="btn-secondary mt-2">
          Logout
        </button>
      </div>
    </div>

    {errorMessage && (
      <div className="message-box error w-full max-w-4xl" role="alert">
        <span className="block sm:inline">{errorMessage}</span>
        <span className="absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer" onClick={() => setErrorMessage('')}>
          <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.697l-2.651 3.152a1.2 1.2 0 1 1-1.697-1.697L8.303 10 5.152 7.348a1.2 1.2 0 0 1 1.697-1.697L10 8.303l2.651-3.152a1.2 1.2 0 1 1 1.697 1.697L11.697 10l3.152 2.651a1.2 1.2 0 0 1 0 1.698z"/></svg>
        </span>
      </div>
    )}
    {successMessage && (
      <div className="message-box success" role="alert">
        <span className="block sm:inline">{successMessage}</span>
        <span className="absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer" onClick={() => setSuccessMessage('')}>
          <svg className="fill-current h-6 w-6 text-green-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.697l-2.651 3.152a1.2 1.2 0 1 1-1.697-1.697L8.303 10 5.152 7.348a1.2 1.2 0 0 1 1.697-1.697L10 8.303l2.651-3.152a1.2 1.2 0 1 1 1.697 1.697L11.697 10l3.152 2.651a1.2 1.2 0 0 1 0 1.698z"/></svg>
        </span>
      </div>
    )}

    {/* Admin Dashboard Navigation */}
    {userRole === 'admin' && (
      <div className="w-full max-w-6xl mb-8 flex justify-center space-x-4">
        <button
          onClick={() => setCurrentAdminView('products')}
          className={`nav-button ${currentAdminView === 'products' ? 'active bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
        >
          Product Management
        </button>
        <button
          onClick={() => setCurrentAdminView('sales')}
          className={`nav-button ${currentAdminView === 'sales' ? 'active bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
        >
          Sales History
        </button>
        <button
          onClick={() => setCurrentAdminView('users')}
          className={`nav-button ${currentAdminView === 'users' ? 'active bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
        >
          User Management
        </button>
      </div>
    )}

    {/* Main Content Area based on Role and Admin View */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full max-w-6xl">
      {/* Cashier Panel: Current Sale (always visible for cashier, never for admin) */}
      {userRole === 'cashier' && (
        <div className="lg:col-span-3 card"> {/* Cashier panel takes full width */}
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Current Sale</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Products List for Cashier */}
            <div className="col-span-1">
              <h3 className="text-xl font-medium text-gray-700 mb-3">Available Products</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2">
                {products.length === 0 ? (
                  <p className="text-gray-500">No products available.</p>
                ) : (
                  products.map(product => (
                    <div key={product.id} className="product-card">
                      <div>
                        <h4 className="text-lg font-medium text-gray-800">{product.name}</h4>
                        <p className="text-gray-600 text-xl font-bold mt-1">RM {product.price.toFixed(2)}</p>
                        <p className={`text-sm mt-1 ${product.stock <= 5 && product.stock > 0 ? 'text-orange-500 font-semibold' : product.stock === 0 ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                          Stock: {product.stock}
                        </p>
                        {product.batchNumber && (
                          <p className="text-sm text-gray-500">Batch: {product.batchNumber}</p>
                        )}
                        <p className="text-sm text-gray-500">Status: {product.status || 'Active'}</p>
                      </div>
                      <div className="flex justify-end mt-3">
                        <button
                          onClick={() => addProductToCart(product)}
                          className="btn-add-to-cart"
                          disabled={product.stock <= 0}
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Cart & Checkout for Cashier */}
            <div className="col-span-1">
              <h3 className="text-xl font-medium text-gray-700 mb-3">Cart</h3>
              {cart.length === 0 ? (
                <p className="text-gray-500">Cart is empty. Add products from the left.</p>
              ) : (
                <>
                  <ul className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2">
                    {cart.map(item => (
                      <li key={item.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                        <div className="flex-grow">
                          <p className="font-medium text-gray-800">{item.name}</p>
                          {item.batchNumber && (
                            <p className="text-xs text-gray-500">Batch: {item.batchNumber}</p>
                          )}
                          <p className="text-sm text-gray-600">RM {item.price.toFixed(2)} x {item.quantity}</p>
                          <div className="mt-2 flex items-center">
                            <label htmlFor={`discount-${item.id}`} className="block text-sm font-medium text-gray-700 mr-2">Discount (RM):</label>
                            <input
                              type="number"
                              id={`discount-${item.id}`}
                              value={item.discountApplied}
                              onChange={(e) => updateCartItemDiscount(item.id, e.target.value)}
                              className="w-24 px-2 py-1 border border-gray-300 rounded-md text-sm"
                              step="0.01"
                              min="0"
                              max={item.price} // Max discount is item price
                            />
                          </div>
                        </div>
                        <div className="flex items-center">
                          <button
                            onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                            className="bg-gray-200 text-gray-700 w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-300 transition"
                          >
                            -
                          </button>
                          <span className="mx-2 font-semibold">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                            className="bg-gray-200 text-gray-700 w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-300 transition"
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="ml-3 text-red-500 hover:text-red-700"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {/* Customer Name, Payment Method, Purchase Date Inputs */}
                  <div className="mb-4">
                    <label htmlFor="customerName" className="block text-sm font-medium text-gray-700">Customer Name</label>
                    <input
                      type="text"
                      id="customerName"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="input-field"
                      placeholder="Enter customer name"
                    />
                  </div>
                  <div className="mb-4">
                    <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700">Payment Method</label>
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
                  <div className="mb-6">
                    <label htmlFor="purchaseDate" className="block text-sm font-medium text-gray-700">Purchase Date</label>
                    <input
                      type="date"
                      id="purchaseDate"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="input-field"
                    />
                  </div>

                  <div className="text-right text-2xl font-bold text-gray-800 mb-6">
                    Total: RM {total.toFixed(2)}
                  </div>
                  <div className="flex justify-between space-x-2">
                    <button onClick={checkout} className="btn-primary flex-grow">
                      Checkout
                    </button>
                    <button onClick={clearSale} className="btn-secondary flex-grow">
                      Clear Sale
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin Panel: Products Section */}
      {userRole === 'admin' && currentAdminView === 'products' && (
        <div className="lg:col-span-3 card">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Products Management</h2>
          <button
            onClick={() => setShowAddProductModal(true)}
            className="btn-primary mb-4 flex items-center"
          >
            <span className="mr-2">+</span> Add New Product
          </button>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.length === 0 ? (
              <p className="text-gray-500 col-span-full">No products added yet. Add some to get started!</p>
            ) : (
              products.map(product => (
                <div key={product.id} className="product-card">
                  <div>
                    <h3 className="text-lg font-medium text-gray-800">{product.name}</h3>
                    <p className="text-gray-600 text-xl font-bold mt-1">RM {product.price.toFixed(2)}</p>
                    <p className={`text-sm mt-1 ${product.stock <= 5 && product.stock > 0 ? 'text-orange-500 font-semibold' : product.stock === 0 ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                          Stock: {product.stock}
                        </p>
                        {product.batchNumber && (
                          <p className="text-sm text-gray-500">Batch: {product.batchNumber}</p>
                        )}
                        <p className="text-sm text-gray-500">Status: {product.status || 'Active'}</p>
                      </div>
                      <div className="flex justify-between items-center mt-3">
                        <button
                          onClick={() => openEditProductModal(product)}
                          className="btn-edit"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="btn-danger ml-2"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Admin Panel: Sales History Section */}
          {userRole === 'admin' && currentAdminView === 'sales' && (
            <div className="lg:col-span-3 card">
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">Sales History</h2>
              {sales.length === 0 ? (
                <p className="text-gray-500">No sales recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white rounded-lg shadow-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="table-header">Sale ID</th>
                        <th className="table-header">Date</th>
                        <th className="table-header">Customer</th>
                        <th className="table-header">Method</th>
                        <th className="table-header">Sold By</th>
                        <th className="table-header">Items</th>
                        <th className="table-header">Total</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700">
                      {sales.map(sale => (
                        <tr key={sale.id} className="border-b border-gray-200 table-row">
                          <td className="table-row-cell">{sale.id.substring(0, 8)}...</td>
                          <td className="table-row-cell">
                            {sale.timestamp ? new Date(sale.timestamp.toDate()).toLocaleString() : 'N/A'}
                          </td>
                          <td className="table-row-cell">{sale.customerName || 'N/A'}</td>
                          <td className="table-row-cell">{sale.paymentMethod || 'N/A'}</td>
                          <td className="table-row-cell">{sale.soldBy || 'N/A'}</td>
                          <td className="table-row-cell">
                            <ul className="list-disc list-inside space-y-1">
                              {sale.items.map((item, index) => (
                                <li key={index}>
                                  {item.name} (x{item.quantity}) - RM {item.originalPrice.toFixed(2)} each
                                  {item.discountApplied > 0 && ` (-RM ${item.discountApplied.toFixed(2)} discount)`}
                                  {item.batchNumber && ` (Batch: ${item.batchNumber})`}
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className="table-row-cell font-semibold">RM {sale.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Admin Panel: User Management Section */}
          {userRole === 'admin' && currentAdminView === 'users' && (
            <div className="lg:col-span-3 card">
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">User Management</h2>
              <button
                onClick={() => setShowAddUserModal(true)}
                className="btn-primary mb-4 flex items-center"
              >
                <span className="mr-2">+</span> Sign Up New User
              </button>
              {usersInSystem.length === 0 ? (
                <p className="text-gray-500">No users registered yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white rounded-lg shadow-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="table-header">User ID</th>
                        <th className="table-header">Email</th>
                        <th className="table-header">Role</th>
                        <th className="table-header">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700">
                      {usersInSystem.map(user => (
                        <tr key={user.id} className="border-b border-gray-200 table-row">
                          <td className="table-row-cell">{user.id.substring(0, 8)}...</td>
                          <td className="table-row-cell">{user.email || 'N/A'}</td>
                          <td className="table-row-cell capitalize">{user.role}</td>
                          <td className="table-row-cell flex space-x-2">
                            <button
                              onClick={() => openEditUserRoleModal(user)}
                              className="btn-edit text-xs"
                            >
                              Edit Role
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user)}
                              className="btn-danger text-xs"
                            >
                              Delete User
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add Product Modal */}
        {showAddProductModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="card w-full max-w-md">
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">Add New Product</h2>
              <div className="mb-4">
                <label htmlFor="productName" className="block text-sm font-medium text-gray-700">Product Name</label>
                <input
                  type="text"
                  id="productName"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="input-field"
                  placeholder="e.g., Coffee"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="productPrice" className="block text-sm font-medium text-gray-700">Price (RM)</label>
                <input
                  type="number"
                  id="productPrice"
                  value={newProductPrice}
                  onChange={(e) => setNewProductPrice(e.target.value)}
                  className="input-field"
                  placeholder="e.g., 5.50"
                  step="0.01"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="productStock" className="block text-sm font-medium text-gray-700">Initial Stock</label>
                <input
                  type="number"
                  id="productStock"
                  value={newProductStock}
                  onChange={(e) => setNewProductStock(e.target.value)}
                  className="input-field"
                  placeholder="e.g., 100"
                  step="1"
                  min="0"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="productBatchNumber" className="block text-sm font-medium text-gray-700">Batch Number (Optional)</label>
                <input
                  type="text"
                  id="productBatchNumber"
                  value={newProductBatchNumber}
                  onChange={(e) => setNewProductBatchNumber(e.target.value)}
                  className="input-field"
                  placeholder="e.g., BATCH-2023-001"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="productStatus" className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  id="productStatus"
                  value={newProductStatus}
                  onChange={(e) => setNewProductStatus(e.target.value)}
                  className="input-field"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowAddProductModal(false);
                    setNewProductName('');
                    setNewProductPrice('');
                    setNewProductStock('');
                    setNewProductBatchNumber('');
                    setNewProductStatus('Active'); // Reset to default
                    setErrorMessage(''); // Clear error when closing modal
                    setSuccessMessage('');
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNewProduct}
                  className="btn-primary"
                >
                  Add Product
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Product Modal */}
        {showEditProductModal && editingProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="card w-full max-w-md">
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">Edit Product</h2>
              <div className="mb-4">
                <label htmlFor="editProductName" className="block text-sm font-medium text-gray-700">Product Name</label>
                <input
                  type="text"
                  id="editProductName"
                  value={editProductName}
                  onChange={(e) => setEditProductName(e.target.value)}
                  className="input-field"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="editProductPrice" className="block text-sm font-medium text-gray-700">Price (RM)</label>
                <input
                  type="number"
                  id="editProductPrice"
                  value={editProductPrice}
                  onChange={(e) => setEditProductPrice(e.target.value)}
                  className="input-field"
                  step="0.01"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="editProductStock" className="block text-sm font-medium text-gray-700">Current Stock</label>
                <input
                  type="number"
                  id="editProductStock"
                  value={editProductStock}
                  onChange={(e) => setEditProductStock(e.target.value)}
                  className="input-field"
                  step="1"
                  min="0"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="editProductBatchNumber" className="block text-sm font-medium text-gray-700">Batch Number (Optional)</label>
                <input
                  type="text"
                  id="editProductBatchNumber"
                  value={editProductBatchNumber}
                  onChange={(e) => setEditProductBatchNumber(e.target.value)}
                  className="input-field"
                  placeholder="e.g., BATCH-2023-001"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="editProductStatus" className="block text-sm font-medium text-gray-700">Status</label>
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
                <button
                  onClick={() => {
                    setShowEditProductModal(false);
                    setEditingProduct(null);
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateProduct}
                  className="btn-primary"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add New User Modal (Admin Only) */}
        {userRole === 'admin' && showAddUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="card w-full max-w-md">
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">Add New User</h2>
              <div className="mb-4">
                <label htmlFor="newAddUserEmail" className="block text-sm font-medium text-gray-700">New User Email</label>
                <input
                  type="email"
                  id="newAddUserEmail"
                  value={newAddUserEmail}
                  onChange={(e) => setNewAddUserEmail(e.target.value)}
                  className="input-field"
                  placeholder="user@example.com"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="newAddUserPassword" className="block text-sm font-medium text-gray-700">New User Password</label>
                <input
                  type="password"
                  id="newAddUserPassword"
                  value={newAddUserPassword}
                  onChange={(e) => setNewAddUserPassword(e.target.value)}
                  className="input-field"
                  placeholder="********"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="newAddUserRole" className="block text-sm font-medium text-gray-700">New User Role</label>
                <select
                  id="newAddUserRole"
                  value={newAddUserRole}
                  onChange={(e) => setNewAddUserRole(e.target.value)}
                  className="input-field"
                >
                  <option value="cashier">Cashier</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="mb-6">
                <label htmlFor="adminPasswordForUserCreation" className="block text-sm font-medium text-gray-700">Your Admin Password (for confirmation)</label>
                <input
                  type="password"
                  id="adminPasswordForUserCreation"
                  value={adminPasswordForUserCreation}
                  onChange={(e) => setAdminPasswordForUserCreation(e.target.value)}
                  className="input-field"
                  placeholder="********"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowAddUserModal(false);
                    setNewAddUserEmail('');
                    setNewAddUserPassword('');
                    setNewAddUserRole('cashier');
                    setAdminPasswordForUserCreation(''); // Clear admin password
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNewUser}
                  className="btn-primary"
                >
                  Create User
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Edit User Role Modal */}
        {userRole === 'admin' && showEditUserRoleModal && editingUserForRole && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="card w-full max-w-md">
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
      </div>
    );
    }
